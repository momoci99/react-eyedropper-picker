import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, frame, pixelPoint, test } from '../helpers'

const src = (path: string) =>
  readFileSync(
    fileURLToPath(
      new URL(
        `../../../../packages/react-eyedropper-picker/src/${path}`,
        import.meta.url
      )
    ),
    'utf8'
  )

/** Names in `export { a, type B } from` and `export type { C } from` blocks. */
const reexports = (code: string) =>
  [...code.matchAll(/export (?:type )?\{([^}]*)\}/g)].flatMap(([, list]) =>
    list!
      .split(',')
      .map((s) => s.trim().replace(/^type /, ''))
      .filter(Boolean)
  )

/** `export const X` and `export type X` in a module. */
const declared = (code: string) =>
  [...code.matchAll(/^export (?:const|type) (\w+)/gm)].map(([, n]) => n!)

const BASE = [...reexports(src('index.ts')), ...declared(src('utils/color.ts'))]
const LOUPE = reexports(src('loupe/index.ts'))

for (const path of ['/api/', '/ko/api/']) {
  test(`${path} lists every export`, async ({ page }) => {
    await page.goto(path)
    const codes = await page.locator('.doc code').allTextContents()
    const missing = [...BASE, ...LOUPE].filter((name) => !codes.includes(name))
    expect(missing).toEqual([])
  })
}

test('the custom sound example plays its chime on pick', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { audioStarts: number }
    w.audioStarts = 0
    for (const node of [AudioScheduledSourceNode, AudioBufferSourceNode]) {
      const start = node.prototype.start
      node.prototype.start = function (
        this: AudioScheduledSourceNode,
        ...a: never[]
      ) {
        w.audioStarts++
        return (start as (...args: never[]) => void).apply(this, a)
      }
    }
  })
  await page.goto('/effects/')
  const image = page
    .locator('figure.example')
    .nth(1)
    .getByRole('button', { name: 'Pick a color from Pixel art landscape' })
  await image.scrollIntoViewIfNeeded()
  const point = await pixelPoint(image, 10, 10)
  await page.mouse.move(...point)
  await frame(page)
  await page.mouse.click(...point)
  // Two oscillators: the two notes of the chime. Pixel ticks are off.
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { audioStarts: number }).audioStarts
      )
    )
    .toBe(2)
})
