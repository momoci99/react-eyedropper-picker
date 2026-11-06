import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachLoupeHover, type LoupeHoverOptions } from '../src/loupe/hover'
import { resolveMagnificationConfig } from '../src/loupe/magnification'
import {
  fakeFeedback,
  gridBuffer,
  gridHex,
  mockCanvas,
  mockFrames,
  mockSource,
  loupeLabel,
  mockAnimate,
  mockReducedMotion,
  resetAnimate,
  resetReducedMotion,
} from './loupe-mocks'

let frames: ReturnType<typeof mockFrames>
let source: HTMLCanvasElement
let detach: (() => void)[] = []

beforeEach(() => {
  mockCanvas()
  frames = mockFrames()
  source = mockSource()
})

afterEach(() => {
  for (const d of detach) d()
  detach = []
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const attach = (overrides: Partial<LoupeHoverOptions> = {}) => {
  const h = attachLoupeHover({
    source,
    getBuffer: () => gridBuffer(10, 10),
    config: resolveMagnificationConfig(),
    magnification: 8,
    size: 120,
    shape: 'circle',
    grid: true,
    sampleSize: 1,
    onPick: () => {},
    ...overrides,
  })
  detach.push(h.destroy)
  return h
}

const send = (
  type: string,
  x: number,
  y: number,
  init: PointerEventInit = {}
) =>
  source.dispatchEvent(
    new PointerEvent(type, {
      clientX: x,
      clientY: y,
      pointerType: 'mouse',
      bubbles: true,
      cancelable: true,
      ...init,
    })
  )

const hoverAt = (x: number, y: number) => {
  send('pointerover', x, y)
  send('pointermove', x, y)
}

const finger = (type: string, id: number, x: number, y: number) =>
  send(type, x, y, { pointerType: 'touch', pointerId: id })

const wheel = (deltaY: number) =>
  source.dispatchEvent(
    new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
  )

const loupe = () => document.querySelector<HTMLElement>('[aria-hidden="true"]')
const labelText = () => loupeLabel(loupe()!).textContent

describe('attachLoupeHover', () => {
  it('shows nothing until the pointer is over the source', () => {
    attach()
    frames.flush()
    expect(loupe()).toBeNull()
  })

  it('follows a hovering mouse', () => {
    attach()
    hoverAt(35, 45)
    frames.flush()
    expect(loupe()).toBeInTheDocument()
    expect(loupe()!.style.transform).toBe('translate(-25px, -15px)')
    expect(labelText()).toBe(gridHex(3, 4))
    expect(source.style.cursor).toBe('none')
  })

  it('hides on leave and restores the cursor', () => {
    source.style.cursor = 'crosshair'
    attach()
    hoverAt(35, 45)
    send('pointerleave', 150, 45)
    expect(loupe()).toBeNull()
    expect(source.style.cursor).toBe('crosshair')
  })

  it('picks on click and stays open', () => {
    const onPick = vi.fn()
    attach({ onPick })
    hoverAt(35, 45)
    source.dispatchEvent(new MouseEvent('click', { clientX: 35, clientY: 45 }))
    expect(onPick).toHaveBeenCalledWith({
      sRGBHex: gridHex(3, 4),
      x: 3,
      y: 4,
      mode: 'loupe',
    })
    expect(loupe()).toBeInTheDocument()
  })

  it('zooms with the wheel only while the loupe shows', () => {
    const onChange = vi.fn()
    attach({ onMagnificationChange: onChange })
    expect(wheel(-100)).toBe(true) // page scrolls
    hoverAt(35, 45)
    expect(wheel(-100)).toBe(false)
    expect(onChange).toHaveBeenCalledWith(8.8)
  })

  it('reports aim changes once per pixel', () => {
    const onAim = vi.fn()
    attach({ onAim })
    hoverAt(35, 45)
    frames.flush()
    send('pointermove', 36, 46) // same pixel
    frames.flush()
    send('pointermove', 45, 46)
    frames.flush()
    expect(onAim.mock.calls.map(([r]) => [r.x, r.y])).toEqual([
      [3, 4],
      [4, 4],
    ])
  })

  it('puts a custom label under the loupe', () => {
    const label = document.createElement('div')
    attach({ label })
    hoverAt(35, 45)
    frames.flush()
    expect(loupeLabel(loupe()!)).toBe(label)
    expect(label.textContent).toBe('')
  })

  it('waits while the source has no pixels', () => {
    let buffer: ReturnType<typeof gridBuffer> | null = null
    attach({ getBuffer: () => buffer })
    hoverAt(35, 45)
    expect(loupe()).toBeNull()
    buffer = gridBuffer(10, 10)
    send('pointermove', 35, 45)
    expect(loupe()).toBeInTheDocument()
  })

  it('reports a read error once', () => {
    const onError = vi.fn()
    const error = new DOMException('tainted', 'SecurityError')
    attach({
      getBuffer: () => {
        throw error
      },
      onError,
    })
    hoverAt(35, 45)
    hoverAt(36, 45)
    expect(onError.mock.calls).toEqual([[error]])
    expect(loupe()).toBeNull()
  })

  it('destroy removes the loupe and listeners', () => {
    const onPick = vi.fn()
    const h = attach({ onPick })
    hoverAt(35, 45)
    h.destroy()
    expect(loupe()).toBeNull()
    hoverAt(35, 45)
    source.dispatchEvent(new MouseEvent('click', { clientX: 35, clientY: 45 }))
    expect(loupe()).toBeNull()
    expect(onPick).not.toHaveBeenCalled()
  })

  describe('touch', () => {
    it('shows the loupe above the finger and picks on lift', () => {
      source = mockSource(100, 400)
      const onPick = vi.fn()
      attach({ onPick })
      finger('pointerdown', 1, 15, 300)
      finger('pointermove', 1, 35, 300)
      frames.flush()
      expect(loupe()!.style.transform).toBe('translate(-25px, 132px)')
      finger('pointerup', 1, 35, 300)
      expect(onPick).toHaveBeenCalledWith(
        expect.objectContaining({ x: 3, y: 7 })
      )
      expect(loupe()).toBeNull()
    })

    it('picks nothing when lifted off the source', () => {
      const onPick = vi.fn()
      attach({ onPick })
      finger('pointerdown', 1, 35, 45)
      finger('pointermove', 1, 150, 45)
      finger('pointerup', 1, 150, 45)
      expect(onPick).not.toHaveBeenCalled()
      expect(loupe()).toBeNull()
    })

    it('pinches to zoom and picks nothing', () => {
      const onPick = vi.fn()
      const onChange = vi.fn()
      attach({ onPick, onMagnificationChange: onChange })
      finger('pointerdown', 1, 40, 50)
      finger('pointerdown', 2, 60, 50)
      finger('pointermove', 2, 80, 50)
      expect(onChange).toHaveBeenLastCalledWith(16)
      finger('pointerup', 2, 80, 50)
      finger('pointerup', 1, 40, 50)
      expect(onPick).not.toHaveBeenCalled()
    })

    it('ignores the hover path for touch', () => {
      attach()
      send('pointerover', 35, 45, { pointerType: 'touch' })
      expect(loupe()).toBeNull()
    })

    it('blocks page scroll on the source', () => {
      attach()
      const e = new Event('touchstart', { bubbles: true, cancelable: true })
      source.dispatchEvent(e)
      expect(e.defaultPrevented).toBe(true)
    })
  })
})

describe('attachLoupeHover feedback', () => {
  it('ticks on pixel changes, not when the loupe appears', () => {
    const feedback = fakeFeedback()
    attach({ feedback })
    hoverAt(35, 45)
    frames.flush()
    expect(feedback.pixel).not.toHaveBeenCalled()
    send('pointermove', 45, 45)
    frames.flush()
    expect(feedback.pixel).toHaveBeenCalledTimes(1)

    // Leaving and coming back is a new appearance.
    send('pointerleave', 150, 45)
    hoverAt(75, 45)
    frames.flush()
    expect(feedback.pixel).toHaveBeenCalledTimes(1)
  })

  it('plays confirm on pick, never open or cancel', () => {
    const feedback = fakeFeedback()
    attach({ feedback })
    hoverAt(35, 45)
    source.dispatchEvent(new MouseEvent('click', { clientX: 35, clientY: 45 }))
    send('pointerleave', 150, 45)
    expect(feedback.confirm).toHaveBeenCalledTimes(1)
    expect(feedback.open).not.toHaveBeenCalled()
    expect(feedback.cancel).not.toHaveBeenCalled()
  })

  it('ticks zoom only while the loupe shows', () => {
    const feedback = fakeFeedback()
    const h = attach({ feedback })
    h.setMagnification(16) // e.g. an app slider, loupe hidden
    expect(feedback.zoom).not.toHaveBeenCalled()
    hoverAt(35, 45)
    wheel(-100)
    expect(feedback.zoom).toHaveBeenCalledTimes(1)
  })

  it('unlocks audio on pointerdown', () => {
    const feedback = fakeFeedback()
    attach({ feedback })
    send('pointerdown', 35, 45)
    expect(feedback.unlock).toHaveBeenCalledTimes(1)
  })
})

describe('attachLoupeHover motion', () => {
  afterEach(() => {
    resetAnimate()
    resetReducedMotion()
  })

  it('grows in on show and shrinks out on leave', () => {
    const animations = mockAnimate()
    attach()
    hoverAt(35, 45)
    expect(animations).toHaveLength(1)
    const el = loupe()!
    send('pointerleave', 150, 45)
    expect(animations).toHaveLength(2)
    expect(el).toBeInTheDocument()
    animations[1]!.finish()
    expect(el).not.toBeInTheDocument()
  })

  it('coming back during the shrink-out keeps the loupe', () => {
    const animations = mockAnimate()
    attach()
    hoverAt(35, 45)
    const el = loupe()!
    send('pointerleave', 150, 45)
    hoverAt(45, 45)
    expect(animations[1]!.cancel).toHaveBeenCalled()
    // A late finish of the cancelled shrink-out does nothing.
    animations[1]!.finish()
    expect(el).toBeInTheDocument()
    expect(loupe()).toBe(el)
  })

  it('hides at once with reduced motion', () => {
    const animations = mockAnimate()
    mockReducedMotion(true)
    attach()
    hoverAt(35, 45)
    send('pointerleave', 150, 45)
    expect(animations).toHaveLength(0)
    expect(loupe()).toBeNull()
  })
})

describe('attachLoupeHover label swatch', () => {
  afterEach(() => resetReducedMotion())

  const swatch = () => loupeLabel(loupe()!).firstElementChild as HTMLElement
  const rgb = (x: number, y: number) => `rgb(${x * 10}, ${y * 10}, 0)`

  it('shows the color, fading only after the first one', () => {
    attach()
    hoverAt(35, 45)
    frames.flush()
    expect(swatch().style.backgroundColor).toBe(rgb(3, 4))
    expect(swatch().style.transition).toBe('none')
    send('pointermove', 45, 45)
    frames.flush()
    expect(swatch().style.backgroundColor).toBe(rgb(4, 4))
    expect(swatch().style.transition).toContain('background-color')
  })

  const fadesAfterMove = () => {
    hoverAt(35, 45)
    frames.flush()
    send('pointermove', 45, 45)
    frames.flush()
    return swatch().style.transition !== 'none'
  }

  it('does not fade with reduced motion', () => {
    mockReducedMotion(true)
    attach()
    expect(fadesAfterMove()).toBe(false)
  })

  it('does not fade with animate: false', () => {
    attach({ animate: false })
    expect(fadesAfterMove()).toBe(false)
  })
})
