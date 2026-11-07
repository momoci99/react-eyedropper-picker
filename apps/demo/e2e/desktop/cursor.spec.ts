import type { Locator, Page } from '@playwright/test'
import { expect, frame, loupeDemo, pixelPoint, test, truth } from '../helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(loupeDemo(page).image).toBeVisible()
})

const cursorOf = (el: Locator) => el.evaluate((e) => getComputedStyle(e).cursor)

const choose = (page: Page, name: string) =>
  page
    .locator('.loupe-demo')
    .getByRole('radiogroup', { name: 'Cursor' })
    .getByRole('radio', { name })
    .click()

test('hover: the cursor is hidden by default', async ({ page }) => {
  const { image } = loupeDemo(page)
  await page.mouse.move(...(await pixelPoint(image, 13, 25)))
  await frame(page)
  expect(await cursorOf(image)).toBe('none')
})

test('hover: the eye dropper cursor shows over the loupe', async ({ page }) => {
  const { image, hoverLoupe } = loupeDemo(page)
  await choose(page, 'Eye dropper cursor')
  await image.scrollIntoViewIfNeeded()
  const [x, y] = await pixelPoint(image, 13, 25)
  await page.mouse.move(x, y)
  await frame(page)
  await expect(hoverLoupe).toBeVisible()
  expect(await cursorOf(image)).toMatch(
    /^url\("data:image\/svg\+xml,.+"\) 3 23, crosshair$/
  )

  // The loupe moves above (or below) the pointer, clear of the cursor. It
  // glides there, so wait for it.
  const canvas = hoverLoupe.locator('canvas')
  await expect
    .poll(async () => {
      const b = (await canvas.boundingBox())!
      return b.y + b.height < y - 40 || b.y > y + 40
    })
    .toBe(true)
  const b = (await canvas.boundingBox())!
  expect(Math.abs(b.x + b.width / 2 - x)).toBeLessThan(2)
  await expect(hoverLoupe.locator('div').last()).toHaveText(
    await truth(image, 13, 25)
  )
})

test('open mode: the cursor option applies over the image', async ({
  page,
}) => {
  const { image, dialog, mode } = loupeDemo(page)
  await choose(page, 'Crosshair cursor')
  await mode(/Click to open/).click()
  await page.getByRole('button', { name: 'Pick from image' }).click()
  await expect(dialog).toBeVisible()
  await page.mouse.move(...(await pixelPoint(image, 13, 25)))
  await frame(page)
  expect(await cursorOf(dialog)).toBe('crosshair')
  await page.keyboard.press('Escape')
})
