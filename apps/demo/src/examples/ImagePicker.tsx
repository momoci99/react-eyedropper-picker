import { useState } from 'react'
import { ImageColorPicker } from 'react-eyedropper-picker/loupe'
import photo from './pixel-art.png'

export default function ImagePicker() {
  const [color, setColor] = useState<string | null>(null)
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <ImageColorPicker
        src={photo}
        alt="Pixel art landscape"
        width={288}
        style={{ imageRendering: 'pixelated', borderRadius: 8 }}
        loupe={{ sound: true }}
        onPick={(result) => setColor(result.sRGBHex)}
      />
      <code>{color ?? 'Hover the image, click to pick'}</code>
    </div>
  )
}
