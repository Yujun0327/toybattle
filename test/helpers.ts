import { makeCtx, createGame, applyMove, legalMoves } from '../src/engine'
import type { Ctx, GameConfig, GameState, Move, PlayerId, TroopType } from '../src/engine'
import { fullArmy, mulberry32 } from '../src/engine'
import { getTerrain } from '../src/terrains'
import { gridTerrain } from '../src/terrains/_builder'

/** Tiny 2×2 board: red HQ ─ column a ─ column b ─ blue HQ, one 1-medal region. */
export const mini = gridTerrain({
  id: 'mini',
  name: 'Mini',
  description: 'test fixture',
  medalObjective: 1,
  theme: { mat: '#7CB84F', matDark: '#4E8B33', accent: '#fff', icon: 'castle' },
  cols: [200, 400],
  rows: [140, 320],
  cellMedals: { a1: 1 },
})

/** A legal 20-tile reserve: full army minus one roxy/kwak/star/skully, deterministically shuffled. */
export function testReserve(seed: number): TroopType[] {
  const drop: TroopType[] = ['roxy', 'kwak', 'star', 'skully']
  const tiles = fullArmy()
  for (const d of drop) tiles.splice(tiles.indexOf(d), 1)
  const rng = mulberry32(seed)
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles
}

/** An UNSHUFFLED reserve in a fixed order, handy when tests need known draws. */
export function orderedReserve(order: TroopType[]): TroopType[] {
  if (order.length !== 20) throw new Error('need exactly 20 tiles')
  return order
}

export function config(terrainId: string, seed = 42): GameConfig {
  return { terrainId, sharedSeed: seed, startingPlayer: 'red', rulesVersion: 'test' }
}

export function hotseatGame(terrainId = 'mini', seed = 42): { ctx: Ctx; state: GameState } {
  const terrain = terrainId === 'mini' ? mini : getTerrain(terrainId)
  const ctx = makeCtx(terrain)
  const state = createGame(ctx, config(terrainId, seed), {
    red: testReserve(seed),
    blue: testReserve(seed + 1),
  })
  return { ctx, state }
}

/** Apply a scripted sequence, throwing with context on failure. */
export function play(ctx: Ctx, state: GameState, steps: [PlayerId, Move][]): GameState {
  let s = state
  for (const [actor, move] of steps) {
    s = applyMove(ctx, s, actor, move)
  }
  return s
}

/** Cheat helper for scenario setup: force tiles onto the board directly. */
export function put(state: GameState, base: string, owner: PlayerId, troop: TroopType): void {
  ;(state.board[base] ??= []).push({ owner, troop })
}

/** Cheat helper: replace a player's rack contents. */
export function setRack(state: GameState, player: PlayerId, tiles: TroopType[]): void {
  state.players[player].rack = { count: tiles.length, known: [...tiles] }
}

export function currentActor(state: GameState): PlayerId {
  return state.pending?.actor ?? state.turn
}

export function pickRandomMove(ctx: Ctx, state: GameState, rand: () => number): Move {
  const actor = currentActor(state)
  const moves = legalMoves(ctx, state, actor)
  if (moves.length === 0) throw new Error('no legal moves for actor')
  return moves[Math.floor(rand() * moves.length)]
}
