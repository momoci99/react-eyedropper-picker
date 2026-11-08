import { defineConfig } from '@playwright/test'

// Own port, so a running `pnpm dev` (5173) is never reused by accident.
const PORT = 5199
// The built site, served by `vite preview`.
const DOCS_PORT = 5198

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // The built, prerendered docs site (see webServer below).
      name: 'docs',
      testMatch: /docs\/.*\.spec\.ts/,
      use: {
        baseURL: `http://localhost:${DOCS_PORT}`,
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'desktop',
      testMatch: /desktop\/.*\.spec\.ts/,
      use: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 },
    },
    {
      name: 'mobile',
      testMatch: /mobile\/.*\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: `vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Build (with prerender) and serve it, to test what Pages serves.
      command: `pnpm build && vite preview --port ${DOCS_PORT} --strictPort`,
      url: `http://localhost:${DOCS_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
