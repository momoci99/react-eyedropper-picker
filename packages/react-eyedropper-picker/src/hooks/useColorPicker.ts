import { useCallback, useEffect, useRef, useState } from 'react'
import { hexToHsv, hsvToHex, normalizeHex, type HSV } from '../utils/color'
import { useEyeDropper } from './useEyeDropper'

export type UseColorPickerOptions = {
  /** Controlled value (hex). */
  value?: string
  /** Initial value when uncontrolled. Defaults to `#000000`. */
  defaultValue?: string
  /** Called with normalized lowercase `#rrggbb`. */
  onChange?: (hex: string) => void
}

export type UseColorPickerResult = {
  hex: string
  hsv: HSV
  setHex: (hex: string) => boolean
  setHsv: (hsv: HSV) => void
  /** Opens the eye dropper and applies the picked color. Returns the hex, or null if cancelled. */
  pickFromScreen: () => Promise<string | null>
  isEyeDropperSupported: boolean
}

const FALLBACK = '#000000'

/**
 * Headless color picker state. Keeps HSV internally so hue/saturation
 * survive when the color hits black/white/gray.
 */
export const useColorPicker = ({
  value,
  defaultValue = FALLBACK,
  onChange,
}: UseColorPickerOptions = {}): UseColorPickerResult => {
  const initial = normalizeHex(value ?? defaultValue) ?? FALLBACK
  const [hsv, setHsvState] = useState<HSV>(() => hexToHsv(initial)!)
  const hex = hsvToHex(hsv)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Sync controlled value without clobbering hue when hex already matches
  useEffect(() => {
    if (value === undefined) return
    const next = normalizeHex(value)
    if (!next) return
    setHsvState((prev) => (hsvToHex(prev) === next ? prev : hexToHsv(next)!))
  }, [value])

  const setHsv = useCallback((next: HSV) => {
    setHsvState(next)
    onChangeRef.current?.(hsvToHex(next))
  }, [])

  const setHex = useCallback((input: string) => {
    const next = normalizeHex(input)
    if (!next) return false
    setHsvState(hexToHsv(next)!)
    onChangeRef.current?.(next)
    return true
  }, [])

  const { open, isSupported } = useEyeDropper()

  const pickFromScreen = useCallback(async () => {
    try {
      const { sRGBHex } = await open()
      // Some browsers return `rgba(...)` instead of hex
      const picked = normalizeHex(sRGBHex) ?? rgbaStringToHex(sRGBHex)
      if (!picked) return null
      setHex(picked)
      return picked
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null
      throw e
    }
  }, [open, setHex])

  return {
    hex,
    hsv,
    setHex,
    setHsv,
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
