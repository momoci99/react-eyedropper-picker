import { expect, frame, loupeDemo, pixelPoint, test } from '../helpers'

// Sounds can't be heard here; count the Web Audio sources the loupe starts.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { audioStarts: number }
    w.audioStarts = 0
    // AudioBufferSourceNode has its own start(), so patch both.
    for (const node of [AudioScheduledSourceNode, AudioBufferSourceNode]) {
      const start = node.prototype.start
      node.prototype.start = function (
        this: AudioScheduledSourceNode,
        ...args: never[]
      ) {
        w.audioStarts++
        return (start as (...a: never[]) => void).apply(this, args)
      }
    }
  })
  await page.goto('/')
  await expect(loupeDemo(page).image).toBeVisible()
})

const starts = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => (window as unknown as { audioStarts: number }).audioStarts
  )

/** Moves across `count` source pixels of row `y`, a frame per pixel. */
const sweep = async (
  page: import('@playwright/test').Page,
  count: number,
  y = 10
) => {
  const { image } = loupeDemo(page)
  for (let x = 4; x < 4 + count; x++) {
    await page.mouse.move(...(await pixelPoint(image, x, y)))
    await frame(page)
  }
}

test('hover: ticks while moving, clicks on pick', async ({ page }) => {
  const { image } = loupeDemo(page)
  // A click anywhere is the gesture that lets audio start.
  await page.locator('h1').click()
  await sweep(page, 8)
  const ticks = await starts(page)
  expect(ticks).toBeGreaterThan(0)

  await page.mouse.click(...(await pixelPoint(image, 11, 10)))
  await expect.poll(() => starts(page)).toBeGreaterThan(ticks)
})

test('hover: wheel zoom ticks per detent', async ({ page }) => {
  const { image } = loupeDemo(page)
  await page.locator('h1').click()
  await page.mouse.move(...(await pixelPoint(image, 10, 10)))
  await frame(page)
  const before = await starts(page)
  await page.mouse.wheel(0, -100)
  await expect.poll(() => starts(page)).toBeGreaterThan(before)
})

test('open mode: open, ticks and cancel sound', async ({ page }) => {
  const { dialog } = loupeDemo(page)
  await loupeDemo(page)
    .mode(/Click to open/)
    .click()
  await page.getByRole('button', { name: 'Pick from image' }).click()
  await expect(dialog).toBeVisible()
  const opened = await starts(page)
  expect(opened).toBeGreaterThan(0)

  await sweep(page, 6)
  const ticked = await starts(page)
  expect(ticked).toBeGreaterThan(opened)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => starts(page)).toBeGreaterThan(ticked)
})

test('sound off: silent', async ({ page }) => {
  const { image, sound } = loupeDemo(page)
  await sound.uncheck()
  await sweep(page, 8)
  await page.mouse.click(...(await pixelPoint(image, 11, 10)))
  await frame(page)
  expect(await starts(page)).toBe(0)
})
