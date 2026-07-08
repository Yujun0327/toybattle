// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'

// keep jsdom clear of real WebRTC / audio
vi.mock('../src/transport/trystero', () => ({
  connectRoom: () => ({
    send: () => {},
    onMessage: () => {},
    onPeerJoin: () => {},
    onPeerLeave: () => {},
    close: () => {},
  }),
  makeRoomCode: () => 'TESTAA',
}))
vi.mock('../src/ui/audio', () => ({ play: () => {}, setMuted: () => {}, isMuted: () => false }))

import App from '../src/App.svelte'

function click(el: Element | null) {
  if (!el) throw new Error('element not found')
  // SVG elements in jsdom have no .click(); dispatch the event directly
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  flushSync()
}

function buttonByText(text: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) ?? null
  )
}

describe('app UI', () => {
  let app: object

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    location.hash = ''
    app = mount(App, { target: document.getElementById('app')! })
    flushSync()
    return () => unmount(app)
  })

  it('renders the home screen', () => {
    expect(document.body.textContent).toContain('TOY')
    expect(document.body.textContent).toContain('BATTLE')
    expect(buttonByText('Hot-seat')).not.toBeNull()
    expect(buttonByText('Create room')).not.toBeNull()
  })

  it('opens the rules leaflet', () => {
    click(buttonByText('How to play'))
    expect(document.body.textContent).toContain('Supply line')
    expect(document.body.textContent).toContain('Kwak')
  })

  it('starts a hot-seat game and plays a first tile', () => {
    click(buttonByText('Hot-seat'))
    expect(document.body.textContent).toContain('Hot-seat battle')
    click(buttonByText('Start the battle'))

    // game screen is up
    expect(document.body.textContent).toMatch(/(RED|BLUE)'s turn/)
    expect(document.querySelector('svg.board')).not.toBeNull()

    // starter has 3 tiles on their own (bottom) rack — the first .tray is the foe's
    const slots = document.querySelectorAll('.mine-strip .tray button.slot')
    expect(slots.length).toBeGreaterThanOrEqual(3)

    // select the first tile → legal targets get halos
    click(slots[0])
    const halos = document.querySelectorAll('.halo')
    expect(halos.length).toBeGreaterThan(0)

    // click a highlighted base → the tile lands on the board
    const target = document.querySelector('svg.board g.clickable') as HTMLElement
    click(target)
    const placed = document.querySelectorAll('svg.board .tile')
    expect(placed.length).toBeGreaterThanOrEqual(1)
  })

  it('draw button works and passes the turn', () => {
    click(buttonByText('Hot-seat'))
    // casual mode so no handoff curtain interrupts
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
    checkbox.click()
    flushSync()
    click(buttonByText('Start the battle'))

    const before = document.body.textContent?.match(/(RED|BLUE)'s turn/)?.[1]
    // NB: tile tooltips also contain "Draw 2…", so match the action button precisely
    const drawBtn = [...document.querySelectorAll('button.btn')].find((b) =>
      b.textContent?.trim().startsWith('Draw 2'),
    )
    click(drawBtn ?? null)
    const after = document.body.textContent?.match(/(RED|BLUE)'s turn/)?.[1]
    expect(after).not.toBe(before)
  })

  it('creating a room shows the lobby with a copyable code', () => {
    click(buttonByText('Create room'))
    click(buttonByText('Create room & get link'))
    // jsdom fires hashchange asynchronously — nudge it by hand
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    flushSync()
    expect(location.hash).toContain('room=TESTAA')
    expect(document.body.textContent).toContain('TESTAA')
    expect(document.body.textContent).toMatch(/Setting up the room|Waiting for your friend/)
  })
})
