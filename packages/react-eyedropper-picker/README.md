# react-eyedropper-picker

React color picker with built-in support for the native [EyeDropper API](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API).
Zero runtime dependencies, fully typed, SSR-safe, keyboard accessible.

브라우저 기본 [EyeDropper API](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API)를 지원하는 React 컬러 피커입니다.
런타임 의존성이 없고, 타입이 모두 갖춰져 있으며, SSR에서 안전하고, 키보드로 조작할 수 있습니다.

**[Live demo →](https://momoci99.github.io/react-eyedropper-picker/)** · **[데모 보기 →](https://momoci99.github.io/react-eyedropper-picker/)**

```bash
npm install react-eyedropper-picker
```

## Usage · 사용법

### Component · 컴포넌트

```tsx
import { useState } from 'react'
import { ColorPicker } from 'react-eyedropper-picker'

function App() {
  const [color, setColor] = useState('#3b82f6')
  return <ColorPicker value={color} onChange={setColor} />
}
```

| Prop             | Type                    | Default     | Description · 설명                            |
| ---------------- | ----------------------- | ----------- | --------------------------------------------- |
| `value`          | `string`                | –           | Controlled hex value<br>제어 모드의 hex 값 |
| `defaultValue`   | `string`                | `'#000000'` | Initial value when uncontrolled<br>비제어 모드의 초깃값 |
| `onChange`       | `(hex: string) => void` | –           | Called with normalized `#rrggbb` (`#rrggbbaa` with `alpha`)<br>정규화된 `#rrggbb`로 호출 (`alpha`를 켜면 `#rrggbbaa`) |
| `alpha`          | `boolean`               | `false`     | Opacity slider; values become `#rrggbbaa` (see Opacity)<br>투명도 슬라이더. 값이 `#rrggbbaa`가 됨 (투명도 참고) |
| `showEyeDropper` | `boolean`               | `true`      | Show eye dropper button (when supported)<br>스포이드 버튼 표시 (지원될 때) |
| `eyeDropper`     | `EyeDropperLike`        | native      | Picker behind the button (see Loupe)<br>버튼이 여는 스포이드 (확대경 참고) |
| `showInput`      | `boolean`               | `true`      | Show hex input<br>hex 입력창 표시 |
| `theme`          | `'light' \| 'dark' \| 'auto'` | `'light'` | `'auto'` follows the OS (see Theming)<br>`'auto'`는 OS 설정을 따름 (테마 참고) |
| `history`        | `boolean \| UseColorHistoryOptions \| UseColorHistoryResult` | `false` | Recent picks under the input (see Color history)<br>입력창 아래 최근 색 (색 기록 참고) |
| `touchBubble`    | `boolean`               | `true`      | Color bubble above the finger on touch drags<br>터치로 끌 때 손가락 위 색 버블 |
| `className`      | `string`                | –           | Root class name<br>루트 요소 클래스 이름 |
| `style`          | `CSSProperties`         | –           | Root inline style (merged with defaults)<br>루트 인라인 스타일 (기본값과 합쳐짐) |

On touch screens the thumb covers the handle, so while you drag the panel or a slider by touch, a bubble above the finger shows the color under it. Mouse and pen don't show it. `SaturationPanel`, `HueSlider` and `AlphaSlider` take `touchBubble` too.

터치 화면에서는 엄지가 손잡이를 가립니다. 그래서 패널이나 슬라이더를 터치로 끄는 동안 손가락 위 버블에 그 아래 색을 보여 줍니다. 마우스와 펜에서는 나오지 않습니다. `SaturationPanel`, `HueSlider`, `AlphaSlider`도 `touchBubble`을 받습니다.

### Opacity · 투명도

`alpha` adds an opacity slider under the hue slider.

`alpha`를 켜면 색상 슬라이더 아래에 투명도 슬라이더가 생깁니다.

```tsx
const [color, setColor] = useState('#3b82f680')
<ColorPicker alpha value={color} onChange={setColor} />
```

- Values are always `#rrggbbaa`: `ff` is opaque, `00` transparent. `#336699` comes back as `#336699ff`.
- `value`, `defaultValue` and the input take `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`; no alpha digits means opaque.
- The eye dropper sets the picked color opaque: pixels on screen have no transparency.
- The preview and the history swatches show transparency over a checkerboard.
- Headless: `useColorPicker({ alpha: true })` adds `alpha` (0-1) and `setAlpha`; `AlphaSlider` is the slider (`color`, `alpha`, `onChange`).

- 값은 항상 `#rrggbbaa`입니다. `ff`는 불투명, `00`은 투명입니다. `#336699`는 `#336699ff`로 돌아옵니다.
- `value`, `defaultValue`, 입력창은 `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`를 받습니다. 투명도 자리가 없으면 불투명입니다.
- 스포이드로 집은 색은 불투명이 됩니다. 화면 픽셀에는 투명도가 없기 때문입니다.
- 미리보기와 최근 색 견본은 체커보드 위에 투명도를 보여 줍니다.
- 헤드리스: `useColorPicker({ alpha: true })`는 `alpha`(0-1)와 `setAlpha`를 더해 줍니다. 슬라이더는 `AlphaSlider`(`color`, `alpha`, `onChange`)입니다.

### Theming · 테마

`theme="dark"` switches to dark colors; `theme="auto"` follows the user's OS setting with CSS `light-dark()`, so it's right on the first paint, server rendering included. Every color is also a CSS variable you can set anywhere above the picker (`:root`, a wrapper class):

`theme="dark"`는 어두운 색으로 바꿉니다. `theme="auto"`는 CSS `light-dark()`로 사용자의 OS 설정을 따르므로, 서버 렌더링을 포함해 첫 화면부터 맞게 나옵니다. 모든 색은 CSS 변수이기도 해서, 피커 바깥 어디서든(`:root`, 감싸는 요소의 클래스) 바꿀 수 있습니다.

```css
:root {
  --rep-bg: #fdf6e3;
  --rep-fg: #073642;
}
```

| Variable             | Used for · 쓰이는 곳             | Light / dark default                        |
| -------------------- | -------------------------------- | ------------------------------------------- |
| `--rep-bg`           | Picker background<br>피커 배경 | `#fff` / `#1f1f23`                          |
| `--rep-fg`           | Picker text<br>피커 글자 | `#111` / `#f2f2f5`                          |
| `--rep-border`       | Input, button and swatch borders<br>입력창, 버튼, 견본 테두리 | `rgba(0,0,0,.15)` / `rgba(255,255,255,.18)` |
| `--rep-input-bg`     | Hex input background<br>hex 입력창 배경 | `#fff` / `#2a2a30`                          |
| `--rep-shadow`       | Picker shadow color<br>피커 그림자 색 | `rgba(0,0,0,.12)` / `rgba(0,0,0,.5)`        |
| `--rep-loupe-ring`   | Ring around the loupe<br>확대경 테두리 | `#fff`                                      |
| `--rep-loupe-shadow` | Loupe shadow color<br>확대경 그림자 색 | `rgba(0,0,0,.35)`                           |
| `--rep-label-bg`     | Hex label under the loupe<br>확대경 아래 hex 라벨 | `rgba(0,0,0,.75)`                           |
| `--rep-label-fg`     | Hex label text<br>hex 라벨 글자 | `#fff`                                      |

The loupe is added to `<body>`, so set its variables on `:root` (or pass `loupe.className`).

확대경은 `<body>`에 붙기 때문에, 확대경 변수는 `:root`에 지정하세요(또는 `loupe.className`을 넘기세요).

### Color history · 색 기록

`history` shows the colors picked with the eye dropper as swatches under the input; click one to use it again. Dragging and typing don't add to it.

`history`를 켜면 스포이드로 집은 색이 입력창 아래에 견본으로 쌓입니다. 누르면 그 색을 다시 씁니다. 드래그나 직접 입력한 색은 쌓이지 않습니다.

```tsx
<ColorPicker history />                                       // in memory
<ColorPicker history={{ storageKey: 'my-app-colors', max: 12 }} /> // kept in localStorage
```

`useColorHistory` is the same history as a hook, for your own swatches or to share one history between pickers:

`useColorHistory`는 같은 기록을 훅으로 제공합니다. 직접 견본을 그리거나, 여러 피커가 기록 하나를 나눠 쓸 때 씁니다.

```tsx
import { ColorPicker, useColorHistory } from 'react-eyedropper-picker'

const history = useColorHistory({ storageKey: 'my-app-colors' })
// history.colors: newest first; history.add(hex), history.remove(hex), history.clear()

<ColorPicker history={history} />
<ImageColorPicker src="/photo.jpg" onPick={(c) => history.add(c.sRGBHex)} />
```

| Option          | Default | Description · 설명                                                                |
| --------------- | ------- | --------------------------------------------------------------------------------- |
| `max`           | `8`     | Most colors kept<br>최대 보관 개수 |
| `storageKey`    | –       | Save to `localStorage` under this key, synced across tabs and pickers with the key<br>이 키로 `localStorage`에 저장. 같은 키를 쓰는 탭과 피커끼리 동기화 |
| `defaultColors` | `[]`    | Starting colors, used while nothing is stored<br>저장된 것이 없을 때 쓰는 시작 색 |

With `storageKey`, the server renders `defaultColors` and the client reads storage while hydrating. If storage is blocked or full, the history still works for the page's lifetime.

`storageKey`를 쓰면 서버는 `defaultColors`로 렌더링하고, 클라이언트는 하이드레이션 중에 저장소를 읽습니다. 저장소가 막혀 있거나 가득 차도 페이지가 열려 있는 동안은 기록이 동작합니다.

### Headless hook · 헤드리스 훅

Build your own UI with `useColorPicker` plus the `SaturationPanel` / `HueSlider` / `AlphaSlider` / `EyeDropperButton` building blocks.

`useColorPicker`와 `SaturationPanel` / `HueSlider` / `AlphaSlider` / `EyeDropperButton` 부품으로 원하는 UI를 직접 만들 수 있습니다.

```tsx
import { useColorPicker, SaturationPanel, HueSlider, EyeDropperButton } from 'react-eyedropper-picker'

function MyPicker() {
  const { hex, hsv, setHsv, pickColor, canPickColor } = useColorPicker({
    defaultValue: '#ff0000',
  })
  return (
    <div>
      <SaturationPanel hsv={hsv} onChange={setHsv} />
      <HueSlider hue={hsv.h} onChange={(h) => setHsv({ ...hsv, h })} />
      {canPickColor && <EyeDropperButton onClick={pickColor} />}
      <span>{hex}</span>
    </div>
  )
}
```

`pickColor` opens the eye dropper (native, or the loupe you pass as `eyeDropper`) and applies the color. Show the button only when `canPickColor` is true. The old names `pickFromScreen` and `isEyeDropperSupported` still work in 0.x and are removed in 1.0.

`pickColor`는 스포이드(순정, 또는 `eyeDropper`로 넘긴 확대경)를 열고 뽑은 색을 적용합니다. 버튼은 `canPickColor`가 true일 때만 보여 주세요. 예전 이름 `pickFromScreen`, `isEyeDropperSupported`는 0.x에서는 계속 동작하고 1.0에서 없어집니다.

### Eye dropper only · 스포이드만 쓰기

```tsx
import { useEyeDropper } from 'react-eyedropper-picker'

const { open, close, isSupported } = useEyeDropper()
const { sRGBHex } = await open() // rejects with AbortError on cancel/close
```

`open()` rejects with `NotSupportedError` where the browser has no EyeDropper API. Check `isSupported` first.

EyeDropper API가 없는 브라우저에서는 `open()`이 `NotSupportedError`로 실패합니다. 먼저 `isSupported`를 확인하세요. 취소하거나 `close()`를 부르면 `AbortError`로 실패합니다.

### Loupe: pick from an image, canvas or video · 확대경: 이미지, 캔버스, 영상에서 색 집기

`react-eyedropper-picker/loupe` adds a pixel-accurate magnifier that works in every browser. It is a separate entry, so apps that only use the base entry don't bundle it.

`react-eyedropper-picker/loupe`는 모든 브라우저에서 동작하는, 픽셀 단위로 정확한 확대경을 제공합니다. 별도 진입점이라 기본 진입점만 쓰는 앱의 번들에는 들어가지 않습니다.

The loupe entry needs `react-dom` (for `renderLabel`). The base entry does not.

확대경 진입점은 `react-dom`이 필요합니다(`renderLabel` 때문). 기본 진입점은 필요 없습니다.

#### `ImageColorPicker`

An `<img>` you pick colors from. Hover to magnify, click to pick. The page stays usable, and you can pick again and again.

색을 집을 수 있는 `<img>`입니다. 마우스를 올리면 확대되고 클릭하면 집습니다. 페이지는 계속 쓸 수 있고, 몇 번이고 다시 집을 수 있습니다.

```tsx
import { ImageColorPicker } from 'react-eyedropper-picker/loupe'

<ImageColorPicker
  src="/photo.jpg"
  alt="Sunset"
  onPick={({ sRGBHex, x, y }) => console.log(sRGBHex, x, y)}
  loupe={{
    defaultMagnification: 10,
    sampleSize: 3,
    renderLabel: ({ sRGBHex }) => <span>{sRGBHex}</span>,
  }}
/>
```

- Mouse: hover to aim, click to pick, wheel to zoom (only while over the image, so the page still scrolls elsewhere).
- Touch: press and drag on the image, lift to pick, pinch with both fingers on the image to zoom. Touches on the image don't scroll the page.
- Keyboard: Tab to the image, Enter or Space opens the full-screen loupe (keys below).
- Takes every `<img>` prop. `loupe` takes the options below plus `renderLabel(color)`, which replaces the hex label under the loupe.
- `onPickError` gets read errors, such as `SecurityError` for a cross-origin image without CORS. Default: `console.error`.
- CSS `object-fit`, `object-position`, border and padding are followed: the loupe picks where the picture is drawn, and letterbox bars pick nothing.

- 마우스: 올려서 겨누고, 클릭해서 집고, 휠로 확대합니다(이미지 위에서만. 다른 곳에서는 페이지가 그대로 스크롤됩니다).
- 터치: 이미지를 누른 채 끌고, 떼면 집습니다. 두 손가락을 이미지 위에 두고 벌리거나 오므리면 확대합니다. 이미지 위의 터치는 페이지를 스크롤하지 않습니다.
- 키보드: Tab으로 이미지에 가서 Enter나 Space를 누르면 전체 화면 확대경이 열립니다(키는 아래 참고).
- `<img>`의 모든 prop을 받습니다. `loupe`는 아래 옵션과 함께 `renderLabel(color)`를 받으며, 확대경 아래 hex 라벨을 대신합니다.
- `onPickError`는 읽기 오류를 받습니다. 예를 들어 CORS 없는 다른 도메인 이미지는 `SecurityError`입니다. 기본값은 `console.error`입니다.
- CSS `object-fit`, `object-position`, 테두리, 패딩을 따릅니다. 그림이 실제로 그려진 곳에서 집고, 레터박스 띠에서는 집지 않습니다.

#### `useLoupeEyeDropper`

Picks once from an image, canvas or video, like the native EyeDropper: call `open()`, get a promise. The loupe covers the page until you pick or cancel.

기본 EyeDropper처럼 이미지, 캔버스, 영상에서 한 번 색을 집습니다. `open()`을 부르면 Promise를 돌려줍니다. 색을 집거나 취소할 때까지 확대경이 페이지를 덮습니다.

```tsx
import { useRef } from 'react'
import { useLoupeEyeDropper } from 'react-eyedropper-picker/loupe'

function ImagePicker() {
  const img = useRef<HTMLImageElement>(null)
  const { open, isOpen } = useLoupeEyeDropper({
    source: img,
    loupe: { defaultMagnification: 8, sampleSize: 1 },
  })

  const pick = async () => {
    try {
      const { sRGBHex, x, y } = await open()
      console.log(sRGBHex, x, y) // x, y: source pixel
    } catch (e) {
      // AbortError: cancelled (Escape, click outside, close())
    }
  }

  return (
    <>
      <img ref={img} src="/photo.jpg" crossOrigin="anonymous" alt="" />
      <button onClick={pick} aria-busy={isOpen}>
        Pick a color
      </button>
    </>
  )
}
```

- Mouse: move to aim, click to pick, click outside the image to cancel, wheel to zoom.
- Touch: the loupe sits above your finger. Drag to aim, lift to pick, tap outside to cancel, pinch to zoom.
- Keyboard: arrows move 1px (Shift: 10px), Enter picks, Escape cancels, `+` / `-` zoom, `0` resets.
- `mode`: `'auto'` (default) uses the loupe when there is a `source`, else the native EyeDropper. `'native'` and `'loupe'` force one.
- `loupe` options: `defaultMagnification` (8), `minMagnification` (1), `maxMagnification` (64), `magnificationSteps`, controlled `magnification` + `onMagnificationChange`, `size` (120), `shape` (`'circle'` | `'square'`), `grid` (true), `sampleSize` (1 | 3 | 5), `className`, `smoothing` (0), `animate` (true), `cursor` (`'none'`), `sound` (false), `haptics` (false).
- Cross-origin images need CORS (`crossOrigin="anonymous"`), or `open()` rejects with `SecurityError`.
- CSS `object-fit`, `object-position`, border and padding are followed, as with `ImageColorPicker`.
- Focus returns to the element that was focused before `open()`. Don't disable that button while `isOpen`, or focus is lost (a disabled button can't take focus back).

