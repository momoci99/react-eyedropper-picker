import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveMagnificationConfig } from '../src/loupe/magnification'
import {
  startLoupeSession,
  type LoupeSession,
  type LoupeSessionOptions,
} from '../src/loupe/session'
import {
  click,
  getOverlay,
  gridBuffer,
  gridHex,
  key,
  mockCanvas,
  mockFrames,
  mockSource,
  pointer,
  wheel,
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
const labelText = () => loupeElement().lastElementChild!.textContent

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
      const badge = loupeElement().lastElementChild!.lastElementChild!
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
})
