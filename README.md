# react-eyedropper-picker (monorepo)

See [packages/react-eyedropper-picker/README.md](packages/react-eyedropper-picker/README.md) for library docs.

```
packages/react-eyedropper-picker   # the npm library (tsup → ESM + CJS + d.ts)
apps/demo                          # Vite playground (imports library source for HMR)
```

```bash
pnpm install
pnpm dev          # demo at http://localhost:5173
pnpm test         # vitest
pnpm typecheck
pnpm build        # build library
```

Publish: `cd packages/react-eyedropper-picker && pnpm publish --access public`
(`prepublishOnly` runs typecheck, tests, build.)