- 마우스: 움직여서 겨누고, 클릭해서 집고, 이미지 밖을 클릭하면 취소, 휠로 확대합니다.
- 터치: 확대경이 손가락 위에 뜹니다. 끌어서 겨누고, 떼면 집고, 바깥을 탭하면 취소, 두 손가락으로 확대합니다.
- 키보드: 방향키로 1px(Shift: 10px) 이동, Enter로 집기, Escape로 취소, `+` / `-`로 확대·축소, `0`으로 처음 배율.
- `mode`: `'auto'`(기본)는 `source`가 있으면 확대경을, 없으면 기본 EyeDropper를 씁니다. `'native'`와 `'loupe'`는 한쪽으로 고정합니다.
- `loupe` 옵션: `defaultMagnification`(8), `minMagnification`(1), `maxMagnification`(64), `magnificationSteps`, 제어용 `magnification` + `onMagnificationChange`, `size`(120), `shape`(`'circle'` | `'square'`), `grid`(true), `sampleSize`(1 | 3 | 5), `className`, `smoothing`(0), `animate`(true), `cursor`(`'none'`), `sound`(false), `haptics`(false).
- 다른 도메인 이미지는 CORS(`crossOrigin="anonymous"`)가 필요합니다. 없으면 `open()`이 `SecurityError`로 실패합니다.
- `ImageColorPicker`처럼 CSS `object-fit`, `object-position`, 테두리, 패딩을 따릅니다.
- 닫히면 `open()` 전에 포커스가 있던 요소로 포커스가 돌아갑니다. `isOpen`인 동안 그 버튼을 비활성화하지 마세요. 비활성화된 버튼은 포커스를 받을 수 없어서 포커스를 잃습니다.

