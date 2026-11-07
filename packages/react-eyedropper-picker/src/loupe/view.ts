import { rgbToHex } from '../utils/color'
import { createLoupeRenderer } from './draw'
import type { Point } from './geometry'
import { formatMagnification } from './magnification'
import {
  FRAME_MS,
  followFactor,
  followMagnification,
  followPoint,
  reducedMotionQuery,
  smoothingTimeConstant,
  ZOOM_TIME_CONSTANT,
} from './motion'
import { samplePixel, type PixelBuffer, type SampleSize } from './pixels'

export type LoupeShape = 'circle' | 'square'

export type LoupeViewOptions = {
  /** CSS px. */
  size: number
  shape: LoupeShape
  grid: boolean
  sampleSize: SampleSize
  className?: string
  /**
   * Shown under the loupe instead of the hex label. The caller fills it,
   * e.g. with a React portal.
   */
  label?: HTMLElement
  /** Announce the hex label to screen readers. */
  live: boolean
  /** 0 to 1: how much the loupe glides after the pointer. Default 0. */
  smoothing?: number
  /** Grow in, shrink out and animated zoom. Default true. */
  animate?: boolean
}

export type LoupeView = {
  /** `position: fixed`. The caller adds it to the page. */
  element: HTMLDivElement
  /**
   * Draws `pixel` with the loupe heading for the client point `anchor`.
   * The pixel is exact; only the loupe's position and zoom glide. Returns
   * true while still moving: call again next frame.
   */
  render: (pixel: Point, anchor: Point, magnification: number) => boolean
  /** Adds the element to `parent` and plays the grow-in. */
  mount: (parent: Node) => void
  /** Grow-in for an element the caller added. The next render snaps. */
  appear: () => void
  /** Plays the shrink-out, then removes the element. */
  unmount: () => void
  /** Shows `12.5×` next to the hex for a second. */
  showMagnification: (value: number) => void
  destroy: () => void
}

export const DEFAULT_LOUPE_SIZE = 120

/** How long the `12.5×` badge stays after the last zoom change. */
const ZOOM_BADGE_MS = 1000
const LABEL_GAP = 8

const ENTER: Keyframe[] = [
  { transform: 'scale(0.6)', opacity: 0 },
  { transform: 'scale(1)', opacity: 1 },
]
// A little overshoot: the loupe pops in.
const ENTER_TIMING = { duration: 160, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)' }
const EXIT: Keyframe[] = [
  { transform: 'scale(1)', opacity: 1 },
  { transform: 'scale(0.7)', opacity: 0 },
]
const EXIT_TIMING = {
  duration: 110,
  easing: 'ease-in',
  fill: 'forwards',
} as const

/** Hex of the `sampleSize` block at `p`. */
export const pixelHex = (
  buffer: PixelBuffer,
  p: Point,
  sampleSize: SampleSize
): string => {
  const c = samplePixel(buffer, p.x, p.y, sampleSize)
  return c ? rgbToHex(c) : '#000000'
}

/**
 * The magnifier element: canvas plus a label under it. Plain DOM.
 * Returns null when the browser has no 2D canvas.
 */
