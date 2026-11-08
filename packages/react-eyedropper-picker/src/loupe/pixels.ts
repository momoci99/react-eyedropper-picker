/**
 * What the loupe can pick from. A `<video>` is picked from the frame showing
 * when the loupe opens; that frame covers the video until it closes.
 */
export type PickSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement

/** RGBA pixels at the source's own resolution, row-major, 4 bytes per pixel. */
export type PixelBuffer = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type SampleSize = 1 | 3 | 5

/** Channels are 0-255 integers. Alpha is 255 for opaque. */
export type RGBA = { r: number; g: number; b: number; a: number }

/** A `<video>`: picked from the frame showing when the loupe opens. */
export const isVideo = (source: PickSource): source is HTMLVideoElement =>
  'videoWidth' in source

/**
 * Intrinsic size: `naturalWidth` for images, `videoWidth` for videos, the
 * bitmap size for canvases.
 */
export const getSourceSize = (
  source: PickSource
): { width: number; height: number } =>
  'naturalWidth' in source
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : isVideo(source)
      ? { width: source.videoWidth, height: source.videoHeight }
      : { width: source.width, height: source.height }

/** `HTMLMediaElement.HAVE_CURRENT_DATA`: a frame can be drawn. */
const HAVE_CURRENT_DATA = 2

/**
 * Draws `source` once onto an offscreen canvas at its intrinsic size and
 * returns the pixels. Call it when the loupe opens and keep the result.
 * For a video, that is the current frame.
 *
 * Throws `InvalidStateError` if the source has no pixels yet (image not
 * loaded, 0x0 canvas, video without a frame). A cross-origin image or video
 * without CORS throws `SecurityError` from `getImageData`; that error is
 * passed through.
 */
export const readPixels = (source: PickSource): PixelBuffer => {
  const { width, height } = getSourceSize(source)
  if (
    width === 0 ||
    height === 0 ||
    (isVideo(source) && source.readyState < HAVE_CURRENT_DATA)
  ) {
    throw new DOMException('Source has no pixels yet', 'InvalidStateError')
  }
  const canvas = source.ownerDocument.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new DOMException('2D canvas is not available', 'NotSupportedError')
  }
  ctx.drawImage(source, 0, 0)
  const { data } = ctx.getImageData(0, 0, width, height)
  return { width, height, data }
}

/**
 * Averages the `size` x `size` block centered on (`x`, `y`).
 * Pixels outside the buffer are skipped, so edges average fewer pixels.
 * RGB is weighted by alpha, so transparent pixels don't pull the color
 * toward black. Returns null if (`x`, `y`) is outside the buffer.
 */
export const samplePixel = (
  buffer: PixelBuffer,
  x: number,
  y: number,
  size: SampleSize = 1
): RGBA | null => {
  const { width, height, data } = buffer
  if (x < 0 || y < 0 || x >= width || y >= height) return null

  if (size === 1) {
    const i = (y * width + x) * 4
    return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! }
  }

  const radius = (size - 1) / 2
  const x0 = Math.max(0, x - radius)
  const x1 = Math.min(width - 1, x + radius)
  const y0 = Math.max(0, y - radius)
  const y1 = Math.min(height - 1, y + radius)

  let r = 0
  let g = 0
  let b = 0
  let a = 0
  let count = 0
  for (let py = y0; py <= y1; py++) {
    let i = (py * width + x0) * 4
    for (let px = x0; px <= x1; px++, i += 4) {
      const alpha = data[i + 3]!
      r += data[i]! * alpha
      g += data[i + 1]! * alpha
      b += data[i + 2]! * alpha
      a += alpha
      count++
    }
  }

  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: Math.round(r / a),
    g: Math.round(g / a),
    b: Math.round(b / a),
    a: Math.round(a / count),
  }
}
