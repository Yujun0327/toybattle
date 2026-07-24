import { describe, expect, it } from 'vitest'
import {
  applyMove,
  createGame,
  isFrozen,
  legalMoves,
  makeCtx,
  publicHash,
  redact,
  RulesError,
  topOf,
} from '../src/engine'
import { getTerrain } from '../src/terrains'
import { config, hotseatGame, mini, put, setRack, testReserve } from './helpers'

describe('setup', () => {
  it('racks 3 tiles for the starter and 4 for the opponent', () => {
    const { state } = hotseatGame()
    expect(state.players.red.rack.count).toBe(3)
    expect(state.players.blue.rack.count).toBe(4)
    expect(state.players.red.reserve.count).toBe(17)
    expect(state.players.blue.reserve.count).toBe(16)
    expect(state.turn).toBe('red')
  })

  it('rejects malformed reserves', () => {
    const ctx = makeCtx(mini)
    expect(() => createGame(ctx, config('mini'), { red: testReserve(1).slice(1) })).toThrow(RulesError)
  })
})

describe('draw action', () => {
  it('draws 2, or 1 when the rack is at 7, and never past 8', () => {
    const { ctx, state } = hotseatGame()
    let s = applyMove(ctx, state, 'red', { type: 'draw' })
    expect(s.players.red.rack.count).toBe(5)
    expect(s.players.red.reserve.count).toBe(15)
    expect(s.turn).toBe('blue')

    setRack(s, 'blue', Array(7).fill('skully'))
    s = applyMove(ctx, s, 'blue', { type: 'draw' })
    expect(s.players.blue.rack.count).toBe(8)

    setRack(s, 'red', Array(8).fill('skully'))
    expect(() => applyMove(ctx, s, 'red', { type: 'draw' })).toThrow(RulesError)
  })
})

describe('placement rules', () => {
  it('requires connection to your HQ', () => {
    const { ctx, state } = hotseatGame()
    setRack(state, 'red', ['roxy'])
    expect(() => applyMove(ctx, state, 'red', { type: 'place', troop: 'roxy', base: 'b1' })).toThrow(
      /illegal placement/,
    )
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'roxy', base: 'a1' })
    expect(topOf(s, 'a1')).toEqual({ owner: 'red', troop: 'roxy' })
  })

  it('enemy tiles are only covered by strictly higher strength; Kwak covers and is covered by anything', () => {
    const { ctx, state } = hotseatGame()
    put(state, 'a1', 'red', 'roxy') // red occupies a1 → its neighbors are connected for red
    put(state, 'b1', 'blue', 'jumbo') // strength 3

    setRack(state, 'red', ['jumbo', 'capn', 'hook', 'kwak'])
    // equal strength: illegal
    expect(() => applyMove(ctx, state, 'red', { type: 'place', troop: 'jumbo', base: 'b1' })).toThrow()
    // lower: illegal
    expect(() => applyMove(ctx, state, 'red', { type: 'place', troop: 'capn', base: 'b1' })).toThrow()
    // higher: legal
    expect(topOf(applyMove(ctx, state, 'red', { type: 'place', troop: 'hook', base: 'b1' }), 'b1')!.troop).toBe(
      'hook',
    )
    // joker: legal over anything
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'kwak', base: 'b1' })
    expect(topOf(s, 'b1')!.troop).toBe('kwak')
    // ...and anything covers the joker back
    setRack(s, 'blue', ['skully'])
    const s2 = applyMove(ctx, s, 'blue', { type: 'place', troop: 'skully', base: 'b1' })
    expect(topOf(s2, 'b1')).toEqual({ owner: 'blue', troop: 'skully' })
    expect(s2.board.b1.length).toBe(3) // stack grew, never reordered
  })

  it('own tiles can always be stacked on, but only when connected', () => {
    const { ctx, state } = hotseatGame()
    put(state, 'b2', 'red', 'roxy') // stranded: not connected to red HQ
    setRack(state, 'red', ['skully'])
    expect(() => applyMove(ctx, state, 'red', { type: 'place', troop: 'skully', base: 'b2' })).toThrow()
  })

  it('enemy-occupied bases cut the connection path', () => {
    const { ctx, state } = hotseatGame()
    put(state, 'a1', 'blue', 'roxy')
    put(state, 'a2', 'blue', 'roxy')
    setRack(state, 'red', ['skully'])
    // red's frontier is only a1/a2 (both blocked by stronger tiles); b1/b2 unreachable
    expect(legalMoves(ctx, state, 'red').filter((m) => m.type === 'place')).toEqual([])
  })

  it('Hook ignores connection for bases but not for the enemy HQ', () => {
    const { ctx, state } = hotseatGame()
    setRack(state, 'red', ['hook', 'hook'])
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'hook', base: 'b2' })
    expect(topOf(s, 'b2')!.troop).toBe('hook')
    setRack(s, 'red', ['hook'])
    s.turn = 'red'
    expect(() => applyMove(ctx, s, 'red', { type: 'place', troop: 'hook', base: 'hq-blue' })).toThrow()
  })
})

