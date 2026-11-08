// What the README GIF shows. record.mjs opens this page and drives the mouse.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ColorPicker, useColorHistory } from 'react-eyedropper-picker'
import { ImageColorPicker } from 'react-eyedropper-picker/loupe'
import photo from '../../src/examples/pixel-art.png'

const Scene = () => {
  const [color, setColor] = useState('#6366f1')
  const history = useColorHistory()
  return (
    // Top-aligned with a fixed height, so picks don't move the card.
    <div
      style={{
        display: 'flex',
        gap: 40,
        alignItems: 'flex-start',
        height: 290,
      }}
    >
      <ImageColorPicker
        src={photo}
        alt="Pixel art landscape"
        width={432}
        style={{
          imageRendering: 'pixelated',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,.15)',
        }}
        loupe={{ smoothing: 0.25, size: 130 }}
        onPick={({ sRGBHex }) => {
          setColor(sRGBHex)
          history.add(sRGBHex)
        }}
      />
      <ColorPicker value={color} onChange={setColor} history={history} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Scene />
  </StrictMode>
)
