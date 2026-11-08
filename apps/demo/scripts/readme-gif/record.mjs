// Records the README GIF: starts Vite, plays scene.tsx in headless Chromium,
// and encodes the screencast.
//
//   pnpm readme-gif                 # writes apps/demo/public/loupe-demo.gif
//   pnpm readme-gif out.gif         # somewhere else
//
// Needs Playwright's Chromium (pnpm e2e:install). The result differs a
// little on every run, so commit a new GIF only when the UI changed.
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { encodeGif } from './gif.mjs'
import { decodePng } from './png.mjs'

const demo = fileURLToPath(new URL('../..', import.meta.url))
// pnpm passes a `--` separator through; skip it.
const arg = process.argv.slice(2).find((a) => a !== '--')
// INIT_CWD: where pnpm was run, so a relative path means what the user typed.
const out = arg
  ? resolve(process.env.INIT_CWD ?? process.cwd(), arg)
  : resolve(demo, 'public/loupe-demo.gif')
const FPS = 20
/** CSS px per pixel-art pixel: 432px wide image, 48 pixels across. */
const CELL = 9

const server = await createServer({
  root: demo,
  logLevel: 'warn',
  server: { port: 5194, open: false },
})
await server.listen()
const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: 960, height: 370 },
    deviceScaleFactor: 2,
  })
  await page.goto(
    new URL('scripts/readme-gif/scene.html', server.resolvedUrls.local[0]).href
  )
  const img = page.getByRole('button', {
    name: 'Pick a color from Pixel art landscape',
  })
  await img.waitFor()
  await page.waitForTimeout(500)
  const box = await img.boundingBox()
  /** Center of a pixel-art pixel. */
  const at = (x, y) => [box.x + (x + 0.5) * CELL, box.y + (y + 0.5) * CELL]

  const shots = []
  const cdp = await page.context().newCDPSession(page)
  cdp.on('Page.screencastFrame', async (f) => {
    shots.push({ t: f.metadata.timestamp, data: f.data })
    await cdp
      .send('Page.screencastFrameAck', { sessionId: f.sessionId })
      .catch(() => {})
  })

  const pause = (ms) => page.waitForTimeout(ms)
  let cur = [box.x - 60, box.y + box.height * 0.45]
  await page.mouse.move(...cur)
  /** Moves the mouse with ease-in-out, one step per frame. */
  const glide = async (to, ms) => {
    const from = cur
    const n = Math.max(1, Math.round(ms / 16))
    for (let i = 1; i <= n; i++) {
      const k = i / n
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
      await page.mouse.move(
        from[0] + (to[0] - from[0]) * e,
        from[1] + (to[1] - from[1]) * e
      )
      await pause(16)
    }
    cur = to
  }
  const wheel = async (dy, times) => {
    for (let i = 0; i < times; i++) {
      await page.mouse.wheel(0, dy)
      await pause(140)
    }
  }
  const pick = async () => {
    await page.mouse.click(...cur)
    await pause(550)
  }

  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
  await pause(250)
  await glide(at(6, 12), 450) // into the sky
  await glide(at(30, 9), 650) // sweep right
  await glide(at(36, 11), 300) // onto the sun
  await wheel(-200, 3) // zoom in
  await pause(250)
  await pick()
  await glide(at(29, 22), 550) // trees
  await pick()
  await glide(at(15, 20), 550) // roof
  await pick()
  await wheel(200, 3) // zoom out
  await pause(150)
  await glide([box.x + box.width + 30, cur[1]], 450) // leave: loupe shrinks out
  await pause(900)
  await cdp.send('Page.stopScreencast')

  // Resample to a steady frame rate: each slot shows the latest shot.
  const pngs = []
  const start = shots[0].t
  const end = shots.at(-1).t
  for (let t = start, j = 0; t <= end; t += 1 / FPS) {
    while (j + 1 < shots.length && shots[j + 1].t <= t) j++
    pngs.push(Buffer.from(shots[j].data, 'base64'))
  }
  // The screencast sends nothing once the page stops changing, so hold the
  // final state for a second.
  const still = await page.screenshot({ scale: 'css' })
  for (let k = 0; k < FPS; k++) pngs.push(still)

  const { gif, frames, quantized } = encodeGif(pngs.map(decodePng), FPS)
  writeFileSync(out, gif)
  console.log(
    `${out}: ${(pngs.length / FPS).toFixed(1)} s, ${frames} frames ` +
      `(${quantized} quantized), ${(gif.length / 1024).toFixed(0)} KB`
  )
} finally {
  await browser.close()
  await server.close()
}
