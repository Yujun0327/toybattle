import type { GameConfig, Move, PlayerId } from '../engine/types'

export const PROTOCOL_VERSION = 2

export interface WireMove {
  seq: number
  actor: PlayerId
  move: Move
  /** publicHash of the state AFTER applying this move. */
  hash: string
}

export type NetMsg =
  | { t: 'hello'; nonce: number; protocol: number; creator: boolean; haveGame: string | null }
  | { t: 'config'; gameId: string; cfg: GameConfig; yourSide: PlayerId }
  | { t: 'move'; wire: WireMove }
  | { t: 'resyncReq'; haveSeq: number }
  | { t: 'resync'; gameId: string; cfg: GameConfig; yourSide: PlayerId; log: WireMove[] }
  | { t: 'rematchReq' }
  | { t: 'roomFull' }

export interface Transport {
  /** Broadcast, or send to one peer when `target` is given. */
  send(msg: NetMsg, target?: string): void
  onMessage(fn: (msg: NetMsg, peerId: string) => void): void
  onPeerJoin(fn: (peerId: string) => void): void
  onPeerLeave(fn: (peerId: string) => void): void
  close(): void
  /** Number of currently-open signaling relay connections, if known. */
  relayCount?(): number
}
