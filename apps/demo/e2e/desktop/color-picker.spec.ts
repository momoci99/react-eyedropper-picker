import { expect, pixelPoint, test, truth } from '../helpers'

test('the loupe eyeDropper picks into ColorPicker', async ({ page }) => {
  await page.goto('/playground/')
  const card = page.locator('.picker-demo')
  const photo = card.locator('img.picker-photo')
  await photo.scrollIntoViewIfNeeded()

  await card.getByRole('button', { name: 'Pick a color', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  const sun = await pixelPoint(photo, 36, 11)
  await page.mouse.move(...sun)
  await page.mouse.click(...sun)
  await expect(dialog).toHaveCount(0)

  const expected = await truth(photo, 36, 11)
  await expect(card.locator('.result-hex')).toHaveText(expected)
  await expect(card.getByLabel('Hex color')).toHaveValue(expected)
})
