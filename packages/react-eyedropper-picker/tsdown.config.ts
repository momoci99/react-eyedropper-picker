import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.ts', loupe: 'src/loupe/index.ts' },
  format: ['esm', 'cjs'],
  platform: 'neutral',
  target: 'es2020',
  dts: true,
  clean: true,
  sourcemap: true,
  fixedExtension: false,
})