#### With `ColorPicker` · `ColorPicker`와 함께

Pass the hook to `eyeDropper`. The eye dropper button then opens the loupe on your image, so it shows in every browser, not only where the native EyeDropper exists. `ColorPicker` only needs `{ open, isSupported }`, so the base entry still doesn't bundle the loupe.

훅을 `eyeDropper`에 넘기세요. 그러면 스포이드 버튼이 이미지 위에 확대경을 열기 때문에, 기본 EyeDropper가 있는 브라우저뿐 아니라 모든 브라우저에서 버튼이 보입니다. `ColorPicker`는 `{ open, isSupported }`만 필요하므로 기본 진입점에는 여전히 확대경이 번들되지 않습니다.

```tsx
const img = useRef<HTMLImageElement>(null)
const dropper = useLoupeEyeDropper({ source: img })

<img ref={img} src="/photo.jpg" alt="" />
<ColorPicker value={color} onChange={setColor} eyeDropper={dropper} />
```

`useColorPicker({ eyeDropper })` does the same for headless pickers.

헤드리스 피커는 `useColorPicker({ eyeDropper })`로 똑같이 할 수 있습니다.

#### Video · 영상

`source` can be a `<video>`. `open()` picks from the frame showing at that moment: the frame covers the video until you pick or cancel, so what you aim at stays still. Playback is not touched (the video keeps playing and stays audible); pause it yourself if you want it to stop.

