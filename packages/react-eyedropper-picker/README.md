# react-eyedropper-picker

React color picker with built-in support for the native [EyeDropper API](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API).
Zero runtime dependencies, fully typed, SSR-safe, keyboard accessible.

**[Live demo →](https://momoci99.github.io/react-eyedropper-picker/)**

```bash
npm install react-eyedropper-picker
```

## Usage

### Component

```tsx
import { useState } from 'react'
import { ColorPicker } from 'react-eyedropper-picker'

function App() {
  const [color, setColor] = useState('#3b82f6')
  return <ColorPicker value={color} onChange={setColor} />
}
```

| Prop             | Type                    | Default     | Description                                   |
| ---------------- | ----------------------- | ----------- | --------------------------------------------- |
| `value`          | `string`                | –           | Controlled hex value                          |
| `defaultValue`   | `string`                | `'#000000'` | Initial value when uncontrolled               |
| `onChange`       | `(hex: string) => void` | –           | Called with normalized `#rrggbb` (`#rrggbbaa` with `alpha`) |
| `alpha`          | `boolean`               | `false`     | Opacity slider; values become `#rrggbbaa` (see Opacity) |
| `showEyeDropper` | `boolean`               | `true`      | Show eye dropper button (when supported)      |
| `eyeDropper`     | `EyeDropperLike`        | native      | Picker behind the button (see Loupe)          |
| `showInput`      | `boolean`               | `true`      | Show hex input                                |
| `theme`          | `'light' \| 'dark' \| 'auto'` | `'light'` | `'auto'` follows the OS (see Theming) |
| `history`        | `boolean \| UseColorHistoryOptions \| UseColorHistoryResult` | `false` | Recent picks under the input (see Color history) |
| `touchBubble`    | `boolean`               | `true`      | Color bubble above the finger on touch drags  |
| `className`      | `string`                | –           | Root class name                               |
| `style`          | `CSSProperties`         | –           | Root inline style (merged with defaults)      |

On touch screens the thumb covers the handle, so while you drag the panel or a slider by touch, a bubble above the finger shows the color under it. Mouse and pen don't show it. `SaturationPanel`, `HueSlider` and `AlphaSlider` take `touchBubble` too.

### Opacity

`alpha` adds an opacity slider under the hue slider.

```tsx
const [color, setColor] = useState('#3b82f680')
<ColorPicker alpha value={color} onChange={setColor} />
```

- Values are always `#rrggbbaa`: `ff` is opaque, `00` transparent. `#336699` comes back as `#336699ff`.
- `value`, `defaultValue` and the input take `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`; no alpha digits means opaque.
- The eye dropper sets the picked color opaque: pixels on screen have no transparency.
- The preview and the history swatches show transparency over a checkerboard.
- Headless: `useColorPicker({ alpha: true })` adds `alpha` (0-1) and `setAlpha`; `AlphaSlider` is the slider (`color`, `alpha`, `onChange`).

### Theming

`theme="dark"` switches to dark colors; `theme="auto"` follows the user's OS setting with CSS `light-dark()`, so it's right on the first paint, server rendering included. Every color is also a CSS variable you can set anywhere above the picker (`:root`, a wrapper class):

```css
:root {
  --rep-bg: #fdf6e3;
  --rep-fg: #073642;
}
```

| Variable             | Used for                         | Light / dark default                        |
| -------------------- | -------------------------------- | ------------------------------------------- |
| `--rep-bg`           | Picker background                | `#fff` / `#1f1f23`                          |
| `--rep-fg`           | Picker text                      | `#111` / `#f2f2f5`                          |
| `--rep-border`       | Input, button and swatch borders | `rgba(0,0,0,.15)` / `rgba(255,255,255,.18)` |
| `--rep-input-bg`     | Hex input background             | `#fff` / `#2a2a30`                          |
| `--rep-shadow`       | Picker shadow color              | `rgba(0,0,0,.12)` / `rgba(0,0,0,.5)`        |
| `--rep-loupe-ring`   | Ring around the loupe            | `#fff`                                      |
| `--rep-loupe-shadow` | Loupe shadow color               | `rgba(0,0,0,.35)`                           |
| `--rep-label-bg`     | Hex label under the loupe        | `rgba(0,0,0,.75)`                           |
| `--rep-label-fg`     | Hex label text                   | `#fff`                                      |

The loupe is added to `<body>`, so set its variables on `:root` (or pass `loupe.className`).

### Color history

`history` shows the colors picked with the eye dropper as swatches under the input; click one to use it again. Dragging and typing don't add to it.

```tsx
<ColorPicker history />                                       // in memory
<ColorPicker history={{ storageKey: 'my-app-colors', max: 12 }} /> // kept in localStorage
```

`useColorHistory` is the same history as a hook, for your own swatches or to share one history between pickers:

```tsx
import { ColorPicker, useColorHistory } from 'react-eyedropper-picker'

const history = useColorHistory({ storageKey: 'my-app-colors' })
// history.colors: newest first; history.add(hex), history.remove(hex), history.clear()

<ColorPicker history={history} />
<ImageColorPicker src="/photo.jpg" onPick={(c) => history.add(c.sRGBHex)} />
```

| Option          | Default | Description                                                                       |
| --------------- | ------- | --------------------------------------------------------------------------------- |
| `max`           | `8`     | Most colors kept                                                                  |
| `storageKey`    | –       | Save to `localStorage` under this key, synced across tabs and pickers with the key |
| `defaultColors` | `[]`    | Starting colors, used while nothing is stored                                     |

With `storageKey`, the server renders `defaultColors` and the client reads storage while hydrating. If storage is blocked or full, the history still works for the page's lifetime.

### Headless hook

Build your own UI with `useColorPicker` plus the `SaturationPanel` / `HueSlider` / `AlphaSlider` / `EyeDropperButton` building blocks.

```tsx
import { useColorPicker, SaturationPanel, HueSlider, EyeDropperButton } from 'react-eyedropper-picker'

function MyPicker() {
  const { hex, hsv, setHsv, pickFromScreen, isEyeDropperSupported } = useColorPicker({
    defaultValue: '#ff0000',
  })
  return (
    <div>
      <SaturationPanel hsv={hsv} onChange={setHsv} />
      <HueSlider hue={hsv.h} onChange={(h) => setHsv({ ...hsv, h })} />
      {isEyeDropperSupported && <EyeDropperButton onClick={pickFromScreen} />}
      <span>{hex}</span>
    </div>
  )
}
```

### Eye dropper only

```tsx
import { useEyeDropper } from 'react-eyedropper-picker'

const { open, close, isSupported } = useEyeDropper()
const { sRGBHex } = await open() // rejects with AbortError on cancel/close
```

`open()` rejects with `NotSupportedError` where the browser has no EyeDropper API. Check `isSupported` first.

### Loupe: pick from an image, canvas or video

`react-eyedropper-picker/loupe` adds a pixel-accurate magnifier that works in every browser. It is a separate entry, so apps that only use the base entry don't bundle it.

The loupe entry needs `react-dom` (for `renderLabel`). The base entry does not.

#### `ImageColorPicker`

An `<img>` you pick colors from. Hover to magnify, click to pick. The page stays usable, and you can pick again and again.

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

#### `useLoupeEyeDropper`

Picks once from an image, canvas or video, like the native EyeDropper: call `open()`, get a promise. The loupe covers the page until you pick or cancel.

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

#### With `ColorPicker`

Pass the hook to `eyeDropper`. The eye dropper button then opens the loupe on your image, so it shows in every browser, not only where the native EyeDropper exists. `ColorPicker` only needs `{ open, isSupported }`, so the base entry still doesn't bundle the loupe.

```tsx
const img = useRef<HTMLImageElement>(null)
const dropper = useLoupeEyeDropper({ source: img })

<img ref={img} src="/photo.jpg" alt="" />
<ColorPicker value={color} onChange={setColor} eyeDropper={dropper} />
```

`useColorPicker({ eyeDropper })` does the same for headless pickers.

#### Video

`source` can be a `<video>`. `open()` picks from the frame showing at that moment: the frame covers the video until you pick or cancel, so what you aim at stays still. Playback is not touched (the video keeps playing and stays audible); pause it yourself if you want it to stop.

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

#### Motion

- `smoothing` (0 to 1, default 0): the loupe glides after the pointer instead of jumping. The picked pixel is always the one under the pointer; only the loupe's position lags.
- `animate` (default true): the loupe grows in when it appears, shrinks out when it closes, and zooms smoothly.
- Both turn off when the user prefers reduced motion (`prefers-reduced-motion: reduce`).

#### Cursor

Over the image the cursor is hidden by default and the loupe is centered on the pointer: its center pixel marks the spot. `cursor` takes any CSS `cursor` value to show instead; the loupe then moves above the pointer, as it does over a finger, so the cursor doesn't cover it (below near the top of the viewport). `eyeDropperCursor` is a ready-made eye dropper icon (tip on the pointer, outlined for any background):

```tsx
import { ImageColorPicker, eyeDropperCursor } from 'react-eyedropper-picker/loupe'

<ImageColorPicker src="/photo.jpg" loupe={{ cursor: eyeDropperCursor }} />
useLoupeEyeDropper({ source, loupe: { cursor: 'url(/pick.png) 2 22, crosshair' } })
```

#### Sound and haptics

The loupe can tick like a mechanical dial as it moves: one tick per source pixel, a "brrrt" when you sweep fast, a detent tick per zoom step, a "whoosh" on open, a click on confirm, a low tone on cancel. Both are **off by default**: turn them on with one option, on `ImageColorPicker` or `useLoupeEyeDropper`.

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

### Color utilities

`normalizeHex`, `isValidHex`, `hexToRgb`, `rgbToHex`, `rgbToHsv`, `hsvToRgb`, `hexToHsv`, `hsvToHex`.

With alpha: `normalizeHexAlpha` (any of `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` → `#rrggbbaa`), `hexToRgba`, `rgbaToHex` and the `RGBA` type (`a` is 0-1).

## Browser support

The picker works everywhere. `theme="auto"` needs CSS `light-dark()` (Chrome 123, Safari 17.5, Firefox 120); older browsers should use `'light'` or `'dark'`. By default the eye dropper button only appears where the EyeDropper API exists (Chromium-based browsers: Chrome, Edge, Opera). With a loupe `eyeDropper` it appears in every browser.

## Credits

`useEyeDropper` is based on [use-eye-dropper](https://github.com/woofers/use-eye-dropper) by Jaxson Van Doorn (MIT).

## License

MIT
