import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HotseatSession, OnlineSession } from '../src/app/session.svelte'
import { publicHash } from '../src/engine'
import type { Move } from '../src/engine'
import type { NetMsg, Transport } from '../src/transport/types'

/** A pair of loopback transports with async (microtask) delivery. */
function transportPair(): [Transport, Transport, () => void] {
  const handlers: [((m: NetMsg) => void)[], ((m: NetMsg) => void)[]] = [[], []]
  const joins: [(() => void)[], (() => void)[]] = [[], []]
  const queue: { to: 0 | 1; msg: NetMsg }[] = []

  const flush = () => {
    while (queue.length) {
      const { to, msg } = queue.shift()!
      // JSON round-trip, like the real wire
      const clone = JSON.parse(JSON.stringify(msg)) as NetMsg
      for (const fn of handlers[to]) fn(clone)
    }
  }

  const make = (self: 0 | 1): Transport => ({
    send: (msg) => void queue.push({ to: self === 0 ? 1 : 0, msg }),
    onMessage: (fn) => void handlers[self].push(fn),
    onPeerJoin: (fn) => void joins[self].push(fn),
    onPeerLeave: () => {},
    close: () => {},
  })

  const a = make(0)
  const b = make(1)
  const connect = () => {
    for (const fn of joins[0]) fn()
    for (const fn of joins[1]) fn()
    flush()
  }
  // deliver pending messages whenever timers advance
  const interval = setInterval(flush, 1)
  interval.unref?.()
  return [a, b, connect]
}

async function settle(rounds = 20) {
  for (let i = 0; i < rounds; i++) {
    await vi.advanceTimersByTimeAsync(700)
  }
}

describe('sessions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hot-seat: a full random game plays to completion through the session', async () => {
    const session = new HotseatSession('castle-field', true)
    let guard = 0
    while (!session.state.result && guard++ < 400) {
      const moves = session.myMoves()
      if (moves.length === 0) {
        // an auto-response (reveal/skip/stalemate) is queued — let it fire
        await settle(2)
        continue
      }
      session.submit(moves[Math.floor(Math.random() * moves.length)])
      await settle(1)
    }
    expect(session.state.result).not.toBeNull()
  })

  it('online: two sessions handshake, play, and stay in sync', async () => {
    const [ta, tb, connect] = transportPair()
    const host = new OnlineSession('TEST42', true, ta)
    host.pickedTerrain = 'caribbean-sea'
    const guest = new OnlineSession('TEST42', false, tb)
    connect()
    await settle(2)

    expect(host.playing).toBe(true)
    expect(guest.playing).toBe(true)
    expect(host.side).not.toBe(guest.side)
    expect(host.terrain.id).toBe('caribbean-sea')
    expect(publicHash(host.state)).toBe(publicHash(guest.state))

    // hidden info: each side sees only its own tiles
    expect(host.state.players[host.side].rack.known).toBeDefined()
    expect(host.state.players[guest.side].rack.known).toBeUndefined()

    let guard = 0
    while (!host.state.result && guard++ < 500) {
      const active = host.myTurn ? host : guest
      const moves = active.myMoves()
      if (moves.length === 0) {
        await settle(2)
        continue
      }
      const preferred =
        moves.find((m: Move) => m.type === 'place') ?? moves[Math.floor(Math.random() * moves.length)]
      active.submit(preferred)
      await settle(1)
      expect(publicHash(host.state)).toBe(publicHash(guest.state))
      expect(host.status).not.toBe('desync')
      expect(guest.status).not.toBe('desync')
    }
    expect(host.state.result).not.toBeNull()
    expect(guest.state.result).toEqual(host.state.result)
  })
})
