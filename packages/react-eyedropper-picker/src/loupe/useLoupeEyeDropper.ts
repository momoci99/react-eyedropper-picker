import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react'
import { isEyeDropperSupported, useEyeDropper } from '../hooks/useEyeDropper'
import { createLoupeFeedback } from './feedback'
import {
  clampMagnification,
  resolveMagnificationConfig,
  type MagnificationOptions,
} from './magnification'
import { readPixels, type LoupeSource, type SampleSize } from './pixels'
import {
  startLoupeSession,
  type LoupeSession,
  type LoupeShape,
} from './session'
import type { LoupeSoundOptions } from './sound'
import { DEFAULT_LOUPE_SIZE } from './view'

export type PickMode = 'auto' | 'native' | 'loupe'

/** What the loupe can pick from. */
export type PickSource = LoupeSource

export type PickResult = {
  /** `#rrggbb`, same key as the native EyeDropper result. */
  sRGBHex: string
  /** Source pixel coordinates. Loupe mode only. */
  x?: number
  y?: number
  mode: 'native' | 'loupe'
}

export type LoupeOptions = MagnificationOptions & {
  /** Controlled magnification. Pair with `onMagnificationChange`. */
  magnification?: number
  onMagnificationChange?: (value: number) => void
  /** Loupe width and height in CSS px. Default 120. */
  size?: number
  /** Default `'circle'`. */
  shape?: LoupeShape
  /** Pixel grid. Default true, hidden below 4px per cell. */
  grid?: boolean
  /** Average an NxN block. Default 1. */
  sampleSize?: SampleSize
  /** Added to the loupe element (canvas + label). */
  className?: string
  /**
   * 0 to 1: how much the loupe glides after the pointer. Default 0 (none).
   * The picked pixel is always the one under the pointer.
   */
  smoothing?: number
  /**
   * Grow in on open, shrink out on close, animated zoom. Default true.
   * Off when the user prefers reduced motion, as is `smoothing`.
   */
  animate?: boolean
  /**
   * CSS `cursor` over the image while the loupe shows. Default `'none'`:
   * the cursor is hidden and the loupe is centered on the pointer, its
   * center pixel marking the spot. Any other value shows that cursor and
   * moves the loupe above it (below near the top of the viewport).
   * `eyeDropperCursor` is a ready-made eye dropper
   * icon; any value works, e.g. `'url(/pick.svg) 2 22, crosshair'`.
   */
  cursor?: string
  /**
   * Sounds made with Web Audio: a tick per pixel (a "brrrt" when moving
   * fast), a detent tick per zoom step, open, confirm and cancel.
   * Default false. `true` or options turn it on.
   */
  sound?: boolean | LoupeSoundOptions
  /**
   * Short vibration on pixel ticks and confirm (`navigator.vibrate`,
   * Android Chrome). Does nothing where unsupported. Default false.
   */
  haptics?: boolean
}

export type UseLoupeEyeDropperOptions = {
  /**
   * - `'auto'` (default): the loupe when there is a source, else native.
   * - `'native'`: the browser EyeDropper only.
   * - `'loupe'`: the loupe only. Needs a source.
   */
  mode?: PickMode
  /** Element to pick from. `open({ source })` overrides it. */
  source?: PickSource | RefObject<PickSource | null>
  loupe?: LoupeOptions
}

export type LoupeOpenOptions = {
  source?: PickSource
  signal?: AbortSignal
}

export type UseLoupeEyeDropperResult = {
  /**
   * Starts picking. Rejects with `AbortError` when cancelled and
   * `NotSupportedError` when the mode can't run (no source for the loupe,
   * no native EyeDropper). Reading a cross-origin image without CORS
   * rejects with `SecurityError`.
   */
  open: (options?: LoupeOpenOptions) => Promise<PickResult>
  /** Cancels the open picker, if any. */
  close: () => void
  /** Whether `open()` can work in the current mode. False during SSR. */
  isSupported: boolean
  isOpen: boolean
}

