# react-eyedropper-picker

React color picker with built-in support for the native [EyeDropper API](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API).
Zero runtime dependencies, fully typed, SSR-safe, keyboard accessible.

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
| `onChange`       | `(hex: string) => void` | –           | Called with normalized `#rrggbb`              |
| `showEyeDropper` | `boolean`               | `true`      | Show eye dropper button (when supported)      |
| `showInput`      | `boolean`               | `true`      | Show hex input                                |
| `className`      | `string`                | –           | Root class name                               |
| `style`          | `CSSProperties`         | –           | Root inline style (merged with defaults)      |

### Headless hook

Build your own UI with `useColorPicker` plus the `SaturationPanel` / `HueSlider` / `EyeDropperButton` building blocks.

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

### Loupe: pick from an image or canvas

`react-eyedropper-picker/loupe` adds a pixel-accurate magnifier that works in every browser. It is a separate entry, so apps that only use the base entry don't bundle it.

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
      <button onClick={pick} disabled={isOpen}>
        Pick a color
      </button>
    </>
  )
}
```

- Mouse: move to aim, click to pick, click outside the image to cancel, wheel to zoom.
- Keyboard: arrows move 1px (Shift: 10px), Enter picks, Escape cancels, `+` / `-` zoom, `0` resets.
- `mode`: `'auto'` (default) uses the loupe when there is a `source`, else the native EyeDropper. `'native'` and `'loupe'` force one.
- `loupe` options: `defaultMagnification` (8), `minMagnification` (1), `maxMagnification` (64), `magnificationSteps`, controlled `magnification` + `onMagnificationChange`, `size` (120), `shape` (`'circle'` | `'square'`), `grid` (true), `sampleSize` (1 | 3 | 5), `className`.
- Cross-origin images need CORS (`crossOrigin="anonymous"`), or `open()` rejects with `SecurityError`.

### Color utilities

`normalizeHex`, `isValidHex`, `hexToRgb`, `rgbToHex`, `rgbToHsv`, `hsvToRgb`, `hexToHsv`, `hsvToHex`.

## Browser support

The picker works everywhere. The eye dropper button only appears where the EyeDropper API exists (Chromium-based browsers: Chrome, Edge, Opera).

## Credits

`useEyeDropper` is based on [use-eye-dropper](https://github.com/woofers/use-eye-dropper) by Jaxson Van Doorn (MIT).

## License

MIT