export const createLoupeView = (
  doc: Document,
  buffer: PixelBuffer,
  options: LoupeViewOptions
): LoupeView | null => {
  const { size, sampleSize } = options
  const win = doc.defaultView!
  const animate = options.animate !== false
  const glide = smoothingTimeConstant(options.smoothing)
  const reducedMotion = reducedMotionQuery(win)

  const element = doc.createElement('div')
  if (options.className) element.className = options.className
  Object.assign(element.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    zIndex: '2147483647',
    width: `${size}px`,
    pointerEvents: 'none',
    willChange: 'transform',
  })
  // Scaled by the grow-in / shrink-out; `element` only moves.
  const inner = doc.createElement('div')
  inner.style.transformOrigin = `${size / 2}px ${size / 2}px`
  element.append(inner)

  const canvas = doc.createElement('canvas')
  Object.assign(canvas.style, {
    display: 'block',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: options.shape === 'circle' ? '50%' : '0',
    boxShadow:
      '0 0 0 2px var(--rep-loupe-ring, #fff), 0 2px 12px var(--rep-loupe-shadow, rgba(0, 0, 0, 0.35))',
    // Checkerboard behind transparent pixels and outside the source.
    background:
      'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 12px 12px',
  })

  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const renderer = createLoupeRenderer(ctx, buffer)

  const label = options.label ?? doc.createElement('div')
  const hexText = doc.createElement('span')
  const zoomText = doc.createElement('span')
  /** Dot of the current color; fades between colors. */
  const swatch = doc.createElement('span')
  if (options.label) {
    Object.assign(label.style, {
      width: 'max-content',
      margin: `${LABEL_GAP}px auto 0`,
    })
  } else {
    if (options.live) label.setAttribute('aria-live', 'polite')
    Object.assign(label.style, {
      width: 'max-content',
      margin: `${LABEL_GAP}px auto 0`,
      padding: '2px 8px',
      borderRadius: '999px',
      background: 'var(--rep-label-bg, rgba(0, 0, 0, 0.75))',
      color: 'var(--rep-label-fg, #fff)',
      font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
      whiteSpace: 'nowrap',
    })
    zoomText.hidden = true
    swatch.setAttribute('aria-hidden', 'true')
    Object.assign(swatch.style, {
      display: 'inline-block',
      width: '10px',
      height: '10px',
      marginRight: '6px',
      verticalAlign: '-1px',
      borderRadius: '50%',
      boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.6)',
    })
    label.append(swatch, hexText, zoomText)
  }
  inner.append(canvas, label)

  let lastHex = ''
  let badgeTimer: ReturnType<typeof setTimeout> | undefined
  /** Where the loupe is drawn now; null snaps on the next render. */
  let shown: Point | null = null
  let shownMagnification = 0
  /** Time of the last render while moving; 0 at rest. */
  let lastFrame = 0
  /** What the canvas shows, to skip redraws while only gliding. */
  let drawnX = NaN
  let drawnY = NaN
  let drawnMagnification = NaN
  let drawnRatio = NaN
  let exit: Animation | null = null

  /** Animations run: on, supported, and no reduced motion. */
  const animates = () =>
    animate && typeof inner.animate === 'function' && !reducedMotion()

  const appear = () => {
    exit?.cancel()
    exit = null
    shown = null
    shownMagnification = 0
    lastFrame = 0
    if (animates()) inner.animate(ENTER, ENTER_TIMING)
  }

  return {
    element,
    render: (pixel, anchor, magnification) => {
      const now = win.performance.now()
      const dt = lastFrame ? now - lastFrame : FRAME_MS
      const still = reducedMotion()
      shown = shown
        ? followPoint(shown, anchor, still ? 1 : followFactor(dt, glide))
        : anchor
      shownMagnification = shownMagnification
        ? followMagnification(
            shownMagnification,
            magnification,
            still || !animate ? 1 : followFactor(dt, ZOOM_TIME_CONSTANT)
          )
        : magnification
      const moving = shown !== anchor || shownMagnification !== magnification
      lastFrame = moving ? now : 0

      element.style.transform = `translate(${shown.x - size / 2}px, ${shown.y - size / 2}px)`
      const ratio = win.devicePixelRatio || 1
      if (
        pixel.x !== drawnX ||
        pixel.y !== drawnY ||
        shownMagnification !== drawnMagnification ||
        ratio !== drawnRatio
      ) {
        drawnX = pixel.x
        drawnY = pixel.y
        drawnMagnification = shownMagnification
        drawnRatio = ratio
        renderer.draw(pixel, {
          size,
          magnification: shownMagnification,
          devicePixelRatio: ratio,
          grid: options.grid,
          sampleSize,
        })
        const hex = pixelHex(buffer, pixel, sampleSize)
        if (hex !== lastHex) {
          // Fade between colors, but not into the first one.
          swatch.style.transition =
            lastHex && animate && !reducedMotion()
              ? 'background-color 120ms ease-out'
              : 'none'
          lastHex = hex
          hexText.textContent = hex
          swatch.style.backgroundColor = hex
        }
      }
      return moving
    },
    mount: (parent) => {
      if (element.parentNode !== parent) parent.appendChild(element)
      appear()
    },
    appear,
    unmount: () => {
      if (!element.isConnected || exit) return
      if (!animates() || element.style.display === 'none') {
        element.remove()
        return
      }
      const a = inner.animate(EXIT, EXIT_TIMING)
      exit = a
      a.onfinish = () => {
        if (exit !== a) return
        exit = null
        element.remove()
        a.cancel()
      }
    },
    showMagnification: (value) => {
      zoomText.textContent = ` · ${formatMagnification(value)}`
      zoomText.hidden = false
      clearTimeout(badgeTimer)
      badgeTimer = setTimeout(() => {
        zoomText.hidden = true
      }, ZOOM_BADGE_MS)
    },
    destroy: () => clearTimeout(badgeTimer),
  }
}
