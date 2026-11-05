import { describe, expect, it, vi } from 'vitest'
import { createLoupeRenderer, GRID_COLOR } from '../src/loupe/draw'
import type { PixelBuffer } from '../src/loupe/pixels'

type Rect = [x: number, y: number, w: number, h: number, style: string]

// jsdom has no 2D canvas, so record the calls the renderer makes.
const mockContext = () => {
  const canvas = { width: 0, height: 0 }
  const rects: Rect[] = []
  let put: ImageData | null = null
  const ctx = {
    canvas,
    fillStyle: '',
    createImageData: vi.fn(
      (w: number, h: number) =>
        ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }) as ImageData
    ),
    putImageData: vi.fn((image: ImageData) => {
      put = image
    }),
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push([x, y, w, h, ctx.fillStyle])
    },
  }
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    canvas,
    rects,
    createImageData: ctx.createImageData,
    /** Red channel of drawn canvas pixel (x, y). */
    red: (x: number, y: number) => put!.data[(y * put!.width + x) * 4]!,
    alpha: (x: number, y: number) => put!.data[(y * put!.width + x) * 4 + 3]!,
    clearRects: () => (rects.length = 0),
  }
}

/** Opaque buffer whose red channel is `x + y * width` (unique per pixel). */
const indexBuffer = (width: number, height: number): PixelBuffer => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = i
    data[i * 4 + 3] = 255
  }
  return { width, height, data }
}

describe('createLoupeRenderer', () => {
  it('sizes the canvas in device pixels', () => {
    const m = mockContext()
    createLoupeRenderer(m.ctx, indexBuffer(4, 4)).draw(
      { x: 1, y: 1 },
      { size: 30, magnification: 10, devicePixelRatio: 2 }
    )
    expect(m.canvas).toEqual({ width: 60, height: 60 })
  })

  it('puts the center pixel in the middle and neighbours around it', () => {
    const m = mockContext()
    // 30px at 10x: cells -1, 0, 1 at [0,10), [10,20), [20,30).
    createLoupeRenderer(m.ctx, indexBuffer(10, 10)).draw(
      { x: 5, y: 5 },
      { size: 30, magnification: 10 }
    )
    expect(m.red(15, 15)).toBe(55)
    expect(m.red(10, 10)).toBe(55)
    expect(m.red(19, 19)).toBe(55)
    expect(m.red(9, 15)).toBe(54)
    expect(m.red(20, 15)).toBe(56)
    expect(m.red(15, 0)).toBe(45)
    expect(m.red(15, 29)).toBe(65)
  })

  it('keeps cells tiling at fractional magnification', () => {
    const m = mockContext()
    createLoupeRenderer(m.ctx, indexBuffer(16, 1)).draw(
      { x: 8, y: 0 },
      { size: 20, magnification: 2.5, grid: false }
    )
    // Every canvas column maps to a source column, consecutive and
    // each 2 or 3 px wide.
    const row: number[] = []
    for (let x = 0; x < 20; x++) row.push(m.red(x, 9))
    const widths = new Map<number, number>()
    for (const v of row) widths.set(v, (widths.get(v) ?? 0) + 1)
    const cols = [...widths.keys()]
    for (let i = 1; i < cols.length; i++) {
      expect(cols[i]).toBe(cols[i - 1]! + 1)
    }
    const inner = [...widths.values()].slice(1, -1)
    for (const w of inner) expect([2, 3]).toContain(w)
    expect(row[10]).toBe(8)
  })

  it('draws pixels outside the source transparent', () => {
    const m = mockContext()
    createLoupeRenderer(m.ctx, indexBuffer(3, 3)).draw(
      { x: 0, y: 0 },
      { size: 30, magnification: 10 }
    )
    expect(m.alpha(5, 5)).toBe(0) // (-1, -1)
    expect(m.alpha(15, 5)).toBe(0) // (0, -1)
    expect(m.alpha(5, 15)).toBe(0) // (-1, 0)
    expect(m.alpha(15, 15)).toBe(255)
    expect(m.red(25, 25)).toBe(4) // (1, 1)
  })

  it('draws grid lines on cell edges', () => {
    const m = mockContext()
    createLoupeRenderer(m.ctx, indexBuffer(10, 10)).draw(
      { x: 5, y: 5 },
      { size: 30, magnification: 10 }
    )
    const grid = m.rects.filter((r) => r[4] === GRID_COLOR)
    expect(grid).toEqual([
      [10, 0, 1, 30, GRID_COLOR],
      [0, 10, 30, 1, GRID_COLOR],
      [20, 0, 1, 30, GRID_COLOR],
      [0, 20, 30, 1, GRID_COLOR],
    ])
  })

  it('hides the grid when off or below 4px per cell', () => {
    const buffer = indexBuffer(10, 10)
    const off = mockContext()
    createLoupeRenderer(off.ctx, buffer).draw(
      { x: 5, y: 5 },
      { size: 30, magnification: 10, grid: false }
    )
    const small = mockContext()
    createLoupeRenderer(small.ctx, buffer).draw(
      { x: 5, y: 5 },
      { size: 30, magnification: 3.9, devicePixelRatio: 3 }
    )
    for (const m of [off, small]) {
      expect(m.rects.some((r) => r[4] === GRID_COLOR)).toBe(false)
    }
  })

  it('frames the sampled block in black and white', () => {
    const m = mockContext()
    createLoupeRenderer(m.ctx, indexBuffer(10, 10)).draw(
      { x: 5, y: 5 },
      { size: 50, magnification: 10, grid: false, sampleSize: 3 }
    )
    // Cells -1..1 span [10, 40). White frame on it, black just outside.
    expect(m.rects).toContainEqual([10, 10, 30, 1, '#fff'])
    expect(m.rects).toContainEqual([10, 39, 30, 1, '#fff'])
    expect(m.rects).toContainEqual([9, 9, 32, 1, '#000'])
    expect(m.rects).toContainEqual([40, 10, 1, 30, '#000'])
  })

  it('reuses buffers until size or magnification changes', () => {
    const m = mockContext()
    const r = createLoupeRenderer(m.ctx, indexBuffer(10, 10))
    r.draw({ x: 5, y: 5 }, { size: 30, magnification: 10 })
    r.draw({ x: 6, y: 5 }, { size: 30, magnification: 10 })
    expect(m.createImageData).toHaveBeenCalledTimes(1)
    expect(m.red(15, 15)).toBe(56)

    r.draw({ x: 6, y: 5 }, { size: 30, magnification: 5 })
    expect(m.createImageData).toHaveBeenCalledTimes(1)
    expect(m.red(15, 15)).toBe(56)
    expect(m.red(10, 15)).toBe(55) // cells now 5px wide

    r.draw({ x: 6, y: 5 }, { size: 40, magnification: 5 })
    expect(m.createImageData).toHaveBeenCalledTimes(2)
  })

  it('works with a misaligned source view', () => {
    const backing = new Uint8ClampedArray(4 + 2 * 2 * 4)
    const data = backing.subarray(1, 1 + 16)
    data.set([10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255])
    const m = mockContext()
    createLoupeRenderer(m.ctx, { width: 2, height: 2, data }).draw(
      { x: 1, y: 1 },
      { size: 10, magnification: 10 }
    )
    expect(m.red(5, 5)).toBe(40)
  })
})
