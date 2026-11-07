/** Bubble diameter in px. */
const SIZE = 44
/** Gap between the bubble's tip and the point, so the fingertip clears it. */
const LIFT = 24
/** Center to tip of the rotated teardrop: half the square's diagonal. */
const TIP = (SIZE / 2) * Math.SQRT2

type ColorBubbleProps = {
  color: string
  /** CSS `left` / `top` of the point it marks, inside a positioned parent. */
  left: string
  top: string
}

/**
 * Teardrop with the current color, above the point under a finger. The
 * thumb hides the handle while dragging by touch; this shows what's under it.
 */
export const ColorBubble = ({ color, left, top }: ColorBubbleProps) => (
  <div
    aria-hidden="true"
    style={{
      position: 'absolute',
      left,
      top,
      zIndex: 1,
      pointerEvents: 'none',
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: -SIZE / 2,
        top: -(LIFT + TIP + SIZE / 2),
        width: SIZE,
        height: SIZE,
        boxSizing: 'border-box',
        // Square with one sharp corner, turned so that corner points down.
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        border: '3px solid #fff',
        background: color,
        boxShadow: '0 2px 10px rgba(0,0,0,.35)',
      }}
    />
  </div>
)
