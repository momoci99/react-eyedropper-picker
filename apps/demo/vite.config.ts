import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const lib = (path: string) =>
  fileURLToPath(
    new URL(
      `../../packages/react-eyedropper-picker/src/${path}`,
      import.meta.url
    )
  )

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Use library source directly for instant HMR during development.
    // Exact matches, so the base alias doesn't swallow `/loupe`.
    alias: [
      {
        find: /^react-eyedropper-picker\/loupe$/,
        replacement: lib('loupe/index.ts'),
      },
      { find: /^react-eyedropper-picker$/, replacement: lib('index.ts') },
    ],
  },
})
