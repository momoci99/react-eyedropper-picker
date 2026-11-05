import { rgbToHex } from '../utils/color'
import { createLoupeRenderer } from './draw'
import {
  clampPixel,
  clientToSourcePixel,
  sourcePixelToClient,
  type DisplayRect,
  type Point,
} from './geometry'
import {
  clampMagnification,
  formatMagnification,
  keyMagnification,
  wheelDeltaToNotches,
  wheelMagnification,
  type MagnificationConfig,
} from './magnification'
import {
  samplePixel,
  type LoupeSource,
  type PixelBuffer,
  type SampleSize,
} from './pixels'

export type LoupeShape = 'circle' | 'square'

export type LoupePickResult = {
  sRGBHex: string
  /** Source pixel coordinates of the center pixel. */
  x: number
  y: number
  mode: 'loupe'
}

export type LoupeSessionOptions = {
  source: LoupeSource
  /** Pixels read from `source` with `readPixels`. */
  buffer: PixelBuffer
  config: MagnificationConfig
  /** Starting magnification. */
  magnification: number
  /**
   * Controlled: user zoom only calls `onMagnificationChange`; the shown
   * value changes when `setMagnification` is called.
   */
  controlled?: boolean
  onMagnificationChange?: (value: number) => void
  /** CSS px. */
  size: number
  shape: LoupeShape
  grid: boolean
  sampleSize: SampleSize
  className?: string
  signal?: AbortSignal
}

export type LoupeSession = {
  /** Resolves on confirm, rejects with `AbortError` on cancel. */
  result: Promise<LoupePickResult>
  setMagnification: (value: number) => void
  /** Closes the loupe; `result` rejects with `AbortError`. */
  cancel: () => void
}

/** How long the `12.5×` badge stays after the last zoom change. */
const ZOOM_BADGE_MS = 1000
const LABEL_GAP = 8

const ARROWS: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

const abortError = () => new DOMException('The loupe was closed.', 'AbortError')

/**
 * Opens the loupe over the page: a full-viewport overlay that blocks clicks
 * to the page, with the magnifier following the pointer over `source`.
 *
 * - Pointer: move to track, click on the source to confirm, click outside
 *   to cancel. Wheel zooms.
 * - Keys: arrows move 1px (Shift: 10px), Enter confirms, Escape cancels,
 *   `+` / `-` / `0` zoom.
 *
 * Plain DOM, no React: the hook calls this from `open()`. Pointer moves only
 * store coordinates; drawing happens in `requestAnimationFrame`.
 */
