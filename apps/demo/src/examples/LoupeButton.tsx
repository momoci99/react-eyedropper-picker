import { useRef, useState } from 'react'
import { useLoupeEyeDropper } from 'react-eyedropper-picker/loupe'
import photo from './pixel-art.png'

export default function LoupeButton() {
  const image = useRef<HTMLImageElement>(null)
  const [color, setColor] = useState('')
  const { open, isOpen } = useLoupeEyeDropper({ source: image })

  const pick = async () => {
    try {
      const { sRGBHex } = await open()
      setColor(sRGBHex)
    } catch {
      // Cancelled: Escape, a click outside the image, or close().
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <img
        ref={image}
        src={photo}
        alt="Pixel art landscape"
        width={288}
        style={{ imageRendering: 'pixelated', borderRadius: 8 }}
      />
      <button type="button" onClick={pick} aria-busy={isOpen}>
        Pick a color
      </button>
      <code>{color || 'No color yet'}</code>
    </div>
  )
}
