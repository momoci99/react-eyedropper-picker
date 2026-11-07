import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import type { UseColorHistoryResult } from 'react-eyedropper-picker'
import {
  ImageColorPicker,
  useLoupeEyeDropper,
  type LoupePickResult,
  type LoupeShape,
  type LoupeSoundEvent,
  type PickResult,
  type SampleSize,
} from 'react-eyedropper-picker/loupe'
import { drawColorField, drawPixelArt, toDataUrl } from './samples'

type SampleId = 'pixel' | 'field' | 'upload'
type Mode = 'hover' | 'open'

const MODES: { id: Mode; label: string }[] = [
  { id: 'hover', label: 'Hover · ImageColorPicker' },
  { id: 'open', label: 'Click to open · useLoupeEyeDropper' },
]

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

/** Demo sound switches, each mapped to `sound.events`. */
const SOUND_GROUPS = [
  { id: 'pixel', label: 'Pixel ticks', events: ['pixel'] },
  { id: 'zoom', label: 'Zoom ticks', events: ['zoom'] },
  {
    id: 'ui',
    label: 'Open, confirm, cancel',
    events: ['open', 'confirm', 'cancel'],
  },
] as const satisfies readonly {
  id: string
  label: string
  events: readonly LoupeSoundEvent[]
}[]
type SoundGroup = (typeof SOUND_GROUPS)[number]['id']

// The slider is logarithmic: equal moves feel like equal zoom steps.
const SLIDER_MAX = 1000
const toSlider = (m: number) =>
  Math.round((Math.log(m) / Math.log(MAX_MAGNIFICATION)) * SLIDER_MAX)
const fromSlider = (t: number) =>
  Math.round(MAX_MAGNIFICATION ** (t / SLIDER_MAX) * 10) / 10
const formatZoom = (m: number) => `${Math.round(m * 10) / 10}×`

const isAbort = (e: unknown) =>
  e instanceof DOMException && e.name === 'AbortError'

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

const customLabel = (c: LoupePickResult) => (
  <span className="loupe-label">
    <span className="loupe-label-swatch" style={{ background: c.sRGBHex }} />
    {c.sRGBHex}
    <span className="loupe-label-xy">
      {c.x}, {c.y}
    </span>
  </span>
)

const sampleClass = (id: SampleId) =>
  id === 'pixel' ? 'source pixelated' : 'source'

type Props = {
  onPick: (hex: string) => void
  /** Shared with the color picker below. */
  history: UseColorHistoryResult
}

