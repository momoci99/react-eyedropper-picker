import {
  clientToSourcePixel,
  touchLoupeCenter,
  type DisplayRect,
  type Point,
} from './geometry'
import {
  clampMagnification,
  pinchMagnification,
  wheelDeltaToNotches,
  wheelMagnification,
  type MagnificationConfig,
} from './magnification'
import type { LoupeSource, PixelBuffer, SampleSize } from './pixels'
import { TOUCH_GAP, type LoupePickResult } from './session'
import { createTouchTracker } from './touch'
import {
  createLoupeView,
  pixelHex,
  type LoupeShape,
  type LoupeView,
} from './view'

export type LoupeHoverOptions = {
  source: LoupeSource
  /**
   * Pixels of `source`, read on first use. Return null while the source
   * has no pixels yet (image loading); throwing reports to `onError`.
   */
  getBuffer: () => PixelBuffer | null
  config: MagnificationConfig
  magnification: number
  /** See `LoupeSessionOptions.controlled`. */
  controlled?: boolean
  onMagnificationChange?: (value: number) => void
  size: number
  shape: LoupeShape
  grid: boolean
  sampleSize: SampleSize
  className?: string
  /** Replaces the hex label; the caller fills it. */
  label?: HTMLElement
  /** Called once per frame when the pixel under the loupe changes. */
  onAim?: (result: LoupePickResult) => void
  onPick: (result: LoupePickResult) => void
  onError?: (error: unknown) => void
}

export type LoupeHover = {
  setMagnification: (value: number) => void
  /** Hides the loupe until the pointer moves over the source again. */
  hide: () => void
  /** Hides the loupe and removes all listeners. */
  destroy: () => void
}

/**
 * Loupe without an overlay. The page stays usable; the magnifier appears
 * while a mouse hovers `source` or a finger is down on it.
 *
 * - Mouse / pen: hover to aim, click to pick, wheel zooms (only while the
 *   loupe shows, so the page scrolls elsewhere).
 * - Touch: press and drag on the source, lift to pick. The loupe sits
 *   above the finger. Pinch with two fingers on the source zooms.
 *   The source blocks page scroll on touch.
 *
 * Picking does not close anything: hover again to pick again.
 */
