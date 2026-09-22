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
  BeaconSession,
  brokersFromEnv,
  playerKey,
  type Beacon,
  type GameAdapter,
  type Transport,
} from '@yujun/game-net'
import { WalletSession, defaultLedger, loadIdentity, type Identity, type Ledger, type LockState, type Payout } from '@yujun/game-net/wallet'
import { shuffledReserve } from './secrets'

/** Storage prefix and MQTT topic namespace for this game. */
export const APP = 'toybattle'

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
    this.afterApply(before, after, move, quiet)
  }

  /** Sound effects and forced responses for one applied transition. */
  protected afterApply(before: GameState, after: GameState, move: Move, quiet = false): void {
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

const SIDE_OF: PlayerId[] = ['red', 'blue']
const seatOf = (p: PlayerId): number => (p === 'red' ? 0 : 1)
const DEFAULT_TERRAIN = 'castle-field'

type Core = BeaconSession<GameConfig, GameState, Move, TroopType[]>

/**
 * Toy Battle on the shared beacon session (see @yujun/game-net). Seats are
 * 0 = red, 1 = blue. The hidden reserve is the per-seat private data: it is
 * generated on adoption, persisted locally, and never put on the wire.
 */
function makeAdapter(host: () => OnlineSession | null): GameAdapter<GameConfig, GameState, Move, TroopType[]> {
  let ctx: Ctx | null = null
  const ctxFor = (terrainId: string): Ctx => {
    if (!ctx || ctx.terrain.id !== terrainId) ctx = makeCtx(getTerrain(terrainId))
    return ctx
  }
  const seed = () => crypto.getRandomValues(new Uint32Array(1))[0]
  return {
    app: APP,
    protocol: 4,
    rulesVersion: RULES_VERSION,
    minSeats: 2,
    maxSeats: 2,
    makeConfig: (_players, prev) => ({
      terrainId: prev ? prev.terrainId : (host()?.pickedTerrain ?? DEFAULT_TERRAIN),
      sharedSeed: seed(),
      startingPlayer: Math.random() < 0.5 ? 'red' : 'blue',
      rulesVersion: RULES_VERSION,
    }),
    // fresh game: random sides; rematch: swap
    orderSeats: (players, prev) => (prev ? [...players].reverse() : Math.random() < 0.5 ? players : [...players].reverse()),
    create: (cfg, seat, priv) => {
      const c = ctxFor(cfg.terrainId)
      if (seat === null) return { state: createGame(c, cfg, {}) }
      const reserve = priv ?? shuffledReserve()
      return { state: createGame(c, cfg, { [SIDE_OF[seat]]: reserve }), priv: reserve }
    },
    apply: (s, actor, move) => applyMove(ctxFor(s.config.terrainId), s, SIDE_OF[actor], move),
    hash: publicHash,
    actor: (s) => seatOf(s.pending?.actor ?? s.turn),
    isOver: (s) => s.result !== null,
    winners: (s) => (s.result?.winner ? [seatOf(s.result.winner)] : []),
    // concede is legal from either seat at any time; everything else only on your turn
    actorFor: (s, seat, move) => (move.type === 'concede' || seatOf(s.pending?.actor ?? s.turn) === seat ? seat : null),
  }
}

export interface OnlineTestHooks {
  ledger?: Ledger
  identity?: Identity
  transport?: Transport<Beacon<GameConfig, Move>>
  now?: () => number
  timers?: boolean
  key?: string
}

export class OnlineSession extends BaseSession {
  readonly mode = 'online'
  readonly room: string
  /** How many times the player pressed rescan (lobby feedback only). */
  scanCount = $state(0)
  /** Host-side terrain selection (set from the lobby before the peer arrives). */
  pickedTerrain = DEFAULT_TERRAIN

  private readonly core: Core
  private wallet: WalletSession<GameConfig, GameState, Move, TroopType[]> | null = null
  /**
   * Reactive revision, bumped on every core change. Every getter reads it
   * first, so templates track it even when the rest short-circuits — if
   * they tracked nothing while `playing` was false, they would never
   * notice the game starting (the original "creator tab never starts" bug).
   */
  private rev = $state(0)
  private gameId = ''
  private seenLog = 0
  private prev: GameState

  constructor(room: string, creator: boolean, test: OnlineTestHooks = {}) {
    const self: { s: OnlineSession | null } = { s: null }
    const core: Core = new BeaconSession(makeAdapter(() => self.s), {
      room,
      creator,
      identity: { key: test.key ?? playerKey(APP), name: creator ? 'Red box' : 'Blue box' },
      transport: test.transport,
      brokers: test.transport ? undefined : brokersFromEnv(import.meta.env as Record<string, string | undefined>),
      now: test.now,
      timers: test.timers,
      log: (t) => console.log(`[${APP}] ${t}`),
    })
    super(makeCtx(getTerrain(core.cfg?.terrainId ?? DEFAULT_TERRAIN)), core.state)
    self.s = this
    this.core = core
    this.room = core.room
    this.prev = core.state
    this.seenLog = core.logLength
    this.gameId = core.snapshot?.gameId ?? ''
    core.subscribe(() => this.sync())
    // the platform wallet: locks stakes, signs and posts settlements, reports payouts
    const ledger = test.ledger ?? (test.transport ? null : defaultLedger())
    if (ledger) {
      this.wallet = new WalletSession(core, APP, test.identity ?? loadIdentity(), ledger, test.now)
      this.wallet.subscribe(() => this.rev++)
    }
    // no lobby ritual in Toy Battle: everyone is always ready and the host deals
    // the moment the second player shows up
    core.setReady(true)
    if (core.started) queueMicrotask(() => this.autoRespond())
  }

  private get c(): Core {
    void this.rev
    return this.core
  }

  private sync(): void {
    const core = this.core
    if (core.snapshot && core.snapshot.gameId !== this.gameId) {
      this.gameId = core.snapshot.gameId
      this.seenLog = 0
      this.ctx = makeCtx(getTerrain(core.snapshot.cfg.terrainId))
      this.prev = createGame(this.ctx, core.snapshot.cfg, {})
    }
    this.state = core.state
    const log = core.snapshot?.log ?? []
    const fresh = log.length - this.seenLog
    if (fresh > 0) {
      let st = this.prev
      for (const wire of log.slice(this.seenLog)) {
        const next = applyMove(this.ctx, st, SIDE_OF[wire.actor], wire.move)
        this.afterApply(st, next, wire.move, fresh > 2)
        st = next
      }
      if (fresh > 2) queueMicrotask(() => this.autoRespond())
    }
    this.seenLog = log.length
    this.prev = core.state
    this.rev++
    if (core.isHost && core.canStart) queueMicrotask(() => core.startGame())
  }

  /* ---------------- base overrides ---------------- */

  get side(): PlayerId {
    return SIDE_OF[this.c.seat ?? 0]
  }

  get mySide(): PlayerId {
    return this.side
  }

  get viewer(): PlayerId {
    return this.side
  }

  get spectator(): boolean {
    return this.c.spectator
  }

  get myTurn(): boolean {
    return this.c.seat !== null && this.actor === this.side
  }

  get playing(): boolean {
    const c = this.c
    return c.started && !c.spectator && c.status !== 'desync' && c.status !== 'version-mismatch'
  }

  submit(move: Move): void {
    this.core.submit(move)
  }

  /* ---------------- status ---------------- */

  private get opponentKey(): string | null {
    const seats = this.core.snapshot?.seats
    if (!seats) return null
    return Object.keys(seats).find((k) => k !== this.core.myKey) ?? null
  }

  get peerHere(): boolean {
    const c = this.c
    if (c.started) {
      const k = this.opponentKey
      return k !== null && c.presence(k)
    }
    return c.livePeers.length > 0
  }

  get status(): OnlineStatus {
    const c = this.c
    if (c.status === 'version-mismatch' || c.status === 'room-full' || c.status === 'desync') return c.status
    if (c.spectator) return 'room-full' // a two-seat table has no gallery
    if (c.started) return this.peerHere ? 'playing' : 'peer-left'
    return this.peerHere ? 'handshake' : 'connecting'
  }

  get rematchWanted(): boolean {
    return this.c.wantRematch
  }

  /** Manual "rescan" from the lobby: reconnect dropped brokers + re-announce. */
  rescan(): void {
    this.scanCount++
    this.core.rescan()
  }

  /** Open broker connections (diagnostics for the lobby). */
  relayCount(): number {
    return this.c.channelCount()
  }

  brokerCount(): number {
    return this.core.channels().length
  }

  requestRematch(): void {
    this.core.requestRematch()
  }

  /** Test/diagnostic access to the shared core. */
  get net(): Core {
    return this.core
  }

  /** Wallet outcome of the current game (null when this build has no wallet). */
  get payout(): Payout | null {
    void this.rev
    return this.wallet?.payout ?? null
  }

  get lockState(): LockState | null {
    void this.rev
    return this.wallet?.lock ?? null
  }

  get ledger(): Ledger | null {
    return this.wallet ? (this.wallet as unknown as { ledger: Ledger }).ledger : null
  }

  leave(): void {
    this.core.leave()
  }

  destroy(): void {
    this.wallet?.destroy()
    this.core.destroy()
  }
}
