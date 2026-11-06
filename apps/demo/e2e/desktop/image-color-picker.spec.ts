import {
  expect,
  frame,
  loupeDemo,
  pixelPoint,
  scrollY,
  test,
  truth,
} from '../helpers'

// Default mode: hover · ImageColorPicker, pixel art sample.
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(loupeDemo(page).image).toBeVisible()
})

test('hover shows the loupe on the pixel under the mouse', async ({ page }) => {
  const { image, hoverLoupe } = loupeDemo(page)
  await page.mouse.move(...(await pixelPoint(image, 13, 25)))
  await frame(page)
  await expect(hoverLoupe).toBeVisible()
  await expect(hoverLoupe.locator('div').last()).toHaveText(
    await truth(image, 13, 25)
  )
})

test('click picks and the loupe stays', async ({ page }) => {
  const { image, hoverLoupe, hex, coords } = loupeDemo(page)
  const door = await pixelPoint(image, 13, 25)
  await page.mouse.move(...door)
  await page.mouse.click(...door)
  await expect(hex).toHaveText(await truth(image, 13, 25))
  await expect(coords).toHaveText('x 13, y 25')
  await expect(hoverLoupe).toBeVisible()
})

test('wheel zooms without scrolling the page', async ({ page }) => {
  const { image, zoom } = loupeDemo(page)
  await page.mouse.move(...(await pixelPoint(image, 13, 25)))
  const before = await zoom.textContent()
  const y = await scrollY(page)
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100)
  await expect(zoom).not.toHaveText(before!)
  expect(await scrollY(page)).toBe(y)
})

test('leaving the image hides the loupe', async ({ page }) => {
  const { image, hoverLoupe } = loupeDemo(page)
  await page.mouse.move(...(await pixelPoint(image, 13, 25)))
  await expect(hoverLoupe).toBeVisible()
  const box = (await image.boundingBox())!
  await page.mouse.move(box.x + box.width + 40, box.y + 10)
  await expect(hoverLoupe).toHaveCount(0)
})

test('renderLabel follows the pixel', async ({ page }) => {
  const { image, hoverLoupe } = loupeDemo(page)
  await page.getByLabel('Custom label').check()
  const label = hoverLoupe.locator('.loupe-label')

  await page.mouse.move(...(await pixelPoint(image, 36, 11)))
  await expect(label).toContainText(await truth(image, 36, 11))
  await expect(label).toContainText('36, 11')

  await page.mouse.move(...(await pixelPoint(image, 17, 23)))
  await expect(label).toContainText(await truth(image, 17, 23))
})

test('keyboard: Enter opens, arrows move, Enter picks', async ({ page }) => {
  const { image, dialog, hex, coords } = loupeDemo(page)
  await image.focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)

  const [, x, y] = (await coords.textContent())!.match(/x (\d+), y (\d+)/)!
  await expect(hex).toHaveText(await truth(image, Number(x), Number(y)))
  await expect(image).toBeFocused()
})

test('keyboard: Escape cancels without picking', async ({ page }) => {
  const { image, dialog, coords } = loupeDemo(page)
  await image.focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(coords).toHaveText('Nothing picked yet')
})
