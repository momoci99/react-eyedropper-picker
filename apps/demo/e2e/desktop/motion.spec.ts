import { expect, frame, loupeDemo, pixelPoint, test, truth } from '../helpers'
import type { Locator } from '@playwright/test'

/** Center of the loupe canvas (the scale animation keeps it in place). */
const center = async (loupe: Locator) => {
  const box = (await loupe.locator('canvas').boundingBox())!
  return [box.x + box.width / 2, box.y + box.height / 2]
}

test.beforeEach(async ({ page }) => {
  await page.goto('/playground/')
  await expect(loupeDemo(page).image).toBeVisible()
})

test('the loupe glides and settles on the pointer, the pixel is exact', async ({
  page,
}) => {
  const { image, hoverLoupe } = loupeDemo(page)
  await page.mouse.move(...(await pixelPoint(image, 5, 5)))
  await frame(page)
  const target = await pixelPoint(image, 30, 20)
  await page.mouse.move(...target)
  await frame(page)
  // The label follows the pointer at once, the loupe catches up.
  await expect(hoverLoupe.locator('div').last()).toHaveText(
    await truth(image, 30, 20)
  )
  await expect
    .poll(async () => {
      const [x, y] = await center(hoverLoupe)
      return Math.hypot(x! - target[0], y! - target[1])
    })
    .toBeLessThan(1)
})

test('reduced motion: the loupe sits on the pointer at once', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { image, hoverLoupe } = loupeDemo(page)
  await page.mouse.move(...(await pixelPoint(image, 5, 5)))
  await frame(page)
  const target = await pixelPoint(image, 30, 20)
  await page.mouse.move(...target)
  await frame(page)
  const [x, y] = await center(hoverLoupe)
  expect(Math.hypot(x! - target[0], y! - target[1])).toBeLessThan(1)

  // No shrink-out either.
  await page.mouse.move(5, 5)
  await expect(hoverLoupe).toHaveCount(0, { timeout: 50 })
})