`source`에 `<video>`를 넘길 수 있습니다. `open()`은 그 순간 보이는 프레임에서 색을 집습니다. 집거나 취소할 때까지 그 프레임이 영상을 덮어서, 겨누는 화면이 멈춰 있습니다. 재생은 건드리지 않습니다(영상은 계속 재생되고 소리도 납니다). 멈추고 싶으면 직접 일시정지하세요.

```tsx
const video = useRef<HTMLVideoElement>(null)
const { open } = useLoupeEyeDropper({ source: video })

<video ref={video} src="/clip.mp4" crossOrigin="anonymous" controls />
<button onClick={() => open().then(({ sRGBHex }) => setColor(sRGBHex))}>Pick from video</button>
```

- Videos letterbox by default (`object-fit: contain`); the bars pick nothing.
- `open()` rejects with `InvalidStateError` until the video has a frame (`readyState` below `HAVE_CURRENT_DATA`), e.g. with `preload="none"` before playing.
- Cross-origin videos need CORS like images. DRM-protected video (Encrypted Media Extensions) can't be read.
- `ImageColorPicker` (hover) is for images only.

- 영상은 기본으로 레터박스가 생깁니다(`object-fit: contain`). 띠에서는 색을 집지 않습니다.
- 영상에 프레임이 생기기 전(`readyState`가 `HAVE_CURRENT_DATA`보다 낮을 때)에는 `open()`이 `InvalidStateError`로 실패합니다. 예를 들어 `preload="none"`이고 아직 재생하지 않은 경우입니다.
- 다른 도메인 영상은 이미지처럼 CORS가 필요합니다. DRM이 걸린 영상(Encrypted Media Extensions)은 읽을 수 없습니다.
- `ImageColorPicker`(hover)는 이미지 전용입니다.

