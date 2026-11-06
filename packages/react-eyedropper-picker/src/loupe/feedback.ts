import {
  createLoupeSound,
  DEFAULT_MIN_TICK_INTERVAL,
  hasUserActivation,
  resolveSoundOptions,
  type LoupeSound,
  type LoupeSoundEvent,
  type LoupeSoundOptions,
} from './sound'

/** Pixel changes this far apart (ms) or more count as speed 0. */
export const SLOW_TICK_INTERVAL = 200
/** Pixel changes this close (ms), about one per frame, count as speed 1. */
export const FAST_TICK_INTERVAL = 20

/** How fast the average interval follows new ones (0 to 1). */
const SPEED_SMOOTHING = 0.3

/**
 * Decides which ticks play, for the "brrrt" of a fast sweep:
 * - A tick within `minInterval` ms of the last played one merges into it.
 * - Returns the speed, 0 (slow) to 1 (fast), from a running average of
 *   the time between ticks, merged ones included. A pause resets it.
 *
 * Returns null for a merged tick.
 */
export const createTickGate = (minInterval: number) => {
  let lastTick = -Infinity
  let lastPlay = -Infinity
  let average = SLOW_TICK_INTERVAL

  return (now: number): number | null => {
    const interval = now - lastTick
    lastTick = now
    average =
      interval >= SLOW_TICK_INTERVAL
        ? SLOW_TICK_INTERVAL
        : average + (interval - average) * SPEED_SMOOTHING
    if (now - lastPlay < minInterval) return null
    lastPlay = now
    const speed =
      (SLOW_TICK_INTERVAL - average) / (SLOW_TICK_INTERVAL - FAST_TICK_INTERVAL)
    return Math.min(1, Math.max(0, speed))
  }
}

/** Vibration (ms) per event. Only pixel ticks and confirm vibrate. */
const VIBRATIONS: Partial<Record<LoupeSoundEvent, number | number[]>> = {
  pixel: 8,
  confirm: [12, 40, 16],
}

export type LoupeFeedbackOptions = {
  sound?: boolean | LoupeSoundOptions
  haptics?: boolean
}

export type LoupeFeedback = {
  /** Call from a user gesture. See `LoupeSound.unlock`. */
  unlock: () => void
  /** The center pixel changed. */
  pixel: () => void
  /** The magnification crossed a detent (see `magnificationDetent`). */
  zoom: () => void
  open: () => void
  confirm: () => void
  cancel: () => void
  destroy: () => void
}

/**
 * Sound and vibration for loupe events. Null when both are off, so a
 * loupe without effects does no work at all.
 *
 * Haptics use `navigator.vibrate` (Android Chrome). Elsewhere, such as
 * iOS Safari, they do nothing.
 */
export const createLoupeFeedback = (
  doc: Document,
  options: LoupeFeedbackOptions,
  now: () => number = () => doc.defaultView!.performance.now()
): LoupeFeedback | null => {
  const soundOptions = resolveSoundOptions(options.sound)
  const win = doc.defaultView
  const vibrate =
    options.haptics && win && typeof win.navigator.vibrate === 'function'
      ? (pattern: number | number[]) => {
          // Chrome blocks (and logs) vibrate before a user gesture.
          if (!hasUserActivation(win)) return
          try {
            win.navigator.vibrate(pattern)
          } catch {
            // Not allowed here (e.g. a cross-origin iframe).
          }
        }
      : null
  if (!soundOptions && !vibrate) return null

  const sound: LoupeSound | null = soundOptions
    ? createLoupeSound(doc, soundOptions)
    : null
  const minInterval = soundOptions?.minTickInterval ?? DEFAULT_MIN_TICK_INTERVAL
  const pixelGate = createTickGate(minInterval)
  const zoomGate = createTickGate(minInterval)

  const emit = (event: LoupeSoundEvent, speed = 0) => {
    sound?.play(event, speed)
    const pattern = VIBRATIONS[event]
    if (pattern !== undefined) vibrate?.(pattern)
  }

  const ticked =
    (gate: (t: number) => number | null, event: LoupeSoundEvent) => () => {
      const speed = gate(now())
      if (speed !== null) emit(event, speed)
    }

  return {
    unlock: () => sound?.unlock(),
    pixel: ticked(pixelGate, 'pixel'),
    zoom: ticked(zoomGate, 'zoom'),
    open: () => emit('open'),
    confirm: () => emit('confirm'),
    cancel: () => emit('cancel'),
    destroy: () => sound?.destroy(),
  }
}
