import { useRef, useState } from 'react'
import { ColorPicker } from 'react-eyedropper-picker'
import { useLoupeEyeDropper } from 'react-eyedropper-picker/loupe'
import photo from './pixel-art.png'

export default function PickerWithLoupe() {
  const image = useRef<HTMLImageElement>(null)
  const [color, setColor] = useState('#f59e0b')
  const dropper = useLoupeEyeDropper({ source: image })
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'start',
      }}
    >
      <ColorPicker
        theme="auto"
        value={color}
        onChange={setColor}
        eyeDropper={dropper}
        history
      />
      <img
        ref={image}
        src={photo}
        alt="Pixel art landscape"
        width={240}
        style={{ imageRendering: 'pixelated', borderRadius: 8 }}
      />
    </div>
  )
}
