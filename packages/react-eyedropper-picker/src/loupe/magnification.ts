export const DEFAULT_MAGNIFICATION = 8
export const DEFAULT_MIN_MAGNIFICATION = 1
export const DEFAULT_MAX_MAGNIFICATION = 64

/** Continuous mode: one wheel notch or key press multiplies by this. */
export const MAGNIFICATION_STEP_FACTOR = 1.1

/** Wheel delta that counts as one notch, per `WheelEvent.deltaMode`. */
const PIXELS_PER_NOTCH = 100
const LINES_PER_NOTCH = 3

export type MagnificationRange = { min: number; max: number }

/** Resolved settings for every magnification change. */
export type MagnificationConfig = MagnificationRange & {
  /** Sorted, unique, inside the range. Undefined means continuous. */
  steps?: readonly number[]
  /** Value the `0` key returns to, inside the range. */
  defaultValue: number
}

export type MagnificationOptions = {
  defaultMagnification?: number
  minMagnification?: number
  maxMagnification?: number
  magnificationSteps?: readonly number[]
}

const isPositive = (n: number | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0

/** Drops float noise such as `8.000000000000002` after `* 1.1 / 1.1`. */
const tidy = (n: number): number => Math.round(n * 1e6) / 1e6

/** Treats values this close (relative) as equal when comparing to steps. */
const EPSILON = 1e-9
const isAbove = (a: number, b: number) => a > b * (1 + EPSILON)
const isBelow = (a: number, b: number) => a < b * (1 - EPSILON)

export const clampMagnification = (
  value: number,
  { min, max }: MagnificationRange
): number => Math.min(max, Math.max(min, value))

/**
 * Turns user options into a config that is always valid, so a bad prop
 * never throws during render:
 * - `min` is at least 1 (a cell is never smaller than a pixel).
 * - `max` is at least `min`. There is no upper limit otherwise.
 * - Non-positive or non-finite numbers fall back to the defaults.
 * - Steps outside the range are dropped. No steps left means continuous.
 * - The default is clamped into the range.
 */
export const resolveMagnificationConfig = (
  options: MagnificationOptions = {}
): MagnificationConfig => {
  const min = Math.max(
    1,
    isPositive(options.minMagnification)
      ? options.minMagnification
      : DEFAULT_MIN_MAGNIFICATION
  )
  const max = Math.max(
    min,
    isPositive(options.maxMagnification)
      ? options.maxMagnification
      : DEFAULT_MAX_MAGNIFICATION
  )
  const range = { min, max }

  let steps: number[] | undefined
  if (options.magnificationSteps) {
    const inRange = options.magnificationSteps.filter(
      (s) => isPositive(s) && s >= min && s <= max
    )
    steps = [...new Set(inRange)].sort((a, b) => a - b)
    if (steps.length === 0) steps = undefined
  }

  const defaultValue = clampMagnification(
    isPositive(options.defaultMagnification)
      ? options.defaultMagnification
      : DEFAULT_MAGNIFICATION,
    range
  )
  return { min, max, steps, defaultValue }
}

/**
 * Moves `count` steps in (positive) or out (negative).
 *
 * With steps, each step goes to the next listed value strictly above (or
 * below) the current one, so a value between steps (e.g. after a pinch)
 * snaps to the neighbour in that direction. Past the last step it stays.
 *
 * Without steps, each step multiplies (or divides) by 1.1.
 */
export const stepMagnification = (
  current: number,
  count: number,
  config: MagnificationConfig
): number => {
  if (count === 0) return clampMagnification(current, config)
  const { steps } = config

  if (!steps) {
    return tidy(
      clampMagnification(current * MAGNIFICATION_STEP_FACTOR ** count, config)
    )
  }

  let value = clampMagnification(current, config)
  const n = Math.abs(count)
  for (let i = 0; i < n; i++) {
    const next = count > 0 ? stepAbove(steps, value) : stepBelow(steps, value)
    if (next === undefined) break
    value = next
  }
  return value
}

const stepAbove = (steps: readonly number[], value: number) => {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!
    if (isAbove(s, value)) return s
  }
  return undefined
}

const stepBelow = (steps: readonly number[], value: number) => {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!
    if (isBelow(s, value)) return s
  }
  return undefined
}

/**
 * Converts a wheel event's `deltaY` to notches. Positive means zoom in
 * (wheel up, `deltaY < 0`). Trackpads give fractions of a notch.
 *
 * `deltaMode`: 0 pixels, 1 lines, 2 pages (`WheelEvent.DOM_DELTA_*`).
 */
export const wheelDeltaToNotches = (
  deltaY: number,
  deltaMode: number
): number => {
  const perNotch =
    deltaMode === 1 ? LINES_PER_NOTCH : deltaMode === 2 ? 1 : PIXELS_PER_NOTCH
  return -deltaY / perNotch
}

/**
 * Applies `notches` of wheel input (from `wheelDeltaToNotches`, plus any
 * `remainder` carried from the previous event).
 *
 * Continuous: changes by `1.1 ** notches`, fractions included, so trackpads
 * zoom smoothly. Remainder is always 0.
 *
 * Steps: moves one step per whole notch. The fraction comes back as
 * `remainder`; pass it into the next call so small trackpad deltas add up
 * instead of each jumping a full step.
 */
export const wheelMagnification = (
  current: number,
  notches: number,
  config: MagnificationConfig
): { magnification: number; remainder: number } => {
  if (!config.steps) {
    return {
      magnification: stepMagnification(current, notches, config),
      remainder: 0,
    }
  }
  const whole = Math.trunc(notches)
  return {
    magnification: stepMagnification(current, whole, config),
    remainder: notches - whole,
  }
}

/**
 * Magnification during a pinch: the value at pinch start scaled by how
 * much the finger distance changed. Always continuous, even with steps.
 * Returns `start` (clamped) if either distance is not positive.
 */
export const pinchMagnification = (
  start: number,
  startDistance: number,
  distance: number,
  config: MagnificationRange
): number => {
  if (!(startDistance > 0) || !(distance > 0)) {
    return clampMagnification(start, config)
  }
  return tidy(clampMagnification((start * distance) / startDistance, config))
}

/**
 * Keyboard zoom while the loupe is open. Returns the new magnification,
 * or null if `key` is not a zoom key.
 * - `+` (also `=`, the same key unshifted on US layouts): one step in
 * - `-` (also `_`): one step out
 * - `0`: back to the default
 */
export const keyMagnification = (
  key: string,
  current: number,
  config: MagnificationConfig
): number | null => {
  switch (key) {
    case '+':
    case '=':
      return stepMagnification(current, 1, config)
    case '-':
    case '_':
      return stepMagnification(current, -1, config)
    case '0':
      return config.defaultValue
    default:
      return null
  }
}

/** Label shown while zooming: one decimal at most, e.g. `8×`, `12.5×`. */
export const formatMagnification = (value: number): string =>
  `${Math.round(value * 10) / 10}×`
