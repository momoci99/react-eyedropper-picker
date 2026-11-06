import type { Page } from '@playwright/test'
import { expect, frame, loupeDemo, pixelPoint, test } from '../helpers'

const picker = (page: Page) =>
  page.locator('.picker-demo .picker-row > div').first()

const background = (page: Page) =>
  picker(page).evaluate((el) => getComputedStyle(el).backgroundColor)

const theme = (page: Page, name: RegExp) =>
  page
    .getByRole('radiogroup', { name: 'Theme' })
    .getByRole('radio', { name })
    .click()

test('auto follows the OS color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  expect(await background(page)).toBe('rgb(255, 255, 255)')
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await background(page)).toBe('rgb(31, 31, 35)')
})

test('light and dark ignore the OS', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await theme(page, /^Light/)
  expect(await background(page)).toBe('rgb(255, 255, 255)')
  await theme(page, /^Dark/)
  await page.emulateMedia({ colorScheme: 'light' })
  expect(await background(page)).toBe('rgb(31, 31, 35)')
})

test('CSS variables override the theme, loupe included', async ({ page }) => {
  await page.goto('/')
  await page.addStyleTag({
    content: ':root { --rep-bg: rgb(1, 2, 3); --rep-label-bg: rgb(4, 5, 6) }',
  })
  expect(await background(page)).toBe('rgb(1, 2, 3)')

  const { image, hoverLoupe } = loupeDemo(page)
  await page.mouse.move(...(await pixelPoint(image, 10, 10)))
  await frame(page)
  const label = hoverLoupe.locator('div').last()
  expect(
    await label.evaluate((el) => getComputedStyle(el).backgroundColor)
  ).toBe('rgb(4, 5, 6)')
})