describe('winning', () => {
  it('capturing the enemy HQ wins instantly (requires connection)', () => {
    const { ctx, state } = hotseatGame()
    setRack(state, 'red', ['skully', 'skully'])
    expect(() => applyMove(ctx, state, 'red', { type: 'place', troop: 'skully', base: 'hq-blue' })).toThrow()
    put(state, 'a1', 'red', 'roxy')
    put(state, 'b1', 'red', 'roxy')
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'skully', base: 'hq-blue' })
    expect(s.result).toEqual({ winner: 'red', reason: 'hq' })
    expect(topOf(s, 'hq-blue')).toEqual({ owner: 'red', troop: 'skully' }) // the flag-capturing tile is visible
  })

  it('surrounding a region claims its medals once and can win by objective', () => {
    const { ctx, state } = hotseatGame()
    put(state, 'a1', 'red', 'roxy')
    put(state, 'a2', 'red', 'roxy')
    put(state, 'b1', 'red', 'roxy')
    setRack(state, 'red', ['star'])
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'star', base: 'b2' })
    expect(s.players.red.medals).toBe(1)
    expect(s.regionsClaimed['r-a1']).toBe('red')
    expect(s.result).toEqual({ winner: 'red', reason: 'medals' }) // mini objective is 1
  })

  it('claimed regions never re-award', () => {
    const { ctx, state } = hotseatGame('castle-field')
    // hand red the r-top-left pocket (tl, gt, rt, ct); the completing tile
    // lands on gt, which has no special-base effect
    for (const b of ['tl', 'rt', 'ct']) put(state, b, 'red', 'roxy')
    setRack(state, 'red', ['star'])
    let s = applyMove(ctx, state, 'red', { type: 'place', troop: 'star', base: 'gt' })
    expect(s.players.red.medals).toBe(1)
    expect(s.regionsClaimed['r-top-left']).toBe('red')
    // blue seizes rt (cheat placement), then red re-completes the region — no second award
    put(s, 'rt', 'blue', 'roxy')
    s.turn = 'red'
    setRack(s, 'red', ['kwak'])
    s = applyMove(ctx, s, 'red', { type: 'place', troop: 'kwak', base: 'rt' })
    expect(s.regionsClaimed['r-top-left']).toBe('red')
    expect(s.players.red.medals).toBe(1)
  })

  it('concede hands the win to the opponent', () => {
    const { ctx, state } = hotseatGame()
    const s = applyMove(ctx, state, 'blue', { type: 'concede' })
    expect(s.result).toEqual({ winner: 'red', reason: 'concede' })
  })
})