#### Motion · 모션

- `smoothing` (0 to 1, default 0): the loupe glides after the pointer instead of jumping. The picked pixel is always the one under the pointer; only the loupe's position lags.
- `animate` (default true): the loupe grows in when it appears, shrinks out when it closes, and zooms smoothly.
- Both turn off when the user prefers reduced motion (`prefers-reduced-motion: reduce`).

- `smoothing`(0~1, 기본 0): 확대경이 포인터로 뚝 옮겨 가지 않고 부드럽게 따라갑니다. 집는 픽셀은 항상 포인터 아래 픽셀이고, 확대경 위치만 뒤따라갑니다.
- `animate`(기본 true): 확대경이 나타날 때 커지고, 닫힐 때 작아지며, 확대도 부드럽게 바뀝니다.
- 사용자가 모션 줄이기를 설정하면(`prefers-reduced-motion: reduce`) 둘 다 꺼집니다.

#### Cursor · 커서

Over the image the cursor is hidden by default and the loupe is centered on the pointer: its center pixel marks the spot. `cursor` takes any CSS `cursor` value to show instead; the loupe then moves above the pointer, as it does over a finger, so the cursor doesn't cover it (below near the top of the viewport). `eyeDropperCursor` is a ready-made eye dropper icon (tip on the pointer, outlined for any background):

