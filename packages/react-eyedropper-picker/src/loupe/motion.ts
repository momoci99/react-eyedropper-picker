import type { Point } from './geometry'

/** Frame length assumed when motion starts from rest. */
export const FRAME_MS = 1000 / 60

/** Time constant (ms) of the glide at `smoothing: 1`. */
const MAX_SMOOTHING_MS = 100

/** Time constant (ms) of the zoom animation. */
export const ZOOM_TIME_CONSTANT = 60

/** Closer than this (CSS px) counts as arrived. */
const POSITION_EPSILON = 0.25
/** Closer than this (ratio) counts as arrived, about 0.2% zoom. */
const ZOOM_EPSILON = 0.002

/**
 * `smoothing` (0 to 1) as a time constant in ms. 0 means no glide.
 * Out of range or non-finite values clamp, NaN is 0.
 */
export const smoothingTimeConstant = (
  smoothing: number | undefined
): number => {
  const s = typeof smoothing === 'number' && smoothing > 0 ? smoothing : 0
  return Math.min(1, s) * MAX_SMOOTHING_MS
}

/**
 * Share of the way to the target covered in `dt` ms, for exponential
 * smoothing with time constant `tau`. The same total motion at any frame
 * rate. `tau <= 0` covers all of it.
 */
export const followFactor = (dt: number, tau: number): number =>
  tau > 0 ? 1 - Math.exp(-Math.max(0, dt) / tau) : 1

/** Steps `current` toward `target`. Snaps once within a quarter pixel. */
export const followPoint = (
  current: Point,
  target: Point,
  factor: number
): Point => {
  const dx = target.x - current.x
  const dy = target.y - current.y
  if (factor >= 1 || Math.hypot(dx, dy) < POSITION_EPSILON) return target
  return { x: current.x + dx * factor, y: current.y + dy * factor }
}

/**
 * Steps a magnification toward `target` in log space, so zooming 2→4 and
 * 16→32 take the same time. Snaps once within 0.2%.
 */
export const followMagnification = (
  current: number,
  target: number,
  factor: number
): number => {
  if (factor >= 1 || !(current > 0) || !(target > 0)) return target
  const ratio = target / current
  if (Math.abs(ratio - 1) < ZOOM_EPSILON) return target
  return current * ratio ** factor
}

/**
 * Live `prefers-reduced-motion: reduce`. False where `matchMedia` is
 * missing. Read `.matches` per use: the user can change it any time.
 */
export const reducedMotionQuery = (win: Window) => {
  const query = win.matchMedia?.('(prefers-reduced-motion: reduce)')
  return () => query?.matches === true
}
