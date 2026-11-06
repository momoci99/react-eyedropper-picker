import { useCallback, type CSSProperties, type KeyboardEvent } from 'react'
import { usePointerDrag } from '../hooks/usePointerDrag'

export type HueSliderProps = {
  /** 0-360 */
  hue: number
  onChange: (hue: number) => void
  className?: string
  style?: CSSProperties
}

export const HueSlider = ({
  hue,
  onChange,
  className,
  style,
}: HueSliderProps) => {
  const drag = usePointerDrag<HTMLDivElement>(
    useCallback(({ x }) => onChange(x * 360), [onChange])
  )

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1
    let next: number | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = hue - step
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = hue + step
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = 360
    if (next === null) return
    e.preventDefault()
    onChange(Math.min(360, Math.max(0, next)))
  }

  return (
    <div
      {...drag}
      role="slider"
      tabIndex={0}
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      onKeyDown={onKeyDown}
      className={className}
      style={{
        position: 'relative',
        height: 12,
        borderRadius: 6,
        cursor: 'pointer',
        touchAction: 'none',
        outlineOffset: 2,
        background:
          'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${(hue / 360) * 100}%`,
          top: '50%',
          width: 16,
          height: 16,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '2px solid #fff',
          background: `hsl(${hue}, 100%, 50%)`,
          boxShadow: '0 0 0 1px rgba(0,0,0,.3)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
