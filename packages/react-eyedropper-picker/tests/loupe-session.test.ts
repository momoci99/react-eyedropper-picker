import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveMagnificationConfig } from '../src/loupe/magnification'
import {
  startLoupeSession,
  type LoupeSession,
  type LoupeSessionOptions,
} from '../src/loupe/session'
import {
  click,
  fakeFeedback,
  getOverlay,
  gridBuffer,
  gridHex,
  key,
  mockCanvas,
  mockFrames,
  mockSource,
  pointer,
  touch,
  wheel,
  loupeLabel,
  mockVideo,
  mockAnimate,
  mockNow,
  mockReducedMotion,
  resetAnimate,
  resetReducedMotion,
} from './loupe-mocks'

let frames: ReturnType<typeof mockFrames>
let sessions: LoupeSession[] = []

beforeEach(() => {
  mockCanvas()
  frames = mockFrames()
})

afterEach(() => {
  for (const s of sessions) {
    s.result.catch(() => {})
    s.cancel()
  }
  sessions = []
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const start = (overrides: Partial<LoupeSessionOptions> = {}) => {
  const s = startLoupeSession({
    source: mockSource(),
    buffer: gridBuffer(10, 10),
    config: resolveMagnificationConfig(),
    magnification: 8,
    size: 120,
    shape: 'circle',
    grid: true,
    sampleSize: 1,
    ...overrides,
  })
  sessions.push(s)
  return s
}

const loupeElement = () => getOverlay()!.firstElementChild as HTMLElement
const labelText = () => loupeLabel(loupeElement()).textContent

describe('startLoupeSession', () => {
  it('opens a focused overlay', () => {
    start()
    const overlay = getOverlay()
    expect(overlay).toBeInTheDocument()
    expect(document.activeElement).toBe(overlay)
  })

  it('starts at the source center', () => {
    start()
    frames.flush()
    expect(loupeElement().style.display).toBe('block')
    // Pixel (5, 5) centers at client (55, 55); loupe is 120px wide.
    expect(loupeElement().style.transform).toBe('translate(-5px, -5px)')
    expect(labelText()).toBe(gridHex(5, 5))
  })

  it('follows the pointer and draws once per frame', () => {
    start()
    frames.flush()
    pointer('pointermove', 31, 42)
    pointer('pointermove', 35, 45)
    frames.flush()
    expect(loupeElement().style.transform).toBe('translate(-25px, -15px)')
    expect(labelText()).toBe(gridHex(3, 4))
  })

  it('hides the cursor over the source, or shows the cursor option', () => {
    start()
    frames.flush()
    expect(getOverlay()!.style.cursor).toBe('none')
    const first = sessions.pop()!
    first.result.catch(() => {})
    first.cancel()
    start({ cursor: 'copy' })
    frames.flush()
    expect(getOverlay()!.style.cursor).toBe('copy')
    pointer('pointermove', 150, 50)
    frames.flush()
    expect(getOverlay()!.style.cursor).toBe('default')
  })

  it('moves the loupe above a visible cursor', () => {
    start({ cursor: 'copy' })
    frames.flush()
    pointer('pointermove', 35, 45)
    frames.flush()
    expect(loupeElement().style.transform).toBe('translate(-25px, 97px)')
    expect(labelText()).toBe(gridHex(3, 4))
  })

  it('picks through object-fit letterboxing', () => {
    // 10x5 frame, contain in 100x100: drawn at y 25..75, bars above and below.
    start({ source: mockVideo(10, 5), buffer: gridBuffer(10, 5) })
    frames.flush()
    pointer('pointermove', 35, 20)
    frames.flush()
    expect(loupeElement().style.display).toBe('none')
    pointer('pointermove', 35, 45)
    frames.flush()
    expect(loupeElement().style.display).toBe('block')
    expect(labelText()).toBe(gridHex(3, 2))
  })

  it('freeze: covers the source with the read pixels while open', () => {
    const putImageData = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement) {
        return {
          canvas: this,
          createImageData: (w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4),
          }),
          putImageData,
          drawImage: () => {},
          fillRect: () => {},
        } as never
      }
    )
    const video = mockVideo(10, 5)
    const s = start({ source: video, buffer: gridBuffer(10, 5), freeze: true })
    const frozen = getOverlay()!.firstElementChild as HTMLElement
    const canvas = frozen.querySelector('canvas')!
    expect(frozen.getAttribute('aria-hidden')).toBe('true')
    expect(frozen.style.pointerEvents).toBe('none')
    expect([canvas.width, canvas.height]).toEqual([10, 5])
    expect(putImageData).toHaveBeenCalled()
    // Box 100x100; the frame letterboxed inside it.
    expect(frozen.style.width).toBe('100px')
    expect(canvas.style.top).toBe('25px')
    expect(canvas.style.height).toBe('50px')

    // Follows layout changes.
    vi.mocked(video.getBoundingClientRect).mockReturnValue({
      left: 20,
      top: 0,
      width: 200,
      height: 100,
    } as DOMRect)
    window.dispatchEvent(new Event('resize'))
    expect(frozen.style.left).toBe('20px')
    expect(canvas.style.left).toBe('0px')
    expect(canvas.style.width).toBe('200px')

    s.result.catch(() => {})
    s.cancel()
    expect(frozen.isConnected).toBe(false)
  })

  it('freeze: fades the frame out on close, under the loupe', () => {
    const animations = mockAnimate()
    try {
      const s = start({
        source: mockVideo(10, 5),
        buffer: gridBuffer(10, 5),
        freeze: true,
      })
      const frozen = getOverlay()!.firstElementChild as HTMLElement
      s.result.catch(() => {})
      s.cancel()
      expect(getOverlay()).toBeNull()
      expect(frozen.parentElement).toBe(document.body)
      // Under the shrinking loupe.
      expect(frozen.nextElementSibling).not.toBeNull()
      const fade = animations.find((a) => a.keyframes[0]?.opacity === 1)!
      expect(fade.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }])
      fade.finish()
      expect(frozen.isConnected).toBe(false)
    } finally {
      resetAnimate()
    }
  })

  it('freeze: no fade with animate off or reduced motion', () => {
    mockAnimate()
    try {
      for (const options of [{ animate: false }, {}]) {
        if (!('animate' in options)) mockReducedMotion(true)
        const s = start({
          source: mockVideo(10, 5),
          buffer: gridBuffer(10, 5),
          freeze: true,
          ...options,
        })
        const frozen = getOverlay()!.firstElementChild as HTMLElement
        s.result.catch(() => {})
        s.cancel()
        expect(frozen.isConnected).toBe(false)
      }
    } finally {
      resetAnimate()
      resetReducedMotion()
    }
  })

  it('does not freeze by default', () => {
    start()
    expect(
      getOverlay()!.querySelector('[aria-hidden="true"] canvas')
    ).toBeNull()
  })

  it('hides the loupe outside the source', () => {
    start()
    pointer('pointermove', 150, 50)
    frames.flush()
    expect(loupeElement().style.display).toBe('none')
    expect(getOverlay()!.style.cursor).toBe('default')
  })

  it('confirms the clicked pixel', async () => {
    const s = start()
    click(35, 45)
    await expect(s.result).resolves.toEqual({
      sRGBHex: gridHex(3, 4),
      x: 3,
      y: 4,
      mode: 'loupe',
    })
    expect(getOverlay()).toBeNull()
  })

  it('confirms the pixel the loupe shows, not a neighbour under the click', async () => {
    const s = start()
    pointer('pointermove', 39.9, 45)
    // Click coordinates can round into the next source pixel.
    click(40, 45)
    await expect(s.result).resolves.toMatchObject({ x: 3, y: 4 })
  })

  it('confirms the pixel moved to with keys on click', async () => {
    const s = start()
    pointer('pointermove', 35, 45)
    key('ArrowRight')
    click(35, 45)
    await expect(s.result).resolves.toMatchObject({ x: 4, y: 4 })
  })

  it('averages with sampleSize', async () => {
    const s = start({ sampleSize: 3 })
    click(55, 55)
    // 3x3 around (5, 5) averages to (5, 5) on a linear gradient.
    await expect(s.result).resolves.toMatchObject({ sRGBHex: gridHex(5, 5) })
  })

  it('cancels on a click outside the source', async () => {
    const s = start()
    click(150, 50)
    await expect(s.result).rejects.toMatchObject({ name: 'AbortError' })
    expect(getOverlay()).toBeNull()
  })

  it('cancels on Escape and restores focus', async () => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    const s = start()
    key('Escape')
    await expect(s.result).rejects.toMatchObject({ name: 'AbortError' })
    expect(getOverlay()).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('moves with arrow keys and confirms with Enter', async () => {
    const s = start()
    key('ArrowRight')
    key('ArrowDown', { shiftKey: true }) // 5 + 10, clamped to 9
    key('ArrowLeft')
    key('ArrowUp')
    frames.flush()
    expect(labelText()).toBe(gridHex(5, 8))
    key('Enter')
    await expect(s.result).resolves.toMatchObject({ x: 5, y: 8 })
  })

  it('keeps handled keys from the page', () => {
    const pageKeys = vi.fn()
    window.addEventListener('keydown', pageKeys)
    start()
    key('ArrowRight')
    key('+')
    key('Tab')
    key('a')
    expect(pageKeys.mock.calls.map(([e]) => e.key)).toEqual(['a'])
    window.removeEventListener('keydown', pageKeys)
  })

  it('zooms with the wheel and shows the badge', () => {
    const onChange = vi.fn()
    start({ onMagnificationChange: onChange })
    expect(wheel(-100)).toBe(false) // preventDefault called
    wheel(-100)
    expect(onChange.mock.calls).toEqual([[8.8], [9.68]])
    expect(labelText()).toContain('9.7×')
  })

  it('hides the badge after a second', () => {
    vi.useFakeTimers()
    try {
      start()
      wheel(-100)
      const badge = loupeLabel(loupeElement()).lastElementChild!
      expect((badge as HTMLElement).hidden).toBe(false)
      vi.advanceTimersByTime(1000)
      expect((badge as HTMLElement).hidden).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('adds up trackpad deltas with steps', () => {
    const onChange = vi.fn()
    start({
      config: resolveMagnificationConfig({ magnificationSteps: [4, 8, 16] }),
      onMagnificationChange: onChange,
    })
    wheel(-40)
    wheel(-40)
    expect(onChange).not.toHaveBeenCalled()
    wheel(-40)
    expect(onChange).toHaveBeenCalledWith(16)
  })

  it('zooms with + - 0 keys', () => {
    const onChange = vi.fn()
    start({
      config: resolveMagnificationConfig({ magnificationSteps: [4, 8, 16] }),
      onMagnificationChange: onChange,
    })
    key('+')
    key('+') // already at the last step: no change
    key('-')
    key('-')
    key('0')
    expect(onChange.mock.calls).toEqual([[16], [8], [4], [8]])
  })

  it('in controlled mode waits for setMagnification', () => {
    const onChange = vi.fn()
    const s = start({ controlled: true, onMagnificationChange: onChange })
    wheel(-100)
    wheel(-100)
    expect(onChange.mock.calls).toEqual([[8.8], [8.8]])
    s.setMagnification(16)
    expect(labelText()).toContain('16×')
    wheel(-100)
    expect(onChange).toHaveBeenLastCalledWith(17.6)
  })

  it('cancels when the signal aborts', async () => {
    const controller = new AbortController()
    const s = start({ signal: controller.signal })
    controller.abort()
    await expect(s.result).rejects.toMatchObject({ name: 'AbortError' })
    expect(getOverlay()).toBeNull()
  })

  it('rejects at once for an aborted signal', async () => {
    const s = start({ signal: AbortSignal.abort() })
    await expect(s.result).rejects.toMatchObject({ name: 'AbortError' })
    expect(getOverlay()).toBeNull()
  })

  it('cancel() closes and ignores later input', async () => {
    const onChange = vi.fn()
    const s = start({ onMagnificationChange: onChange })
    const overlay = getOverlay()!
    s.cancel()
    await expect(s.result).rejects.toMatchObject({ name: 'AbortError' })
    overlay.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }))
    expect(onChange).not.toHaveBeenCalled()
  })

  describe('touch', () => {
    it('shows the loupe above the finger', () => {
      start({ source: mockSource(100, 400) })
      touch('pointerdown', 1, 35, 300)
      frames.flush()
      // Center 48 + 60 px above the finger; translate is center - 60.
      expect(loupeElement().style.transform).toBe('translate(-25px, 132px)')
    })

    it('flips the loupe below the finger near the top', () => {
      start()
      touch('pointerdown', 1, 35, 45)
      frames.flush()
      expect(loupeElement().style.transform).toBe('translate(-25px, 93px)')
    })

    it('confirms the pixel under the finger on lift', async () => {
      const s = start()
      touch('pointerdown', 1, 15, 15)
      touch('pointermove', 1, 35, 45)
      frames.flush()
      expect(labelText()).toBe(gridHex(3, 4))
      touch('pointerup', 1, 35, 45)
      await expect(s.result).resolves.toMatchObject({ x: 3, y: 4 })
    })

    it('cancels on a tap outside the source', async () => {
      const s = start()
      touch('pointerdown', 1, 150, 50)
      touch('pointerup', 1, 150, 50)
      await expect(s.result).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('stays open when a drag ends outside the source', () => {
      start()
      touch('pointerdown', 1, 50, 50)
      touch('pointermove', 1, 150, 50)
      touch('pointerup', 1, 150, 50)
      expect(getOverlay()).toBeInTheDocument()
    })

    it('does not confirm on pointercancel', () => {
      start()
      touch('pointerdown', 1, 50, 50)
      touch('pointercancel', 1, 50, 50)
      expect(getOverlay()).toBeInTheDocument()
    })

    it('ignores the click a browser sends after a touch', () => {
      start()
      touch('pointerdown', 1, 50, 50)
      touch('pointermove', 1, 150, 50)
      touch('pointerup', 1, 150, 50)
      getOverlay()!.dispatchEvent(
        new PointerEvent('click', {
          pointerType: 'touch',
          clientX: 150,
          clientY: 50,
          bubbles: true,
        })
      )
      expect(getOverlay()).toBeInTheDocument()
    })

    it('pinches to zoom and does not confirm after a pinch', async () => {
      const onChange = vi.fn()
      const s = start({ onMagnificationChange: onChange })
      touch('pointerdown', 1, 40, 50)
      touch('pointerdown', 2, 60, 50) // 20px apart
      touch('pointermove', 2, 80, 50) // 40px: 2x
      expect(onChange).toHaveBeenLastCalledWith(16)
      touch('pointermove', 2, 50, 50) // 10px: 0.5x of the start
      expect(onChange).toHaveBeenLastCalledWith(4)
      touch('pointerup', 2, 50, 50)
      touch('pointerup', 1, 40, 50)
      expect(getOverlay()).toBeInTheDocument()

      // The next one-finger gesture confirms again.
      touch('pointerdown', 3, 35, 45)
      touch('pointerup', 3, 35, 45)
      await expect(s.result).resolves.toMatchObject({ x: 3, y: 4 })
    })

    it('keeps the pinch continuous with steps', () => {
      const onChange = vi.fn()
      start({
        config: resolveMagnificationConfig({ magnificationSteps: [4, 8, 16] }),
        onMagnificationChange: onChange,
      })
      touch('pointerdown', 1, 0, 50)
      touch('pointerdown', 2, 100, 50)
      touch('pointermove', 2, 150, 50)
      expect(onChange).toHaveBeenLastCalledWith(12)
    })

    it('prevents default on touch events', () => {
      start()
      const e = new Event('touchmove', { bubbles: true, cancelable: true })
      getOverlay()!.dispatchEvent(e)
      expect(e.defaultPrevented).toBe(true)
    })
  })
})

describe('startLoupeSession feedback', () => {
  it('unlocks audio and plays open on start', () => {
    const feedback = fakeFeedback()
    start({ feedback })
    expect(feedback.unlock).toHaveBeenCalled()
    expect(feedback.open).toHaveBeenCalledTimes(1)
  })

  it('ticks when the center pixel changes, not on the first draw', () => {
    const feedback = fakeFeedback()
    start({ feedback })
    frames.flush()
    expect(feedback.pixel).not.toHaveBeenCalled()
    pointer('pointermove', 31, 42)
    pointer('pointermove', 45, 45)
    frames.flush()
    expect(feedback.pixel).toHaveBeenCalledTimes(1)
    pointer('pointermove', 46, 46) // same pixel
    frames.flush()
    expect(feedback.pixel).toHaveBeenCalledTimes(1)
    key('ArrowRight')
    frames.flush()
    expect(feedback.pixel).toHaveBeenCalledTimes(2)
  })

  it('ticks zoom once per detent', () => {
    const feedback = fakeFeedback()
    start({ feedback })
    wheel(-100)
    expect(feedback.zoom).toHaveBeenCalledTimes(1)
    // Half a notch stays on the same detent.
    wheel(-50)
    wheel(-50)
    expect(feedback.zoom).toHaveBeenCalledTimes(2)
  })

  it('plays confirm on pick', async () => {
    const feedback = fakeFeedback()
    const s = start({ feedback })
    key('Enter')
    await s.result
    expect(feedback.confirm).toHaveBeenCalledTimes(1)
    expect(feedback.cancel).not.toHaveBeenCalled()
  })

  it('plays cancel on Escape and on a click outside', async () => {
    for (const close of [() => key('Escape'), () => click(150, 50)]) {
      const feedback = fakeFeedback()
      const s = start({ feedback })
      close()
      await expect(s.result).rejects.toThrow()
      expect(feedback.cancel).toHaveBeenCalledTimes(1)
    }
  })

  it('stays silent on cancel() and an aborted signal', async () => {
    const feedback = fakeFeedback()
    const s = start({ feedback })
    s.cancel()
    await expect(s.result).rejects.toThrow()

    const controller = new AbortController()
    const t = start({ feedback, signal: controller.signal })
    controller.abort()
    await expect(t.result).rejects.toThrow()
    expect(feedback.cancel).not.toHaveBeenCalled()
  })

  it('unlocks audio on pointerdown and keydown', () => {
    const feedback = fakeFeedback()
    start({ feedback })
    feedback.unlock.mockClear()
    pointer('pointerdown', 30, 30)
    key('ArrowLeft')
    expect(feedback.unlock).toHaveBeenCalledTimes(2)
  })
})

describe('startLoupeSession motion', () => {
  afterEach(() => {
    resetAnimate()
    resetReducedMotion()
  })

  const transform = () => loupeElement().style.transform
  /** Loupe transform centered on client (35, 45). */
  const AT_POINTER = 'translate(-25px, -15px)'
  const raf = () => vi.mocked(window.requestAnimationFrame).mock.calls.length

  /** Runs frames 16ms apart until nothing is scheduled (max 200). */
  const settle = (clock: ReturnType<typeof mockNow>) => {
    for (let i = 0; i < 200; i++) {
      const before = raf()
      clock.advance(16)
      frames.flush()
      if (raf() === before) return
    }
  }

  it('glides after the pointer with smoothing, the pixel is exact at once', () => {
    const clock = mockNow()
    start({ smoothing: 1 })
    frames.flush()
    pointer('pointermove', 35, 45)
    frames.flush()
    expect(transform()).not.toBe(AT_POINTER)
    expect(labelText()).toBe(gridHex(3, 4))
    settle(clock)
    expect(transform()).toBe(AT_POINTER)
    // Settled: no frame left.
    const before = raf()
    frames.flush()
    expect(raf()).toBe(before)
  })

  it('ignores smoothing when the user prefers reduced motion', () => {
    mockReducedMotion(true)
    start({ smoothing: 1 })
    frames.flush()
    pointer('pointermove', 35, 45)
    frames.flush()
    expect(transform()).toBe(AT_POINTER)
  })

  it('keeps drawing after a zoom until it settles', () => {
    const clock = mockNow()
    start()
    frames.flush()
    wheel(-500)
    frames.flush()
    const before = raf()
    clock.advance(16)
    frames.flush()
    // Still zooming: the frame scheduled another one.
    expect(raf()).toBe(before + 1)
    settle(clock)
    const after = raf()
    frames.flush()
    expect(raf()).toBe(after)
  })

  it('grows in on open and shrinks out after confirm', async () => {
    const animations = mockAnimate()
    const s = start()
    expect(animations).toHaveLength(1)
    const loupe = loupeElement()
    key('Enter')
    await s.result
    // The page is free at once; the loupe finishes shrinking on its own.
    expect(getOverlay()).toBeNull()
    expect(animations).toHaveLength(2)
    expect(loupe.parentNode).toBe(document.body)
    animations[1]!.finish()
    expect(loupe).not.toBeInTheDocument()
  })

  it('does not animate with animate: false or reduced motion', async () => {
    const animations = mockAnimate()
    const a = start({ animate: false })
    const first = loupeElement()
    key('Enter')
    await a.result
    mockReducedMotion(true)
    const b = start()
    const second = loupeElement()
    key('Enter')
    await b.result
    expect(animations).toHaveLength(0)
    expect(first).not.toBeInTheDocument()
    expect(second).not.toBeInTheDocument()
  })
})