describe('stalemate', () => {
  function stuckState() {
    const { ctx, state } = hotseatGame()
    put(state, 'a1', 'blue', 'roxy')
    put(state, 'a2', 'blue', 'roxy')
    setRack(state, 'red', Array(8).fill('skully')) // rack full → no draw; nothing beats roxy
    return { ctx, state }
  }

  it('is the only legal move when stuck, and the stuck player loses ties', () => {
    const { ctx, state } = stuckState()
    expect(legalMoves(ctx, state, 'red')).toEqual([{ type: 'stalemate' }])
    const s = applyMove(ctx, state, 'red', { type: 'stalemate' })
    expect(s.result).toEqual({ winner: 'blue', reason: 'stalemateTie' })
  })

  it('most medals wins a stalemate', () => {
    const { ctx, state } = stuckState()
    state.players.red.medals = 3
    state.players.blue.medals = 1
    const s = applyMove(ctx, state, 'red', { type: 'stalemate' })
    expect(s.result).toEqual({ winner: 'red', reason: 'stalemate' })
  })

  it('cannot be declared while moves remain', () => {
    const { ctx, state } = stuckState()
    setRack(state, 'red', [...Array(7).fill('skully'), 'kwak']) // kwak covers roxy
    expect(() => applyMove(ctx, state, 'red', { type: 'stalemate' })).toThrow(/still place/)
  })
})

describe('troop effects', () => {
  it('Skully draws 2 (1 when the rack is at 7)', () => {
    const { ctx, state } = hotseatGame()
    setRack(state, 'red', ['skully'])
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'skully', base: 'a1' })
    expect(s.players.red.rack.count).toBe(2) // played 1 of 1, drew 2
    expect(s.players.red.reserve.count).toBe(15)

    const { ctx: c2, state: s2 } = hotseatGame()
    setRack(s2, 'red', Array(8).fill('skully'))
    const s3 = applyMove(c2, s2, 'red', { type: 'place', troop: 'skully', base: 'a1' })
    expect(s3.players.red.rack.count).toBe(8) // 7 after playing, drew only 1
  })

  it('Star draws 1', () => {
    const { ctx, state } = hotseatGame()
    setRack(state, 'red', ['star'])
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'star', base: 'a1' })
    expect(s.players.red.rack.count).toBe(1)
  })

  it("Cap'n chains an extra placement whose own effect also resolves", () => {
    const { ctx, state } = hotseatGame()
    setRack(state, 'red', ['capn', 'star'])
    let s = applyMove(ctx, state, 'red', { type: 'place', troop: 'capn', base: 'a1' })
    expect(s.pending).toEqual({ kind: 'capnPlace', actor: 'red', optional: true })
    expect(s.turn).toBe('red') // turn has not passed yet
    s = applyMove(ctx, s, 'red', { type: 'choice', value: { place: { troop: 'star', base: 'a2' } } })
    expect(topOf(s, 'a2')!.troop).toBe('star')
    expect(s.players.red.rack.count).toBe(1) // star's draw-1 resolved inside the chain
    expect(s.turn).toBe('blue')
  })

  it("Cap'n can be skipped, and creates no pending with an empty rack", () => {
    const { ctx, state } = hotseatGame()
    setRack(state, 'red', ['capn', 'roxy'])
    let s = applyMove(ctx, state, 'red', { type: 'place', troop: 'capn', base: 'a1' })
    s = applyMove(ctx, s, 'red', { type: 'skip' })
    expect(s.turn).toBe('blue')

    setRack(state, 'red', ['capn'])
    const s2 = applyMove(ctx, state, 'red', { type: 'place', troop: 'capn', base: 'a1' })
    expect(s2.pending).toBeNull()
    expect(s2.turn).toBe('blue')
  })

  it('Jumbo may discard an adjacent visible enemy troop', () => {
    const { ctx, state } = hotseatGame()
    put(state, 'a1', 'red', 'roxy')
    put(state, 'b1', 'blue', 'skully')
    setRack(state, 'red', ['jumbo'])
    let s = applyMove(ctx, state, 'red', { type: 'place', troop: 'jumbo', base: 'a1' })
    expect(s.pending).toMatchObject({ kind: 'jumboDiscard', options: ['b1'] })
    s = applyMove(ctx, s, 'red', { type: 'choice', value: { base: 'b1' } })
    expect(topOf(s, 'b1')).toBeUndefined()
    expect(s.players.blue.discard).toEqual(['skully'])
  })

  it("XB-42: the owner blind-picks a rack position, the victim reveals it", () => {
    const { ctx, state } = hotseatGame()
    setRack(state, 'red', ['xb42'])
    setRack(state, 'blue', ['roxy', 'star', 'kwak', 'hook'])
    let s = applyMove(ctx, state, 'red', { type: 'place', troop: 'xb42', base: 'a1' })
    expect(s.pending).toEqual({ kind: 'xb42Pick', actor: 'red', optional: true })

    // the attacker sees one blind option per opponent tile, plus skip
    const picks = legalMoves(ctx, s, 'red')
    expect(picks).toHaveLength(5)
    expect(picks).toContainEqual({ type: 'choice', value: { index: 2 } })

    s = applyMove(ctx, s, 'red', { type: 'choice', value: { index: 2 } })
    expect(s.pending).toEqual({ kind: 'xb42Reveal', actor: 'blue', index: 2 })

    const reveal = legalMoves(ctx, s, 'blue')
    expect(reveal).toEqual([{ type: 'choice', value: { troop: 'kwak' } }])
    s = applyMove(ctx, s, 'blue', reveal[0])
    expect(s.players.blue.rack.count).toBe(3)
    expect(s.players.blue.discard).toEqual(['kwak'])
    expect(s.turn).toBe('blue')
  })

  it('XB-42 can be skipped, and rejects out-of-range picks', () => {
    const { ctx, state } = hotseatGame()
    setRack(state, 'red', ['xb42'])
    setRack(state, 'blue', ['roxy'])
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'xb42', base: 'a1' })
    expect(() => applyMove(ctx, s, 'red', { type: 'choice', value: { index: 1 } })).toThrow(/bad rack/)
    const skipped = applyMove(ctx, s, 'red', { type: 'skip' })
    expect(skipped.pending).toBeNull()
    expect(skipped.players.blue.rack.count).toBe(1)
  })

  it('XB-42 fizzles against an empty rack', () => {
    const { ctx, state } = hotseatGame()
    setRack(state, 'red', ['xb42'])
    setRack(state, 'blue', [])
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'xb42', base: 'a1' })
    expect(s.pending).toBeNull()
    expect(s.sharedRngCursor).toBe(0)
    expect(s.turn).toBe('blue')
  })
})

