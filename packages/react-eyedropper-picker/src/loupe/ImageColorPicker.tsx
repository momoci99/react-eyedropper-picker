import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefCallback,
} from 'react'
import { createPortal } from 'react-dom'
import { attachLoupeHover, type LoupeHover } from './hover'
import { clampMagnification, resolveMagnificationConfig } from './magnification'
import { readPixels, type PixelBuffer } from './pixels'
import {
  startLoupeSession,
  type LoupePickResult,
  type LoupeSession,
} from './session'
import type { LoupeOptions } from './useLoupeEyeDropper'
import { DEFAULT_LOUPE_SIZE } from './view'

export type ImageColorPickerLoupeOptions = LoupeOptions & {
  /**
   * Rendered under the loupe instead of the hex label, with the color
   * under it. Re-renders when the pixel changes.
   */
  renderLabel?: (color: LoupePickResult) => ReactNode
}

export type ImageColorPickerProps = Omit<ComponentProps<'img'>, 'children'> & {
  /** Called on every pick. The picker stays ready for the next one. */
  onPick?: (result: LoupePickResult) => void
  /**
   * Reading the image failed, e.g. `SecurityError` for a cross-origin
   * image served without CORS (set `crossOrigin="anonymous"` and serve
   * `Access-Control-Allow-Origin`). Default: `console.error`.
   */
  onPickError?: (error: unknown) => void
  loupe?: ImageColorPickerLoupeOptions
}

const isAbortError = (e: unknown) =>
  e instanceof DOMException && e.name === 'AbortError'

/**
 * An `<img>` you pick colors from.
 *
 * - Mouse: hover to magnify, click to pick, wheel to zoom.
 * - Touch: press and drag on the image, lift to pick, pinch to zoom.
 * - Keyboard: focus the image, press Enter or Space, then arrows and Enter
 *   (the same full-screen loupe as `useLoupeEyeDropper`).
 *
 * Takes every `<img>` prop. Pixels are read on first use, at the image's
 * own resolution.
 */
export const ImageColorPicker = ({
  onPick,
  onPickError,
  loupe = {},
  ref,
  onLoad,
  style,
  ...imgProps
}: ImageColorPickerProps) => {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const pixels = useRef<{ src: string; buffer: PixelBuffer } | null>(null)
  const hover = useRef<LoupeHover | null>(null)
  const session = useRef<LoupeSession | null>(null)
  /** Uncontrolled magnification, shared by hover and keyboard loupe. */
  const zoom = useRef<number | null>(null)
  const [loads, setLoads] = useState(0)
  const [aim, setAim] = useState<{
    color: LoupePickResult
    container: HTMLElement
  } | null>(null)

  const {
    renderLabel,
    magnification,
    size = DEFAULT_LOUPE_SIZE,
    shape = 'circle',
    grid = true,
    sampleSize = 1,
    className,
    defaultMagnification,
    minMagnification,
    maxMagnification,
    magnificationSteps,
  } = loupe
  // A new steps array every render must not rebuild the loupe.
  const steps = magnificationSteps?.join(',')
  const config = useMemo(
    () =>
      resolveMagnificationConfig({
        defaultMagnification,
        minMagnification,
        maxMagnification,
        magnificationSteps: steps?.split(',').map(Number),
      }),
    [defaultMagnification, minMagnification, maxMagnification, steps]
  )
  const controlled = magnification !== undefined
  const hasLabel = renderLabel !== undefined
  const { src } = imgProps

  const setImg = useCallback<RefCallback<HTMLImageElement>>(
    (node) => {
      imgRef.current = node
      const cleanup = typeof ref === 'function' ? ref(node) : undefined
      if (ref && typeof ref !== 'function') ref.current = node
      return () => {
        imgRef.current = null
        if (typeof cleanup === 'function') cleanup()
        else if (typeof ref === 'function') ref(null)
        else if (ref) ref.current = null
      }
    },
    [ref]
  )

  const handlePick = useEffectEvent((result: LoupePickResult) =>
    onPick?.(result)
  )
  const handleError = useEffectEvent((error: unknown) => {
    if (onPickError) onPickError(error)
    else console.error(error)
  })
  const handleZoom = useEffectEvent((value: number) => {
    if (!controlled) {
      zoom.current = value
      hover.current?.setMagnification(value)
    }
    loupe.onMagnificationChange?.(value)
  })
  const handleAim = useEffectEvent(
    (color: LoupePickResult, container: HTMLElement) =>
      setAim({ color, container })
  )
  const startMagnification = useEffectEvent(() =>
    clampMagnification(
      magnification ?? zoom.current ?? config.defaultValue,
      config
    )
  )

  useEffect(() => {
    const source = imgRef.current
    if (!source) return
    // Portal target for `renderLabel`, moved between hover and overlay.
    const label = hasLabel
      ? source.ownerDocument.createElement('div')
      : undefined

    const getBuffer = (): PixelBuffer | null => {
      if (!source.complete || source.naturalWidth === 0) return null
      const key = source.currentSrc || source.src
      if (pixels.current?.src !== key) {
        pixels.current = { src: key, buffer: readPixels(source) }
      }
      return pixels.current.buffer
    }

    const shared = {
      source,
      config,
      controlled,
      onMagnificationChange: (value: number) => handleZoom(value),
      size,
      shape,
      grid,
      sampleSize,
      className,
      label,
      onAim: label
        ? (color: LoupePickResult) => handleAim(color, label)
        : undefined,
    }

    const h = attachLoupeHover({
      ...shared,
      getBuffer,
      magnification: startMagnification(),
      onPick: (result) => handlePick(result),
      onError: (error) => handleError(error),
    })
    hover.current = h

    // Keyboard: open the full-screen loupe, same as useLoupeEyeDropper.
    const keys = new AbortController()
    source.addEventListener(
      'keydown',
      (e) => {
        if ((e.key !== 'Enter' && e.key !== ' ') || session.current) return
        e.preventDefault()
        let buffer: PixelBuffer | null
        try {
          buffer = getBuffer()
        } catch (error) {
          return handleError(error)
        }
        if (!buffer) return
        h.hide()
        const s = startLoupeSession({
          ...shared,
          buffer,
          magnification: startMagnification(),
        })
        session.current = s
        s.result
          .then(
            (result) => handlePick(result),
            (error) => {
              if (!isAbortError(error)) handleError(error)
            }
          )
          .finally(() => {
            if (session.current === s) session.current = null
          })
      },
      { signal: keys.signal }
    )

    return () => {
      keys.abort()
      h.destroy()
      hover.current = null
      session.current?.cancel()
      session.current = null
    }
  }, [
    config,
    controlled,
    size,
    shape,
    grid,
    sampleSize,
    className,
    hasLabel,
    src,
    loads,
  ])

  useEffect(() => {
    if (magnification === undefined) return
    hover.current?.setMagnification(magnification)
    session.current?.setMagnification(magnification)
  }, [magnification])

  return (
    <>
      <img
        role="button"
        tabIndex={0}
        draggable={false}
        aria-label={
          imgProps.alt
            ? `Pick a color from ${imgProps.alt}`
            : 'Pick a color from the image'
        }
        {...imgProps}
        ref={setImg}
        onLoad={(e) => {
          setLoads((n) => n + 1)
          onLoad?.(e)
        }}
        style={{
          cursor: 'crosshair',
          touchAction: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          ...style,
        }}
      />
      {aim &&
        renderLabel &&
        createPortal(renderLabel(aim.color), aim.container)}
    </>
  )
}
