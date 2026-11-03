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

### Color utilities

`normalizeHex`, `isValidHex`, `hexToRgb`, `rgbToHex`, `rgbToHsv`, `hsvToRgb`, `hexToHsv`, `hsvToHex`.

## Browser support

The picker works everywhere. The eye dropper button only appears where the EyeDropper API exists (Chromium-based browsers: Chrome, Edge, Opera).

## Credits

`useEyeDropper` is based on [use-eye-dropper](https://github.com/woofers/use-eye-dropper) by Jaxson Van Doorn (MIT).

## License

MIT
