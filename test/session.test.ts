// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Mesh } from '@yujun/game-net/mesh'
import { HotseatSession, OnlineSession } from '../src/app/session.svelte'
import { publicHash } from '../src/engine'
import type { Move } from '../src/engine'

const ROOM = 'TEST42'
let clock = 1_000_000
const now = () => clock

/** Deterministic room: an in-memory broadcast mesh plus a manual clock. */
class World {
  mesh = new Mesh<never>()
  sessions: OnlineSession[] = []

  add(i: number, creator = false, terrain?: string): OnlineSession {
    const s = new OnlineSession(ROOM, creator, {
      transport: this.mesh.peer(`peer-${i}`),
      now,
      timers: false,
      key: `key-${i}`,
    })
    if (terrain) s.pickedTerrain = terrain
    this.sessions.push(s)
    return s
  }

  /** Real time advances (auto-responses fire), then a second of beacons. */
  async settle(rounds = 2): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      await vi.advanceTimersByTimeAsync(700)
      clock += 1000
      for (const s of this.sessions) s.net.tick()
      this.mesh.flush()
      await vi.advanceTimersByTimeAsync(0)
      this.mesh.flush()
    }
  }

  remove(s: OnlineSession): void {
    s.destroy()
    this.sessions = this.sessions.filter((x) => x !== s)
  }
}

async function pair(w: World, terrain = 'castle-field'): Promise<[OnlineSession, OnlineSession]> {
  const host = w.add(0, true, terrain)
  const guest = w.add(1)
  await w.settle(3)
  return [host, guest]
}

describe('sessions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    clock = 1_000_000
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
        await vi.advanceTimersByTimeAsync(1400)
        continue
      }
      session.submit(moves[Math.floor(Math.random() * moves.length)])
      await vi.advanceTimersByTimeAsync(700)
    }
    expect(session.state.result).not.toBeNull()
  })

  it('online: two sessions pair, play, and stay in sync', async () => {
    const w = new World()
    const [host, guest] = await pair(w, 'caribbean-sea')

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
        await w.settle(2)
        continue
      }
      const preferred =
        moves.find((m: Move) => m.type === 'place') ?? moves[Math.floor(Math.random() * moves.length)]
      active.submit(preferred)
      await w.settle(1)
      expect(publicHash(host.state)).toBe(publicHash(guest.state))
      expect(host.status).not.toBe('desync')
      expect(guest.status).not.toBe('desync')
    }
    expect(host.state.result).not.toBeNull()
    expect(guest.state.result).toEqual(host.state.result)
  })

  it('lossy delivery (40% of beacons dropped) stays in sync', async () => {
    const w = new World()
    const [host, guest] = await pair(w)
    let n = 0
    w.mesh.filter = () => n++ % 5 > 1
    let guard = 0
    while (!host.state.result && guard++ < 200) {
      const active = host.myTurn ? host : guest
      const moves = active.myMoves()
      if (moves.length === 0 || (active.state.result !== null)) {
        await w.settle(2)
        continue
      }
      active.submit(moves[Math.floor(Math.random() * moves.length)])
      await w.settle(1)
      expect(host.status).not.toBe('desync')
      expect(guest.status).not.toBe('desync')
    }
    w.mesh.filter = () => true
    await w.settle(4)
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
  })

  it('a third player is turned away and cannot disturb the game', async () => {
    const w = new World()
    const [host, guest] = await pair(w)
    const intruder = w.add(2)
    await w.settle(3)
    expect(intruder.status).toBe('room-full')
    expect(intruder.playing).toBe(false)

    const active = host.myTurn ? host : guest
    const moves = active.myMoves()
    active.submit(moves.find((m) => m.type === 'draw') ?? moves[0])
    await w.settle(2)
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
    expect(host.status).not.toBe('desync')
  })

  it('a refresh restores the game, the seat and the hidden reserve', async () => {
    const w = new World()
    const [host, guest] = await pair(w)
    for (let i = 0; i < 4; i++) {
      const active = host.myTurn ? host : guest
      const moves = active.myMoves()
      if (moves.length === 0) {
        await w.settle(2)
        continue
      }
      active.submit(moves[0])
      await w.settle(1)
    }
    const side = guest.side
    const rack = guest.state.players[side].rack
    w.remove(guest)
    const again = w.add(1)
    expect(again.playing).toBe(true)
    expect(again.side).toBe(side)
    expect(again.state.players[side].rack).toEqual(rack)
    await w.settle(2)
    expect(publicHash(again.state)).toBe(publicHash(host.state))
    expect(host.status).toBe('playing')
  })

  it('reports peer-left when the opponent goes quiet, then recovers', async () => {
    const w = new World()
    const [host, guest] = await pair(w)
    w.mesh.filter = (_m, from) => from !== 'peer-1'
    await w.settle(17)
    expect(host.status).toBe('peer-left')
    expect(host.peerHere).toBe(false)
    w.mesh.filter = () => true
    await w.settle(8) // the guest's steady-state heartbeat is 6s apart
    expect(host.status).toBe('playing')
    expect(guest.status).toBe('playing')
  })
})
