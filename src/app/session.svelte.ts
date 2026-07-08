import {
  applyMove,
  createGame,
  legalMoves,
  makeCtx,
  publicHash,
  redact,
} from '../engine'
import type { Ctx, GameConfig, GameState, Move, PlayerId } from '../engine'
import { opponent } from '../engine/types'
import { getTerrain } from '../terrains'
import { PROTOCOL_VERSION, type NetMsg, type Transport, type WireMove } from '../transport/types'
import { connectRoom } from '../transport/trystero'
import { clearGame, loadGame, saveGame, shuffledReserve, type SavedGame } from './secrets'

export type SfxEvent = 'place' | 'cover' | 'draw' | 'discard' | 'medal' | 'win' | 'lose' | 'freeze'

export type OnlineStatus =
  | 'connecting' // joined room, waiting for a peer
  | 'handshake'  // peer present, deciding host / exchanging config
  | 'playing'
  | 'peer-left'
  | 'desync'
  | 'room-full'

const RULES_VERSION = '1'

abstract class BaseSession {
  ctx: Ctx
  state = $state<GameState>() as GameState
  events = $state<{ id: number; sfx: SfxEvent }[]>([])
  private eventId = 0

  constructor(ctx: Ctx, initial: GameState) {
    this.ctx = ctx
    this.state = initial
  }

  abstract readonly mode: 'hotseat' | 'online'
  /** The seat this client plays, or null in hot-seat (plays both). */
  abstract get mySide(): PlayerId | null
  /** Whose tiles the UI is allowed to show right now. */
  abstract get viewer(): PlayerId

  get terrain() {
    return this.ctx.terrain
  }

  get visibleState(): GameState {
    return redact(this.state, this.viewer)
  }

  get actor(): PlayerId {
    return this.state.pending?.actor ?? this.state.turn
  }

  /** Can the local human act right now? */
  get myTurn(): boolean {
    return this.mySide === null || this.actor === this.mySide
  }

  myMoves(): Move[] {
    if (!this.myTurn || this.state.result) return []
    return legalMoves(this.ctx, this.state, this.actor)
  }

  protected emit(sfx: SfxEvent) {
    this.events = [...this.events.slice(-4), { id: this.eventId++, sfx }]
  }

  protected applyLocal(actor: PlayerId, move: Move): void {
    const before = this.state
    const after = applyMove(this.ctx, before, actor, move)
    this.state = after

    // derive sound effects from the transition
    if (move.type === 'draw') this.emit('draw')
    if (move.type === 'place' || (move.type === 'choice' && 'place' in move.value)) {
      const base = move.type === 'place' ? move.base : (move.value as { place: { base: string } }).place.base
      this.emit((after.board[base]?.length ?? 1) > 1 ? 'cover' : 'place')
    }
    const discards = (s: GameState) => s.players.red.discard.length + s.players.blue.discard.length
    if (discards(after) > discards(before)) this.emit('discard')
    const medals = (s: GameState) => s.players.red.medals + s.players.blue.medals
    if (medals(after) > medals(before)) this.emit('medal')
    if (Object.keys(after.frozen).length > Object.keys(before.frozen).length) this.emit('freeze')
    if (!before.result && after.result) {
      const winner = after.result.winner
      this.emit(this.mySide === null || winner === this.mySide ? 'win' : 'lose')
    }

    queueMicrotask(() => this.autoRespond())
  }

  /** Moves the engine forces (reveals, empty choices, stalemate declarations). */
  protected autoRespond(): void {
    if (this.state.result) return
    const actor = this.actor
    if (this.mySide !== null && actor !== this.mySide) return
    const moves = legalMoves(this.ctx, this.state, actor)
    const pend = this.state.pending

    // XB-42: the reveal is forced — no human decision involved
    if (pend?.kind === 'xb42Reveal' && moves.length === 1) {
      setTimeout(() => this.trySubmit(moves[0]), 600)
      return
    }
    // Optional effect with nothing to pick: auto-skip
    if (pend && moves.length === 1 && moves[0].type === 'skip') {
      setTimeout(() => this.trySubmit(moves[0]), 300)
      return
    }
    // Stuck: declare stalemate
    if (!pend && moves.length === 1 && moves[0].type === 'stalemate') {
      setTimeout(() => this.trySubmit(moves[0]), 600)
    }
  }

  private trySubmit(move: Move): void {
    // state may have advanced while the timer ran; validate again
    try {
      this.submit(move)
    } catch {
      /* superseded */
    }
  }

  abstract submit(move: Move): void
  destroy(): void {}
}

/* ------------------------------------------------------------------ */

