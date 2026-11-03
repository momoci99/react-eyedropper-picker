import { useCallback, useRef, type PointerEvent } from 'react'

/** Relative pointer position inside an element, each axis clamped to 0..1. */
export type DragPosition = { x: number; y: number }

export const usePointerDrag = <T extends HTMLElement>(
  onMove: (pos: DragPosition) => void
) => {
  const ref = useRef<T>(null)

  const emit = useCallback(
    (e: PointerEvent<T>) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const clamp = (n: number) => Math.min(1, Math.max(0, n))
      onMove({
        x: rect.width ? clamp((e.clientX - rect.left) / rect.width) : 0,
        y: rect.height ? clamp((e.clientY - rect.top) / rect.height) : 0,
      })
    },
    [onMove]
  )

  const onPointerDown = useCallback(
    (e: PointerEvent<T>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      e.currentTarget.focus()
      emit(e)
    },
    [emit]
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<T>) => {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) emit(e)
    },
    [emit]
  )

  return { ref, onPointerDown, onPointerMove }
}
