# react-eyedropper-picker (monorepo)

![Picking colors from an image with the loupe: hover, zoom with the wheel, click to pick](apps/demo/public/loupe-demo.gif)

React color picker with the native EyeDropper API and a pixel-accurate loupe for images in every browser. **[Docs and live demo →](https://momoci99.github.io/react-eyedropper-picker/)**

순정 EyeDropper API와, 모든 브라우저에서 이미지 색을 픽셀 단위로 뽑는 확대경을 갖춘 React 컬러 피커입니다. **[문서와 데모 보기 →](https://momoci99.github.io/react-eyedropper-picker/ko/)**

See [packages/react-eyedropper-picker/README.md](packages/react-eyedropper-picker/README.md) for library docs.

라이브러리 문서는 [packages/react-eyedropper-picker/README.md](packages/react-eyedropper-picker/README.md)를 보세요.

```
packages/react-eyedropper-picker   # the npm library (tsdown → ESM + CJS + d.ts)
apps/demo                          # docs site + playground (Vite, MDX, prerendered; imports library source for HMR)
```

- `packages/react-eyedropper-picker`: npm에 배포하는 라이브러리 (tsdown으로 ESM, CJS, 타입 선언 빌드)
- `apps/demo`: 문서 사이트와 플레이그라운드 (Vite, MDX, 미리 렌더링. HMR을 위해 라이브러리 소스를 직접 가져옴)

```bash
pnpm install
pnpm dev          # docs + playground at http://localhost:5173
pnpm test         # vitest
pnpm typecheck
pnpm build        # build library
```

`pnpm dev`는 http://localhost:5173 에 문서와 플레이그라운드를 띄우고, `pnpm test`는 vitest 테스트, `pnpm typecheck`는 타입 검사, `pnpm build`는 라이브러리 빌드를 실행합니다.

Publish: `cd packages/react-eyedropper-picker && pnpm publish --access public`
(`prepublishOnly` runs typecheck, tests, build.)

배포: `cd packages/react-eyedropper-picker && pnpm publish --access public`
(`prepublishOnly`가 타입 검사, 테스트, 빌드를 먼저 실행합니다.)

P.S
- 김성혜 디자이너님. 정말 오래걸렸지만 구현했습니다. 그당시 저의 기술력은 이만한 컬러픽커를 만들 수준이 못되었습니다.
- AI의 힘을 빌려 원하시던 형태의 컬러픽커를 구현했습니다. 5년 걸렸네요. 늦어서 미안합니다.
