import {
  clampPixel,
  clientToSourcePixel,
  sourcePixelToClient,
  touchLoupeCenter,
  type DisplayRect,
  type Point,
} from './geometry'
import {
  clampMagnification,
  keyMagnification,
  magnificationDetent,
  pinchMagnification,
  wheelDeltaToNotches,
  wheelMagnification,
  type MagnificationConfig,
} from './magnification'
import type { LoupeFeedback } from './feedback'
import type { LoupeSource, PixelBuffer, SampleSize } from './pixels'
import { createTouchTracker } from './touch'
import { createLoupeView, pixelHex, type LoupeShape } from './view'

export type { LoupeShape } from './view'

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
  /** Replaces the hex label; the caller fills it. */
  label?: HTMLElement
  /** Called once per frame when the pixel under the loupe changes. */
  onAim?: (result: LoupePickResult) => void
  /**
   * Sound and haptics. The caller owns it (creates and destroys it); the
   * session plays open, pixel, zoom, confirm and cancel (Escape or a click
   * outside, not `cancel()` or `signal`).
   */
  feedback?: LoupeFeedback | null
  /** See `LoupeViewOptions.smoothing`. */
  smoothing?: number
  /** See `LoupeViewOptions.animate`. */
  animate?: boolean
  signal?: AbortSignal
}

export type LoupeSession = {
  /** Resolves on confirm, rejects with `AbortError` on cancel. */
  result: Promise<LoupePickResult>
  setMagnification: (value: number) => void
  /** Closes the loupe; `result` rejects with `AbortError`. */
  cancel: () => void
}

/** Space between a finger and the loupe edge; the label sits in it. */
export const TOUCH_GAP = 48

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
 * - Mouse / pen: move to track, click on the source to confirm, click
 *   outside to cancel. Wheel zooms.
 * - Touch: the loupe sits above the finger. Drag to aim, lift to confirm,
 *   tap outside to cancel. Pinch with two fingers zooms.
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
  const feedback = options.feedback ?? null
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
  let lastCursor = ''
  /** Last pixel sent to `onAim`. */
  let lastAim = ''
  /** Last pixel that ticked; starts at the first pixel, which doesn't. */
  let lastTick = `${pixel.x},${pixel.y}`
  let detent = magnificationDetent(magnification, config)
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

  const view = createLoupeView(doc, buffer, {
    size,
    shape: options.shape,
    grid: options.grid,
    sampleSize,
    className: options.className,
    label: options.label,
    live: true,
    smoothing: options.smoothing,
    animate: options.animate,
  })
  if (!view) {
    reject(new DOMException('2D canvas is not available', 'NotSupportedError'))
    return { result, setMagnification: () => {}, cancel: () => {} }
  }
  const loupe = view.element
  overlay.append(loupe)

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

    // Gliding or zooming: keep drawing until it settles.
    if (view.render(pixel, anchor, magnification)) schedule()
    if (feedback) {
      const key = `${pixel.x},${pixel.y}`
      if (key !== lastTick) {
        lastTick = key
        feedback.pixel()
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
    if (!frame && !settled) frame = win.requestAnimationFrame(draw)
  }

  const pickResult = (p: Point): LoupePickResult => ({
    sRGBHex: pixelHex(buffer, p, sampleSize),
    x: p.x,
    y: p.y,
    mode: 'loupe',
  })

  // ── State changes ──
  const showMagnification = (value: number) => {
    magnification = value
    view.showMagnification(value)
    const d = magnificationDetent(value, config)
    if (d !== detent) {
      detent = d
      feedback?.zoom()
    }
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
    view.destroy()
    // The page is usable at once; the loupe shrinks out on its own.
    if (loupe.isConnected) doc.body.append(loupe)
    overlay.remove()
    view.unmount()
    previousFocus?.focus?.()
  }

  const confirm = (p: Point) => {
    if (settled) return
    feedback?.confirm()
    finish()
    resolve(pickResult(p))
  }

  const cancel = () => {
    if (settled) return
    finish()
    reject(abortError())
  }

  /** Escape or a click outside: the only cancels that make a sound. */
  const userCancel = () => {
    if (!settled) feedback?.cancel()
    cancel()
  }

  // ── Events ──
  const on = { signal: listeners.signal }
  const passive = { signal: listeners.signal, passive: true }

  // ── Touch ──
  // One finger: the loupe sits above it, drag to aim, lift to confirm.
  // Two fingers: pinch zooms. A gesture that pinched never confirms.
  const touch = createTouchTracker(() => magnification, {
    aim: (x, y) => {
      pixel = pixelAt(x, y)
      anchor = touchLoupeCenter(x, y, size, TOUCH_GAP)
      aimed = true
      schedule()
    },
    pinch: (start, startDistance, distance) =>
      zoomTo(pinchMagnification(start, startDistance, distance, config)),
    end: (x, y, { tap, pinched, cancelled }) => {
      if (pinched || cancelled) return
      const p = pixelAt(x, y)
      if (p) confirm(pixel ?? p)
      // Tap outside cancels; a drag that ends outside keeps the loupe open.
      else if (tap) userCancel()
    },
  })

  overlay.addEventListener(
    'pointerdown',
    (e) => {
      // A gesture: lets audio start if `open()` came without one.
      feedback?.unlock()
      if (e.pointerType === 'touch') touch.down(e)
    },
    passive
  )

  overlay.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return touch.move(e)
      anchor = { x: e.clientX, y: e.clientY }
      pixel = pixelAt(e.clientX, e.clientY)
      aimed = true
      schedule()
    },
    passive
  )

  for (const type of ['pointerup', 'pointercancel'] as const) {
    overlay.addEventListener(
      type,
      (e) => {
        if (e.pointerType === 'touch') touch.up(e)
      },
      passive
    )
  }

  // Not passive: stops page scroll and pinch-zoom (iOS ignores some
  // `touch-action`), and the click a browser makes after a touch, which
  // would land on the page once the overlay is gone.
  for (const type of ['touchstart', 'touchmove', 'touchend'] as const) {
    overlay.addEventListener(type, (e) => e.preventDefault(), {
      signal: listeners.signal,
      passive: false,
    })
  }

  overlay.addEventListener(
    'click',
    (e) => {
      // Touch is handled on pointerup. Some browsers still send a click.
      if ((e as PointerEvent).pointerType === 'touch') return
      const p = pixelAt(e.clientX, e.clientY)
      if (!p) return userCancel()
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
      feedback?.unlock()
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
        userCancel()
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
  view.appear()
  overlay.focus({ preventScroll: true })
  feedback?.unlock()
  feedback?.open()
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
