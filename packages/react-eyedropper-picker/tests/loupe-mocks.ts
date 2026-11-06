import { vi } from 'vitest'
import type { PixelBuffer } from '../src/loupe/pixels'
import { rgbToHex } from '../src/utils/color'

/** Opaque buffer where pixel (x, y) is rgb(x * 10, y * 10, 0). */
export const gridBuffer = (width: number, height: number): PixelBuffer => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = x * 10
      data[i + 1] = y * 10
      data[i + 3] = 255
    }
  }
  return { width, height, data }
}

export const gridHex = (x: number, y: number) =>
  rgbToHex({ r: x * 10, g: y * 10, b: 0 })

/**
 * jsdom has no 2D canvas. Every `getContext('2d')` returns a stub that
 * draws nothing; `getImageData` returns `pixels` (for `readPixels`).
 */
export const mockCanvas = (pixels?: PixelBuffer) =>
  vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(function (this: HTMLCanvasElement) {
      return {
        canvas: this,
        fillStyle: '',
        drawImage: () => {},
        getImageData: () => ({ data: pixels?.data }),
        createImageData: (w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: () => {},
        fillRect: () => {},
      } as never
    })

/** Collects `requestAnimationFrame` callbacks; `flush()` runs them. */
export const mockFrames = () => {
  let queue: FrameRequestCallback[] = []
  const win = document.defaultView!
  vi.spyOn(win, 'requestAnimationFrame').mockImplementation((cb) => {
    queue.push(cb)
    return queue.length
  })
  vi.spyOn(win, 'cancelAnimationFrame').mockImplementation(() => {})
  return {
    flush: () => {
      const run = queue
      queue = []
      for (const cb of run) cb(0)
    },
  }
}

/** A 10x10 `<canvas>` source shown at `width` x `height` CSS px from (0, 0). */
export const mockSource = (width = 100, height = 100) => {
  const source = document.createElement('canvas')
  source.width = 10
  source.height = 10
  vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  document.body.append(source)
  return source
}

export const getOverlay = () =>
  document.querySelector<HTMLElement>('[role="dialog"]')

export const pointer = (type: string, clientX: number, clientY: number) =>
  getOverlay()!.dispatchEvent(
    new PointerEvent(type, { clientX, clientY, bubbles: true })
  )

export const click = (clientX: number, clientY: number) =>
  getOverlay()!.dispatchEvent(
    new MouseEvent('click', { clientX, clientY, bubbles: true })
  )

export const key = (k: string, init: KeyboardEventInit = {}) =>
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: k,
      bubbles: true,
      cancelable: true,
      ...init,
    })
  )

export const wheel = (deltaY: number) =>
  getOverlay()!.dispatchEvent(
    new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
  )

export const touch = (
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  pointerId: number,
  clientX: number,
  clientY: number
) =>
  getOverlay()!.dispatchEvent(
    new PointerEvent(type, {
      pointerType: 'touch',
      pointerId,
      clientX,
      clientY,
      bubbles: true,
    })
  )