이미지 위에서는 기본으로 커서를 숨기고 확대경을 포인터 가운데에 둡니다. 확대경의 가운데 픽셀이 위치를 표시합니다. `cursor`에 CSS `cursor` 값을 주면 그 커서를 보여 주고, 확대경은 손가락 때처럼 포인터 위로 옮겨 가서 커서가 가리지 않습니다(화면 위쪽 끝에서는 아래로). `eyeDropperCursor`는 바로 쓸 수 있는 스포이드 아이콘입니다(끝이 포인터 위치, 어떤 배경에서도 보이도록 외곽선이 있음).

```tsx
import { ImageColorPicker, eyeDropperCursor } from 'react-eyedropper-picker/loupe'

<ImageColorPicker src="/photo.jpg" loupe={{ cursor: eyeDropperCursor }} />
useLoupeEyeDropper({ source, loupe: { cursor: 'url(/pick.png) 2 22, crosshair' } })
```

#### Sound and haptics · 소리와 진동

The loupe can tick like a mechanical dial as it moves: one tick per source pixel, a "brrrt" when you sweep fast, a detent tick per zoom step, a "whoosh" on open, a click on confirm, a low tone on cancel. Both are **off by default**: turn them on with one option, on `ImageColorPicker` or `useLoupeEyeDropper`.

확대경은 움직일 때 기계식 다이얼처럼 소리를 낼 수 있습니다. 원본 픽셀마다 틱, 빠르게 훑으면 "드르륵", 확대 단계마다 딸깍, 열 때 "휙", 확정할 때 클릭, 취소할 때 낮은 음입니다. 소리와 진동은 **기본으로 꺼져 있습니다**. `ImageColorPicker`나 `useLoupeEyeDropper`에서 옵션 하나로 켭니다.

