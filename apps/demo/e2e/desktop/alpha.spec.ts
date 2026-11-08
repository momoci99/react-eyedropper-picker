import { expect, test } from '../helpers'

test('alpha: the opacity slider sets #rrggbbaa; a pick is opaque', async ({
  page,
}) => {
  await page.goto('/playground/')
  const card = page.locator('.picker-demo')
  const input = card.getByLabel('Hex color')
  const result = card.locator('.result-hex')
  await expect(card.getByRole('slider', { name: 'Opacity' })).toHaveCount(0)

  await card.getByRole('checkbox', { name: /Opacity/ }).check()
  const slider = card.getByRole('slider', { name: 'Opacity' })
  await expect(input).toHaveValue('#6366f1ff')

  await slider.focus()
  await page.keyboard.press('Home')
  await expect(result).toHaveText('#6366f100')
  await expect(input).toHaveValue('#6366f100')
  await page.keyboard.press('Shift+ArrowRight')
  // 10% of 255 = 25.5 → 0x1a.
  await expect(result).toHaveText('#6366f11a')

  // Dragging: the middle of the track is about 50%.
  const box = (await slider.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(slider).toHaveAttribute('aria-valuenow', /^(49|50|51)$/)

  // Typing 8 digits works too.
  await input.fill('#ff000080')
  await expect(result).toHaveText('#ff000080')

  // The loupe picks screen-like pixels: opaque.
  await card.getByRole('button', { name: 'Pick a color' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(result).toHaveText(/^#[0-9a-f]{6}ff$/)

  // Off again: back to #rrggbb.
  await card.getByRole('checkbox', { name: /Opacity/ }).uncheck()
  await expect(result).toHaveText(/^#[0-9a-f]{6}$/)
  await expect(card.getByRole('slider', { name: 'Opacity' })).toHaveCount(0)
})
