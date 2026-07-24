export type PlayerId = 'red' | 'blue'
export type TroopType =
  | 'skully' // 1 — draw 2
  | 'capn'   // 2 — place 1 extra troop
  | 'jumbo'  // 3 — discard adjacent visible enemy
  | 'hook'   // 4 — ignore connection rule
  | 'xb42'   // 5 — steal random troop from opponent rack
  | 'star'   // 6 — draw 1
  | 'roxy'   // 7 — no effect
  | 'kwak'   // joker — covers anything, covered by anything

export type BaseId = string
export type RegionId = string

export function opponent(p: PlayerId): PlayerId {
  return p === 'red' ? 'blue' : 'red'
}

export interface StackEntry {
  owner: PlayerId
  troop: TroopType
}

/**
 * A hidden-capable tile zone. `count` is always public and authoritative.
 * `known` is present only when this client is allowed to see the contents
 * (own zones, or both zones in hot-seat). Invariant: known.length === count.
 */
export interface Zone {
  count: number
  known?: TroopType[]
}

export interface PlayerState {
  rack: Zone
  reserve: Zone
  medals: number
  /** Face-up, public. */
  discard: TroopType[]
}

export type EffectFrame =
  | { kind: 'troopEffect'; troop: TroopType; base: BaseId; actor: PlayerId }
  | { kind: 'specialBase'; base: BaseId; actor: PlayerId }

export type PendingChoice =
  | { kind: 'capnPlace'; actor: PlayerId; optional: true }
  | { kind: 'jumboDiscard'; actor: PlayerId; options: BaseId[]; optional: true }
  /** XB-42's owner blind-picks a position in the opponent's rack (count is public). */
  | { kind: 'xb42Pick'; actor: PlayerId; optional: true }
  /** actor here is the VICTIM, who must reveal rack[index]. Not optional. */
  | { kind: 'xb42Reveal'; actor: PlayerId; index: number }
  | { kind: 'volcanicMove'; actor: PlayerId; options: { from: BaseId; to: BaseId }[]; optional: true }
  | { kind: 'castleReturn'; actor: PlayerId; options: BaseId[]; optional: true }
  | { kind: 'cemeteryRecover'; actor: PlayerId; options: TroopType[]; optional: true }

export type ChoiceValue =
  | { place: { troop: TroopType; base: BaseId } } // capnPlace
  | { base: BaseId }                              // jumboDiscard, castleReturn
  | { troop: TroopType }                          // xb42Reveal, cemeteryRecover
  | { index: number }                             // xb42Pick (blind rack position)
  | { move: { from: BaseId; to: BaseId } }        // volcanicMove

export type Move =
  | { type: 'draw' }
  | { type: 'place'; troop: TroopType; base: BaseId }
  | { type: 'choice'; value: ChoiceValue }
  | { type: 'skip' }
  /**
   * Declared by the player whose turn it is when they have no legal action.
   * Placement-impossibility can only be fully verified by the declarer's own
   * client (rack contents are private); the opponent trusts it (or commit-
   * reveal catches lies after the game).
   */
  | { type: 'stalemate' }
  /** Give up. Legal at any time, from either player. */
  | { type: 'concede' }

export type GameResultReason = 'hq' | 'medals' | 'stalemate' | 'stalemateTie' | 'concede'

export interface GameConfig {
  terrainId: string
  sharedSeed: number
  startingPlayer: PlayerId
  rulesVersion: string
}

export interface GameState {
  config: GameConfig
  turn: PlayerId
  turnNumber: number
  /** Stacks per base; LAST element is on top and occupies the base. HQs stay empty (placing on enemy HQ ends the game). */
  board: Record<BaseId, StackEntry[]>
  /** baseId → turnNumber until which its top troop is frozen (exclusive). */
  frozen: Record<BaseId, number>
  regionsClaimed: Record<RegionId, PlayerId | null>
  players: Record<PlayerId, PlayerState>
  effectStack: EffectFrame[]
  pending: PendingChoice | null
  /** Number of shared-PRNG draws consumed so far (public randomness). */
  sharedRngCursor: number
  result: { winner: PlayerId | null; reason: GameResultReason } | null
}

export class RulesError extends Error {}
