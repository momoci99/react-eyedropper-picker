export type Point = { x: number; y: number }

/** The on-screen box the source is drawn into, e.g. from `getBoundingClientRect()`. */
export type DisplayRect = {
  left: number
  top: number
  width: number
  height: number
}

const outside = (r: DisplayRect, x: number, y: number) =>
  x < r.left || y < r.top || x >= r.left + r.width || y >= r.top + r.height

/**
 * Maps a client (viewport) point to integer source pixel coordinates.
 * `rect` is where the pixels are drawn (see `fitRect`). Returns null
 * outside `rect`, or outside `clip` (the visible box, for `object-fit:
 * cover`).
 */
export const clientToSourcePixel = (
  clientX: number,
  clientY: number,
  rect: DisplayRect,
  sourceWidth: number,
  sourceHeight: number,
  clip?: DisplayRect
): Point | null => {
  if (clip && outside(clip, clientX, clientY)) return null
  const dx = clientX - rect.left
  const dy = clientY - rect.top
  if (dx < 0 || dy < 0 || dx >= rect.width || dy >= rect.height) return null
  // min() guards against float rounding landing exactly on the far edge.
  return {
    x: Math.min(sourceWidth - 1, Math.floor((dx * sourceWidth) / rect.width)),
    y: Math.min(
      sourceHeight - 1,
      Math.floor((dy * sourceHeight) / rect.height)
    ),
  }
}

/** Clamps a source pixel into `[0, width - 1] x [0, height - 1]`. */
export const clampPixel = (
  x: number,
  y: number,
  width: number,
  height: number
): Point => ({
  x: Math.min(width - 1, Math.max(0, x)),
  y: Math.min(height - 1, Math.max(0, y)),
})

/**
 * Layout of magnified cells along one axis of the loupe canvas.
 *
 * Cell `k` is the source pixel at `center + k`. It spans
 * `[cellEdge(layout, k), cellEdge(layout, k + 1))` in canvas pixels.
 * Edges use `Math.round(k * m)`, so with fractional magnification cells
 * differ by at most 1px but always tile with no gaps, and grid lines drawn
 * on the edges always match the cells.
 */
export type CellLayout = {
  /** Canvas pixels per source pixel. */
  magnification: number
  /** Canvas position of cell 0's start edge (the center pixel). */
  origin: number
  /** First cell (<= 0) that is at least partly visible. */
  first: number
  /** Last cell (>= 0) that is at least partly visible. */
  last: number
}

export const cellEdge = (layout: CellLayout, k: number): number =>
  layout.origin + Math.round(k * layout.magnification)

/**
 * Computes which cells cover a canvas `size` pixels wide at `magnification`.
 * Work in device pixels (`size` and `magnification` both multiplied by
 * `devicePixelRatio`) so every edge lands on a whole device pixel.
 *
 * The center cell is placed in the middle. When `size` and the center
 * cell's width have different parity, it sits 0.5px left of exact center
 * (in canvas pixels), the closest an integer edge can get.
 */
export const computeCellLayout = (
  size: number,
  magnification: number
): CellLayout => {
  const m = magnification
  if (!(m > 0) || !Number.isFinite(m)) {
    throw new RangeError(`magnification must be a positive number, got ${m}`)
  }
  const origin = Math.floor((size - Math.round(m)) / 2)
  const layout: CellLayout = { magnification: m, origin, first: 0, last: 0 }

  // Estimate, then correct for rounding. Edges grow with k, so both
  // pairs of loops stop after a step or two.
  // first: cell that contains canvas x = 0.
  let first = Math.floor(-origin / m) - 1
  while (cellEdge(layout, first + 1) <= 0) first++
  while (cellEdge(layout, first) > 0) first--
  // last: cell that contains canvas x = size - 1.
  let last = Math.ceil((size - origin) / m)
  while (cellEdge(layout, last) >= size) last--
  while (cellEdge(layout, last + 1) < size) last++

  layout.first = Math.min(0, first)
  layout.last = Math.max(0, last)
  return layout
}