export class HotseatSession extends BaseSession {
  readonly mode = 'hotseat'
  openRacks: boolean
  /** Which player last confirmed the hand-off curtain. */
  acknowledged = $state<PlayerId>('red')

  constructor(terrainId: string, openRacks: boolean) {
    const ctx = makeCtx(getTerrain(terrainId))
    const cfg: GameConfig = {
      terrainId,
      sharedSeed: crypto.getRandomValues(new Uint32Array(1))[0],
      startingPlayer: Math.random() < 0.5 ? 'red' : 'blue',
      rulesVersion: RULES_VERSION,
    }
    const state = createGame(ctx, cfg, { red: shuffledReserve(), blue: shuffledReserve() })
    super(ctx, state)
    this.openRacks = openRacks
    this.acknowledged = state.turn
  }

  get mySide(): null {
    return null
  }

  get viewer(): PlayerId {
    return this.state.turn
  }

  get handoffNeeded(): boolean {
    return !this.openRacks && !this.state.result && this.state.turn !== this.acknowledged
  }

  get visibleState(): GameState {
    return this.openRacks ? this.state : redact(this.state, this.viewer)
  }

  submit(move: Move): void {
    this.applyLocal(this.actor, move)
  }
}

/* ------------------------------------------------------------------ */

export class OnlineSession extends BaseSession {
  readonly mode = 'online'
  readonly room: string
  status = $state<OnlineStatus>('connecting')
  peerHere = $state(false)
  side = $state<PlayerId>('red')
  rematchWanted = $state(false)

  private transport: Transport
  private log: WireMove[] = []
  private gameId = ''
  private cfg: GameConfig | null = null
  private reserve: ReturnType<typeof shuffledReserve> | null = null
  private myNonce = crypto.getRandomValues(new Uint32Array(1))[0]
  private peerNonce: number | null = null
  private creator: boolean
  private peerCreator = false
  private started = false

  constructor(room: string, creator: boolean, transport?: Transport) {
    // placeholder state until config arrives (or a saved game restores)
    const placeholderCtx = makeCtx(getTerrain('castle-field'))
    const saved = loadGame(room)
    if (saved) {
      const ctx = makeCtx(getTerrain(saved.cfg.terrainId))
      const state = replayLog(ctx, saved)
      super(ctx, state)
      this.cfg = saved.cfg
      this.gameId = saved.gameId
      this.side = saved.side
      this.reserve = saved.reserve
      this.log = saved.log
      this.started = true
    } else {
      super(
        placeholderCtx,
        createGame(
          placeholderCtx,
          { terrainId: 'castle-field', sharedSeed: 0, startingPlayer: 'red', rulesVersion: RULES_VERSION },
          {},
        ),
      )
    }
    this.room = room
    this.creator = creator
    this.transport = transport ?? connectRoom(room)
    this.transport.onPeerJoin(() => {
      this.peerHere = true
      if (this.status === 'connecting') this.status = 'handshake'
      this.sendHello()
    })
    this.transport.onPeerLeave(() => {
      this.peerHere = false
      if (this.status === 'playing') this.status = 'peer-left'
    })
    this.transport.onMessage((msg) => this.onMessage(msg))
  }

  get mySide(): PlayerId {
    return this.side
  }

  get viewer(): PlayerId {
    return this.side
  }

  get playing(): boolean {
    return this.started && (this.status === 'playing' || this.status === 'peer-left')
  }

  private sendHello() {
    this.transport.send({
      t: 'hello',
      nonce: this.myNonce,
      protocol: PROTOCOL_VERSION,
      creator: this.creator,
      haveGame: this.started ? this.gameId : null,
    })
  }

  private get isHost(): boolean {
    // the room creator hosts; nonce comparison only breaks creator-flag ties
    if (this.creator !== this.peerCreator) return this.creator
    if (this.peerNonce === null) return this.creator
    return this.myNonce > this.peerNonce
  }

  private onMessage(msg: NetMsg): void {
    switch (msg.t) {
      case 'hello': {
        this.peerHere = true
        this.peerNonce = msg.nonce
        this.peerCreator = msg.creator
        if (this.status === 'connecting') this.status = 'handshake'
        if (this.started) {
          // resume: push our full log; the peer adopts it if it's ahead of theirs
          this.transport.send({
            t: 'resync',
            gameId: this.gameId,
            cfg: this.cfg!,
            yourSide: opponent(this.side),
            log: this.log,
          })
          this.status = 'playing'
        } else if (this.isHost) {
          this.startNewGame(msg.nonce)
        }
        return
      }
      case 'config': {
        if (this.started && msg.gameId === this.gameId) return
        this.adoptGame(msg.gameId, msg.cfg, msg.yourSide, [])
        return
      }
      case 'move': {
        if (!this.started) return
        this.receiveMove(msg.wire)
        return
      }
      case 'resyncReq': {
        if (!this.started) return
        this.transport.send({
          t: 'resync',
          gameId: this.gameId,
          cfg: this.cfg!,
          yourSide: opponent(this.side),
          log: this.log,
        })
        return
      }
      case 'resync': {
        if (!this.started) {
          this.adoptGame(msg.gameId, msg.cfg, msg.yourSide, msg.log)
          return
        }
        if (msg.gameId === this.gameId && msg.log.length > this.log.length) {
          this.rebuildFrom(msg.log)
        }
        this.status = 'playing'
        return
      }
      case 'rematchReq': {
        if (this.isHost && this.state.result) this.startNewGame(this.peerNonce ?? 0, true)
        return
      }
      case 'roomFull':
        this.status = 'room-full'
        return
    }
  }

