import type { Point } from './geometry'

/** A touch that moves less than this (CSS px) counts as a tap. */
const TAP_SLOP = 10

export type TouchGesture = {
  /** Moved less than the tap slop. */
  tap: boolean
  /** Two fingers were down at some point. */
  pinched: boolean
  /** Ended with `pointercancel`. */
  cancelled: boolean
}

export type TouchHandlers = {
  /** One finger is down or moving at this client point. */
  aim: (x: number, y: number) => void
  /** Two fingers: zoom from `start` by the finger distance ratio. */
  pinch: (start: number, startDistance: number, distance: number) => void
  /** The last finger lifted at this client point. */
  end: (x: number, y: number, gesture: TouchGesture) => void
}

export type TouchTracker = {
  down: (e: PointerEvent) => void
  move: (e: PointerEvent) => void
  /** For `pointerup` and `pointercancel`. */
  up: (e: PointerEvent) => void
}

/**
 * One finger aims, two fingers pinch. A gesture that pinched stays a pinch
 * until every finger lifts. `getMagnification` is read when a pinch starts.
 */
export const createTouchTracker = (
  getMagnification: () => number,
  handlers: TouchHandlers
): TouchTracker => {
  const touches = new Map<number, Point>()
  let pinch: { distance: number; magnification: number } | null = null
  let pinched = false
  let start: Point | null = null
  let moved = false

  const fingerDistance = () => {
    const [a, b] = touches.values()
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  return {
    down: (e) => {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.size === 1) {
        pinched = false
        moved = false
        start = { x: e.clientX, y: e.clientY }
        handlers.aim(e.clientX, e.clientY)
      } else if (touches.size === 2) {
        pinch = {
          distance: fingerDistance(),
          magnification: getMagnification(),
        }
        pinched = true
      }
    },
    move: (e) => {
      if (!touches.has(e.pointerId)) return
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch) {
        handlers.pinch(pinch.magnification, pinch.distance, fingerDistance())
      } else if (!pinched) {
        if (
          start &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP
        ) {
          moved = true
        }
        handlers.aim(e.clientX, e.clientY)
      }
    },
    up: (e) => {
      if (!touches.delete(e.pointerId)) return
      if (touches.size < 2) pinch = null
      if (touches.size > 0) return
      handlers.end(e.clientX, e.clientY, {
        tap: !moved,
        pinched,
        cancelled: e.type === 'pointercancel',
      })
    },
  }
}
