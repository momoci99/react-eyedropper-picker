import { useRef, useState } from 'react'
import {
  ColorPicker,
  useColorHistory,
  useEyeDropper,
  type ColorPickerTheme,
} from 'react-eyedropper-picker'
import { useLoupeEyeDropper } from 'react-eyedropper-picker/loupe'
import { LoupeDemo } from './LoupeDemo'
import { drawPixelArt, toDataUrl } from './samples'

type Dropper = 'loupe' | 'native'

/** Shows transparency in the result swatch. */
const checkered = (color: string) =>
  `linear-gradient(${color}, ${color}), repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 12px 12px`

const THEMES: { id: ColorPickerTheme; label: string }[] = [
  { id: 'auto', label: 'Auto (OS)' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

export const App = () => {
  const [color, setColor] = useState('#6366f1')
  const [dropper, setDropper] = useState<Dropper>('loupe')
  const [theme, setTheme] = useState<ColorPickerTheme>('auto')
  const [alpha, setAlpha] = useState(false)
  // Client-only demo: drawing in the initializer is fine.
  const [photo] = useState(() => toDataUrl(drawPixelArt))
  const photoRef = useRef<HTMLImageElement>(null)
  const { isSupported: nativeSupported } = useEyeDropper()
  // One history for the loupe card and the picker, kept across reloads.
  const history = useColorHistory({ storageKey: 'rep-demo-history' })
  const loupe = useLoupeEyeDropper({
    source: photoRef,
    loupe: { sound: true, haptics: true },
  })

  return (
    <main className="page">
      <header className="page-header">
        <h1>react-eyedropper-picker</h1>
        <p className="muted">
          React color picker. Native EyeDropper where the browser has it, a
          pixel-accurate loupe for images everywhere.
        </p>
        <nav className="page-links" aria-label="Project">
          <a href="https://github.com/momoci99/react-eyedropper-picker">
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/react-eyedropper-picker">
            npm
          </a>
          <code>npm install react-eyedropper-picker</code>
        </nav>
      </header>

      <LoupeDemo onPick={setColor} history={history} />

      <section className="card picker-demo" aria-labelledby="picker-title">
        <header className="card-header">
          <h2 id="picker-title">Color picker</h2>
          <p className="muted">
            Colors picked with the loupe land here too. The eye dropper button
            takes any <code>eyeDropper</code>. Picks show up under the input (
            <code>history</code>) and stay after a reload.
          </p>
        </header>
        <div className="segmented" role="radiogroup" aria-label="Eye dropper">
          <button
            type="button"
            role="radio"
            aria-checked={dropper === 'loupe'}
            onClick={() => setDropper('loupe')}
          >
            Loupe · this image
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={dropper === 'native'}
            disabled={!nativeSupported}
            onClick={() => setDropper('native')}
          >
            Native · whole screen{nativeSupported ? '' : ' (Chromium only)'}
          </button>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              onClick={() => setTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={alpha}
            onChange={(e) => {
              setAlpha(e.target.checked)
              // Back to #rrggbb when alpha goes off.
              if (!e.target.checked) setColor((c) => c.slice(0, 7))
            }}
          />
          Opacity <code>alpha</code>
        </label>
        <div className="picker-row">
          <ColorPicker
            theme={theme}
            alpha={alpha}
            value={color}
            onChange={setColor}
            history={history}
            eyeDropper={dropper === 'loupe' ? loupe : undefined}
          />
          <div className="picker-info">
            <div className="result">
              <div
                className="result-swatch large"
                style={{ background: checkered(color) }}
              />
              <code className="result-hex">{color}</code>
            </div>
            {dropper === 'loupe' ? (
              <>
                <img
                  ref={photoRef}
                  src={photo}
                  alt="Pixel art landscape"
                  className="picker-photo pixelated"
                />
                <p className="muted small">
                  <code>{'eyeDropper={useLoupeEyeDropper({ source })}'}</code>:
                  the button opens a loupe on this image, in every browser.
                </p>
              </>
            ) : (
              <p className="muted small">
                Default: the native EyeDropper picks from anywhere on screen.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