export const LoupeDemo = ({ onPick, history }: Props) => {
  // Client-only demo: drawing in the initializer is fine.
  const [samples] = useState(() => ({
    pixel: toDataUrl(drawPixelArt),
    field: toDataUrl(drawColorField),
  }))
  const [mode, setMode] = useState<Mode>('hover')
  const [sample, setSample] = useState<SampleId>('pixel')
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const [magnification, setMagnification] = useState(8)
  const [useSteps, setUseSteps] = useState(false)
  const [sampleSize, setSampleSize] = useState<SampleSize>(1)
  const [shape, setShape] = useState<LoupeShape>('circle')
  const [size, setSize] = useState(120)
  const [grid, setGrid] = useState(true)
  const [fancyLabel, setFancyLabel] = useState(false)
  // The library default is off; the demo shows the effects on.
  const [sound, setSound] = useState(true)
  const [volume, setVolume] = useState(0.5)
  const [soundGroups, setSoundGroups] = useState<Record<SoundGroup, boolean>>({
    pixel: true,
    zoom: true,
    ui: true,
  })
  const [haptics, setHaptics] = useState(true)
  // Library default is 0 (no glide); the demo shows a little.
  const [smoothing, setSmoothing] = useState(0.4)
  const [animate, setAnimate] = useState(true)
  const [latest, setLatest] = useState<PickResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const imageRef = useRef<HTMLImageElement | null>(null)

  const loupe = {
    magnification,
    onMagnificationChange: setMagnification,
    maxMagnification: MAX_MAGNIFICATION,
    magnificationSteps: useSteps ? STEPS : undefined,
    sampleSize,
    shape,
    size,
    grid,
    sound: sound && {
      volume,
      events: Object.fromEntries(
        SOUND_GROUPS.flatMap((g) => g.events.map((e) => [e, soundGroups[g.id]]))
      ),
    },
    haptics,
    smoothing,
    animate,
  }
  const { open, isOpen } = useLoupeEyeDropper({ source: imageRef, loupe })

  const record = (result: PickResult) => {
    setError(null)
    setLatest(result)
    history.add(result.sRGBHex)
    onPick(result.sRGBHex)
  }

  const pick = async () => {
    if (!imageRef.current) return
    setError(null)
    try {
      record(await open())
    } catch (e) {
      if (!isAbort(e)) setError(errorText(e))
    }
  }

  const src = sample === 'upload' ? uploadUrl : samples[sample]

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
          <div className="segmented" role="radiogroup" aria-label="Mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
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
            onClick={mode === 'open' ? pick : undefined}
            title={mode === 'open' ? 'Click to pick a color' : undefined}
          >
            {src &&
              (mode === 'hover' ? (
                <ImageColorPicker
                  key={src}
                  src={src}
                  alt={SAMPLES.find((s) => s.id === sample)!.label}
                  className={sampleClass(sample)}
                  onPick={record}
                  onPickError={(e) => setError(errorText(e))}
                  loupe={{
                    ...loupe,
                    renderLabel: fancyLabel ? customLabel : undefined,
                  }}
                />
              ) : (
                <img
                  key={src}
                  ref={imageRef}
                  src={src}
                  alt={SAMPLES.find((s) => s.id === sample)!.label}
                  className={sampleClass(sample)}
                  draggable={false}
                />
              ))}
          </div>
          <p className="muted small">
            Drop an image on the stage to use it. Images stay in your browser.
          </p>
        </div>

        <div className="controls-column">
          {mode === 'open' ? (
            <button
              type="button"
              className="primary"
              onClick={pick}
              aria-busy={isOpen}
            >
              {isOpen ? 'Picking…' : 'Pick from image'}
            </button>
          ) : (
            <p className="hint">
              Hover the image and click. On touch, press and drag, then lift.
            </p>
          )}

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
            <label className="check">
              <input
                type="checkbox"
                checked={fancyLabel}
                disabled={mode !== 'hover'}
                onChange={(e) => setFancyLabel(e.target.checked)}
              />
              <span>
                Custom label (<code>renderLabel</code>, hover mode)
              </span>
            </label>
          </fieldset>

          <fieldset>
            <legend>
              Motion{' '}
              <output>{smoothing ? `glide ${smoothing}` : 'no glide'}</output>
            </legend>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={smoothing}
              onChange={(e) => setSmoothing(Number(e.target.value))}
              aria-label="Smoothing"
              aria-valuetext={String(smoothing)}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={animate}
                onChange={(e) => setAnimate(e.target.checked)}
              />
              <span>
                Grow in, shrink out, animated zoom (<code>animate</code>)
              </span>
            </label>
            <p className="muted small">
              Both are off when your system asks for reduced motion.
            </p>
          </fieldset>

          <fieldset>
            <legend>
              Sound{' '}
              <output>{sound ? `${Math.round(volume * 100)}%` : 'off'}</output>
            </legend>
            <label className="check">
              <input
                type="checkbox"
                checked={sound}
                onChange={(e) => setSound(e.target.checked)}
              />
              <span>
                Sound on (<code>sound</code>)
              </span>
            </label>
            {SOUND_GROUPS.map((g) => (
              <label key={g.id} className="check sub">
                <input
                  type="checkbox"
                  checked={soundGroups[g.id]}
                  disabled={!sound}
                  onChange={(e) =>
                    setSoundGroups((prev) => ({
                      ...prev,
                      [g.id]: e.target.checked,
                    }))
                  }
                />
                <span>
                  {g.label} (<code>{g.events.join(' / ')}</code>)
                </span>
              </label>
            ))}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              disabled={!sound}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              aria-valuetext={`${Math.round(volume * 100)}%`}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={haptics}
                onChange={(e) => setHaptics(e.target.checked)}
              />
              <span>
                Vibrate on ticks and confirm (<code>haptics</code>, Android)
              </span>
            </label>
          </fieldset>

          {history.colors.length > 0 && (
            <fieldset>
              <legend>
                History (<code>useColorHistory</code>)
              </legend>
              <div className="history">
                {history.colors.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className="history-swatch"
                    style={{ background: hex }}
                    onClick={() => onPick(hex)}
                    aria-label={`Use ${hex}`}
                    title={hex}
                  />
                ))}
                <button
                  type="button"
                  className="history-clear"
                  onClick={history.clear}
                >
                  Clear
                </button>
              </div>
            </fieldset>
          )}

          <details className="keys">
            <summary>Controls</summary>
            <dl>
              {mode === 'hover' ? (
                <>
                  <dt>Hover / click</dt>
                  <dd>Aim / pick, again and again</dd>
                  <dt>Wheel</dt>
                  <dd>Zoom (over the image only)</dd>
                  <dt>Drag / lift</dt>
                  <dd>Aim / pick (touch)</dd>
                  <dt>Pinch</dt>
                  <dd>Zoom (touch, both fingers on the image)</dd>
                  <dt>
                    <kbd>Tab</kbd> <kbd>Enter</kbd>
                  </dt>
                  <dd>Focus the image, open the keyboard loupe</dd>
                </>
              ) : (
                <>
                  <dt>Move / click</dt>
                  <dd>Aim / pick</dd>
                  <dt>Wheel</dt>
                  <dd>Zoom</dd>
                  <dt>Drag / lift</dt>
                  <dd>Aim / pick (touch)</dd>
                  <dt>Pinch</dt>
                  <dd>Zoom (touch)</dd>
                </>
              )}
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
