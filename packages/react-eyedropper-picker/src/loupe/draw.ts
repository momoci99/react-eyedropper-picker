import {
  cellEdge,
  computeCellLayout,
  isGridVisible,
  type Point,
} from './geometry'
import type { PixelBuffer, SampleSize } from './pixels'

export type LoupeDrawOptions = {
  /** Loupe width and height in CSS px. */
  size: number
  /** CSS px per source pixel. */
  magnification: number
  /** Default 1. */
  devicePixelRatio?: number
  /** Pixel grid lines. Default true. Hidden below 4 CSS px per cell. */
  grid?: boolean
  /** The center frame covers this many cells per side. Default 1. */
  sampleSize?: SampleSize
}

export type LoupeRenderer = {
  /** Draws the cells around source pixel `center` onto the canvas. */
  draw: (center: Point, options: LoupeDrawOptions) => void
}

export const GRID_COLOR = 'rgba(0, 0, 0, 0.2)'
const FRAME_OUTER = '#000'
const FRAME_INNER = '#fff'

/**
 * Creates a renderer that draws `buffer` magnified onto `ctx.canvas`.
 *
 * Cells are written straight into an `ImageData` at device resolution
 * using `computeCellLayout`, instead of scaling with `drawImage`. Browser
 * scaling at fractional magnification can put a cell edge 1px away from
 * where the grid line goes; this way they always match.
 *
 * The canvas is resized to `size * devicePixelRatio`. Size the element with
 * CSS. `putImageData` ignores clipping, so make it round with CSS
 * (`border-radius: 50%`), not a canvas clip path.
 *
 * Source pixels outside the buffer are drawn transparent. Keep one renderer
 * per open loupe: it reuses its buffers until size or magnification change.
 */
export const createLoupeRenderer = (
  ctx: CanvasRenderingContext2D,
  buffer: PixelBuffer
): LoupeRenderer => {
  const { width: srcWidth, height: srcHeight } = buffer
  const src = toUint32(buffer.data)

  // Cached per (canvas size, device magnification).
  let side = -1
  let deviceMagnification = -1
  let image: ImageData | null = null
  let out: Uint32Array | null = null
  // cellOf[i] = cell index (offset from center) covering canvas px i.
  let cellOf = new Int32Array(0)
  let layout = computeCellLayout(1, 1)

  const prepare = (nextSide: number, nextM: number) => {
    if (nextSide !== side) {
      side = nextSide
      ctx.canvas.width = side
      ctx.canvas.height = side
      image = ctx.createImageData(side, side)
      out = toUint32(image.data)
      cellOf = new Int32Array(side)
      deviceMagnification = -1
    }
    if (nextM !== deviceMagnification) {
      deviceMagnification = nextM
      layout = computeCellLayout(side, nextM)
      for (let k = layout.first; k <= layout.last; k++) {
        const start = Math.max(0, cellEdge(layout, k))
        const end = Math.min(side, cellEdge(layout, k + 1))
        cellOf.fill(k, start, end)
      }
    }
  }

  const draw = (center: Point, options: LoupeDrawOptions) => {
    const dpr = options.devicePixelRatio ?? 1
    prepare(
      Math.max(1, Math.round(options.size * dpr)),
      options.magnification * dpr
    )
    const pixels = out!
    const n = side
    const cx = center.x
    const cy = center.y

    for (let y = 0, row = 0; y < n; y++, row += n) {
      const sy = cy + cellOf[y]!
      if (sy < 0 || sy >= srcHeight) {
        pixels.fill(0, row, row + n)
        continue
      }
      const srcRow = sy * srcWidth
      for (let x = 0; x < n; x++) {
        const sx = cx + cellOf[x]!
        pixels[row + x] = sx >= 0 && sx < srcWidth ? src[srcRow + sx]! : 0
      }
    }
    ctx.putImageData(image!, 0, 0)

    const line = Math.max(1, Math.floor(dpr))
    if (isGridVisible(options.magnification, options.grid)) {
      ctx.fillStyle = GRID_COLOR
      for (let k = layout.first + 1; k <= layout.last; k++) {
        const e = cellEdge(layout, k)
        ctx.fillRect(e, 0, line, n)
        ctx.fillRect(0, e, n, line)
      }
    }

    // Two-tone frame around the sampled block, visible on any color.
    const r = ((options.sampleSize ?? 1) - 1) / 2
    const start = cellEdge(layout, -r)
    const extent = cellEdge(layout, r + 1) - start
    ctx.fillStyle = FRAME_OUTER
    frame(ctx, start - line, extent + 2 * line, line)
    ctx.fillStyle = FRAME_INNER
    frame(ctx, start, extent, line)
  }

  return { draw }
}

/** Square outline of thickness `t` whose outer box is (`p`, `p`, `s`, `s`). */
const frame = (
  ctx: CanvasRenderingContext2D,
  p: number,
  s: number,
  t: number
) => {
  ctx.fillRect(p, p, s, t)
  ctx.fillRect(p, p + s - t, s, t)
  ctx.fillRect(p, p + t, t, s - 2 * t)
  ctx.fillRect(p + s - t, p + t, t, s - 2 * t)
}

/**
 * One 32-bit word per RGBA pixel, so a copy is one assignment. Byte order
 * doesn't matter since both sides use the same layout. Copies only if the
 * view would be misaligned.
 */
const toUint32 = (data: Uint8ClampedArray): Uint32Array =>
  data.byteOffset % 4 === 0
    ? new Uint32Array(data.buffer, data.byteOffset, data.length >> 2)
    : new Uint32Array(data.slice().buffer)
