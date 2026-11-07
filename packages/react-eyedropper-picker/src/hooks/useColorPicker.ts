import { useCallback, useEffect, useRef, useState } from 'react'
import {
  hexToHsv,
  hexToRgba,
  hsvToHex,
  hsvToRgb,
  normalizeHex,
  rgbaToHex,
  rgbToHsv,
  type HSV,
} from '../utils/color'
import { useEyeDropper, type EyeDropperLike } from './useEyeDropper'

export type UseColorPickerOptions = {
  /** Controlled value (hex). */
  value?: string
  /** Initial value when uncontrolled. Defaults to `#000000`. */
  defaultValue?: string
  /**
   * Called with normalized lowercase `#rrggbb`, or `#rrggbbaa` with
   * `alpha`.
   */
  onChange?: (hex: string) => void
  /**
   * Opacity support. Values become `#rrggbbaa` (always 8 digits; `ff` is
   * opaque), and `value`, `defaultValue` and `setHex` also take `#rgba` and
   * `#rrggbbaa`. Default false.
   */
  alpha?: boolean
  /**
   * Eye dropper used by `pickFromScreen`. Default: the native EyeDropper
   * (`useEyeDropper()`). Pass `useLoupeEyeDropper()` from
   * `react-eyedropper-picker/loupe` to pick from an image in every browser.
   */
  eyeDropper?: EyeDropperLike
}

export type UseColorPickerResult = {
  /** `#rrggbb`, or `#rrggbbaa` with `alpha`. */
  hex: string
  hsv: HSV
  /** 0 (transparent) to 1 (opaque). Always 1 without `alpha`. */
  alpha: number
  setHex: (hex: string) => boolean
  setHsv: (hsv: HSV) => void
  /** Sets the opacity, 0-1. Ignored without `alpha`. */
  setAlpha: (alpha: number) => void
  /**
   * Opens the eye dropper and applies the picked color (opaque). Returns the
   * new hex, or null if cancelled.
   */
  pickFromScreen: () => Promise<string | null>
  isEyeDropperSupported: boolean
}

const FALLBACK = '#000000'

type Parsed = { hsv: HSV; alpha: number }

/** Parses a hex for the current mode; null if invalid. */
const parse = (input: string, alpha: boolean): Parsed | null => {
  if (!alpha) {
    const hsv = hexToHsv(input)
    return hsv && { hsv, alpha: 1 }
  }
  const rgba = hexToRgba(input)
  return rgba && { hsv: rgbToHsv(rgba), alpha: rgba.a }
}

/** The hex `onChange` gets: `#rrggbb`, or `#rrggbbaa` with alpha. */
const format = (hsv: HSV, a: number, alpha: boolean) =>
  alpha ? rgbaToHex({ ...hsvToRgb(hsv), a }) : hsvToHex(hsv)

/**
 * Headless color picker state. Keeps HSV internally so hue/saturation
 * survive when the color hits black/white/gray.
 */
export const useColorPicker = ({
  value,
  defaultValue = FALLBACK,
  onChange,
  eyeDropper,
  alpha: withAlpha = false,
}: UseColorPickerOptions = {}): UseColorPickerResult => {
  const [state, setState] = useState<Parsed>(
    () => parse(value ?? defaultValue, withAlpha) ?? parse(FALLBACK, withAlpha)!
  )
  const alpha = withAlpha ? state.alpha : 1
  const hex = format(state.hsv, alpha, withAlpha)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const alphaRef = useRef(withAlpha)
  alphaRef.current = withAlpha
  /** Latest state, also between a set and the re-render. */
  const stateRef = useRef(state)
  stateRef.current = state

  // Sync controlled value without clobbering hue when hex already matches
  useEffect(() => {
    if (value === undefined) return
    const next = parse(value, withAlpha)
    if (!next) return
    setState((prev) =>
      format(prev.hsv, prev.alpha, withAlpha) ===
      format(next.hsv, next.alpha, withAlpha)
        ? prev
        : next
    )
  }, [value, withAlpha])

  const update = useCallback((next: Parsed) => {
    stateRef.current = next
    setState(next)
    onChangeRef.current?.(format(next.hsv, next.alpha, alphaRef.current))
  }, [])

  const setHsv = useCallback(
    (hsv: HSV) => update({ hsv, alpha: stateRef.current.alpha }),
    [update]
  )

  const setAlpha = useCallback(
    (a: number) => {
      if (!alphaRef.current) return
      update({ hsv: stateRef.current.hsv, alpha: Math.min(1, Math.max(0, a)) })
    },
    [update]
  )

  const setHex = useCallback(
    (input: string) => {
      const next = parse(input, alphaRef.current)
      if (!next) return false
      update(next)
      return true
    },
    [update]
  )

  const native = useEyeDropper()
  const { open, isSupported } = eyeDropper ?? native

  const pickFromScreen = useCallback(async () => {
    try {
      const { sRGBHex } = await open()
      // Some browsers return `rgba(...)` instead of hex
      const picked = normalizeHex(sRGBHex) ?? rgbaStringToHex(sRGBHex)
      if (!picked) return null
      // Screen pixels are opaque.
      const next = parse(picked, alphaRef.current)!
      update(next)
      return format(next.hsv, next.alpha, alphaRef.current)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null
      throw e
    }
  }, [open, update])

  return {
    hex,
    hsv: state.hsv,
    alpha,
    setHex,
    setHsv,
    setAlpha,
    pickFromScreen,
    isEyeDropperSupported: isSupported,
  }
}

const rgbaStringToHex = (s: string): string | null => {
  const m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s)
  if (!m) return null
  return (
    '#' +
    [m[1], m[2], m[3]]
      .map((c) => Math.min(255, Number(c)).toString(16).padStart(2, '0'))
      .join('')
  )
}