/** Below this many CSS pixels per cell, grid lines would hide the colors. */
export const MIN_GRID_CELL_SIZE = 4

/** Grid lines show only when enabled and each cell is at least 4 CSS px. */
export const isGridVisible = (magnification: number, grid = true): boolean =>
  grid && magnification >= MIN_GRID_CELL_SIZE

/** Client (viewport) point at the center of source pixel (`x`, `y`). */
export const sourcePixelToClient = (
  x: number,
  y: number,
  rect: DisplayRect,
  sourceWidth: number,
  sourceHeight: number
): Point => ({
  x: rect.left + ((x + 0.5) * rect.width) / sourceWidth,
  y: rect.top + ((y + 0.5) * rect.height) / sourceHeight,
})

/**
 * Loupe center above a finger or visible cursor at (`x`, `y`), its edge
 * `gap` px away so neither covers it. Below instead when the loupe would
 * leave the top of the viewport.
 */
export const loupeCenterAbove = (
  x: number,
  y: number,
  size: number,
  gap: number
): Point => {
  const above = y - gap - size / 2
  return { x, y: above - size / 2 >= 0 ? above : y + gap + size / 2 }
}

/** One axis of `object-position`: `fraction` of the free space plus `px`. */
type PositionAxis = { fraction: number; px: number }

const CENTER: PositionAxis = { fraction: 0.5, px: 0 }
const KEYWORD: Record<string, number> = {
  left: 0,
  top: 0,
  center: 0.5,
  right: 1,
  bottom: 1,
}

/** `50%`, `12px`, `calc(100% - 10px)` or a keyword; null otherwise. */
const axisValue = (token: string): PositionAxis | null => {
  const keyword = KEYWORD[token]
  if (keyword !== undefined) return { fraction: keyword, px: 0 }
  const calc = /^calc\((-?[\d.]+)% ([+-]) (-?[\d.]+)px\)$/.exec(token)
  if (calc) {
    const [, p = '', sign, n = ''] = calc
    return {
      fraction: parseFloat(p) / 100,
      px: (sign === '-' ? -1 : 1) * parseFloat(n),
    }
  }
  const n = parseFloat(token)
  if (Number.isNaN(n)) return null
  if (token.endsWith('%')) return { fraction: n / 100, px: 0 }
  if (token.endsWith('px') || n === 0) return { fraction: 0, px: n }
  return null
}

/**
 * Parses a computed `object-position` (`x y`, each `%`, `px` or
 * `calc(% ± px)`, which is how browsers report it) into x and y.
 * Anything else falls back to centered, the default.
 */
export const parseObjectPosition = (
  value: string
): [PositionAxis, PositionAxis] => {
  const tokens = value.match(/calc\([^)]*\)|\S+/g) ?? []
  const [a = 'center', b = 'center'] = tokens
  const x = axisValue(a)
  const y = axisValue(b)
  return tokens.length <= 2 && x && y ? [x, y] : [CENTER, CENTER]
}

const place = (free: number, axis: PositionAxis) =>
  free * axis.fraction + axis.px

/**
 * Where a `width` x `height` picture is drawn inside `box` (the element's
 * content box) for CSS `object-fit` and `object-position`. `fill` (the
 * default for images and canvases) stretches it to `box`; videos default
 * to `contain`, which letterboxes.
 */
export const fitRect = (
  box: DisplayRect,
  width: number,
  height: number,
  fit: string,
  position: string
): DisplayRect => {
  if (!width || !height || !box.width || !box.height) return box
  const contain = Math.min(box.width / width, box.height / height)
  const scale =
    fit === 'contain'
      ? contain
      : fit === 'cover'
        ? Math.max(box.width / width, box.height / height)
        : fit === 'none'
          ? 1
          : fit === 'scale-down'
            ? Math.min(1, contain)
            : 0
  if (!scale) return box
  const w = width * scale
  const h = height * scale
  const [x, y] = parseObjectPosition(position)
  return {
    left: box.left + place(box.width - w, x),
    top: box.top + place(box.height - h, y),
    width: w,
    height: h,
  }
}
