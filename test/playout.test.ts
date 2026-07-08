import { describe, expect, it } from 'vitest'
import {
  applyMove,
  createGame,
  legalMoves,
  makeCtx,
  mulberry32,
  publicHash,
  ALL_TROOP_TYPES,
} from '../src/engine'
import type { GameState, PlayerId } from '../src/engine'
import { TERRAINS } from '../src/terrains'
import { config, currentActor, testReserve } from './helpers'

/** Tiles a player owns across every public/known zone. */
function conservation(state: GameState, p: PlayerId): void {
  const onBoard = Object.values(state.board)
    .flat()
    .filter((e) => e.owner === p).length
  const ps = state.players[p]
  expect(ps.rack.count).toBeLessThanOrEqual(8)
  expect(ps.reserve.count + ps.rack.count + ps.discard.length + onBoard).toBe(20)
  expect(ps.rack.known!.length).toBe(ps.rack.count)
  expect(ps.reserve.known!.length).toBe(ps.reserve.count)
  // never more than 3 copies of a type in the knowable universe
  for (const t of ALL_TROOP_TYPES) {
    const copies =
      ps.rack.known!.filter((x) => x === t).length +
      ps.reserve.known!.filter((x) => x === t).length +
      ps.discard.filter((x) => x === t).length +
      Object.values(state.board)
        .flat()
        .filter((e) => e.owner === p && e.troop === t).length
    expect(copies).toBeLessThanOrEqual(3)
  }
}

describe('random playouts stay consistent across asymmetric clients', () => {
  for (const terrain of TERRAINS) {
    for (const seed of [7, 99, 2026]) {
      it(`${terrain.id} (seed ${seed})`, () => {
        const ctx = makeCtx(terrain)
        const cfg = config(terrain.id, seed)
        const redTiles = testReserve(seed)
        const blueTiles = testReserve(seed * 31 + 1)

        // referee knows everything; each client knows only its own tiles
        let full = createGame(ctx, cfg, { red: redTiles, blue: blueTiles })
        let redClient = createGame(ctx, cfg, { red: redTiles })
        let blueClient = createGame(ctx, cfg, { blue: blueTiles })

        const rand = mulberry32(seed ^ 0xbeef)
        const medals = { red: 0, blue: 0 }

        for (let step = 0; step < 600 && !full.result; step++) {
          const actor = currentActor(full)
          const moves = legalMoves(ctx, full, actor)
          expect(moves.length).toBeGreaterThan(0)
          const move = moves[Math.floor(rand() * moves.length)]

          full = applyMove(ctx, full, actor, move)
          redClient = applyMove(ctx, redClient, actor, move)
          blueClient = applyMove(ctx, blueClient, actor, move)

          // the whole point: all three agree on every public fact, every step
          const h = publicHash(full)
          expect(publicHash(redClient)).toBe(h)
          expect(publicHash(blueClient)).toBe(h)

          conservation(full, 'red')
          conservation(full, 'blue')

          // medals are monotonic
          expect(full.players.red.medals).toBeGreaterThanOrEqual(medals.red)
          expect(full.players.blue.medals).toBeGreaterThanOrEqual(medals.blue)
          medals.red = full.players.red.medals
          medals.blue = full.players.blue.medals
        }

        // terrains without recycling effects must terminate
        if (terrain.id === 'caribbean-sea') expect(full.result).not.toBeNull()
        if (full.result) {
          expect(['hq', 'medals', 'stalemate', 'stalemateTie']).toContain(full.result.reason)
        }
      })
    }
  }

  it('replaying a recorded log reproduces the exact same public state', () => {
    const terrain = TERRAINS[0]
    const ctx = makeCtx(terrain)
    const cfg = config(terrain.id, 5)
    const redTiles = testReserve(5)
    const blueTiles = testReserve(6)

    let live = createGame(ctx, cfg, { red: redTiles, blue: blueTiles })
    const log: { actor: PlayerId; move: ReturnType<typeof legalMoves>[number] }[] = []
    const rand = mulberry32(123)
    while (!live.result && log.length < 200) {
      const actor = currentActor(live)
      const moves = legalMoves(ctx, live, actor)
      const move = moves[Math.floor(rand() * moves.length)]
      log.push({ actor, move })
      live = applyMove(ctx, live, actor, move)
    }

    let replayed = createGame(ctx, cfg, { red: redTiles, blue: blueTiles })
    for (const { actor, move } of log) replayed = applyMove(ctx, replayed, actor, move)
    expect(publicHash(replayed)).toBe(publicHash(live))
    expect(replayed.result).toEqual(live.result)
  })
})
