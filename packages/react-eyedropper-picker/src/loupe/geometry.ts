export type Point = { x: number; y: number }

/** The on-screen box the source is drawn into, e.g. from `getBoundingClientRect()`. */
export type DisplayRect = {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Maps a client (viewport) point to integer source pixel coordinates.
 * Assumes the source fills `rect` (no `object-fit` letterboxing).
 * Returns null if the point is outside `rect`.
 */
export const clientToSourcePixel = (
  clientX: number,
  clientY: number,
  rect: DisplayRect,
  sourceWidth: number,
  sourceHeight: number
): Point | null => {
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
