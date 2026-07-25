/** One-shot diagnostic: pair two browsers, then dump what each page actually shows. */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4199
const BASE = `http://localhost:${PORT}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
})
await sleep(1200)

const mk = async (name) => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  page.on('console', (m) => {
    if (m.text().includes('[toybattle]') || m.type() === 'error')
      console.log(`  ${name} console: ${m.text()}`)
  })
  page.on('pageerror', (e) => console.log(`  ${name} PAGEERROR: ${e.message}\n${e.stack}`))
  return { browser, page }
}

const a = await mk('A')
const b = await mk('B')

await a.page.goto(BASE)
await a.page.getByRole('button', { name: 'Create room' }).click()
await a.page.getByRole('button', { name: 'Create room & get link' }).click()
await a.page.waitForSelector('.code', { timeout: 10_000 })
const link = (await a.page.locator('.link').textContent())?.trim().replace(/^https?:\/\/[^/]+/, BASE)
console.log('link:', link)

await b.page.goto(link)
await sleep(10_000)

for (const [name, page] of [['A', a.page], ['B', b.page]]) {
  const hasBoard = (await page.locator('svg.board').count()) > 0
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400)
  console.log(`\n${name}: svg.board=${hasBoard}`)
  console.log(`${name} body: ${text}`)
  await page.screenshot({ path: `e2e/${name}-probe.png` })
}

await a.browser.close()
await b.browser.close()
server.kill()
