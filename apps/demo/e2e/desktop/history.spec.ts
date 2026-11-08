import type { Page } from '@playwright/test'
import { expect, loupeDemo, pixelPoint, test, truth } from '../helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/playground/')
  await expect(loupeDemo(page).image).toBeVisible()
})

const recent = (page: Page) =>
  page
    .locator('.picker-demo')
    .getByRole('group', { name: 'Recent colors' })
    .getByRole('button')

test('loupe picks land in both histories, newest first', async ({ page }) => {
  const { image } = loupeDemo(page)
  const card = page.locator('.loupe-demo')
  const door = await pixelPoint(image, 13, 25)
  const sky = await pixelPoint(image, 2, 2)
  await page.mouse.move(...door)
  await page.mouse.click(...door)
  await page.mouse.move(...sky)
  await page.mouse.click(...sky)

  const expected = [await truth(image, 2, 2), await truth(image, 13, 25)]
  await expect(recent(page)).toHaveCount(2)
  expect(
    await recent(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label'))
    )
  ).toEqual(expected)
  await expect(card.locator('.history-swatch')).toHaveCount(2)
})

test('ColorPicker picks are kept after a reload', async ({ page }) => {
  const card = page.locator('.picker-demo')
  const photo = card.locator('img.picker-photo')
  await photo.scrollIntoViewIfNeeded()
  await card.getByRole('button', { name: 'Pick a color', exact: true }).click()
  const sun = await pixelPoint(photo, 36, 11)
  await page.mouse.move(...sun)
  await page.mouse.click(...sun)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const expected = await truth(photo, 36, 11)
  await expect(recent(page)).toHaveCount(1)
  await page.reload()
  await expect(recent(page)).toHaveCount(1)
  await expect(recent(page).first()).toHaveAttribute('aria-label', expected)
})

test('a swatch applies its color; Clear empties the history', async ({
  page,
}) => {
  const { image } = loupeDemo(page)
  const card = page.locator('.loupe-demo')
  const door = await pixelPoint(image, 13, 25)
  await page.mouse.move(...door)
  await page.mouse.click(...door)
  const expected = await truth(image, 13, 25)

  const picker = page.locator('.picker-demo')
  await picker.getByLabel('Hex color').fill('#000000')
  await expect(picker.locator('.result-hex')).toHaveText('#000000')
  await recent(page).first().click()
  await expect(picker.locator('.result-hex')).toHaveText(expected)

  await card.getByRole('button', { name: 'Clear' }).click()
  await expect(recent(page)).toHaveCount(0)
  await expect(card.locator('.history-swatch')).toHaveCount(0)
})