export const startLoupeSession = (
  options: LoupeSessionOptions
): LoupeSession => {
  const { source, buffer, config, size, sampleSize, signal } = options
  const { width: srcWidth, height: srcHeight } = buffer
  const doc = source.ownerDocument
  const win = doc.defaultView!

  let resolve!: (r: LoupePickResult) => void
  let reject!: (e: unknown) => void
  const result = new Promise<LoupePickResult>((res, rej) => {
    resolve = res
    reject = rej
  })

  let settled = false
  let magnification = clampMagnification(options.magnification, config)
  let wheelRemainder = 0
  let rect: DisplayRect = source.getBoundingClientRect()
  /** Source pixel under the loupe, or null when outside the source. */
  let pixel: Point | null = clampPixel(
    Math.floor(srcWidth / 2),
    Math.floor(srcHeight / 2),
    srcWidth,
    srcHeight
  )
  /** Client point the loupe is centered on. */
  let anchor = sourcePixelToClient(pixel.x, pixel.y, rect, srcWidth, srcHeight)
  let frame = 0
  let badgeTimer: ReturnType<typeof setTimeout> | undefined
  let lastHex = ''
  let lastCursor = ''
  /** True once the user aimed with a pointer move or a key. */
  let aimed = false

  // ── DOM ──
  const overlay = doc.createElement('div')
  overlay.tabIndex = -1
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', 'Color picker loupe')
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    outline: 'none',
    touchAction: 'none',
    userSelect: 'none',
  })

  const loupe = doc.createElement('div')
  if (options.className) loupe.className = options.className
  Object.assign(loupe.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${size}px`,
    pointerEvents: 'none',
    willChange: 'transform',
  })

  const canvas = doc.createElement('canvas')
  Object.assign(canvas.style, {
    display: 'block',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: options.shape === 'circle' ? '50%' : '0',
    boxShadow: '0 0 0 2px #fff, 0 2px 12px rgba(0, 0, 0, 0.35)',
    // Checkerboard behind transparent pixels and outside the source.
    background:
      'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 12px 12px',
  })

  const label = doc.createElement('div')
  label.setAttribute('aria-live', 'polite')
  Object.assign(label.style, {
    width: 'max-content',
    margin: `${LABEL_GAP}px auto 0`,
    padding: '2px 8px',
    borderRadius: '999px',
    background: 'rgba(0, 0, 0, 0.75)',
    color: '#fff',
    font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
    whiteSpace: 'nowrap',
  })
  const hexText = doc.createElement('span')
  const zoomText = doc.createElement('span')
  zoomText.hidden = true
  label.append(hexText, zoomText)
  loupe.append(canvas, label)
  overlay.append(loupe)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    reject(new DOMException('2D canvas is not available', 'NotSupportedError'))
    return { result, setMagnification: () => {}, cancel: () => {} }
  }
  const renderer = createLoupeRenderer(ctx, buffer)

  // ── Drawing ──
  const draw = () => {
    frame = 0
    const cursor = pixel ? 'none' : 'default'
    if (cursor !== lastCursor) {
      lastCursor = cursor
      overlay.style.cursor = cursor
      loupe.style.display = pixel ? 'block' : 'none'
    }
    if (!pixel) return

    loupe.style.transform = `translate(${anchor.x - size / 2}px, ${anchor.y - size / 2}px)`
    renderer.draw(pixel, {
      size,
      magnification,
      devicePixelRatio: win.devicePixelRatio || 1,
      grid: options.grid,
      sampleSize,
    })
    const hex = colorAt(pixel)
    if (hex !== lastHex) {
      lastHex = hex
      hexText.textContent = hex
    }
  }

  const schedule = () => {
    if (!frame && !settled) frame = win.requestAnimationFrame(draw)
  }

  const colorAt = (p: Point): string => {
    const c = samplePixel(buffer, p.x, p.y, sampleSize)
    return c ? rgbToHex(c) : '#000000'
  }

  // ── State changes ──
  const showMagnification = (value: number) => {
    magnification = value
    zoomText.textContent = ` · ${formatMagnification(value)}`
    zoomText.hidden = false
    clearTimeout(badgeTimer)
    badgeTimer = setTimeout(() => {
      zoomText.hidden = true
    }, ZOOM_BADGE_MS)
    schedule()
  }

  const zoomTo = (value: number) => {
    if (value === magnification) return
    options.onMagnificationChange?.(value)
    if (!options.controlled) showMagnification(value)
  }

  const moveTo = (p: Point) => {
    pixel = p
    aimed = true
    anchor = sourcePixelToClient(p.x, p.y, rect, srcWidth, srcHeight)
    schedule()
  }

  const pixelAt = (clientX: number, clientY: number) =>
    clientToSourcePixel(clientX, clientY, rect, srcWidth, srcHeight)

  // ── Closing ──
  const listeners = new AbortController()
  const previousFocus = doc.activeElement as HTMLElement | null

  const finish = () => {
    settled = true
    listeners.abort()
    if (frame) win.cancelAnimationFrame(frame)
    clearTimeout(badgeTimer)
    overlay.remove()
    previousFocus?.focus?.()
  }

  const confirm = (p: Point) => {
    if (settled) return
    finish()
    resolve({ sRGBHex: colorAt(p), x: p.x, y: p.y, mode: 'loupe' })
  }

  const cancel = () => {
    if (settled) return
    finish()
    reject(abortError())
  }

  // ── Events ──
  const on = { signal: listeners.signal }
  const passive = { signal: listeners.signal, passive: true }

  overlay.addEventListener(
    'pointermove',
    (e) => {
      anchor = { x: e.clientX, y: e.clientY }
      pixel = pixelAt(e.clientX, e.clientY)
      aimed = true
      schedule()
    },
    passive
  )

  overlay.addEventListener(
    'click',
    (e) => {
      const p = pixelAt(e.clientX, e.clientY)
      if (!p) return cancel()
      // Confirm what the loupe shows. The click point can land on the next
      // source pixel when the source is shown smaller than its size (click
      // and move coordinates round differently), and arrow keys may have
      // moved off the pointer. A tap with no move first uses its own point.
      confirm(aimed && pixel ? pixel : p)
    },
    on
  )

  // Not passive: preventDefault stops the page from scrolling.
  overlay.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const next = wheelMagnification(
        magnification,
        wheelDeltaToNotches(e.deltaY, e.deltaMode) + wheelRemainder,
        config
      )
      wheelRemainder = next.remainder
      zoomTo(next.magnification)
    },
    { signal: listeners.signal, passive: false }
  )

  doc.addEventListener(
    'keydown',
    (e) => {
      const arrow = ARROWS[e.key]
      if (arrow) {
        const step = e.shiftKey ? 10 : 1
        const base = pixel ?? {
          x: Math.floor(srcWidth / 2),
          y: Math.floor(srcHeight / 2),
        }
        moveTo(
          clampPixel(
            base.x + arrow.x * step,
            base.y + arrow.y * step,
            srcWidth,
            srcHeight
          )
        )
      } else if (e.key === 'Enter') {
        if (pixel) confirm(pixel)
      } else if (e.key === 'Escape') {
        cancel()
      } else if (e.key === 'Tab') {
        // Keep focus inside the overlay while it is open.
      } else {
        const next = keyMagnification(e.key, magnification, config)
        if (next === null) return
        zoomTo(next)
      }
      e.preventDefault()
      e.stopPropagation()
    },
    { signal: listeners.signal, capture: true }
  )

  const updateRect = () => {
    rect = source.getBoundingClientRect()
  }
  win.addEventListener('resize', updateRect, passive)
  win.addEventListener('scroll', updateRect, { ...passive, capture: true })

  if (signal) {
    if (signal.aborted) {
      cancel()
      return { result, setMagnification: () => {}, cancel }
    }
    signal.addEventListener('abort', cancel, on)
  }

  doc.body.append(overlay)
  overlay.focus({ preventScroll: true })
  schedule()

  return {
    result,
    setMagnification: (value) => {
      if (settled) return
      const next = clampMagnification(value, config)
      if (next !== magnification) showMagnification(next)
    },
    cancel,
  }
}
