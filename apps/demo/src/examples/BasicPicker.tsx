import { useState } from 'react'
import { ColorPicker } from 'react-eyedropper-picker'

export default function BasicPicker() {
  const [color, setColor] = useState('#3b82f6')
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <ColorPicker theme="auto" value={color} onChange={setColor} />
      <code>{color}</code>
    </div>
  )
}
