import type { GameConfig, Move, PlayerId } from '../engine/types'

export const PROTOCOL_VERSION = 3

export interface WireMove {
  seq: number
  actor: PlayerId
  move: Move
  /** publicHash of the state AFTER applying this move. */
  hash: string
}

/** The complete shared description of a game — everything public. */
export interface GameSnapshot {
  gameId: string
  cfg: GameConfig
  /** clientId of the host that created this game. */
  hostId: string
  hostSide: PlayerId
  log: WireMove[]
}

/**
 * The ONLY wire message. Stateless-per-message: every beacon carries the
 * full shared state, so convergence never depends on ordering, connection
 * events, or which side spoke first — any lost message is repaired by the
 * next beacon.
 */
export interface Beacon {
  t: 'sync'
  protocol: number
  room: string
  clientId: string
  creator: boolean
  /** Who this client considers its opponent (spectator detection). */
  partnerId: string | null
  wantRematch: boolean
  game: GameSnapshot | null
}

export type NetMsg = Beacon

export interface Transport {
  /** Broadcast, or send to one peer when `target` is given. */
  send(msg: NetMsg, target?: string): void
  /**
   * peerId is transport-specific (for MQTT it's the broker URL) — session
   * logic identifies players by beacon.clientId, never by transport peerId.
   */
  onMessage(fn: (msg: NetMsg, peerId: string) => void): void
  /** Fired when a channel comes up (MQTT: per-broker connect) — used as an eager-beacon trigger. */
  onPeerJoin(fn: (peerId: string) => void): void
  onPeerLeave(fn: (peerId: string) => void): void
  close(): void
  /** Number of currently-open broker/relay connections, if known. */
  relayCount?(): number
  /** Nudge any disconnected channels to reconnect immediately. */
  wake?(): void
}
