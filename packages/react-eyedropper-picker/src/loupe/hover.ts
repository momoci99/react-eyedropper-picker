import { clientToSourcePixel, loupeCenterAbove, type Point } from './geometry'
import { sourceLayout, type SourceLayout } from './layout'
import {
  clampMagnification,
  magnificationDetent,
  pinchMagnification,
  wheelDeltaToNotches,
  wheelMagnification,
  type MagnificationConfig,
} from './magnification'
import type { LoupeFeedback } from './feedback'
import type { PickSource, PixelBuffer, SampleSize } from './pixels'
import {
  CURSOR_GAP,
  loupeAboveCursor,
  TOUCH_GAP,
  type LoupePickResult,
} from './session'
import { createTouchTracker } from './touch'
import {
  createLoupeView,
  pixelHex,
  type LoupeShape,
  type LoupeView,
} from './view'

export type LoupeHoverOptions = {
  source: PickSource
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
  /**
   * Sound and haptics; the caller owns it. Plays pixel, zoom and confirm
   * (on pick). No open or cancel: hovering is not opening.
   */
  feedback?: LoupeFeedback | null
  /** See `LoupeViewOptions.smoothing`. */
  smoothing?: number
  /** See `LoupeViewOptions.animate`. */
  animate?: boolean
  /**
   * CSS cursor over the source while the loupe shows. Default `'none'`.
   * Any other value moves the loupe above the pointer.
   */
  cursor?: string
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
  const feedback = options.feedback ?? null
  const above = loupeAboveCursor(options.cursor)
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
  let layout: SourceLayout | null = null
  let pixel: Point | null = null
  let anchor: Point = { x: 0, y: 0 }
  let frame = 0
  let visible = false
  let cursor = ''
  let lastAim = ''
  /** Last pixel that ticked. Empty right after showing: no tick on entry. */
  let lastTick = ''
  let detent = magnificationDetent(magnification, config)

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
        smoothing: options.smoothing,
        animate: options.animate,
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
    if (view.render(pixel, anchor, magnification)) schedule()
    if (feedback) {
      const key = `${pixel.x},${pixel.y}`
      if (key !== lastTick) {
        if (lastTick) feedback.pixel()
        lastTick = key
      }
    }
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
    measure()
    view.mount(doc.body)
    // By default hide the cursor: the loupe center is the cursor.
    cursor = source.style.cursor
    source.style.cursor = options.cursor ?? 'none'
  }

  const hide = () => {
    if (!visible) return
    visible = false
    pixel = null
    lastTick = ''
    if (frame) win.cancelAnimationFrame(frame)
    frame = 0
    view?.unmount()
    source.style.cursor = cursor
  }

  const measure = () => {
    if (buffer) layout = sourceLayout(source, buffer.width, buffer.height)
  }

  const pixelAt = (x: number, y: number) =>
    buffer && layout
      ? clientToSourcePixel(
          x,
          y,
          layout.rect,
          buffer.width,
          buffer.height,
          layout.box
        )
      : null

  const zoomTo = (value: number) => {
    if (value === magnification) return
    options.onMagnificationChange?.(value)
    if (!options.controlled) showMagnification(value)
  }

  const showMagnification = (value: number) => {
    magnification = value
    view?.showMagnification(value)
    const d = magnificationDetent(value, config)
    if (d !== detent) {
      detent = d
      // Not for a prop change (e.g. an app slider) while hidden.
      if (visible) feedback?.zoom()
    }
    schedule()
  }

  const pick = (p: Point) => {
    feedback?.confirm()
    options.onPick(pickResult(p))
  }

  // ── Events ──
  const listeners = new AbortController()
  const passive = { signal: listeners.signal, passive: true }
  const active = { signal: listeners.signal, passive: false }

  const touch = createTouchTracker(() => magnification, {
    aim: (x, y) => {
      show()
      pixel = pixelAt(x, y)
      anchor = loupeCenterAbove(x, y, size, TOUCH_GAP)
      schedule()
    },
    pinch: (start, startDistance, distance) =>
      zoomTo(pinchMagnification(start, startDistance, distance, config)),
    end: (x, y, { pinched, cancelled }) => {
      const p = pinched || cancelled ? null : (pixel ?? pixelAt(x, y))
      hide()
      // Lifting off the source picks nothing.
      if (p && pixelAt(x, y)) pick(p)
    },
  })

  const onMouseMove = (e: PointerEvent) => {
    if (!ready()) return
    show()
    measure()
    anchor = above
      ? loupeCenterAbove(e.clientX, e.clientY, size, CURSOR_GAP)
      : { x: e.clientX, y: e.clientY }
    pixel = pixelAt(e.clientX, e.clientY)
    schedule()
  }

  el.addEventListener(
    'pointerdown',
    (e) => {
      // A gesture: lets audio start.
      feedback?.unlock()
      if (e.pointerType !== 'touch' || !ready()) return
      // Keep getting moves when the finger slides off the source.
      try {
        source.setPointerCapture?.(e.pointerId)
      } catch {
        // Not an active pointer (synthetic events): moves still arrive
        // while the finger stays on the source.
      }
      if (!visible) measure()
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
      if (visible && pixel) pick(pixel)
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
    if (visible) measure()
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
