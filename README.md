# react-eyedropper-picker (monorepo)

See [packages/react-eyedropper-picker/README.md](packages/react-eyedropper-picker/README.md) for library docs.

```
packages/react-eyedropper-picker   # the npm library (tsdown → ESM + CJS + d.ts)
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

P.S
- 김성혜 디자이너님. 정말 오래걸렸지만 구현했습니다. 그당시 저의 기술력은 이만한 컬러픽커를 만들 수준이 못되었습니다.
- AI의 힘을 빌려 원하시던 형태의 컬러픽커를 구현했습니다. 5년 걸렸네요. 늦어서 미안합니다.
