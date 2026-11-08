import { test as base, expect, type Locator, type Page } from '@playwright/test'

/** Fails the test on any page error or `console.error`. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })
      await use(errors)
      expect(errors).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Pixel art sample: 48x32 source pixels. */
export const ART_WIDTH = 48

/** Waits two frames, so a rAF draw has run. */
export const frame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      )
  )

/** Hex of source pixel (x, y), read straight from the image. */
export const truth = (image: Locator, x: number, y: number) =>
  image.evaluate(
    (img: HTMLImageElement, [x, y]) => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const d = g.getImageData(x, y, 1, 1).data
      return (
        '#' +
        [d[0]!, d[1]!, d[2]!]
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('')
      )
    },
    [x, y] as const
  )

/** Client point at the center of source pixel (x, y). */
export const pixelPoint = async (
  image: Locator,
  x: number,
  y: number,
  sourceWidth = ART_WIDTH
): Promise<[number, number]> => {
  const box = (await image.boundingBox())!
  const cell = box.width / sourceWidth
  // Whole CSS pixels: WebKit rounds mouse positions, Chromium does not.
  return [
    Math.round(box.x + (x + 0.5) * cell),
    Math.round(box.y + (y + 0.5) * cell),
  ]
}

export const loupeDemo = (page: Page) => {
  const card = page.locator('.loupe-demo')
  return {
    image: card.locator('img.source'),
    /** Hover loupe, appended to `<body>`. */
    hoverLoupe: page.locator('body > div[aria-hidden="true"]'),
    dialog: page.getByRole('dialog'),
    hex: card.locator('.result-hex'),
    coords: card.locator('.result .small'),
    zoom: card
      .locator('legend', { hasText: 'Magnification' })
      .locator('output'),
    sound: card.getByRole('checkbox', { name: /Sound on/ }),
    soundEvent: (name: RegExp) => card.getByRole('checkbox', { name }),
    mode: (name: RegExp) =>
      card
        .getByRole('radiogroup', { name: 'Mode' })
        .getByRole('radio', { name }),
  }
}

/** Touch input through CDP, so pointer and touch events both fire. */
export const touch = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page)
  const send = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: [number, number][]
  ) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(([x, y], id) => ({ x, y, id })),
    })
  return {
    start: (...points: [number, number][]) => send('touchStart', points),
    move: (...points: [number, number][]) => send('touchMove', points),
    end: () => send('touchEnd', []),
  }
}

export const scrollY = (page: Page) => page.evaluate(() => window.scrollY)