```tsx
<ImageColorPicker src="/photo.jpg" alt="" loupe={{ sound: true, haptics: true }} />

useLoupeEyeDropper({
  source: img,
  loupe: {
    sound: {
      volume: 0.3, // 0 to 1, default 0.5
      events: { cancel: false }, // pixel, zoom, open, confirm, cancel
      minTickInterval: 50, // ms, ticks closer than this merge. Default 35
    },
  },
})
```

- Sounds are made with Web Audio: no audio files, no network requests.
- Browsers mute audio until the user interacts with the page. `open()` and pointer presses unlock it, so the first ticks of a hover may be silent until the first click anywhere on the page.
- Sounds stop while the tab is hidden.
- `haptics` vibrates on pixel ticks and confirm with `navigator.vibrate` (Android Chrome). Elsewhere, such as iOS Safari, it does nothing.
- Custom sounds: `play: { confirm: (ctx, speed, output) => ... }` replaces an event's sound. Connect your nodes (or an `AudioBuffer` source) to `output`, not `ctx.destination`, so `volume` applies. `speed` is 0 (slow) to 1 (fast) for `pixel` and `zoom`.

- 소리는 Web Audio로 합성합니다. 오디오 파일도, 네트워크 요청도 없습니다.
- 브라우저는 사용자가 페이지와 상호작용하기 전까지 소리를 막습니다. `open()`과 포인터 누르기가 소리를 풀어 주므로, hover의 첫 틱은 페이지 어딘가를 처음 클릭하기 전까지 안 들릴 수 있습니다.
- 탭이 숨겨져 있는 동안에는 소리가 멈춥니다.
- `haptics`는 픽셀 틱과 확정 때 `navigator.vibrate`로 진동합니다(Android Chrome). iOS Safari 같은 다른 곳에서는 아무 일도 하지 않습니다.
- 사용자 정의 소리: `play: { confirm: (ctx, speed, output) => ... }`로 이벤트의 소리를 바꿉니다. 노드(또는 `AudioBuffer` 소스)는 `ctx.destination`이 아니라 `output`에 연결해야 `volume`이 적용됩니다. `speed`는 `pixel`과 `zoom`에서 0(느림)~1(빠름)입니다.

### Color utilities · 색 변환 함수

`normalizeHex`, `isValidHex`, `hexToRgb`, `rgbToHex`, `rgbToHsv`, `hsvToRgb`, `hexToHsv`, `hsvToHex`.

With alpha: `normalizeHexAlpha` (any of `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` → `#rrggbbaa`), `hexToRgba`, `rgbaToHex` and the `RGBA` type (`a` is 0-1).

알파용: `normalizeHexAlpha`(`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` 중 무엇이든 → `#rrggbbaa`), `hexToRgba`, `rgbaToHex`, 그리고 `RGBA` 타입(`a`는 0-1).

## Browser support · 브라우저 지원

The picker works everywhere. `theme="auto"` needs CSS `light-dark()` (Chrome 123, Safari 17.5, Firefox 120); older browsers should use `'light'` or `'dark'`. By default the eye dropper button only appears where the EyeDropper API exists (Chromium-based browsers: Chrome, Edge, Opera). With a loupe `eyeDropper` it appears in every browser.

피커는 모든 브라우저에서 동작합니다. `theme="auto"`는 CSS `light-dark()`가 필요합니다(Chrome 123, Safari 17.5, Firefox 120). 더 오래된 브라우저에서는 `'light'`나 `'dark'`를 쓰세요. 스포이드 버튼은 기본으로 EyeDropper API가 있는 브라우저(Chromium 기반: Chrome, Edge, Opera)에서만 보입니다. 확대경을 `eyeDropper`로 넘기면 모든 브라우저에서 보입니다.

## Credits · 크레딧

`useEyeDropper` is based on [use-eye-dropper](https://github.com/woofers/use-eye-dropper) by Jaxson Van Doorn (MIT).

`useEyeDropper`는 Jaxson Van Doorn의 [use-eye-dropper](https://github.com/woofers/use-eye-dropper)(MIT)를 바탕으로 합니다.

## License · 라이선스

MIT
