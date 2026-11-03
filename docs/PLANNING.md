# react-eyedropper-picker 기획서

- 작성일: 2026-11-04
- 현재 버전: v0.1.0 (스캐폴딩 완료, 미배포)
- 저장소: https://github.com/momoci99/react-eyedropper-picker

## 1. 개요

**한 줄 정의**: 브라우저 순정 스포이드를 쓸 수 있으면 그대로 쓰고, 쓸 수 없거나 이미지에서 색을 뽑을 때는 픽셀 단위로 정확한 확대경(Loupe)을 제공하는 React 컬러픽커.

**포지셔닝**

> 순정이 되면 순정, 안 되거나 이미지라면 픽셀 정확한 확대경. 확대경 모양과 효과는 마음대로.

기본 컬러픽커 시장은 [react-colorful](https://github.com/omgovich/react-colorful)(주간 약 924만 다운로드)이 차지하고 있다. 기본 픽커만으로는 경쟁할 이유가 약하다. 차별점은 **스포이드 경험**에 둔다.

**대상 사용자와 시나리오** (결정 필요, 11장 1번)

| # | 누가 | 어떤 화면에서 | 무엇을 |
| --- | --- | --- | --- |
| S1 | TBD (예: 테마 빌더 개발자) | TBD (예: 로고/사진 업로드 후 브랜드 색 추출) | TBD |
| S2 | TBD (예: 이미지 에디터 개발자) | TBD (예: canvas 편집 화면) | TBD |
| S3 | TBD (예: 커머스 개발자) | TBD (예: 상품 이미지에서 옵션 색 추출) | TBD |

대표 시나리오가 정해져야 v0.2 범위, 기본값(배율, 지름), 효과 우선순위를 판단할 수 있다.

**v0.1.0에 이미 있는 것**

| 구성 요소 | 내용 |
| --- | --- |
| `useEyeDropper` | 순정 EyeDropper API 래퍼 ([use-eye-dropper](https://github.com/woofers/use-eye-dropper) TS 재구현, MIT 고지 포함) |
| `useColorPicker` | headless 상태 훅 (HSV 내부 상태, hex 입출력, 화면에서 색 뽑기) |
| `ColorPicker` | 완성형 컴포넌트 (채도/명도 패널, hue 슬라이더, hex 입력, 스포이드 버튼) |
| `SaturationPanel`, `HueSlider`, `EyeDropperButton` | 조합용 부품 컴포넌트, 키보드 조작 지원 |
| 색 변환 유틸 | `normalizeHex`, `hexToRgb`, `rgbToHsv`, `hsvToHex` 등 |
| 빌드/테스트 | pnpm 모노레포, tsup(ESM + CJS + d.ts), vitest 21개 통과 |

## 2. 배경: 순정 EyeDropper API의 한계

순정 API는 `new EyeDropper().open({ signal })` 하나뿐이고, 결과로 `{ sRGBHex }` 하나만 돌려준다.

**순정만 할 수 있는 것**

- 브라우저 밖을 포함한 **화면 전체**에서 색 추출. 웹 코드로는 대체할 방법이 없다.

**순정으로 안 되는 것**

| 항목 | 이유 |
| --- | --- |
| 확대경 커스텀 | 브라우저가 자체 확대경을 그린다. 크기, 배율, 모양 변경 불가 |
| 실시간 미리보기 | 커서가 움직이는 동안의 색을 받을 수 없다. 최종 색만 반환 |
| 애니메이션, 스타일 | 오버레이는 브라우저 UI라 접근 불가 |
| 크로스 브라우저 | Chromium 계열(Chrome, Edge, Opera)만 지원. Firefox, Safari, 대부분의 모바일 미지원 |

**제약**

- 클릭 같은 사용자 동작 안에서만 열 수 있다.
- 보안 컨텍스트(HTTPS) 필요. localhost는 예외.
- 일부 구현은 hex 대신 `rgba(...)` 문자열을 반환한다. (v0.1에서 변환 처리함)

## 3. 경쟁 조사

조사일 2026-11-03. 다운로드는 npm 주간 기준.

| 프로젝트 | 주간 다운로드 | ★ | 방식 | 한계 |
| --- | ---: | ---: | --- | --- |
| [use-eye-dropper](https://github.com/woofers/use-eye-dropper) | 47,113 | 19 | 순정 API React 훅 | 확대경 없음, Chromium 전용 |
| [eyedropper-polyfill](https://github.com/iam-medvedev/eyedropper-polyfill) | 20,738 | 22 | html2canvas-pro로 페이지 캡처 + 확대경, `window.EyeDropper` 폴리필 | 배율 고정(size 4, scale 12), DOM 렌더링 정확도 한계, React용 아님 |
| [@spectrum-web-components/color-loupe](https://www.npmjs.com/package/@spectrum-web-components/color-loupe) | 21,086 | - | Adobe. 손가락/커서 위에 뜨는 색 말풍선 | 픽셀 확대가 아니라 현재 색 미리보기만 |
| [react-eyedrop](https://github.com/jodhman/react-eyedrop) | 5,194 | 25 | html2canvas 기반 React 컴포넌트/훅 | 2024년 이후 갱신 없음, 색 정확도 이슈 다수 |
| [@ltcode/eyedropper](https://www.npmjs.com/package/@ltcode/eyedropper) | 극소 | 1 | canvas/이미지 대상 확대경 (vanilla) | 알파 버전, React 아님, 2025-08 이후 갱신 없음 |
| [react-colorful](https://github.com/omgovich/react-colorful) | 9,240,258 | 3,563 | 기본 컬러픽커 | 스포이드 기능 없음 |

웹 도구 [colortrail](https://colortrail.pages.dev/) 등은 `getDisplayMedia`로 화면 한 프레임을 캡처한 뒤 확대경으로 색을 뽑는다. 라이브러리가 아니라 완성된 앱이지만, 화면 캡처 방식이 실제로 작동함을 보여준다.

**결론**

1. **수요는 있다.** 순정 래퍼와 폴리필을 합쳐 주간 약 7만 다운로드.
   - 단, 이 수치는 **화면 스포이드를 전 브라우저에서 쓰려는 수요**다. Loupe(이미지 확대경) 수요의 직접 근거는 react-eyedrop(주간 5천)과 @ltcode(극소)뿐이다. → Loupe 수요 근거 보강 필요.
   - use-eye-dropper는 ★19에 주간 4.7만으로, 다른 패키지의 의존성으로 딸려 받는 수치일 수 있다. → npm dependents 확인 필요.
2. **DOM을 canvas로 렌더링하는 방식은 정확도가 낮다.** react-eyedrop 사용자들이 계속 부딪혔다 (4장).
3. **이미지/canvas에서 픽셀 정확하게 뽑고, 확대경을 마음대로 꾸밀 수 있는 React 라이브러리는 없다.** 이 자리를 노린다.

## 4. 기존 이슈에서 얻은 인사이트

### html2canvas 방식의 실패 사례 (react-eyedrop)

| 이슈 | 증상 |
| --- | --- |
| [#5](https://github.com/jodhman/react-eyedrop/issues/5) | 회색 배경인데 흰색으로 읽힘 |
| [#21](https://github.com/jodhman/react-eyedrop/issues/21) | 클릭 위치와 다른 곳의 색을 읽음 |
| [#40](https://github.com/jodhman/react-eyedrop/issues/40) | `background-image`는 항상 흰색 |
| [#63](https://github.com/jodhman/react-eyedrop/issues/63) | 모바일 앱 웹뷰 안에서 항상 흰색 |

→ DOM 렌더링 방식은 기본 기능으로 넣지 않는다.

### 기능 아이디어

| 아이디어 | 출처 | 내용 | 반영 시점 |
| --- | --- | --- | --- |
| 샘플링 반경 | react-eyedrop [#2](https://github.com/jodhman/react-eyedrop/issues/2) | 1x1 / 3x3 / 5x5 영역 평균색. 사진 노이즈 대응 | v0.2 |
| 좌표 반환 | react-eyedrop #63 | 결과에 찍은 위치 `x`, `y` 포함 | v0.2 |
| 클릭 차단 | react-eyedrop #84 | 스포이드 모드 중 아래 요소 클릭 이벤트 차단 | v0.2 |
| 커서 커스텀 | react-eyedrop #83 | 스포이드 모드 커서 모양 지정 | v0.3 |
| 순정과 같은 인터페이스 | eyedropper-polyfill | `open({ signal })` → `{ sRGBHex }` 형태 유지, 모드만 교체 | v0.2 |
| 손가락 위 색 말풍선 | Adobe Spectrum color-loupe | 모바일에서 채도 패널 터치 시 손가락 위에 현재 색 표시 | v0.3 |
| 캡처 방식 플러그인 | 폴리필 + getDisplayMedia 사례 | 사용자가 캡처 함수를 주입. 라이브러리는 캡처 구현을 내장하지 않음 | v0.4 |

## 5. 스포이드 모드 설계

| 모드 | 색을 뽑는 곳 | 확대경/효과 커스텀 | 브라우저 | 결정 |
| --- | --- | --- | --- | --- |
| **Native** | 화면 전체 (브라우저 밖 포함) | 불가 | Chromium만 | 유지 |
| **Loupe** | 페이지 안 `<img>`, `<canvas>`, `<video>` | 가능 | 전 브라우저 + 모바일 | **핵심 신규 기능** |
| **Screen capture** | 사용자가 고른 탭/창/화면의 정지 프레임 | 가능 (Loupe 재사용) | 데스크톱 대부분 | 실험 기능 |

### 모드 선택 흐름 (`mode: 'auto'`)

```mermaid
flowchart TD
    A[open 호출] --> B{source 지정됨?}
    B -- 예 --> L[Loupe 모드<br/>source 픽셀에서 추출]
    B -- 아니오 --> C{순정 EyeDropper 지원?}
    C -- 예 --> N[Native 모드]
    C -- 아니오 --> D{capture 함수 주입됨?}
    D -- 예 --> S[Screen capture<br/>캡처 프레임 위에서 Loupe]
    D -- 아니오 --> E[NotSupportedError]
```

**폴백 UX (결정 필요)**: source 없음 + 순정 미지원(Firefox, Safari, 모바일) + capture 없음이면 `NotSupportedError`다. 즉 "전 브라우저 지원"은 source가 있을 때만 성립한다. 이때 `ColorPicker`의 스포이드 버튼을 숨길지, 비활성화+툴팁으로 안내할지 정해야 한다.

### Screen capture 모드

`getDisplayMedia`로 한 프레임을 캡처하고, 정지된 화면 위에서 Loupe를 실행한다.

- 장점: 페이지 전체, 다른 창에서도 추출 가능. Firefox, Safari 데스크톱에서도 동작.
- 단점: 매번 권한 팝업과 화면 공유 표시가 뜬다. 모바일은 대부분 미지원.
- 방침: 라이브러리에 내장하지 않고 `capture` 함수를 주입받는 구조로 연다. 사용자가 원하면 html2canvas 계열도 같은 자리에 꽂을 수 있다.

### 하지 않을 것

- **DOM → canvas 렌더링을 기본 기능으로 내장하지 않는다.** 정확도 문제가 4장에서 확인됐고, 번들이 커진다. 필요한 사용자는 `capture` 플러그인으로 직접 연결한다.

## 6. Loupe 기능 명세

### MVP (v0.2)

| 항목 | 명세 |
| --- | --- |
| 대상 | `HTMLImageElement`, `HTMLCanvasElement` |
| 픽셀 읽기 | 오프스크린 canvas에 원본 해상도로 한 번 그리고 `getImageData` 결과 캐시 (`willReadFrequently: true`) |
| 확대 | 배율 기본 8x, 옵션으로 지정. 확대 렌더링은 `imageSmoothingEnabled = false` |
| 그리드 | 픽셀 경계선 on/off |
| 중앙 표시 | 중앙 픽셀 테두리 강조 + 현재 색 라벨 (hex) |
| 모양 | 원형 / 사각형 |
| 크기 | 확대경 지름 옵션 (기본 120px) |
| 샘플링 반경 | `1` / `3` / `5` (NxN 평균) |
| 좌표 | 결과에 원본 이미지 기준 `x`, `y` 포함 |
| 마우스 | 이동 시 확대경 추적, 클릭으로 확정 |
| 터치 | 손가락 위쪽으로 확대경 오프셋, 손 뗄 때 확정 |
| 키보드 | 방향키 1px 이동, Shift+방향키 10px, Enter 확정, Esc 취소 |
| 취소 | `AbortSignal`, Esc, 대상 밖 클릭 → `AbortError` |
| 클릭 차단 | 스포이드 모드 중 오버레이가 포인터 이벤트를 가로챔 |

### 효과 (v0.3)

| 항목 | 명세 |
| --- | --- |
| 부드러운 추적 | 확대경이 커서를 보간(lerp)으로 따라감. 강도 옵션 |
| 열림/닫힘 | 확대경이 커지며 등장, 줄어들며 사라짐 |
| 확정 연출 | 확정 시 색이 대상 스와치 쪽으로 이동하는 연출 (선택) |
| 색 라벨 전환 | 색 변경 시 라벨 배경 전환 애니메이션 |
| 배율 조절 | 휠 / 핀치로 배율 변경 |
| 모션 감소 | `prefers-reduced-motion`이면 보간과 애니메이션 끔 |

### 렌더링 원칙

- 그리기는 `requestAnimationFrame` 안에서만. 포인터 이벤트에서는 좌표만 저장.
- 확대경은 별도 canvas 하나에 그린다. DOM 노드를 픽셀마다 만들지 않는다.
- `devicePixelRatio`를 반영해 확대경 canvas를 고해상도로 그린다.

## 7. API 초안

확정 전 초안이다. 이름은 11장 열린 질문에서 결정한다.

### 훅

```ts
type PickMode = 'auto' | 'native' | 'loupe'

type PickSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement

type LoupeOptions = {
  magnification?: number        // 기본 8
  size?: number                 // 확대경 지름 px, 기본 120
  shape?: 'circle' | 'square'   // 기본 'circle'
  grid?: boolean                // 기본 true
  sampleSize?: 1 | 3 | 5        // 기본 1
  smoothing?: number            // 0~1 추적 보간, 0이면 즉시 (v0.3)
  className?: string
  renderLabel?: (color: PickResult) => React.ReactNode
}

type PickResult = {
  sRGBHex: string               // 순정 API와 같은 키
  x?: number                    // Loupe 모드일 때 원본 픽셀 좌표
  y?: number
  mode: 'native' | 'loupe'
}

type UseEyeDropperOptions = {
  mode?: PickMode               // 기본 'auto'
  loupe?: LoupeOptions
  capture?: () => Promise<HTMLCanvasElement | ImageBitmap>  // v0.4
}

declare function useEyeDropper(options?: UseEyeDropperOptions): {
  open: (opts?: { source?: PickSource; signal?: AbortSignal }) => Promise<PickResult>
  close: () => void
  isSupported: boolean          // 현재 모드 기준 사용 가능 여부
  isOpen: boolean
}
```

- v0.1의 `useEyeDropper()`는 인자 없이 호출하면 기존처럼 동작하도록 유지한다.
- `open()` 실패는 순정 API와 같은 방식(`AbortError`, `NotSupportedError`)으로 reject한다.
  - 현재 v0.1 코드는 미지원 시 일반 `Error`를 던진다. v0.2에서 `DOMException('...', 'NotSupportedError')`로 바꾼다. 미배포라 호환성 부담 없음.
- `isSupported`의 의미가 v0.1의 "순정 지원 여부"에서 "현재 모드 기준"으로 바뀐다. 배포 전에 확정한다.

**번들 분리와의 충돌 (결정 필요)**: 위 초안대로면 기본 경로의 `useEyeDropper`가 `mode: 'auto' | 'loupe'`를 받는다. 기본 경로 훅이 Loupe로 넘어가려면 Loupe 코드가 기본 번들에 들어가므로 "기본 사용자 번들에 Loupe 없음" 목표가 깨진다.

| 안 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| A | 기본 경로 `useEyeDropper`는 native 전용. `/loupe`가 auto 지원 훅(예: `useLoupeEyeDropper`)을 export | 단순, 번들 분리 확실 | 훅이 둘 |
| B | 기본 훅이 `engine` 옵션으로 Loupe 엔진을 주입받음 (`import { loupeEngine } from '.../loupe'`) | 훅 하나 | API 복잡도 증가 |

### 컴포넌트

```tsx
// 이미지에서 색 뽑기
<ImageColorPicker
  src="/photo.jpg"
  onPick={({ sRGBHex, x, y }) => {}}
  loupe={{ magnification: 10, sampleSize: 3 }}
/>

// 기존 ColorPicker의 스포이드 버튼이 Loupe 대상도 받도록 확장
<ColorPicker value={color} onChange={setColor} eyeDropper={{ source: imgRef }} />
```

### 패키지 경로 분리

```
react-eyedropper-picker          # ColorPicker, 부품, useColorPicker, useEyeDropper(native), 유틸
react-eyedropper-picker/loupe    # Loupe 엔진, ImageColorPicker
```

기본 경로만 쓰는 사용자의 번들에 Loupe 코드가 들어가지 않게 한다.

## 8. 위험 요소와 대응

| 위험 | 내용 | 대응 |
| --- | --- | --- |
| 번들 크기 | Loupe와 효과 코드로 기본 픽커가 무거워질 수 있음 | `/loupe` 서브 경로 분리, `sideEffects: false` 유지, 크기 예산을 CI에서 측정 |
| CORS | 다른 도메인 이미지는 canvas가 오염되어 `getImageData` 실패 | `crossOrigin="anonymous"` 안내, 오염 감지 시 명확한 에러 메시지와 문서 |
| 성능 | 큰 이미지에서 매 프레임 읽기/그리기 비용 | 픽셀 데이터 1회 캐시, rAF 안에서만 그리기, 확대 영역만 그리기 |
| 고해상도 화면 | 레티나에서 CSS 좌표와 원본 픽셀 좌표 불일치 | 표시 크기 대비 원본 크기 비율로 좌표 변환, 테스트 케이스 작성 |
| 색공간 | display-p3 이미지가 sRGB canvas로 변환되며 값이 달라질 수 있음 | 1차는 sRGB 고정 후 문서화. `colorSpace` 옵션은 추후 검토 |
| `<video>` | 프레임이 계속 바뀜 | 스포이드를 열 때 현재 프레임을 고정해서 사용 (v0.4) |
| 접근성 | 마우스 전용이 되기 쉬움 | 키보드 조작, 포커스 이동, `aria-live`로 현재 색 읽기, 모션 감소 대응 |
| 터치 | 손가락이 대상을 가림 | 확대경 오프셋, 확정 방식(손 뗄 때) 명시 |

## 9. 로드맵

```mermaid
flowchart LR
    V01["v0.1 (완료)<br/>스캐폴딩<br/>ColorPicker + 순정 훅"] --> V02["v0.2<br/>Loupe MVP<br/>img, canvas"]
    V02 --> V03["v0.3<br/>효과, 테마<br/>색 히스토리"]
    V03 --> V04["v0.4<br/>video, capture 플러그인<br/>Screen capture 실험"]
    V04 --> V10["v1.0<br/>문서 사이트, 데모<br/>API 고정"]
```

| 버전 | 범위 | 완료 조건 |
| --- | --- | --- |
| v0.1 | 프로젝트 구조, ColorPicker, 순정 훅, 테스트 | 완료 (미배포) |
| v0.2 | Loupe 엔진, `ImageColorPicker`, 확대/그리드/샘플링/좌표, 키보드, 터치, `/loupe` 경로, `ColorPicker`의 `eyeDropper={{ source }}` 확장, GitHub Pages 데모 | jsdom 단위 테스트 + 실제 브라우저(Chrome, Firefox, Safari, 모바일 Safari) 수동 확인 + 데모 공개 |
| v0.3 | 부드러운 추적, 등장/확정 애니메이션, 배율 조절, CSS 변수 테마, 다크 모드, 색 히스토리(근거 보강 필요), 손가락 위 색 말풍선 | 모션 감소 대응 확인, 데모에서 효과 시연 |
| v0.4 | `<video>` 대상, `capture` 플러그인 구조, `getDisplayMedia` 예제 | 플러그인으로 html2canvas와 getDisplayMedia 둘 다 연결되는 예제 |
| v1.0 | 문서 사이트, GitHub Pages 데모, API 고정, 번들 크기 예산 | semver 1.0 공개 |

CI(GitHub Actions: 테스트, 타입체크, 빌드)는 v0.2 작업 시작 전에 추가한다.

- 데모는 v1.0이 아니라 v0.2 공개와 함께 낸다. 확대경은 직접 봐야 가치가 전달된다. v1.0은 문서 사이트를 정식화한다.
- 버전별 목표 시점: TBD. 투입 가능 시간을 기준으로 정한다.

### 성공 지표 (수치 TBD)

| 지표 | 목표 | 측정 시점 |
| --- | --- | --- |
| 픽셀 정확도 | 테스트 이미지 세트 기준 오차 0 | v0.2 |
| `/loupe` 번들 크기 | gzip N KB 이하 | v0.2부터 CI |
| 기본 경로 번들 크기 | gzip N KB 이하, v0.1 대비 증가 없음 | v0.2부터 CI |
| 지원 브라우저 | Chrome, Firefox, Safari, iOS Safari, Android Chrome 수동 확인 통과 | 매 릴리스 |
| 채택 | 주간 다운로드 N, ★ N | v1.0 |

## 10. 테스트 전략

- **단위 테스트(vitest + jsdom)**: 색 변환, 샘플링 평균 계산, 좌표 변환, 모드 선택 로직, 키보드 조작.
- **브라우저 테스트**: jsdom에는 canvas 픽셀 읽기가 없다. Loupe 렌더링은 Vitest Browser Mode 또는 Playwright로 실제 브라우저에서 검증한다.
- **수동 확인 목록**: Chrome, Firefox, Safari 데스크톱, iOS Safari, Android Chrome에서 확대경 위치, 터치 확정, 레티나 좌표.

## 11. 열린 질문

### v0.2 착수 전 필수

- [ ] 주 사용처를 "이미지에서 색 뽑기"로 확정할 것인가? (추천: 예) → 확정 후 1장 대상 사용자 표를 채운다.
- [ ] 훅 구조: 7장 번들 분리 충돌의 A안 / B안 중 무엇으로 할 것인가?
- [ ] 폴백 UX: 순정 미지원 + source 없음일 때 스포이드 버튼을 숨길 것인가, 비활성화+안내할 것인가?

### 배포 전 필수

- [ ] 패키지 이름 `react-eyedropper-picker`를 유지할 것인가? Loupe가 핵심이 되면 이름이 기능을 다 설명하지 못한다. 배포 후 변경은 비용이 크다. (`package.json` description도 함께 갱신)
- [ ] 첫 공개 버전: v0.1을 이름 선점용으로 먼저 낼 것인가, v0.2(Loupe)를 첫 공개로 할 것인가?

### v0.2 설계 중 결정

- [ ] `mode: 'auto'`에서 순정이 지원되지만 `source`도 지정된 경우 Loupe 우선이 맞는가? (추천: 예. source 명시 = 의도 있음)
- [ ] 컴포넌트 이름: `ImageColorPicker` / `MagnifierPicker` / `Loupe` 중 무엇으로 할 것인가? (1번 결정에 따름)
- [ ] v0.2 범위 축소 여부: 터치 최적화와 샘플링 반경을 v0.2.x로 뺄 것인가?

### 후순위

- [ ] 효과(v0.3)의 우선순위: 사용자 근거가 없다. 정확도·크로스 브라우저가 차별점이라면 효과는 v1.0 이후로 미룰 것인가?
- [ ] 알파 채널(투명도) 지원을 v0.3에 넣을 것인가?
- [ ] React 외 프레임워크 지원을 위해 Loupe 엔진을 프레임워크 독립 코어로 분리할 것인가?

## 12. 참고 자료

- [MDN: EyeDropper API](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API)
- [use-eye-dropper](https://github.com/woofers/use-eye-dropper)
- [eyedropper-polyfill](https://github.com/iam-medvedev/eyedropper-polyfill)
- [react-eyedrop](https://github.com/jodhman/react-eyedrop)
- [@spectrum-web-components/color-loupe](https://www.npmjs.com/package/@spectrum-web-components/color-loupe)
- [@ltcode/eyedropper](https://www.npmjs.com/package/@ltcode/eyedropper)
- [react-colorful](https://github.com/omgovich/react-colorful)
- [Choi-R/color-identifier](https://github.com/Choi-R/color-identifier) (vanilla JS 확대경 참고 코드)
- [colortrail](https://colortrail.pages.dev/) (getDisplayMedia 기반 화면 색 추출 도구)
- [Polypane: The EyeDropper API](https://polypane.app/blog/the-eyedropper-api-pick-colors-from-anywhere-on-your-screen/)
