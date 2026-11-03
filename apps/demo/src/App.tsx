import { useState } from 'react'
import { ColorPicker, useEyeDropper } from 'react-eyedropper-picker'

const swatches = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

export const App = () => {
  const [color, setColor] = useState('#3b82f6')
  const { isSupported } = useEyeDropper()

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui, sans-serif',
        background: '#f4f4f5',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>react-eyedropper-picker</h1>
        <ColorPicker value={color} onChange={setColor} />
        <div style={{ display: 'flex', gap: 8 }}>
          {swatches.map((s) => (
            <div key={s} style={{ width: 40, height: 40, borderRadius: 8, background: s }} />
          ))}
        </div>
        <p style={{ margin: 0 }}>
          Selected: <code>{color}</code>
        </p>
        <p style={{ margin: 0, color: '#71717a', fontSize: 13 }}>
          EyeDropper API: {isSupported ? 'supported ✅' : 'not supported (Chromium only)'}
        </p>
      </div>
    </main>
  )
}