export const attachLoupeHover = (options: LoupeHoverOptions): LoupeHover => {
  const { source, config, size, sampleSize } = options
  const doc = source.ownerDocument
  const win = doc.defaultView!
  // The union type of `source` hides the typed listener overloads.
  const el: HTMLElement = source

  let buffer: PixelBuffer | null = null
  let view: LoupeView | null = null
  /** Reading pixels failed; stays off until a new attach. */
  let failed = false
  let destroyed = false
  let magnification = clampMagnification(options.magnification, config)
  let wheelRemainder = 0
  let rect: DisplayRect = { left: 0, top: 0, width: 0, height: 0 }
  let pixel: Point | null = null
  let anchor: Point = { x: 0, y: 0 }
  let frame = 0
  let visible = false
  let cursor = ''
  let lastAim = ''

  /** Reads pixels and builds the view once. False if not possible (yet). */
  const ready = (): boolean => {
    if (view) return true
    if (failed || destroyed) return false
    try {
      buffer = options.getBuffer()
      if (!buffer) return false
      view = createLoupeView(doc, buffer, {
        size,
        shape: options.shape,
        grid: options.grid,
        sampleSize,
        className: options.className,
        label: options.label,
        // Hover is for pointers; keyboard users get the overlay instead.
        live: false,
      })
      if (!view) {
        throw new DOMException(
          '2D canvas is not available',
          'NotSupportedError'
        )
      }
      view.element.setAttribute('aria-hidden', 'true')
      return true
    } catch (error) {
      failed = true
      options.onError?.(error)
      return false
    }
  }

  const pickResult = (p: Point): LoupePickResult => ({
    sRGBHex: pixelHex(buffer!, p, sampleSize),
    x: p.x,
    y: p.y,
    mode: 'loupe',
  })

  const draw = () => {
    frame = 0
    if (!visible || !view) return
    view.element.style.display = pixel ? 'block' : 'none'
    if (!pixel) return
    view.render(pixel, anchor, magnification)
    if (options.onAim) {
      const r = pickResult(pixel)
      const key = `${r.x},${r.y},${r.sRGBHex}`
      if (key !== lastAim) {
        lastAim = key
        options.onAim(r)
      }
    }
  }

  const schedule = () => {
    if (!frame && !destroyed) frame = win.requestAnimationFrame(draw)
  }

  const show = () => {
    if (visible || !view) return
    visible = true
    rect = source.getBoundingClientRect()
    doc.body.append(view.element)
    // Hide the cursor: the loupe center is the cursor.
    cursor = source.style.cursor
    source.style.cursor = 'none'
  }

  const hide = () => {
    if (!visible) return
    visible = false
    pixel = null
    if (frame) win.cancelAnimationFrame(frame)
    frame = 0
    view?.element.remove()
    source.style.cursor = cursor
  }

  const pixelAt = (x: number, y: number) =>
    buffer ? clientToSourcePixel(x, y, rect, buffer.width, buffer.height) : null

  const zoomTo = (value: number) => {
    if (value === magnification) return
    options.onMagnificationChange?.(value)
    if (!options.controlled) showMagnification(value)
  }

  const showMagnification = (value: number) => {
    magnification = value
    view?.showMagnification(value)
    schedule()
  }

  // ── Events ──
  const listeners = new AbortController()
  const passive = { signal: listeners.signal, passive: true }
  const active = { signal: listeners.signal, passive: false }

  const touch = createTouchTracker(() => magnification, {
    aim: (x, y) => {
      show()
      pixel = pixelAt(x, y)
      anchor = touchLoupeCenter(x, y, size, TOUCH_GAP)
      schedule()
    },
    pinch: (start, startDistance, distance) =>
      zoomTo(pinchMagnification(start, startDistance, distance, config)),
    end: (x, y, { pinched, cancelled }) => {
      const p = pinched || cancelled ? null : (pixel ?? pixelAt(x, y))
      hide()
      // Lifting off the source picks nothing.
      if (p && pixelAt(x, y)) options.onPick(pickResult(p))
    },
  })

  const onMouseMove = (e: PointerEvent) => {
    if (!ready()) return
    show()
    rect = source.getBoundingClientRect()
    anchor = { x: e.clientX, y: e.clientY }
    pixel = pixelAt(e.clientX, e.clientY)
    schedule()
  }

  el.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch' || !ready()) return
      // Keep getting moves when the finger slides off the source.
      try {
        source.setPointerCapture?.(e.pointerId)
      } catch {
        // Not an active pointer (synthetic events): moves still arrive
        // while the finger stays on the source.
      }
      if (!visible) rect = source.getBoundingClientRect()
      touch.down(e)
    },
    passive
  )

  for (const type of ['pointerover', 'pointermove'] as const) {
    el.addEventListener(
      type,
      (e) => {
        if (e.pointerType === 'touch') {
          if (type === 'pointermove') touch.move(e)
        } else onMouseMove(e)
      },
      passive
    )
  }

  for (const type of ['pointerup', 'pointercancel'] as const) {
    el.addEventListener(
      type,
      (e) => {
        if (e.pointerType === 'touch') touch.up(e)
      },
      passive
    )
  }

  el.addEventListener(
    'pointerleave',
    (e) => {
      if (e.pointerType !== 'touch') hide()
    },
    passive
  )

  el.addEventListener(
    'click',
    (e) => {
      // Touch picks on lift.
      if ((e as PointerEvent).pointerType === 'touch') return
      if (visible && pixel) options.onPick(pickResult(pixel))
    },
    { signal: listeners.signal }
  )

  // Not passive: preventDefault keeps the page from scrolling while zooming.
  el.addEventListener(
    'wheel',
    (e) => {
      if (!visible) return
      e.preventDefault()
      const next = wheelMagnification(
        magnification,
        wheelDeltaToNotches(e.deltaY, e.deltaMode) + wheelRemainder,
        config
      )
      wheelRemainder = next.remainder
      zoomTo(next.magnification)
    },
    active
  )

  // Not passive: stops scroll, pinch-zoom of the page, the long-press menu
  // and the click a browser makes after a touch.
  for (const type of ['touchstart', 'touchmove', 'touchend'] as const) {
    el.addEventListener(type, (e) => e.preventDefault(), active)
  }

  const updateRect = () => {
    if (visible) rect = source.getBoundingClientRect()
  }
  win.addEventListener('resize', updateRect, passive)
  win.addEventListener('scroll', updateRect, { ...passive, capture: true })

  return {
    setMagnification: (value) => {
      const next = clampMagnification(value, config)
      if (next !== magnification) showMagnification(next)
    },
    hide,
    destroy: () => {
      hide()
      destroyed = true
      listeners.abort()
      view?.destroy()
    },
  }
}
