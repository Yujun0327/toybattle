import { TROOPS } from './troops'
import type { BaseId, GameState, Move, PlayerId, StackEntry, TroopType } from './types'
import { opponent } from './types'
import type { TerrainDef } from '../terrains/schema'
import { buildAdjacency } from '../terrains/schema'

export interface Ctx {
  terrain: TerrainDef
  adjacency: Map<BaseId, BaseId[]>
  baseById: Map<BaseId, TerrainDef['bases'][number]>
}

export function makeCtx(terrain: TerrainDef): Ctx {
  return {
    terrain,
    adjacency: buildAdjacency(terrain),
    baseById: new Map(terrain.bases.map((b) => [b.id, b])),
  }
}

export function topOf(state: GameState, base: BaseId): StackEntry | undefined {
  const stack = state.board[base]
  return stack && stack.length > 0 ? stack[stack.length - 1] : undefined
}

export function isFrozen(state: GameState, base: BaseId): boolean {
  const until = state.frozen[base]
  return until !== undefined && state.turnNumber < until
}

/**
 * Who occupies a base for connection/region purposes.
 * HQs always count as occupied by their owner. A frozen troop does not
 * occupy (pinned ruling — see rulings.md).
 */
export function occupiedBy(ctx: Ctx, state: GameState, base: BaseId): PlayerId | null {
  const def = ctx.baseById.get(base)
  if (!def) return null
  if (def.kind === 'hq') return def.hqOwner!
  if (isFrozen(state, base)) return null
  return topOf(state, base)?.owner ?? null
}

/** All bases reachable from `player`'s HQ traversing only bases they occupy (HQ included). */
export function connectionSet(ctx: Ctx, state: GameState, player: PlayerId): Set<BaseId> {
  const hq = ctx.terrain.bases.find((b) => b.kind === 'hq' && b.hqOwner === player)!
  const set = new Set<BaseId>([hq.id])
  const stack = [hq.id]
  while (stack.length) {
    for (const n of ctx.adjacency.get(stack.pop()!)!) {
      if (!set.has(n) && occupiedBy(ctx, state, n) === player) {
        set.add(n)
        stack.push(n)
      }
    }
  }
  return set
}

/** Connection targets: occupied set plus its frontier. */
export function connectedTargets(ctx: Ctx, state: GameState, player: PlayerId): Set<BaseId> {
  const s = connectionSet(ctx, state, player)
  const out = new Set(s)
  for (const b of s) for (const n of ctx.adjacency.get(b)!) out.add(n)
  return out
}

function strengthOf(t: TroopType): number | 'joker' {
  return TROOPS[t].strength
}

/** May `troop` (owned by `actor`) go on top of `top`? */
export function canCover(actor: PlayerId, troop: TroopType, top: StackEntry): boolean {
  if (top.owner === actor) return true
  const a = strengthOf(troop)
  const d = strengthOf(top.troop)
  if (a === 'joker' || d === 'joker') return true // Kwak covers anything; anything covers Kwak
  return a > d
}

/**
 * Full placement legality for one troop on one base.
 * `connected` should be connectedTargets(...) for the actor.
 */
export function canPlace(
  ctx: Ctx,
  state: GameState,
  actor: PlayerId,
  troop: TroopType,
  base: BaseId,
  connected: Set<BaseId>,
): boolean {
  const def = ctx.baseById.get(base)
  if (!def) return false
  if (def.kind === 'hq') {
    if (def.hqOwner === actor) return false
    // Enemy HQ: connection ALWAYS required (even for Hook). Strength gate may apply (Tropical Pool).
    if (!connected.has(base)) return false
  } else {
    if (isFrozen(state, base)) return false // frozen troops cannot be covered (pinned ruling)
    const top = topOf(state, base)
    if (top && !canCover(actor, troop, top)) return false
    if (troop !== 'hook' && !connected.has(base)) return false
  }
  if (def.special?.kind === 'strengthRestricted') {
    const s = strengthOf(troop)
    if (s === 'joker' || !def.special.allowed.includes(s)) return false // joker fails numeric gates (pinned ruling)
  }
  return true
}

export function placementTargets(ctx: Ctx, state: GameState, actor: PlayerId, troop: TroopType): BaseId[] {
  const connected = connectedTargets(ctx, state, actor)
  return ctx.terrain.bases.filter((b) => canPlace(ctx, state, actor, troop, b.id, connected)).map((b) => b.id)
}

export function canDraw(state: GameState, player: PlayerId): boolean {
  const p = state.players[player]
  return p.rack.count < 8 && p.reserve.count > 0
}

/**
 * Enumerate legal moves for `player`. Requires the player's rack to be known
 * (i.e. call it for the local player / in hot-seat).
 */
export function legalMoves(ctx: Ctx, state: GameState, player: PlayerId): Move[] {
  if (state.result) return []
  const moves: Move[] = []

  if (state.pending) {
    if (state.pending.actor !== player) return []
    const pend = state.pending
    switch (pend.kind) {
      case 'capnPlace': {
        const rack = state.players[player].rack.known ?? []
        for (const troop of new Set(rack)) {
          for (const base of placementTargets(ctx, state, player, troop)) {
            moves.push({ type: 'choice', value: { place: { troop, base } } })
          }
        }
        moves.push({ type: 'skip' })
        return moves
      }
      case 'jumboDiscard':
      case 'castleReturn':
        for (const base of pend.options) moves.push({ type: 'choice', value: { base } })
        moves.push({ type: 'skip' })
        return moves
      case 'volcanicMove':
        for (const move of pend.options) moves.push({ type: 'choice', value: { move } })
        moves.push({ type: 'skip' })
        return moves
      case 'cemeteryRecover':
        for (const troop of pend.options) moves.push({ type: 'choice', value: { troop } })
        moves.push({ type: 'skip' })
        return moves
      case 'xb42Reveal': {
        const rack = state.players[player].rack.known
        if (rack) moves.push({ type: 'choice', value: { troop: rack[pend.index] } })
        return moves
      }
    }
  }

  if (state.turn !== player) return []
  if (canDraw(state, player)) moves.push({ type: 'draw' })
  const rack = state.players[player].rack.known ?? []
  for (const troop of new Set(rack)) {
    for (const base of placementTargets(ctx, state, player, troop)) {
      moves.push({ type: 'place', troop, base })
    }
  }
  if (moves.length === 0) moves.push({ type: 'stalemate' })
  return moves
}