const notSupported = (message: string) =>
  new DOMException(message, 'NotSupportedError')

const resolveSource = (
  source: UseLoupeEyeDropperOptions['source']
): PickSource | undefined =>
  source && 'current' in source ? (source.current ?? undefined) : source

const subscribeNothing = () => () => {}

/**
 * Eye dropper with a pixel-accurate loupe for images and canvases, falling
 * back to (or choosing) the native EyeDropper API.
 *
 * Options are read when `open()` is called. While the loupe is open only
 * `loupe.magnification` (controlled) and `onMagnificationChange` follow
 * new renders.
 */
export const useLoupeEyeDropper = (
  options: UseLoupeEyeDropperOptions = {}
): UseLoupeEyeDropperResult => {
  const native = useEyeDropper()
  const [isOpen, setIsOpen] = useState(false)
  const session = useRef<LoupeSession | null>(null)
  const openId = useRef(0)
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  // True on the client, false on the server and while hydrating.
  const isClient = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false
  )
  const mode = options.mode ?? 'auto'
  const isSupported =
    mode === 'native'
      ? native.isSupported
      : mode === 'loupe'
        ? isClient
        : (isClient && options.source !== undefined) || native.isSupported

  const { close: closeNative } = native
  const close = useCallback(() => {
    openId.current++
    session.current?.cancel()
    session.current = null
    closeNative()
    setIsOpen(false)
  }, [closeNative])

  const { open: openNative } = native
  const open = useCallback(
    async (openOptions: LoupeOpenOptions = {}): Promise<PickResult> => {
      close()
      const id = openId.current
      const { mode = 'auto', loupe = {}, source: own } = latest.current
      const source = openOptions.source ?? resolveSource(own)

      if (mode === 'native' || (mode === 'auto' && !source)) {
        if (!isEyeDropperSupported()) {
          throw notSupported('The EyeDropper API is not available.')
        }
        setIsOpen(true)
        try {
          const { sRGBHex } = await openNative({ signal: openOptions.signal })
          return { sRGBHex, mode: 'native' }
        } finally {
          if (openId.current === id) setIsOpen(false)
        }
      }

      if (!source) throw notSupported('The loupe needs a source element.')
      openOptions.signal?.throwIfAborted()
      setIsOpen(true)
      // Before any await: `open()` runs in the click, a user gesture, so
      // audio may start here.
      const feedback = createLoupeFeedback(source.ownerDocument, loupe)
      feedback?.unlock()
      try {
        if ('naturalWidth' in source && !source.complete) {
          await source.decode()
        }
        if (openId.current !== id) {
          throw new DOMException('The loupe was closed.', 'AbortError')
        }
        const config = resolveMagnificationConfig(loupe)
        const s = startLoupeSession({
          source,
          buffer: readPixels(source),
          config,
          magnification: clampMagnification(
            loupe.magnification ?? config.defaultValue,
            config
          ),
          controlled: loupe.magnification !== undefined,
          onMagnificationChange: (value) =>
            latest.current.loupe?.onMagnificationChange?.(value),
          size: loupe.size ?? DEFAULT_LOUPE_SIZE,
          shape: loupe.shape ?? 'circle',
          grid: loupe.grid ?? true,
          sampleSize: loupe.sampleSize ?? 1,
          className: loupe.className,
          smoothing: loupe.smoothing,
          animate: loupe.animate,
          cursor: loupe.cursor,
          feedback,
          signal: openOptions.signal,
        })
        session.current = s
        try {
          return await s.result
        } finally {
          if (session.current === s) session.current = null
        }
      } finally {
        feedback?.destroy()
        if (openId.current === id) setIsOpen(false)
      }
    },
    [close, openNative]
  )

  const magnification = options.loupe?.magnification
  useEffect(() => {
    if (magnification !== undefined) {
      session.current?.setMagnification(magnification)
    }
  }, [magnification])

  useEffect(() => close, [close])

  return { open, close, isSupported, isOpen }
}
