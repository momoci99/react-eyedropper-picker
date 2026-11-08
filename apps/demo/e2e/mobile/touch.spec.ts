import {
  expect,
  frame,
  loupeDemo,
  pixelPoint,
  scrollY,
  test,
  touch,
  truth,
} from '../helpers'

/** A drag in a few steps from source pixel `from` to `to`. */
const drag = async (
  finger: Awaited<ReturnType<typeof touch>>,
  points: [number, number][]
) => {
  await finger.start(points[0]!)
  for (const p of points.slice(1)) await finger.move(p)
}

const path = async (
  image: Parameters<typeof pixelPoint>[0],
  from: [number, number],
  to: [number, number],
  steps = 5
) => {
  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    points.push(
      await pixelPoint(
        image,
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t
      )
    )
  }
  return points
}

test.beforeEach(async ({ page }) => {
  await page.goto('/playground/')
  await expect(loupeDemo(page).image).toBeVisible()
  // Room above the image for the loupe over the finger.
  await page.evaluate(() => window.scrollTo(0, 120))
})

test.describe('ImageColorPicker', () => {
  test('drag shows the loupe above the finger, lift picks', async ({
    page,
  }) => {
    const { image, hoverLoupe, hex, coords } = loupeDemo(page)
    const finger = await touch(page)
    const y = await scrollY(page)

    await drag(finger, await path(image, [5, 10], [13, 25]))
    await frame(page)
    await expect(hoverLoupe).toBeVisible()
    const loupe = (await hoverLoupe.boundingBox())!
    const [, fingerY] = await pixelPoint(image, 13, 25)
    expect(loupe.y + loupe.height).toBeLessThan(fingerY)
    expect(await scrollY(page)).toBe(y)

    await finger.end()
    await expect(hex).toHaveText(await truth(image, 13, 25))
    await expect(coords).toHaveText('x 13, y 25')
    await expect(hoverLoupe).toHaveCount(0)
  })

  test('pinch zooms and picks nothing', async ({ page }) => {
    const { image, zoom, coords } = loupeDemo(page)
    const finger = await touch(page)
    const before = await zoom.textContent()
    const [cx, cy] = await pixelPoint(image, 24, 16)

    await finger.start([cx - 20, cy])
    await finger.start([cx - 20, cy], [cx + 20, cy])
    for (let i = 1; i <= 5; i++) {
      await finger.move([cx - 20 - 8 * i, cy], [cx + 20 + 8 * i, cy])
    }
    await finger.end()

    await expect(zoom).not.toHaveText(before!)
    await expect(coords).toHaveText('Nothing picked yet')
  })

  test('swiping outside the image still scrolls the page', async ({ page }) => {
    const { image } = loupeDemo(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    const box = (await image.boundingBox())!
    // Start on the text just below the image.
    const startY = box.y + box.height + 30
    const finger = await touch(page)
    await drag(
      finger,
      Array.from(
        { length: 7 },
        (_, i) => [box.x + 20, startY - 40 * i] as [number, number]
      )
    )
    await finger.end()
    await expect.poll(() => scrollY(page)).toBeGreaterThan(0)
  })
})

test.describe('useLoupeEyeDropper', () => {
  test('drag in the overlay, lift picks', async ({ page }) => {
    const { image, dialog, hex, mode } = loupeDemo(page)
    await mode(/Click to open/).tap()
    await page.getByRole('button', { name: 'Pick from image' }).tap()
    await expect(dialog).toBeVisible()

    const finger = await touch(page)
    await drag(finger, await path(image, [5, 10], [13, 25]))
    await finger.end()
    await expect(dialog).toHaveCount(0)
    await expect(hex).toHaveText(await truth(image, 13, 25))
  })
})

test.describe('ColorPicker', () => {
  test('a color bubble rides above the finger, lift hides it', async ({
    page,
  }) => {
    const card = page.locator('.picker-demo')
    const panel = card.getByRole('slider', { name: /Saturation/ })
    await panel.scrollIntoViewIfNeeded()
    const box = (await panel.boundingBox())!
    const bubble = panel.locator('[aria-hidden="true"] > div')

    const finger = await touch(page)
    const at: [number, number] = [
      box.x + box.width * 0.6,
      box.y + box.height * 0.5,
    ]
    await finger.start([box.x + box.width * 0.3, box.y + box.height * 0.7])
    await finger.move(at)
    await expect(bubble).toBeVisible()

    // Above the fingertip, horizontally on it.
    const b = (await bubble.boundingBox())!
    expect(b.y + b.height).toBeLessThan(at[1] - 16)
    expect(Math.abs(b.x + b.width / 2 - at[0])).toBeLessThan(2)

    // Shows the color being picked.
    const hex = await card.getByLabel('Hex color').inputValue()
    expect(
      await bubble.evaluate((el) => getComputedStyle(el).backgroundColor)
    ).toBe(
      `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
    )

    await finger.end()
    await expect(bubble).toHaveCount(0)
  })

  test('the hue slider shows a bubble too', async ({ page }) => {
    const slider = page
      .locator('.picker-demo')
      .getByRole('slider', { name: 'Hue' })
    await slider.scrollIntoViewIfNeeded()
    const box = (await slider.boundingBox())!
    const finger = await touch(page)
    await finger.start([box.x + box.width / 2, box.y + box.height / 2])
    await expect(slider.locator('[aria-hidden="true"] > div')).toBeVisible()
    await finger.end()
    await expect(slider.locator('[aria-hidden="true"] > div')).toHaveCount(0)
  })
})
