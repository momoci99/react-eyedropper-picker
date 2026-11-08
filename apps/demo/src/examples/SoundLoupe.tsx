import { useState } from 'react'
import { ImageColorPicker } from 'react-eyedropper-picker/loupe'
import photo from './pixel-art.png'

export default function SoundLoupe() {
  const [color, setColor] = useState('')
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <ImageColorPicker
        src={photo}
        alt="Pixel art landscape"
        width={288}
        style={{ imageRendering: 'pixelated', borderRadius: 8 }}
        loupe={{ sound: true, haptics: true }}
        onPick={({ sRGBHex }) => setColor(sRGBHex)}
      />
      <code>{color || 'Click once, then sweep across the pixels'}</code>
    </div>
  )
}