  private startNewGame(peerNonce: number, rematch = false): void {
    const mySide: PlayerId = rematch ? opponent(this.side) : Math.random() < 0.5 ? 'red' : 'blue'
    const cfg: GameConfig = {
      terrainId: rematch ? this.cfg!.terrainId : this.pickedTerrain,
      sharedSeed: (this.myNonce ^ peerNonce ^ Date.now()) >>> 0,
      startingPlayer: Math.random() < 0.5 ? 'red' : 'blue',
      rulesVersion: RULES_VERSION,
    }
    const gameId = `${this.room}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`
    this.transport.send({ t: 'config', gameId, cfg, yourSide: opponent(mySide) })
    this.adoptGame(gameId, cfg, mySide, [])
  }

  /** Host-side terrain selection (set from the lobby before the peer arrives). */
  pickedTerrain = 'castle-field'

  private adoptGame(gameId: string, cfg: GameConfig, side: PlayerId, log: WireMove[]): void {
    this.ctx = makeCtx(getTerrain(cfg.terrainId))
    this.gameId = gameId
    this.cfg = cfg
    this.side = side
    this.reserve = shuffledReserve()
    this.log = []
    this.rematchWanted = false
    this.state = createGame(this.ctx, cfg, { [side]: this.reserve })
    this.started = true
    this.status = 'playing'
    for (const wire of log) this.receiveMove(wire) // resumed game: replay the peer's log
    this.persist()
    queueMicrotask(() => this.autoRespond())
  }

  private rebuildFrom(log: WireMove[]): void {
    if (!this.cfg || !this.reserve) return
    this.state = createGame(this.ctx, this.cfg, { [this.side]: this.reserve })
    this.log = []
    for (const wire of log) this.receiveMove(wire)
    this.persist()
  }

  private persist(): void {
    if (!this.cfg || !this.reserve) return
    saveGame(this.room, {
      gameId: this.gameId,
      cfg: this.cfg,
      side: this.side,
      reserve: this.reserve,
      log: this.log,
    } satisfies SavedGame)
  }

  private receiveMove(wire: WireMove): void {
    if (wire.seq !== this.log.length + 1) {
      if (wire.seq > this.log.length + 1) this.transport.send({ t: 'resyncReq', haveSeq: this.log.length })
      return // duplicate or out of order
    }
    try {
      this.applyLocal(wire.actor, wire.move)
    } catch (err) {
      console.error('rejected remote move', wire, err)
      this.status = 'desync'
      return
    }
    if (publicHash(this.state) !== wire.hash) {
      this.status = 'desync'
      this.transport.send({ t: 'resyncReq', haveSeq: 0 })
      return
    }
    this.log.push(wire)
    this.persist()
  }

  submit(move: Move): void {
    if (!this.started) return
    // concede is legal from either seat at any time; everything else only on your turn
    const actor = move.type === 'concede' ? this.side : this.actor
    if (actor !== this.side) throw new Error('not your seat')
    this.applyLocal(actor, move)
    const wire: WireMove = {
      seq: this.log.length + 1,
      actor,
      move,
      hash: publicHash(this.state),
    }
    this.log.push(wire)
    this.persist()
    this.transport.send({ t: 'move', wire })
  }

  requestRematch(): void {
    this.rematchWanted = true
    if (this.isHost && this.state.result) {
      this.startNewGame(this.peerNonce ?? 0, true)
    } else {
      this.transport.send({ t: 'rematchReq' })
    }
  }

  leave(): void {
    clearGame(this.room)
    this.destroy()
  }

  destroy(): void {
    this.transport.close()
  }
}

function replayLog(ctx: Ctx, saved: SavedGame): GameState {
  let state = createGame(ctx, saved.cfg, { [saved.side]: saved.reserve })
  for (const wire of saved.log) {
    state = applyMove(ctx, state, wire.actor, wire.move)
  }
  return state
}
