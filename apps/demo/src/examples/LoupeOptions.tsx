import { useState } from 'react'
import { ImageColorPicker } from 'react-eyedropper-picker/loupe'
import photo from './pixel-art.png'

export default function LoupeOptions() {
  const [color, setColor] = useState('')
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <ImageColorPicker
        src={photo}
        alt="Pixel art landscape"
        width={288}
        style={{ imageRendering: 'pixelated', borderRadius: 8 }}
        onPick={({ sRGBHex, x, y }) => setColor(`${sRGBHex} at ${x}, ${y}`)}
        loupe={{
          defaultMagnification: 12,
          size: 140,
          shape: 'square',
          sampleSize: 3,
          // Replaces the hex label under the loupe.
          renderLabel: ({ sRGBHex, x, y }) => (
            <span>
              {sRGBHex} · {x}, {y}
            </span>
          ),
        }}
      />
      <code>{color || 'Hover, wheel to zoom, click to pick'}</code>
    </div>
  )
}
