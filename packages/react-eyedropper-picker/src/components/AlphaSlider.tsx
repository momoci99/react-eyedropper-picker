import { useCallback, type CSSProperties, type KeyboardEvent } from 'react'
import { usePointerDrag } from '../hooks/usePointerDrag'
import { hexToRgb, rgbaToHex } from '../utils/color'
import { ColorBubble } from './ColorBubble'

/** Gray and white squares that show through transparent colors. */
export const CHECKERBOARD =
  'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 8px 8px'

/** `color` (any CSS color) over the checkerboard, as a `background`. */
export const overCheckerboard = (color: string) =>
  `linear-gradient(${color}, ${color}), ${CHECKERBOARD}`

export type AlphaSliderProps = {
  /** The color to fade, `#rrggbb` (an alpha part is ignored). */
  color: string
  /** 0 (transparent) to 1 (opaque). */
  alpha: number
  onChange: (alpha: number) => void
  /**
   * While dragging by touch, show the color in a bubble above the finger,
   * which hides the handle. Default true. Mouse and pen never show it.
   */
  touchBubble?: boolean
  className?: string
  style?: CSSProperties
}

/** Opacity slider: transparent on the left, `color` on the right. */
export const AlphaSlider = ({
  color,
  alpha,
  onChange,
  touchBubble = true,
  className,
  style,
}: AlphaSliderProps) => {
  const { touching, handlers } = usePointerDrag<HTMLDivElement>(
    useCallback(({ x }) => onChange(x), [onChange])
  )
  const opaque = hexToRgb(color.slice(0, 7)) ?? { r: 0, g: 0, b: 0 }
  const rgb = rgbaToHex({ ...opaque, a: 1 }).slice(0, 7)
  const current = rgbaToHex({ ...opaque, a: alpha })
  const percent = Math.round(alpha * 100)

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01
    let next: number | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = alpha - step
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = alpha + step
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = 1
    if (next === null) return
    e.preventDefault()
    // Whole percents, so keys land on the steps they show.
    onChange(Math.min(1, Math.max(0, Math.round(next * 100) / 100)))
  }

  return (
    <div
      {...handlers}
      role="slider"
      tabIndex={0}
      aria-label="Opacity"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      onKeyDown={onKeyDown}
      className={className}
      style={{
        position: 'relative',
        height: 12,
        borderRadius: 6,
        cursor: 'pointer',
        touchAction: 'none',
        outlineOffset: 2,
        background: `linear-gradient(to right, ${rgb}00, ${rgb}), ${CHECKERBOARD}`,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${alpha * 100}%`,
          top: '50%',
          width: 16,
          height: 16,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '2px solid #fff',
          background: overCheckerboard(current),
          boxShadow: '0 0 0 1px rgba(0,0,0,.3)',
          pointerEvents: 'none',
        }}
      />
      {touchBubble && touching && (
        <ColorBubble
          color={overCheckerboard(current)}
          left={`${alpha * 100}%`}
          top="50%"
        />
      )}
    </div>
  )
}
