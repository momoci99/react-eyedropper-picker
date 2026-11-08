import { useState } from 'react'
import { ColorPicker } from 'react-eyedropper-picker'

export default function AlphaPicker() {
  const [color, setColor] = useState('#8b5cf680')
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <ColorPicker alpha theme="auto" value={color} onChange={setColor} />
      <code>{color}</code>
    </div>
  )
}
