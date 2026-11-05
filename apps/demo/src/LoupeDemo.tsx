import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import {
  useLoupeEyeDropper,
  type LoupeShape,
  type PickResult,
  type PickSource,
  type SampleSize,
} from 'react-eyedropper-picker/loupe'
import { drawColorField, drawPixelArt } from './samples'

type SampleId = 'pixel' | 'field' | 'upload'

const SAMPLES: { id: SampleId; label: string }[] = [
  { id: 'pixel', label: 'Pixel art' },
  { id: 'field', label: 'Color field' },
  { id: 'upload', label: 'Your image' },
]

const STEPS = [2, 4, 8, 16, 32, 64]
const SIZES = [80, 120, 160, 200]
const SAMPLE_SIZES: SampleSize[] = [1, 3, 5]
const SHAPES: LoupeShape[] = ['circle', 'square']
const MAX_MAGNIFICATION = 64
const HISTORY_LIMIT = 10

// The slider is logarithmic: equal moves feel like equal zoom steps.
const SLIDER_MAX = 1000
const toSlider = (m: number) =>
  Math.round((Math.log(m) / Math.log(MAX_MAGNIFICATION)) * SLIDER_MAX)
const fromSlider = (t: number) =>
  Math.round(MAX_MAGNIFICATION ** (t / SLIDER_MAX) * 10) / 10
const formatZoom = (m: number) => `${Math.round(m * 10) / 10}×`

const isAbort = (e: unknown) =>
  e instanceof DOMException && e.name === 'AbortError'

type Props = { onPick: (hex: string) => void }

