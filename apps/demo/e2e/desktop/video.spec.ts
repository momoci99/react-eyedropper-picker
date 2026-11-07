import type { Locator } from '@playwright/test'
import { expect, frame, test } from '../helpers'

/** Hex at client point (x, y) of the frozen frame canvas. */
const frozenHex = (canvas: Locator, x: number, y: number) =>
  canvas.evaluate(
    (c: HTMLCanvasElement, [x, y]) => {
      const r = c.getBoundingClientRect()
      const d = c
        .getContext('2d')!
        .getImageData(
          Math.floor(((x - r.left) * c.width) / r.width),
          Math.floor(((y - r.top) * c.height) / r.height),
          1,
          1
        ).data
      return (
        '#' +
        [d[0]!, d[1]!, d[2]!]
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('')
      )
    },
    [x, y] as const
  )

test('video: picks from a frozen frame, skipping the letterbox', async ({
  page,
}) => {
  await page.goto('/')
  const card = page.locator('.loupe-demo')
  await card.getByRole('radio', { name: 'Video' }).click()
  const video = card.locator('video.source')
  await video.scrollIntoViewIfNeeded()
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2)
  const box = (await video.boundingBox())!

  await card.getByRole('button', { name: 'Pick from video' }).click()
  const dialog = page.getByRole('dialog')
  const frozen = dialog.locator('> div[aria-hidden="true"] > canvas')
  const picture = (await frozen.boundingBox())!
  // 16:9 frame letterboxed in a 3:2 box: bars above and below.
  expect(picture.width).toBeCloseTo(box.width, 0)
  expect(picture.y).toBeGreaterThan(box.y + 10)

  // In the bar: no pixel, no loupe.
  await page.mouse.move(box.x + box.width / 2, box.y + 4)
  await frame(page)
  const loupe = dialog.locator('> div:not([aria-hidden])')
  await expect(loupe).toBeHidden()

  const x = box.x + box.width * 0.3
  const y = box.y + box.height * 0.75
  await page.mouse.move(x, y)
  await frame(page)
  await expect(loupe).toBeVisible()
  const truth = await frozenHex(frozen, x, y)
  await page.mouse.click(x, y)

  await expect(card.locator('.result-hex')).toHaveText(truth)
  await expect(dialog).toHaveCount(0)
  // Playback was never touched.
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false)
})

test('video: hover mode is off for a video', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('.loupe-demo')
  await card.getByRole('radio', { name: 'Video' }).click()
  const modes = card.getByRole('radiogroup', { name: 'Mode' })
  await expect(modes.getByRole('radio', { name: /Hover/ })).toBeDisabled()
  await expect(
    modes.getByRole('radio', { name: /Click to open/ })
  ).toBeChecked()
})
