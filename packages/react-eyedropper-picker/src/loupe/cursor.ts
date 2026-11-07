/** Eye dropper icon paths (Lucide "pipette", ISC), tip at (2, 22). */
const PATHS = [
  'm2 22 1-1h3l9-9',
  'M3 21v-3l9-9',
  'm15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z',
]

/** Black icon on a white outline, so it shows on any color. */
const svg = (): string => {
  const d = PATHS.map((p) => `<path d='${p}'/>`).join('')
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='-1 -1 26 26' fill='none' stroke-linecap='round' stroke-linejoin='round'>` +
    `<g stroke='white' stroke-width='4.5'>${d}</g>` +
    `<g stroke='black' stroke-width='2'>${d}</g></svg>`
  )
}

/**
 * Eye dropper icon as a CSS `cursor` value, its tip on the pointer. For
 * the loupe's `cursor` option, or any element's `style.cursor`. Falls back
 * to `crosshair`.
 */
export const eyeDropperCursor: string = /* @__PURE__ */ (() =>
  `url("data:image/svg+xml,${encodeURIComponent(svg())}") 3 23, crosshair`)()
