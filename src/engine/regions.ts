import type { Ctx } from './legality'
import { occupiedBy } from './legality'
import type { GameState, PlayerId } from './types'

/**
 * Claim every unclaimed region whose surrounding bases are all occupied by
 * one player. Runs after EVERY board mutation — placements, Jumbo discards,
 * Volcanic moves and Castle returns can all complete a region, for either
 * player. Claimed regions never re-award.
 */
export function sweepRegions(ctx: Ctx, state: GameState): void {
  for (const region of ctx.terrain.regions) {
    if (state.regionsClaimed[region.id]) continue
    let owner: PlayerId | null = null
    let complete = true
    for (const baseId of region.baseIds) {
      const occ = occupiedBy(ctx, state, baseId)
      if (!occ || (owner && occ !== owner)) {
        complete = false
        break
      }
      owner = occ
    }
    if (complete && owner) {
      state.regionsClaimed[region.id] = owner
      state.players[owner].medals += region.medals
    }
  }
}
