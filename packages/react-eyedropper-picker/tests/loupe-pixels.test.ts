import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getSourceSize,
  readPixels,
  samplePixel,
  type PixelBuffer,
} from '../src/loupe/pixels'

type Pixel = [r: number, g: number, b: number, a: number]

const makeBuffer = (
  width: number,
  height: number,
  pixel: (x: number, y: number) => Pixel
): PixelBuffer => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(pixel(x, y), (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

const makeVideo = (width: number, height: number, readyState = 2) =>
  Object.defineProperties(document.createElement('video'), {
    videoWidth: { value: width },
    videoHeight: { value: height },
    readyState: { value: readyState },
  })

const makeImage = (width: number, height: number) => {
  const img = document.createElement('img')
  Object.defineProperty(img, 'naturalWidth', { value: width })
  Object.defineProperty(img, 'naturalHeight', { value: height })
  return img
}

describe('samplePixel', () => {
  // Each pixel encodes its own position, so averages are easy to check.
  const grid = makeBuffer(5, 5, (x, y) => [x * 10, y * 10, 100, 255])

  it('reads a single pixel', () => {
    expect(samplePixel(grid, 3, 1)).toEqual({ r: 30, g: 10, b: 100, a: 255 })
    expect(samplePixel(grid, 3, 1, 1)).toEqual(samplePixel(grid, 3, 1))
  })

  it('averages a 3x3 and 5x5 block', () => {
    expect(samplePixel(grid, 2, 2, 3)).toEqual({ r: 20, g: 20, b: 100, a: 255 })
    expect(samplePixel(grid, 2, 2, 5)).toEqual({ r: 20, g: 20, b: 100, a: 255 })
    expect(samplePixel(grid, 1, 3, 3)).toEqual({ r: 10, g: 30, b: 100, a: 255 })
  })

  it('skips pixels outside the buffer at edges', () => {
    // 3x3 at (0, 0) covers only x, y in {0, 1}: 4 pixels.
    expect(samplePixel(grid, 0, 0, 3)).toEqual({ r: 5, g: 5, b: 100, a: 255 })
    // 5x5 at (4, 4) covers x, y in {2, 3, 4}: 9 pixels.
    expect(samplePixel(grid, 4, 4, 5)).toEqual({ r: 30, g: 30, b: 100, a: 255 })
  })

  it('weights color by alpha', () => {
    // Red everywhere except a transparent black center.
    const buf = makeBuffer(3, 3, (x, y) =>
      x === 1 && y === 1 ? [0, 0, 0, 0] : [255, 0, 0, 255]
    )
    expect(samplePixel(buf, 1, 1, 3)).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: Math.round((255 * 8) / 9),
    })
  })

  it('returns transparent black when every pixel is transparent', () => {
    const buf = makeBuffer(3, 3, () => [200, 100, 50, 0])
    expect(samplePixel(buf, 1, 1, 3)).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    expect(samplePixel(buf, 1, 1)).toEqual({ r: 200, g: 100, b: 50, a: 0 })
  })

  it('returns null outside the buffer', () => {
    expect(samplePixel(grid, -1, 0)).toBeNull()
    expect(samplePixel(grid, 0, -1)).toBeNull()
    expect(samplePixel(grid, 5, 0, 3)).toBeNull()
    expect(samplePixel(grid, 0, 5, 5)).toBeNull()
  })
})

describe('getSourceSize', () => {
  it('uses natural size for images and bitmap size for canvases', () => {
    expect(getSourceSize(makeImage(640, 480))).toEqual({
      width: 640,
      height: 480,
    })
    const canvas = document.createElement('canvas')
    canvas.width = 30
    canvas.height = 20
    expect(getSourceSize(canvas)).toEqual({ width: 30, height: 20 })
  })

  it('uses the frame size for videos', () => {
    expect(getSourceSize(makeVideo(1280, 720))).toEqual({
      width: 1280,
      height: 720,
    })
  })
})

describe('readPixels', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockContext = () => {
    const data = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8])
    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data })),
    }
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(function (this: HTMLCanvasElement) {
        return ctx as unknown as CanvasRenderingContext2D
      })
    return { ctx, data, getContext }
  }

  it('draws the source once at intrinsic size and returns its pixels', () => {
    const { ctx, data, getContext } = mockContext()
    const img = makeImage(2, 1)

    const buf = readPixels(img)

    expect(buf).toEqual({ width: 2, height: 1, data })
    expect(getContext).toHaveBeenCalledTimes(1)
    expect(getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true })
    const canvas = getContext.mock.contexts[0] as HTMLCanvasElement
    expect(canvas).not.toBe(img)
    expect([canvas.width, canvas.height]).toEqual([2, 1])
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0)
    expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 2, 1)
  })

  it('reads from a canvas source', () => {
    const { ctx } = mockContext()
    const source = document.createElement('canvas')
    source.width = 2
    source.height = 1

    expect(readPixels(source).width).toBe(2)
    expect(ctx.drawImage).toHaveBeenCalledWith(source, 0, 0)
  })

  it('throws InvalidStateError for an image that is not loaded', () => {
    const { getContext } = mockContext()
    expect(() => readPixels(makeImage(0, 0))).toThrow(
      expect.objectContaining({ name: 'InvalidStateError' })
    )
    expect(getContext).not.toHaveBeenCalled()
  })

  it('reads the current frame of a video', () => {
    const { ctx } = mockContext()
    const video = makeVideo(2, 1)
    expect(readPixels(video).width).toBe(2)
    expect(ctx.drawImage).toHaveBeenCalledWith(video, 0, 0)
  })

  it('throws InvalidStateError for a video without a frame', () => {
    const { getContext } = mockContext()
    // HAVE_METADATA: the size is known, no frame yet.
    expect(() => readPixels(makeVideo(2, 1, 1))).toThrow(
      expect.objectContaining({ name: 'InvalidStateError' })
    )
    expect(() => readPixels(makeVideo(0, 0, 0))).toThrow(
      expect.objectContaining({ name: 'InvalidStateError' })
    )
    expect(getContext).not.toHaveBeenCalled()
  })

  it('throws NotSupportedError when 2D canvas is missing', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(() => readPixels(makeImage(2, 2))).toThrow(
      expect.objectContaining({ name: 'NotSupportedError' })
    )
  })

  it('passes through SecurityError from a tainted canvas', () => {
    const { ctx } = mockContext()
    ctx.getImageData.mockImplementation(() => {
      throw new DOMException('tainted', 'SecurityError')
    })
    expect(() => readPixels(makeImage(2, 2))).toThrow(
      expect.objectContaining({ name: 'SecurityError' })
    )
  })
})
