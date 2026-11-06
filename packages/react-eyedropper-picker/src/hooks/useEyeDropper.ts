// Based on use-eye-dropper by Jaxson Van Doorn (MIT)
// https://github.com/woofers/use-eye-dropper
import { useCallback, useEffect, useRef, useState } from 'react'

export type ColorSelectionOptions = { signal?: AbortSignal }
export type ColorSelectionResult = { sRGBHex: string }

type EyeDropperInstance = {
  open: (options?: ColorSelectionOptions) => Promise<ColorSelectionResult>
}
type EyeDropperConstructor = new () => EyeDropperInstance

/**
 * Anything that picks a color: `useEyeDropper()`, `useLoupeEyeDropper()`
 * from `react-eyedropper-picker/loupe`, or your own.
 */
export type EyeDropperLike = {
  /** Resolves with the color. Rejects with `AbortError` when cancelled. */
  open: () => Promise<{ sRGBHex: string }>
  /** False hides the eye dropper button. */
  isSupported: boolean
}

export type UseEyeDropperResult = {
  /**
   * Opens the native eye dropper. Rejects with `AbortError` when
   * closed/cancelled and `NotSupportedError` when the browser has no
   * EyeDropper API.
   */
  open: (options?: ColorSelectionOptions) => Promise<ColorSelectionResult>
  /** Aborts the currently open eye dropper, if any. */
  close: () => void
  /** `false` during SSR and the first render; resolved after mount. */
  isSupported: boolean
}

const getEyeDropper = (): EyeDropperConstructor | undefined =>
  typeof window !== 'undefined' && 'EyeDropper' in window
    ? (window as unknown as { EyeDropper: EyeDropperConstructor }).EyeDropper
    : undefined

export const isEyeDropperSupported = (): boolean => !!getEyeDropper()

// AbortSignal.any polyfill
// https://github.com/whatwg/fetch/issues/905#issuecomment-491970649
const anySignal = (signals: AbortSignal[]): AbortSignal => {
  if ('any' in AbortSignal) return AbortSignal.any(signals)
  const controller = new AbortController()
  const onAbort = () => {
    controller.abort()
    for (const s of signals) s.removeEventListener('abort', onAbort)
  }
  for (const s of signals) {
    if (s.aborted) {
      onAbort()
      break
    }
    s.addEventListener('abort', onAbort)
  }
  return controller.signal
}

export const useEyeDropper = (): UseEyeDropperResult => {
  const [isSupported, setIsSupported] = useState(false)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    setIsSupported(isEyeDropperSupported())
  }, [])

  const close = useCallback(() => {
    controller.current?.abort()
    controller.current = null
  }, [])

  const open = useCallback(
    async (options: ColorSelectionOptions = {}) => {
      const Ctor = getEyeDropper()
      if (!Ctor) {
        throw new DOMException(
          'The EyeDropper API is not available. See https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API',
          'NotSupportedError'
        )
      }
      close()
      const own = new AbortController()
      controller.current = own
      const signal = options.signal
        ? anySignal([options.signal, own.signal])
        : own.signal
      try {
        return await new Ctor().open({ signal })
      } finally {
        if (controller.current === own) controller.current = null
      }
    },
    [close]
  )

  // Close the dropper on unmount
  useEffect(() => close, [close])

  return { open, close, isSupported }
}
