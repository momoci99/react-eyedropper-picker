import { rgbToHex } from '../utils/color'
import { createLoupeRenderer } from './draw'
import type { Point } from './geometry'
import { formatMagnification } from './magnification'
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
}

export type LoupeView = {
  /** `position: fixed`. The caller adds it to the page. */
  element: HTMLDivElement
  /** Draws `pixel` with the loupe centered on the client point `anchor`. */
  render: (pixel: Point, anchor: Point, magnification: number) => void
  /** Shows `12.5×` next to the hex for a second. */
  showMagnification: (value: number) => void
  destroy: () => void
}

export const DEFAULT_LOUPE_SIZE = 120

/** How long the `12.5×` badge stays after the last zoom change. */
const ZOOM_BADGE_MS = 1000
const LABEL_GAP = 8

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

  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const renderer = createLoupeRenderer(ctx, buffer)

  const label = options.label ?? doc.createElement('div')
  const hexText = doc.createElement('span')
  const zoomText = doc.createElement('span')
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
      background: 'rgba(0, 0, 0, 0.75)',
      color: '#fff',
      font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
      whiteSpace: 'nowrap',
    })
    zoomText.hidden = true
    label.append(hexText, zoomText)
  }
  element.append(canvas, label)

  let lastHex = ''
  let badgeTimer: ReturnType<typeof setTimeout> | undefined

  return {
    element,
    render: (pixel, anchor, magnification) => {
      element.style.transform = `translate(${anchor.x - size / 2}px, ${anchor.y - size / 2}px)`
      renderer.draw(pixel, {
        size,
        magnification,
        devicePixelRatio: win.devicePixelRatio || 1,
        grid: options.grid,
        sampleSize,
      })
      const hex = pixelHex(buffer, pixel, sampleSize)
      if (hex !== lastHex) {
        lastHex = hex
        hexText.textContent = hex
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
