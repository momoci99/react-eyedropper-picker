import { describe, expect, it } from 'vitest'
import {
  cellEdge,
  clampPixel,
  clientToSourcePixel,
  computeCellLayout,
  isGridVisible,
  sourcePixelToClient,
  loupeCenterAbove,
} from '../src/loupe/geometry'

describe('clientToSourcePixel', () => {
  // 100x50 source shown at 2x, offset by (10, 20).
  const rect = { left: 10, top: 20, width: 200, height: 100 }
  const map = (x: number, y: number) => clientToSourcePixel(x, y, rect, 100, 50)

  it('scales client points to source pixels', () => {
    expect(map(10, 20)).toEqual({ x: 0, y: 0 })
    expect(map(11.9, 21.9)).toEqual({ x: 0, y: 0 })
    expect(map(12, 22)).toEqual({ x: 1, y: 1 })
    expect(map(110, 70)).toEqual({ x: 50, y: 25 })
    expect(map(209.99, 119.99)).toEqual({ x: 99, y: 49 })
  })

  it('handles a source shown smaller than its size', () => {
    const small = { left: 0, top: 0, width: 10, height: 10 }
    expect(clientToSourcePixel(5, 9.5, small, 1000, 1000)).toEqual({
      x: 500,
      y: 950,
    })
  })

  it('returns null outside the rect', () => {
    expect(map(9.99, 50)).toBeNull()
    expect(map(50, 19.99)).toBeNull()
    expect(map(210, 50)).toBeNull()
    expect(map(50, 120)).toBeNull()
  })

  it('returns null for an empty rect', () => {
    const empty = { left: 0, top: 0, width: 0, height: 0 }
    expect(clientToSourcePixel(0, 0, empty, 10, 10)).toBeNull()
  })
})

describe('clampPixel', () => {
  it('keeps pixels inside the source', () => {
    expect(clampPixel(-3, 4, 10, 5)).toEqual({ x: 0, y: 4 })
    expect(clampPixel(12, -1, 10, 5)).toEqual({ x: 9, y: 0 })
    expect(clampPixel(5, 9, 10, 5)).toEqual({ x: 5, y: 4 })
  })
})

describe('computeCellLayout', () => {
  const sizes = [1, 2, 119, 120, 121, 240, 360]
  const magnifications = [
    0.5, 1, 1.1, 1.5, 2, 2.5, 3.3, 7.77, 8, 12.5, 13, 64, 100, 200,
  ]
  const cases = sizes.flatMap((size) =>
    magnifications.map((m) => [size, m] as const)
  )

  it.each(cases)('size %d at %dx: center cell is centered', (size, m) => {
    const layout = computeCellLayout(size, m)
    const start = cellEdge(layout, 0)
    const end = cellEdge(layout, 1)
    expect(end - start).toBe(Math.round(m))
    const leftGap = start
    const rightGap = size - end
    expect(rightGap - leftGap).toBeGreaterThanOrEqual(0)
    expect(rightGap - leftGap).toBeLessThanOrEqual(1)
    expect(Number.isInteger(start)).toBe(true)
  })

  it.each(cases)(
    'size %d at %dx: visible cells cover the canvas',
    (size, m) => {
      const layout = computeCellLayout(size, m)
      expect(layout.first).toBeLessThanOrEqual(0)
      expect(layout.last).toBeGreaterThanOrEqual(0)
      expect(cellEdge(layout, layout.first)).toBeLessThanOrEqual(0)
      expect(cellEdge(layout, layout.last + 1)).toBeGreaterThanOrEqual(size)
      // No extra cells fully outside the canvas, except the center cell
      // which is always kept.
      if (layout.first < 0)
        expect(cellEdge(layout, layout.first + 1)).toBeGreaterThan(0)
      if (layout.last > 0)
        expect(cellEdge(layout, layout.last)).toBeLessThan(size)
    }
  )

  it.each(cases)(
    'size %d at %dx: cells tile with widths floor(m) or ceil(m)',
    (size, m) => {
      const layout = computeCellLayout(size, m)
      for (let k = layout.first; k <= layout.last; k++) {
        const width = cellEdge(layout, k + 1) - cellEdge(layout, k)
        expect([Math.floor(m), Math.ceil(m)]).toContain(width)
      }
    }
  )

  it('shows few source pixels at high magnification', () => {
    // 120px loupe at 64x: about 2 pixels across.
    expect(computeCellLayout(120, 64)).toMatchObject({
      origin: 28,
      first: -1,
      last: 1,
    })
  })

  it('shows one cell per canvas pixel at 1x', () => {
    expect(computeCellLayout(120, 1)).toMatchObject({
      origin: 59,
      first: -59,
      last: 60,
    })
    expect(computeCellLayout(121, 1)).toMatchObject({
      origin: 60,
      first: -60,
      last: 60,
    })
  })

  it('works in device pixels', () => {
    // 120 CSS px at 12.5x on a 2x display.
    const layout = computeCellLayout(240, 25)
    expect(layout).toMatchObject({ origin: 107, first: -5, last: 5 })
  })

  it('rejects non-positive magnification', () => {
    expect(() => computeCellLayout(120, 0)).toThrow(RangeError)
    expect(() => computeCellLayout(120, -2)).toThrow(RangeError)
    expect(() => computeCellLayout(120, Number.NaN)).toThrow(RangeError)
    expect(() => computeCellLayout(120, Infinity)).toThrow(RangeError)
  })
})

describe('isGridVisible', () => {
  it('hides the grid below 4 CSS px per cell', () => {
    expect(isGridVisible(3.99)).toBe(false)
    expect(isGridVisible(4)).toBe(true)
    expect(isGridVisible(64)).toBe(true)
    expect(isGridVisible(64, false)).toBe(false)
  })
})

describe('sourcePixelToClient', () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 }

  it('returns the pixel center on screen', () => {
    expect(sourcePixelToClient(0, 0, rect, 100, 50)).toEqual({ x: 11, y: 21 })
    expect(sourcePixelToClient(99, 49, rect, 100, 50)).toEqual({
      x: 209,
      y: 119,
    })
  })

  it('round-trips with clientToSourcePixel', () => {
    for (const [x, y] of [
      [0, 0],
      [37, 12],
      [99, 49],
    ] as const) {
      const p = sourcePixelToClient(x, y, rect, 100, 50)
      expect(clientToSourcePixel(p.x, p.y, rect, 100, 50)).toEqual({ x, y })
    }
  })
})

describe('loupeCenterAbove', () => {
  it('puts the loupe above the finger', () => {
    // Bottom edge at 300 - 48 = 252.
    expect(loupeCenterAbove(100, 300, 120, 48)).toEqual({ x: 100, y: 192 })
  })

  it('flips below when there is no room at the top', () => {
    expect(loupeCenterAbove(100, 168, 120, 48)).toEqual({ x: 100, y: 60 })
    expect(loupeCenterAbove(100, 167, 120, 48)).toEqual({ x: 100, y: 275 })
  })
})
