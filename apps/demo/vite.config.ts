import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Use library source directly for instant HMR during development
    alias: {
      'react-eyedropper-picker': fileURLToPath(
        new URL('../../packages/react-eyedropper-picker/src/index.ts', import.meta.url)
      ),
    },
  },
})