export const LoupeDemo = ({ onPick }: Props) => {
  const [sample, setSample] = useState<SampleId>('pixel')
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const [magnification, setMagnification] = useState(8)
  const [useSteps, setUseSteps] = useState(false)
  const [sampleSize, setSampleSize] = useState<SampleSize>(1)
  const [shape, setShape] = useState<LoupeShape>('circle')
  const [size, setSize] = useState(120)
  const [grid, setGrid] = useState(true)
  const [history, setHistory] = useState<PickResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const sourceRef = useRef<PickSource | null>(null)
  const attachPixelArt = useCallback((el: HTMLCanvasElement | null) => {
    sourceRef.current = el
    if (el) drawPixelArt(el)
  }, [])
  const attachColorField = useCallback((el: HTMLCanvasElement | null) => {
    sourceRef.current = el
    if (el) drawColorField(el)
  }, [])
  const attachImage = useCallback((el: HTMLImageElement | null) => {
    sourceRef.current = el
  }, [])

  const { open, isOpen } = useLoupeEyeDropper({
    source: sourceRef,
    loupe: {
      magnification,
      onMagnificationChange: setMagnification,
      maxMagnification: MAX_MAGNIFICATION,
      magnificationSteps: useSteps ? STEPS : undefined,
      sampleSize,
      shape,
      size,
      grid,
    },
  })

  const pick = async () => {
    if (!sourceRef.current) return
    setError(null)
    try {
      const result = await open()
      setHistory((h) =>
        [result, ...h.filter((r) => r.sRGBHex !== result.sRGBHex)].slice(
          0,
          HISTORY_LIMIT
        )
      )
      onPick(result.sRGBHex)
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : String(e))
    }
  }

  const loadFile = (file: File | undefined) => {
    if (!file?.type.startsWith('image/')) return
    if (uploadUrl) URL.revokeObjectURL(uploadUrl)
    setUploadUrl(URL.createObjectURL(file))
    setSample('upload')
  }

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    loadFile(e.target.files?.[0])
    e.target.value = ''
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    loadFile(e.dataTransfer.files[0])
  }

  const latest = history[0]

  return (
    <section className="card loupe-demo" aria-labelledby="loupe-title">
      <header className="card-header">
        <h2 id="loupe-title">Loupe</h2>
        <p className="muted">
          Pixel-accurate eye dropper for images and canvases. Works in every
          browser.
        </p>
      </header>

      <div className="loupe-layout">
        <div className="stage-column">
          <div className="segmented" role="radiogroup" aria-label="Sample">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={sample === s.id}
                disabled={s.id === 'upload' && !uploadUrl}
                onClick={() => setSample(s.id)}
              >
                {s.label}
              </button>
            ))}
            <label className="upload-button">
              Upload…
              <input type="file" accept="image/*" onChange={onFileChange} />
            </label>
          </div>

          <div
            className="stage"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={pick}
            title="Click to pick a color"
          >
            {sample === 'pixel' && (
              <canvas
                key="pixel"
                ref={attachPixelArt}
                className="source pixelated"
              />
            )}
            {sample === 'field' && (
              <canvas key="field" ref={attachColorField} className="source" />
            )}
            {sample === 'upload' && uploadUrl && (
              <img
                key={uploadUrl}
                ref={attachImage}
                src={uploadUrl}
                alt="Uploaded"
                className="source"
              />
            )}
          </div>
          <p className="muted small">
            Drop an image on the stage to use it. Images stay in your browser.
          </p>
        </div>

        <div className="controls-column">
          <button
            type="button"
            className="primary"
            onClick={pick}
            aria-busy={isOpen}
          >
            {isOpen ? 'Picking…' : 'Pick from image'}
          </button>

          <div className="result" aria-live="polite">
            <div
              className="result-swatch"
              style={{ background: latest?.sRGBHex ?? 'transparent' }}
            />
            <div>
              <div className="result-hex">{latest?.sRGBHex ?? '—'}</div>
              <div className="muted small">
                {latest ? `x ${latest.x}, y ${latest.y}` : 'Nothing picked yet'}
              </div>
            </div>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <fieldset>
            <legend>
              Magnification <output>{formatZoom(magnification)}</output>
            </legend>
            <input
              type="range"
              min={0}
              max={SLIDER_MAX}
              value={toSlider(magnification)}
              onChange={(e) =>
                setMagnification(
                  Math.max(1, fromSlider(Number(e.target.value)))
                )
              }
              aria-label="Magnification"
              aria-valuetext={formatZoom(magnification)}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={useSteps}
                onChange={(e) => setUseSteps(e.target.checked)}
              />
              Snap wheel and keys to {STEPS.join(' / ')}
            </label>
          </fieldset>

          <fieldset>
            <legend>Sample size</legend>
            <div
              className="segmented"
              role="radiogroup"
              aria-label="Sample size"
            >
              {SAMPLE_SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={sampleSize === n}
                  onClick={() => setSampleSize(n)}
                >
                  {n}×{n}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Loupe</legend>
            <div className="segmented" role="radiogroup" aria-label="Shape">
              {SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={shape === s}
                  onClick={() => setShape(s)}
                >
                  {s === 'circle' ? 'Circle' : 'Square'}
                </button>
              ))}
            </div>
            <div className="segmented" role="radiogroup" aria-label="Size">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={size === s}
                  onClick={() => setSize(s)}
                >
                  {s}px
                </button>
              ))}
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={grid}
                onChange={(e) => setGrid(e.target.checked)}
              />
              Pixel grid (hidden below 4× automatically)
            </label>
          </fieldset>

          {history.length > 0 && (
            <fieldset>
              <legend>History</legend>
              <div className="history">
                {history.map((r) => (
                  <button
                    key={r.sRGBHex}
                    type="button"
                    className="history-swatch"
                    style={{ background: r.sRGBHex }}
                    onClick={() => onPick(r.sRGBHex)}
                    aria-label={`Use ${r.sRGBHex}`}
                    title={r.sRGBHex}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <details className="keys">
            <summary>Controls</summary>
            <dl>
              <dt>Move / click</dt>
              <dd>Aim / pick</dd>
              <dt>Wheel</dt>
              <dd>Zoom</dd>
              <dt>Drag / lift</dt>
              <dd>Aim / pick (touch)</dd>
              <dt>Pinch</dt>
              <dd>Zoom (touch)</dd>
              <dt>
                <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd>
              </dt>
              <dd>1px (Shift: 10px)</dd>
              <dt>
                <kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd>
              </dt>
              <dd>Zoom in / out / reset</dd>
              <dt>
                <kbd>Enter</kbd> <kbd>Esc</kbd>
              </dt>
              <dd>Pick / cancel</dd>
            </dl>
          </details>
        </div>
      </div>
    </section>
  )
}
