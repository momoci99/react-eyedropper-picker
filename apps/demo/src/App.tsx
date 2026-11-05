import { useState } from 'react'
import { ColorPicker, useEyeDropper } from 'react-eyedropper-picker'
import { LoupeDemo } from './LoupeDemo'

export const App = () => {
  const [color, setColor] = useState('#6366f1')
  const { isSupported } = useEyeDropper()

  return (
    <main className="page">
      <header className="page-header">
        <h1>react-eyedropper-picker</h1>
        <p className="muted">
          React color picker. Native EyeDropper where the browser has it, a
          pixel-accurate loupe for images everywhere.
        </p>
      </header>

      <LoupeDemo onPick={setColor} />

      <section className="card picker-demo" aria-labelledby="picker-title">
        <header className="card-header">
          <h2 id="picker-title">Color picker</h2>
          <p className="muted">Colors picked with the loupe land here too.</p>
        </header>
        <div className="picker-row">
          <ColorPicker value={color} onChange={setColor} />
          <div className="picker-info">
            <div
              className="result-swatch large"
              style={{ background: color }}
            />
            <code className="result-hex">{color}</code>
            <p className="muted small">
              Native EyeDropper:{' '}
              {isSupported
                ? 'supported — the button picks from anywhere on screen'
                : 'not available (Chromium only)'}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
