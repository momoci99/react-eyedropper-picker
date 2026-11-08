import { expect, frame, loupeDemo, pixelPoint, test, truth } from '../helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/playground/')
  await loupeDemo(page)
    .mode(/Click to open/)
    .click()
})

test('opens, zooms with the wheel and picks on click', async ({ page }) => {
  const { image, dialog, hex, coords } = loupeDemo(page)
  await page.getByRole('button', { name: 'Pick from image' }).click()
  await expect(dialog).toBeVisible()

  const door = await pixelPoint(image, 13, 25)
  await page.mouse.move(...door, { steps: 5 })
  await frame(page)
  const label = dialog.locator('[aria-live]')
  await expect(label).toHaveText(await truth(image, 13, 25))

  await page.mouse.wheel(0, -300)
  await page.mouse.click(...door)
  await expect(dialog).toHaveCount(0)
  await expect(hex).toHaveText(await truth(image, 13, 25))
  await expect(coords).toHaveText('x 13, y 25')
})

test('keyboard: arrows and Enter pick, focus returns', async ({ page }) => {
  const { image, dialog, hex, coords } = loupeDemo(page)
  const button = page.getByRole('button', { name: 'Pick from image' })
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Shift+ArrowDown')
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)

  const [, x, y] = (await coords.textContent())!.match(/x (\d+), y (\d+)/)!
  await expect(hex).toHaveText(await truth(image, Number(x), Number(y)))
  await expect(button).toBeFocused()
})

test('Escape cancels', async ({ page }) => {
  const { dialog, coords } = loupeDemo(page)
  await page.getByRole('button', { name: 'Pick from image' }).click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(coords).toHaveText('Nothing picked yet')
})