describe('special bases', () => {
  it('Castle Field: return one of your other board troops to your rack', () => {
    const { ctx, state } = hotseatGame('castle-field')
    put(state, 'tl', 'red', 'roxy')
    put(state, 'gt', 'red', 'roxy') // hq → tl → gt connects the ct catapult platform
    setRack(state, 'red', ['star'])
    let s = applyMove(ctx, state, 'red', { type: 'place', troop: 'star', base: 'ct' })
    expect(s.pending).toMatchObject({ kind: 'castleReturn', options: ['tl', 'gt'] })
    s = applyMove(ctx, s, 'red', { type: 'choice', value: { base: 'tl' } })
    expect(topOf(s, 'tl')).toBeUndefined()
    expect(s.players.red.rack.known).toContain('roxy')
  })

  it('City of Clouds: cloud pads draw a troop', () => {
    const { ctx, state } = hotseatGame('city-of-clouds')
    put(state, 'a2', 'red', 'roxy')
    setRack(state, 'red', ['roxy'])
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'roxy', base: 'b2' })
    expect(s.players.red.rack.count).toBe(1) // played 1, cloud drew 1
  })

  it('Volcanic Jungle: shove an adjacent enemy troop, ignoring rules', () => {
    const { ctx, state } = hotseatGame('volcanic-jungle')
    put(state, 'a3', 'red', 'roxy')
    put(state, 'c3', 'blue', 'skully')
    setRack(state, 'red', ['roxy'])
    let s = applyMove(ctx, state, 'red', { type: 'place', troop: 'roxy', base: 'b3' })
    expect(s.pending!.kind).toBe('volcanicMove')
    const options = (s.pending as { options: { from: string; to: string }[] }).options
    expect(options).toContainEqual({ from: 'c3', to: 'd3' })
    expect(options).toContainEqual({ from: 'c3', to: 'c2' })
    expect(options).not.toContainEqual({ from: 'c3', to: 'b3' })
    s = applyMove(ctx, s, 'red', { type: 'choice', value: { move: { from: 'c3', to: 'd3' } } })
    expect(topOf(s, 'd3')).toEqual({ owner: 'blue', troop: 'skully' })
    expect(topOf(s, 'c3')).toBeUndefined()
  })

  it('Cursed Cemetery: recover a discarded troop', () => {
    const { ctx, state } = hotseatGame('cursed-cemetery')
    state.players.red.discard = ['roxy']
    put(state, 'a2', 'red', 'star')
    setRack(state, 'red', ['jumbo'])
    let s = applyMove(ctx, state, 'red', { type: 'place', troop: 'jumbo', base: 'b2' })
    expect(s.pending).toMatchObject({ kind: 'cemeteryRecover', options: ['roxy'] })
    s = applyMove(ctx, s, 'red', { type: 'choice', value: { troop: 'roxy' } })
    expect(s.players.red.discard).toEqual([])
    expect(s.players.red.rack.known).toContain('roxy')
  })

  it('Tropical Pool: strength gates block big toys and the joker', () => {
    const { ctx, state } = hotseatGame('tropical-pool')
    put(state, 'a1', 'red', 'star')
    put(state, 'b1', 'red', 'star') // c1 is now connected for red
    setRack(state, 'red', ['roxy', 'kwak', 'capn'])
    expect(() => applyMove(ctx, state, 'red', { type: 'place', troop: 'roxy', base: 'c1' })).toThrow()
    expect(() => applyMove(ctx, state, 'red', { type: 'place', troop: 'kwak', base: 'c1' })).toThrow()
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'capn', base: 'c1' })
    expect(topOf(s, 'c1')!.troop).toBe('capn')
  })

  it('Tropical Pool: HQs only fall to strength 1–5', () => {
    const { ctx, state } = hotseatGame('tropical-pool')
    // path along the bottom row, around the pool hole at c2
    for (const b of ['a3', 'b3', 'd3', 'e3']) put(state, b, 'red', 'star')
    put(state, 'c3', 'red', 'skully')
    setRack(state, 'red', ['roxy', 'hook'])
    expect(() => applyMove(ctx, state, 'red', { type: 'place', troop: 'roxy', base: 'hq-blue' })).toThrow()
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'hook', base: 'hq-blue' })
    expect(s.result).toEqual({ winner: 'red', reason: 'hq' })
  })

  it('Station Metal-X: troop effects fizzle on jammed pads', () => {
    const { ctx, state } = hotseatGame('station-metal-x')
    put(state, 'a1', 'red', 'roxy')
    put(state, 'b1', 'red', 'roxy')
    setRack(state, 'red', ['skully'])
    const s = applyMove(ctx, state, 'red', { type: 'place', troop: 'skully', base: 'c1' })
    expect(s.players.red.rack.count).toBe(0) // no draw happened
    expect(s.turn).toBe('blue')
  })

  it('Battlefield: freezes a random enemy troop; frozen tiles neither occupy nor get covered', () => {
    const { ctx, state } = hotseatGame('battlefield')
    put(state, 'a2', 'red', 'roxy')
    put(state, 'e1', 'blue', 'skully')
    setRack(state, 'red', ['roxy'])
    let s = applyMove(ctx, state, 'red', { type: 'place', troop: 'roxy', base: 'b2' })
    expect(isFrozen(s, 'e1')).toBe(true)
    // blue cannot cover its own frozen tile, and it doesn't anchor blue's connection
    setRack(s, 'blue', ['star'])
    expect(
      legalMoves(ctx, s, 'blue')
        .filter((m) => m.type === 'place')
        .map((m) => (m as { base: string }).base),
    ).not.toContain('e1')
    // thaws at the start of red's next turn
    s = applyMove(ctx, s, 'blue', { type: 'draw' })
    expect(isFrozen(s, 'e1')).toBe(false)
  })
})

describe('views and hashing', () => {
  it('redact strips the other player’s tiles but keeps counts, and public hashes agree', () => {
    const { state } = hotseatGame()
    const asRed = redact(state, 'red')
    expect(asRed.players.red.rack.known).toBeDefined()
    expect(asRed.players.blue.rack.known).toBeUndefined()
    expect(asRed.players.blue.rack.count).toBe(4)
    expect(publicHash(asRed)).toBe(publicHash(state))
  })
})
