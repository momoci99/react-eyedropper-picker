import { useCallback, type CSSProperties, type KeyboardEvent } from 'react'
import { hsvToHex, type HSV } from '../utils/color'
import { usePointerDrag } from '../hooks/usePointerDrag'
import { ColorBubble } from './ColorBubble'

export type SaturationPanelProps = {
  hsv: HSV
  onChange: (hsv: HSV) => void
  /**
   * While dragging by touch, show the color in a bubble above the finger,
   * which hides the handle. Default true. Mouse and pen never show it.
   */
  touchBubble?: boolean
  className?: string
  style?: CSSProperties
}

const clamp = (n: number) => Math.min(100, Math.max(0, n))

export const SaturationPanel = ({
  hsv,
  onChange,
  touchBubble = true,
  className,
  style,
}: SaturationPanelProps) => {
  const { touching, handlers } = usePointerDrag<HTMLDivElement>(
    useCallback(
      ({ x, y }) => onChange({ h: hsv.h, s: x * 100, v: (1 - y) * 100 }),
      [hsv.h, onChange]
    )
  )

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const d = delta[e.key]
    if (!d) return
    e.preventDefault()
    onChange({ h: hsv.h, s: clamp(hsv.s + d[0]), v: clamp(hsv.v + d[1]) })
  }

  return (
    <div
      {...handlers}
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(hsv.s)}%, Brightness ${Math.round(hsv.v)}%`}
      onKeyDown={onKeyDown}
      className={className}
      style={{
        position: 'relative',
        height: 160,
        borderRadius: 6,
        cursor: 'crosshair',
        touchAction: 'none',
        outlineOffset: 2,
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${hsv.s}%`,
          top: `${100 - hsv.v}%`,
          width: 14,
          height: 14,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '2px solid #fff',
          boxShadow: '0 0 0 1px rgba(0,0,0,.3), inset 0 0 0 1px rgba(0,0,0,.3)',
          pointerEvents: 'none',
        }}
      />
      {touchBubble && touching && (
        <ColorBubble
          color={hsvToHex(hsv)}
          left={`${hsv.s}%`}
          top={`${100 - hsv.v}%`}
        />
      )}
    </div>
  )
}
