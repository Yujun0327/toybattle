import {
  applyMove,
  createGame,
  legalMoves,
  makeCtx,
  publicHash,
  redact,
} from '../engine'
import type { Ctx, GameConfig, GameState, Move, PlayerId, TroopType } from '../engine'
import { opponent } from '../engine/types'
import { getTerrain } from '../terrains'
import {
  PROTOCOL_VERSION,
  type Beacon,
  type GameSnapshot,
  type Transport,
  type WireMove,
} from '../transport/types'
import { connectRoom } from '../transport/trystero'
import { clearGame, loadGame, saveGame, shuffledReserve } from './secrets'

export type SfxEvent = 'place' | 'cover' | 'draw' | 'discard' | 'medal' | 'win' | 'lose' | 'freeze'

export type OnlineStatus =
  | 'connecting' // in the room, no partner beacon yet
  | 'handshake'  // partner present, game being created/adopted
  | 'playing'
  | 'peer-left'
  | 'desync'
  | 'room-full'
  | 'version-mismatch'

const RULES_VERSION = '2'

/** Console breadcrumb trail for connection debugging. */
function log(text: string): void {
  console.log(`[toybattle] ${text}`)
}

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

  protected applyLocal(actor: PlayerId, move: Move, quiet = false): void {
    const before = this.state
    const after = applyMove(this.ctx, before, actor, move)
    this.state = after
    if (quiet) return

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

/**
 * Online play over a stateless beacon protocol.
 *
 * There is ONE message: a periodic `sync` beacon carrying this client's
 * identity and its complete view of the shared game (config + full move
 * log). All logic is a pure merge of "latest beacon" into local state:
 *
 * - Host election is a deterministic function both sides compute from any
 *   single beacon (creator wins; ties broken by clientId order).
 * - The host creates the game once it sees a partner and simply includes
 *   it in every beacon; the guest adopts it idempotently.
 * - Moves ride in the beacon's log; receivers apply the missing suffix.
 * - Presence = "beacon received recently", independent of transport events.
 *
 * Nothing depends on message ordering, connection callbacks, or who spoke
 * first, so any dropped/stale message is repaired by the next beacon — and
 * rejoining the room (which we do on a jittered cycle while unpaired, to
 * shed stale relay sockets) loses nothing.
 */
export class OnlineSession extends BaseSession {
  readonly mode = 'online'
  readonly room: string
  status = $state<OnlineStatus>('connecting')
  peerHere = $state(false)
  side = $state<PlayerId>('red')
  rematchWanted = $state(false)
  /** How many times we've rebuilt the room connection looking for a peer. */
  scanCount = $state(0)
  /** Host-side terrain selection (set from the lobby before the peer arrives). */
  pickedTerrain = 'castle-field'

  private transport: Transport
  private readonly clientId = makeClientId()
  private readonly creator: boolean
  private partnerId: string | null = null
  private partnerCreator = false
  private snapshot: GameSnapshot | null = null
  private reserve: TroopType[] | null = null
  private started = false
  private lastBeaconIn = 0
  private lastBeaconOut = 0
  private lastReconnect = Date.now()
  private readonly rejoinCycleMs = 20_000 + Math.random() * 6_000
  private canReconnect: boolean
  private timers: ReturnType<typeof setInterval>[] = []
  private onVisible = () => {
    if (typeof document === 'undefined' || document.hidden) return
    if (!this.peerHere) {
      this.reconnect(10_000)
      this.sendBeacon()
    }
  }

  constructor(room: string, creator: boolean, transport?: Transport) {
    const saved = loadGame(room)
    if (saved) {
      const ctx = makeCtx(getTerrain(saved.snapshot.cfg.terrainId))
      super(ctx, createGame(ctx, saved.snapshot.cfg, { [saved.side]: saved.reserve }))
    } else {
      const ctx = makeCtx(getTerrain('castle-field'))
      super(
        ctx,
        createGame(
          ctx,
          { terrainId: 'castle-field', sharedSeed: 0, startingPlayer: 'red', rulesVersion: RULES_VERSION },
          {},
        ),
      )
    }
    this.room = room
    this.creator = creator
    this.canReconnect = !transport
    this.transport = transport ?? connectRoom(room)
    this.attach(this.transport)

    if (saved) {
      // restore: rebuild local state by replaying the saved log
      this.side = saved.side
      this.reserve = saved.reserve
      this.snapshot = { ...saved.snapshot, log: [] }
      try {
        for (const wire of saved.snapshot.log) this.applyWire(wire, true)
        this.started = true
        log(`restored game ${this.snapshot.gameId} at move ${this.snapshot.log.length}`)
        queueMicrotask(() => this.autoRespond())
      } catch (err) {
        log(`saved game unusable, starting fresh (${String(err)})`)
        this.snapshot = null
        this.reserve = null
        clearGame(room)
      }
    }

    this.timers.push(setInterval(() => this.tick(), 1000))
    if (this.canReconnect && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisible)
    }
    log(`session up · room=${room} creator=${creator} id=${this.clientId} resumed=${this.started}`)
  }

  get mySide(): PlayerId {
    return this.side
  }

  get viewer(): PlayerId {
    return this.side
  }

  get playing(): boolean {
    return this.started && this.status !== 'desync' && this.status !== 'version-mismatch'
  }

  /** Manual "rescan" from the lobby. */
  rescan(): void {
    if (!this.peerHere) {
      this.reconnect(3_000)
      this.sendBeacon()
    }
  }

  /** Open signaling-relay connections (diagnostics for the lobby). */
  relayCount(): number {
    return this.transport.relayCount?.() ?? 0
  }

  submit(move: Move): void {
    if (!this.snapshot) return
    // concede is legal from either seat at any time; everything else only on your turn
    const actor = move.type === 'concede' ? this.side : this.actor
    if (actor !== this.side) throw new Error('not your seat')
    this.applyLocal(actor, move)
    this.snapshot.log.push({
      seq: this.snapshot.log.length + 1,
      actor,
      move,
      hash: publicHash(this.state),
    })
    this.persist()
    this.sendBeacon()
  }

  requestRematch(): void {
    this.rematchWanted = true
    if (this.isHost && this.state.result) {
      this.startRematch()
    } else {
      this.sendBeacon()
    }
  }

  leave(): void {
    clearGame(this.room)
    this.destroy()
  }

  destroy(): void {
    for (const t of this.timers) clearInterval(t)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisible)
    }
    this.transport.close()
  }

  /* ---- internals ---- */

  private attach(t: Transport): void {
    t.onMessage((msg) => this.onBeacon(msg))
    // a fresh WebRTC link is the perfect moment to introduce ourselves
    t.onPeerJoin((peerId) => {
      log(`transport peer connected: ${peerId}`)
      this.sendBeacon()
    })
    t.onPeerLeave((peerId) => log(`transport peer left: ${peerId}`))
  }

  /** Runs every second: heartbeats, liveness, stale-room rejoin. */
  private tick(): void {
    const now = Date.now()

    // presence: beacons, not transport events, are the truth
    if (this.peerHere && now - this.lastBeaconIn > 15_000) {
      this.peerHere = false
      if (this.started && this.status === 'playing') this.status = 'peer-left'
      log('partner beacons stopped')
    }

    // beacon cadence: eager while searching/syncing, heartbeat while playing
    const cadence = this.peerHere && this.snapshot ? 6_000 : 2_500
    if (now - this.lastBeaconOut >= cadence) this.sendBeacon()

    // shed stale relay sockets while unpaired (jittered so both sides never
    // tear down in lockstep; rejoining costs nothing — the protocol is stateless)
    if (!this.peerHere && now - this.lastReconnect > this.rejoinCycleMs) {
      this.reconnect(this.rejoinCycleMs)
    }
  }

  private get isHost(): boolean {
    if (this.snapshot) return this.snapshot.hostId === this.clientId
    if (this.creator !== this.partnerCreator) return this.creator
    return this.clientId < (this.partnerId ?? '~')
  }

  private sendBeacon(): void {
    this.lastBeaconOut = Date.now()
    this.transport.send({
      t: 'sync',
      protocol: PROTOCOL_VERSION,
      room: this.room,
      clientId: this.clientId,
      creator: this.creator,
      partnerId: this.partnerId,
      wantRematch: this.rematchWanted,
      game: this.snapshot,
    })
  }

  private onBeacon(b: Beacon): void {
    if (b.t !== 'sync' || b.room !== this.room || b.clientId === this.clientId) return
    if (b.protocol !== PROTOCOL_VERSION) {
      if (!this.started) this.status = 'version-mismatch'
      return
    }

    const sameGame = !!(this.snapshot && b.game && b.game.gameId === this.snapshot.gameId)

    // they are locked to someone else → we're the spectator
    if (b.partnerId && b.partnerId !== this.clientId && !sameGame) {
      if (!this.started) this.status = 'room-full'
      return
    }
    // a third client while our partner is active → ignore them
    if (this.partnerId && b.clientId !== this.partnerId) {
      if (!sameGame && this.peerHere) return
      // partner came back under a new clientId (refresh), or the seat is open
      log(`partner reseated: ${this.partnerId} → ${b.clientId}`)
      this.partnerId = b.clientId
    }
    this.partnerId ??= b.clientId
    this.partnerCreator = b.creator
    this.lastBeaconIn = Date.now()
    if (!this.peerHere) {
      this.peerHere = true
      log(`partner present: ${b.clientId}`)
    }
    if (this.status === 'connecting' || this.status === 'room-full') this.status = 'handshake'
    if (this.started && this.status === 'peer-left') this.status = 'playing'

    // host creates the game the moment it knows its partner
    if (!this.snapshot && this.isHost) this.createNewGame()

    if (b.game) this.mergeGame(b.game)

    // rematch: host acts on either side's wish
    if (this.snapshot && this.isHost && this.state.result && (b.wantRematch || this.rematchWanted)) {
      this.startRematch()
    }

    // repair: if they lack something we have, answer immediately
    if (
      this.snapshot &&
      (!b.game ||
        (b.game.gameId === this.snapshot.gameId && b.game.log.length < this.snapshot.log.length))
    ) {
      this.sendBeacon()
    }
  }

  private createNewGame(rematch = false): void {
    const hostSide: PlayerId = rematch ? opponent(this.side) : Math.random() < 0.5 ? 'red' : 'blue'
    const snapshot: GameSnapshot = {
      gameId: `${this.room}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,
      cfg: {
        terrainId: rematch && this.snapshot ? this.snapshot.cfg.terrainId : this.pickedTerrain,
        sharedSeed: crypto.getRandomValues(new Uint32Array(1))[0],
        startingPlayer: Math.random() < 0.5 ? 'red' : 'blue',
        rulesVersion: RULES_VERSION,
      },
      hostId: this.clientId,
      hostSide,
      log: [],
    }
    log(`hosting game ${snapshot.gameId} on ${snapshot.cfg.terrainId}, I am ${hostSide}`)
    this.adopt(snapshot, hostSide)
  }

  private startRematch(): void {
    this.createNewGame(true)
  }

  /** Take a snapshot as our game (host after creating, guest on receipt). */
  private adopt(snap: GameSnapshot, side: PlayerId): void {
    this.ctx = makeCtx(getTerrain(snap.cfg.terrainId))
    this.snapshot = { ...snap, log: [] }
    this.side = side
    this.reserve = shuffledReserve()
    this.rematchWanted = false
    this.state = createGame(this.ctx, snap.cfg, { [side]: this.reserve })
    this.started = true
    if (this.status !== 'desync') this.status = 'playing'
    try {
      for (const wire of snap.log) this.applyWire(wire, true)
    } catch (err) {
      log(`adopt replay failed: ${String(err)}`)
      this.status = 'desync'
    }
    this.persist()
    this.sendBeacon()
    queueMicrotask(() => this.autoRespond())
  }

  private mergeGame(g: GameSnapshot): void {
    if (g.cfg.rulesVersion !== RULES_VERSION) {
      if (!this.started) this.status = 'version-mismatch'
      return
    }
    if (!this.snapshot) {
      // guest adopts the host's game
      const side = g.hostId === this.clientId ? g.hostSide : opponent(g.hostSide)
      log(`adopting game ${g.gameId} as ${side}`)
      this.adopt(g, side)
      return
    }
    if (g.gameId !== this.snapshot.gameId) {
      // conflicting games: the host's wins; a guest holding a stale game defers
      if (!this.isHost) {
        log(`replacing game ${this.snapshot.gameId} with host's ${g.gameId}`)
        this.adopt(g, opponent(g.hostSide))
      }
      return
    }
    // same game: apply whatever suffix we're missing
    const before = this.snapshot.log.length
    for (let i = this.snapshot.log.length; i < g.log.length; i++) {
      try {
        this.applyWire(g.log[i], g.log.length - this.snapshot.log.length > 2)
      } catch (err) {
        log(`remote move rejected: ${String(err)}`)
        this.status = 'desync'
        return
      }
    }
    if (this.snapshot.log.length > before) {
      this.persist()
      queueMicrotask(() => this.autoRespond())
    }
  }

  /** Validate + apply one logged move; quiet suppresses sfx for bulk replays. */
  private applyWire(wire: WireMove, quiet = false): void {
    if (!this.snapshot) return
    if (wire.seq !== this.snapshot.log.length + 1) throw new Error(`bad seq ${wire.seq}`)
    this.applyLocal(wire.actor, wire.move, quiet)
    if (publicHash(this.state) !== wire.hash) throw new Error(`hash mismatch at seq ${wire.seq}`)
    this.snapshot.log.push(wire)
  }

  private persist(): void {
    if (!this.snapshot || !this.reserve) return
    saveGame(this.room, { snapshot: this.snapshot, side: this.side, reserve: this.reserve })
  }

  /** Tear down a possibly-stale room connection and join fresh (same room code). */
  private reconnect(minSpacingMs: number): void {
    if (!this.canReconnect) return
    if (Date.now() - this.lastReconnect < minSpacingMs) return
    this.lastReconnect = Date.now()
    this.scanCount++
    log(`rescanning for a peer (attempt ${this.scanCount})`)
    try {
      this.transport.close()
    } catch {
      /* already dead */
    }
    this.transport = connectRoom(this.room)
    this.attach(this.transport)
  }
}

function makeClientId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
