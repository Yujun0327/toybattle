/**
 * Objective two-browser pairing harness.
 *
 * Reproduces the exact human flow with two ISOLATED Chromium processes
 * against the production build:
 *   1. browser A creates a room   2. harness carries the link
 *   3. browser B opens it         4. assert BOTH reach the game screen
 *
 * Usage:
 *   node e2e/pairing.mjs                     # default scenarios, 1 run each
 *   node e2e/pairing.mjs --runs=5            # repeat each scenario
 *   node e2e/pairing.mjs --scenario=idle90   # one scenario
 *   node e2e/pairing.mjs --slow              # include the 5-minute idle case
 */
import { execSync, spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4199
const BASE = `http://localhost:${PORT}`
const args = process.argv.slice(2)
const flag = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : dflt
}
const RUNS = Number(flag('runs', '1'))
const ONLY = flag('scenario', null)
const SLOW = args.includes('--slow')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** One isolated browser process with console capture. */
async function side(name, logs) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const t0 = Date.now()
  page.on('console', (m) => {
    const text = m.text()
    if (text.includes('[toybattle]') || m.type() === 'error') {
      logs.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${name}: ${text}`)
    }
  })
  page.on('pageerror', (err) => logs.push(`${name} PAGEERROR: ${err.message}`))
  return { name, browser, page }
}

async function createRoom(page) {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Create room' }).click()
  await page.getByRole('button', { name: 'Create room & get link' }).click()
  await page.waitForSelector('.code', { timeout: 10_000 })
  const link = (await page.locator('.link').textContent())?.trim()
  if (!link?.includes('#room=')) throw new Error(`no room link found: ${link}`)
  return link.replace(/^https?:\/\/[^/]+/, BASE)
}

async function inGame(page, timeoutMs) {
  await page.waitForSelector('svg.board', { timeout: timeoutMs })
}

async function bothInGame(a, b, timeoutMs, logs) {
  const deadline = `both sides must reach the game screen within ${timeoutMs / 1000}s`
  try {
    await Promise.all([inGame(a.page, timeoutMs), inGame(b.page, timeoutMs)])
  } catch {
    throw new Error(deadline)
  }
  void logs
}

/* ---------------- scenarios ---------------- */

const scenarios = {
  async immediate(logs) {
    const a = await side('A', logs)
    const b = await side('B', logs)
    try {
      const link = await createRoom(a.page)
      await b.page.goto(link)
      await bothInGame(a, b, 20_000, logs)
    } finally {
      await a.browser.close()
      await b.browser.close()
    }
  },

  async idle90(logs) {
    const a = await side('A', logs)
    const b = await side('B', logs)
    try {
      const link = await createRoom(a.page)
      logs.push('… creator idling 90s before friend joins')
      await sleep(90_000)
      await b.page.goto(link)
      await bothInGame(a, b, 30_000, logs)
    } finally {
      await a.browser.close()
      await b.browser.close()
    }
  },

  async idle300(logs) {
    const a = await side('A', logs)
    const b = await side('B', logs)
    try {
      const link = await createRoom(a.page)
      logs.push('… creator idling 300s before friend joins')
      await sleep(300_000)
      await b.page.goto(link)
      await bothInGame(a, b, 40_000, logs)
    } finally {
      await a.browser.close()
      await b.browser.close()
    }
  },

  async hidden(logs) {
    const a = await side('A', logs)
    const b = await side('B', logs)
    try {
      const link = await createRoom(a.page)
      const cdp = await a.page.context().newCDPSession(a.page)
      await cdp.send('Page.setWebLifecycleState', { state: 'frozen' })
      logs.push('… creator tab frozen for 60s')
      await sleep(60_000)
      await b.page.goto(link)
      await sleep(8_000)
      await cdp.send('Page.setWebLifecycleState', { state: 'active' })
      logs.push('… creator tab unfrozen')
      await bothInGame(a, b, 30_000, logs)
    } finally {
      await a.browser.close()
      await b.browser.close()
    }
  },

  async refresh(logs) {
    const a = await side('A', logs)
    const b = await side('B', logs)
    try {
      const link = await createRoom(a.page)
      await b.page.goto(link)
      await bothInGame(a, b, 20_000, logs)
      logs.push('… reloading creator mid-game')
      await a.page.reload()
      await bothInGame(a, b, 25_000, logs)
    } finally {
      await a.browser.close()
      await b.browser.close()
    }
  },

  async third(logs) {
    const a = await side('A', logs)
    const b = await side('B', logs)
    const c = await side('C', logs)
    try {
      const link = await createRoom(a.page)
      await b.page.goto(link)
      await bothInGame(a, b, 20_000, logs)
      await c.page.goto(link)
      await c.page.waitForSelector('text=/two players/', { timeout: 25_000 })
      await bothInGame(a, b, 5_000, logs) // pair unaffected
    } finally {
      await a.browser.close()
      await b.browser.close()
      await c.browser.close()
    }
  },
}

/* ---------------- runner ---------------- */

console.log('building production bundle…')
execSync('npx vite build', { stdio: 'ignore' })
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: false,
})
await sleep(1500)

const names = ONLY
  ? [ONLY]
  : ['immediate', 'refresh', 'third', 'hidden', 'idle90', ...(SLOW ? ['idle300'] : [])]

let failed = 0
for (const name of names) {
  if (!scenarios[name]) {
    console.error(`unknown scenario: ${name}`)
    process.exit(2)
  }
  for (let run = 1; run <= RUNS; run++) {
    const logs = []
    const started = Date.now()
    try {
      await scenarios[name](logs)
      console.log(`PASS  ${name} #${run}  (${((Date.now() - started) / 1000).toFixed(0)}s)`)
    } catch (err) {
      failed++
      console.log(`FAIL  ${name} #${run}  — ${err.message}`)
      for (const line of logs.slice(-60)) console.log(`   ${line}`)
    }
  }
}

server.kill()
console.log(failed === 0 ? '\nALL SCENARIOS PASS' : `\n${failed} FAILURE(S)`)
process.exit(failed === 0 ? 0 : 1)
