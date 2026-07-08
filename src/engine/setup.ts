import type { Ctx } from './legality'
import { makeHiddenZone, makeKnownZone } from './zones'
import { zoneTransfer } from './zones'
import { ALL_TROOP_TYPES } from './troops'
import type { GameConfig, GameState, PlayerId, TroopType } from './types'
import { opponent, RulesError } from './types'

export const ARMY_SIZE = 24
export const REMOVED_AT_SETUP = 4
export const RESERVE_SIZE = ARMY_SIZE - REMOVED_AT_SETUP // 20

/**
 * A player's private reserve: exactly 20 tiles, already shuffled, with the
 * 4 setup-removed tiles ALREADY taken out (the engine never sees them).
 * Provide it only for players whose secrets this client owns.
 */
export type PrivateSetups = Partial<Record<PlayerId, TroopType[]>>

function validateReserve(player: PlayerId, tiles: TroopType[]): void {
  if (tiles.length !== RESERVE_SIZE)
    throw new RulesError(`${player}: reserve must have ${RESERVE_SIZE} tiles, got ${tiles.length}`)
  for (const t of ALL_TROOP_TYPES) {
    const n = tiles.filter((x) => x === t).length
    if (n > 3) throw new RulesError(`${player}: ${n} copies of ${t} (max 3)`)
  }
}

export function createGame(ctx: Ctx, config: GameConfig, privates: PrivateSetups): GameState {
  const players = {} as GameState['players']
  for (const p of ['red', 'blue'] as PlayerId[]) {
    const tiles = privates[p]
    if (tiles) validateReserve(p, tiles)
    players[p] = {
      reserve: tiles ? makeKnownZone(tiles) : makeHiddenZone(RESERVE_SIZE),
      rack: tiles ? makeKnownZone([]) : makeHiddenZone(0),
      medals: 0,
      discard: [],
    }
  }

  const state: GameState = {
    config,
    turn: config.startingPlayer,
    turnNumber: 0,
    board: {},
    frozen: {},
    regionsClaimed: Object.fromEntries(ctx.terrain.regions.map((r) => [r.id, null])),
    players,
    effectStack: [],
    pending: null,
    sharedRngCursor: 0,
    result: null,
  }

  // Starting player racks 3 tiles, the opponent 4.
  zoneTransfer(players[config.startingPlayer].reserve, players[config.startingPlayer].rack, 3)
  const second = opponent(config.startingPlayer)
  zoneTransfer(players[second].reserve, players[second].rack, 4)
  return state
}
