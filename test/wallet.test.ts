// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Mesh } from '@yujun/game-net/mesh'
import { Ledger, identityFromSeed, type Settlement } from '@yujun/game-net/wallet'
import { OnlineSession } from '../src/app/session.svelte'

class FakeLedger extends Ledger {
  posts: { action: string; player: string; msg: string }[] = []
  constructor() {
    super({ url: 'http://fake', anonKey: 'x' }, async (_input, init) => {
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 })
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { action: string; player: string; msg: string }
        this.posts.push(body)
        return json({ ok: true, status: body.action === 'settle' ? 'pending' : 'ok' })
      }
      return json([])
    })
  }
}

const ids = [1, 2].map((n) => identityFromSeed(new Uint8Array(32).fill(n)))
let clock = 1_000_000
const now = () => clock

describe('wallet settlement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    clock = 1_000_000
  })
  afterEach(() => vi.useRealTimers())

  it('maps the red/blue winner to a seat and both sides sign it', async () => {
    const mesh = new Mesh<never>()
    const ledger = new FakeLedger()
    const sessions = ids.map(
      (id, i) => new OnlineSession('WALLETTB', i === 0, { transport: mesh.peer(`peer-${i}`), now, timers: false, key: id.id, ledger, identity: id }),
    )
    const settle = async (rounds = 2) => {
      for (let i = 0; i < rounds; i++) {
        await vi.advanceTimersByTimeAsync(700)
        clock += 1000
        for (const s of sessions) s.net.tick()
        mesh.flush()
        await vi.advanceTimersByTimeAsync(0)
        mesh.flush()
      }
    }
    await settle(3)
    const [host, guest] = sessions
    expect(host.playing && guest.playing).toBe(true)

    // play a few moves, then the guest concedes
    for (let i = 0; i < 10; i++) {
      const active = host.myTurn ? host : guest
      const moves = active.myMoves()
      if (moves.length) active.submit(moves.find((m) => m.type === 'place') ?? moves[0])
      await settle(1)
    }
    guest.submit({ type: 'concede' })
    await settle(2)

    expect(host.state.result?.winner).toBe(host.side)
    const settles = ledger.posts.filter((p) => p.action === 'settle')
    expect(new Set(settles.map((p) => p.player)).size).toBe(2)
    const s = JSON.parse(settles[0].msg) as Settlement
    expect(s.app).toBe('toybattle')
    expect(s.winners).toEqual([host.side === 'red' ? 0 : 1])
    expect(s.seats.find((x) => x.seat === s.winners[0])!.player).toBe(host.net.myKey)
    for (const x of sessions) x.destroy()
  })
})
