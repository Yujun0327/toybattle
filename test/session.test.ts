import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HotseatSession, OnlineSession } from '../src/app/session.svelte'
import { publicHash } from '../src/engine'
import type { Move } from '../src/engine'
import type { NetMsg, Transport } from '../src/transport/types'

/** A pair of loopback transports with async (microtask) delivery.
 *  dupes > 1 simulates MQTT multi-broker delivery (every message arrives N×). */
function transportPair(dupes = 1): [Transport, Transport, () => void] {
  const handlers: [((m: NetMsg, peerId: string) => void)[], ((m: NetMsg, peerId: string) => void)[]] = [
    [],
    [],
  ]
  const joins: [((peerId: string) => void)[], ((peerId: string) => void)[]] = [[], []]
  const queue: { to: 0 | 1; from: string; msg: NetMsg }[] = []
  const ids = ['peer-a', 'peer-b'] as const

  const flush = () => {
    while (queue.length) {
      const { to, from, msg } = queue.shift()!
      // JSON round-trip, like the real wire
      const clone = JSON.parse(JSON.stringify(msg)) as NetMsg
      for (const fn of handlers[to]) fn(clone, from)
    }
  }

  const make = (self: 0 | 1): Transport => ({
    send: (msg, target) => {
      const other = self === 0 ? 1 : 0
      if (target && target !== ids[other]) return
      for (let d = 0; d < dupes; d++) queue.push({ to: other, from: ids[self], msg })
    },
    onMessage: (fn) => void handlers[self].push(fn),
    onPeerJoin: (fn) => void joins[self].push(fn),
    onPeerLeave: () => {},
    close: () => {},
  })

  const a = make(0)
  const b = make(1)
  const connect = () => {
    for (const fn of joins[0]) fn(ids[1])
    for (const fn of joins[1]) fn(ids[0])
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

/** An n-peer mesh with explicit link control, for room-capacity tests. */
function transportMesh(n: number) {
  const handlers = Array.from({ length: n }, () => ({
    msg: [] as ((m: NetMsg, p: string) => void)[],
    join: [] as ((p: string) => void)[],
  }))
  const queue: { to: number; from: string; msg: NetMsg }[] = []
  const id = (i: number) => `peer-${i}`
  const links = new Set<string>()
  const flush = () => {
    while (queue.length) {
      const { to, from, msg } = queue.shift()!
      for (const fn of handlers[to].msg) fn(JSON.parse(JSON.stringify(msg)) as NetMsg, from)
    }
  }
  const transports = Array.from(
    { length: n },
    (_, self): Transport => ({
      send: (msg, target) => {
        for (let o = 0; o < n; o++) {
          if (o === self || !links.has(`${self}|${o}`)) continue
          if (target && target !== id(o)) continue
          queue.push({ to: o, from: id(self), msg })
        }
      },
      onMessage: (fn) => void handlers[self].msg.push(fn),
      onPeerJoin: (fn) => void handlers[self].join.push(fn),
      onPeerLeave: () => {},
      close: () => {},
    }),
  )
  const connect = (a: number, b: number) => {
    links.add(`${a}|${b}`)
    links.add(`${b}|${a}`)
    for (const fn of handlers[a].join) fn(id(b))
    for (const fn of handlers[b].join) fn(id(a))
    flush()
  }
  const interval = setInterval(flush, 1)
  interval.unref?.()
  return { transports, connect }
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

  it('triplicated delivery (MQTT multi-broker) stays perfectly in sync', async () => {
    const [ta, tb, connect] = transportPair(3)
    const host = new OnlineSession('TEST44', true, ta)
    host.pickedTerrain = 'castle-field'
    const guest = new OnlineSession('TEST44', false, tb)
    connect()
    await settle(2)
    expect(host.playing).toBe(true)
    expect(guest.playing).toBe(true)

    let guard = 0
    while (!host.state.result && guard++ < 200) {
      const active = host.myTurn ? host : guest
      const moves = active.myMoves()
      if (moves.length === 0) {
        await settle(2)
        continue
      }
      active.submit(moves[Math.floor(Math.random() * moves.length)])
      await settle(1)
      expect(publicHash(host.state)).toBe(publicHash(guest.state))
      expect(host.status).not.toBe('desync')
      expect(guest.status).not.toBe('desync')
    }
  })

  it('a third player is turned away and cannot disturb the game', async () => {
    const { transports, connect } = transportMesh(3)
    const host = new OnlineSession('TEST43', true, transports[0])
    host.pickedTerrain = 'castle-field'
    const guest = new OnlineSession('TEST43', false, transports[1])
    connect(0, 1)
    await settle(2)
    expect(host.playing).toBe(true)
    expect(guest.playing).toBe(true)

    const intruder = new OnlineSession('TEST43', false, transports[2])
    connect(0, 2)
    connect(1, 2)
    await settle(4)
    expect(intruder.status).toBe('room-full')
    expect(intruder.playing).toBe(false)

    // the locked pair keeps playing, unaffected
    const active = host.myTurn ? host : guest
    const moves = active.myMoves()
    active.submit(moves.find((m) => m.type === 'draw') ?? moves[0])
    await settle(2)
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
    expect(host.status).not.toBe('desync')
    expect(guest.status).not.toBe('desync')
  })
})
