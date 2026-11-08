import { expect, frame, pixelPoint, test, truth } from '../helpers'

// Runs against the built, prerendered site (vite preview), so hydration
// is checked too: a mismatch logs an error and fails the test.

const PAGES = [
  ['/', 'react-eyedropper-picker'],
  ['/getting-started/', 'Getting started'],
  ['/ko/', 'react-eyedropper-picker'],
  ['/ko/getting-started/', '시작하기'],
] as const

for (const [path, h1] of PAGES) {
  test(`${path} is prerendered and hydrates`, async ({ page }) => {
    // The HTML has the content before any script runs.
    const html = await (await page.request.get(path)).text()
    expect(html).toContain(`data-path="${path}"`)
    expect(html).toContain(`<h1`)

    await page.goto(path)
    await expect(page.locator('.doc h1')).toHaveText(h1)
    await expect(page.locator('html')).toHaveAttribute(
      'lang',
      path.startsWith('/ko/') ? 'ko' : 'en'
    )
  })
}

test('the sidebar navigates without a reload', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => ((window as { marker?: number }).marker = 1))
  await page
    .getByRole('navigation', { name: 'Docs' })
    .getByRole('link', { name: 'Getting started' })
    .click()
  await expect(page).toHaveURL(/\/getting-started\/$/)
  await expect(page.locator('.doc h1')).toHaveText('Getting started')
  await expect(page).toHaveTitle('Getting started · react-eyedropper-picker')
  expect(
    await page.evaluate(() => (window as { marker?: number }).marker)
  ).toBe(1)

  await page.goBack()
  await expect(page.locator('.doc h1')).toHaveText('react-eyedropper-picker')
})

test('the language link keeps the page', async ({ page }) => {
  await page.goto('/getting-started/')
  await page.getByRole('link', { name: '한국어' }).click()
  await expect(page).toHaveURL(/\/ko\/getting-started\/$/)
  await expect(page.locator('.doc h1')).toHaveText('시작하기')
})

test.describe('Korean browser', () => {
  test.use({ locale: 'ko-KR' })

  test('suggests Korean on an English page, and remembers', async ({
    page,
  }) => {
    await page.goto('/')
    const banner = page.locator('.lang-suggest')
    await expect(banner).toContainText('한국어로도')
    await banner.getByRole('link', { name: '한국어로 보기' }).click()
    await expect(page).toHaveURL(/\/ko\/$/)
    await expect(banner).toHaveCount(0)

    await page.goto('/')
    await expect(page.locator('.doc h1')).toBeVisible()
    await expect(banner).toHaveCount(0)
  })

  test('no suggestion on a Korean page', async ({ page }) => {
    await page.goto('/ko/')
    await expect(page.locator('.doc h1')).toBeVisible()
    await expect(page.locator('.lang-suggest')).toHaveCount(0)
  })
})

test.describe('English browser', () => {
  test.use({ locale: 'en-US' })

  test('suggests English on a Korean page; dismiss stays dismissed', async ({
    page,
  }) => {
    await page.goto('/ko/getting-started/')
    const banner = page.locator('.lang-suggest')
    await expect(banner).toContainText('also available in English')
    await banner.getByRole('button', { name: 'Dismiss' }).click()
    await expect(banner).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.doc h1')).toBeVisible()
    await expect(banner).toHaveCount(0)
  })
})

test('an unknown path shows not found', async ({ page }) => {
  await page.goto('/ko/nothing-here/')
  await expect(page.locator('.doc h1')).toHaveText('404')
  await expect(page.getByText('페이지를 찾을 수 없어요.')).toBeVisible()
})

test('the playground loads on its own path', async ({ page }) => {
  await page.goto('/playground/')
  await expect(page.locator('.loupe-demo')).toBeVisible()
})

test('the example on the home page picks a color', async ({ page }) => {
  await page.goto('/')
  const image = page.getByRole('button', {
    name: 'Pick a color from Pixel art landscape',
  })
  await image.scrollIntoViewIfNeeded()
  await page.mouse.move(...(await pixelPoint(image, 2, 2)))
  await frame(page)
  await page.mouse.click(...(await pixelPoint(image, 2, 2)))
  await expect(page.locator('.example-live code').first()).toHaveText(
    await truth(image, 2, 2)
  )
})
