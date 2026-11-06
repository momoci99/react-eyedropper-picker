import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EyeDropperLike } from '../src'
import {
  useLoupeEyeDropper,
  type UseLoupeEyeDropperOptions,
} from '../src/loupe'
import {
  click,
  getOverlay,
  gridBuffer,
  gridHex,
  key,
  mockCanvas,
  mockFrames,
  mockSource,
  wheel,
} from './loupe-mocks'

const installEyeDropper = (sRGBHex = '#123456') => {
  ;(window as any).EyeDropper = class {
    open = vi.fn(async () => ({ sRGBHex }))
  }
}

beforeEach(() => {
  mockCanvas(gridBuffer(10, 10))
  mockFrames()
})

afterEach(() => {
  delete (window as any).EyeDropper
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const render = (options: UseLoupeEyeDropperOptions) =>
  renderHook((props: UseLoupeEyeDropperOptions) => useLoupeEyeDropper(props), {
    initialProps: options,
  })

/**
 * Calls open() inside a sync act: the session mounts synchronously for a
 * canvas source. Not async, so callers get the pending promise itself.
 */
const openLoupe = (
  result: { current: ReturnType<typeof useLoupeEyeDropper> },
  ...args: Parameters<ReturnType<typeof useLoupeEyeDropper>['open']>
) => {
  let pending!: ReturnType<ReturnType<typeof useLoupeEyeDropper>['open']>
  act(() => {
    pending = result.current.open(...args)
  })
  pending.catch(() => {})
  return pending
}

describe('useLoupeEyeDropper', () => {
  describe('isSupported', () => {
    it('loupe mode is supported on the client', () => {
      const { result } = render({ mode: 'loupe' })
      expect(result.current.isSupported).toBe(true)
    })

    it('auto mode needs a source or native support', () => {
      expect(render({}).result.current.isSupported).toBe(false)
      const source = mockSource()
      expect(render({ source }).result.current.isSupported).toBe(true)
      installEyeDropper()
      expect(render({}).result.current.isSupported).toBe(true)
    })

    it('native mode follows the EyeDropper API', () => {
      const source = mockSource()
      expect(
        render({ mode: 'native', source }).result.current.isSupported
      ).toBe(false)
      installEyeDropper()
      expect(
        render({ mode: 'native', source }).result.current.isSupported
      ).toBe(true)
    })
  })

  it('opens the loupe on the source and resolves the clicked pixel', async () => {
    const source = mockSource()
    const { result } = render({ source: { current: source } })
    const pending = openLoupe(result)
    expect(getOverlay()).toBeInTheDocument()
    expect(result.current.isOpen).toBe(true)

    await act(async () => {
      click(35, 45)
    })
    await expect(pending).resolves.toEqual({
      sRGBHex: gridHex(3, 4),
      x: 3,
      y: 4,
      mode: 'loupe',
    })
    expect(result.current.isOpen).toBe(false)
  })

  it('prefers the loupe in auto mode even with native support', async () => {
    installEyeDropper()
    const { result } = render({ source: mockSource() })
    openLoupe(result)
    expect(getOverlay()).toBeInTheDocument()
  })

  it('uses native in auto mode without a source', async () => {
    installEyeDropper('#abcdef')
    const { result } = render({})
    await expect(result.current.open()).resolves.toEqual({
      sRGBHex: '#abcdef',
      mode: 'native',
    })
  })

  it('open({ source }) overrides the option', async () => {
    const { result } = render({ mode: 'loupe' })
    openLoupe(result, { source: mockSource() })
    expect(getOverlay()).toBeInTheDocument()
  })

  it('rejects with NotSupportedError when the mode cannot run', async () => {
    const { result } = render({ mode: 'loupe' })
    await expect(result.current.open()).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
    await expect(render({}).result.current.open()).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
  })

  it('close() cancels with AbortError', async () => {
    const { result } = render({ source: mockSource() })
    const pending = openLoupe(result)
    await act(async () => result.current.close())
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(getOverlay()).toBeNull()
    expect(result.current.isOpen).toBe(false)
  })

  it('a second open() cancels the first', async () => {
    const { result } = render({ source: mockSource() })
    const first = openLoupe(result)
    const second = openLoupe(result)
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(result.current.isOpen).toBe(true)
    await act(async () => key('Escape'))
    await expect(second).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('closes on unmount', async () => {
    const { result, unmount } = render({ source: mockSource() })
    const pending = openLoupe(result)
    unmount()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(getOverlay()).toBeNull()
  })

  it('passes loupe options and calls the latest onMagnificationChange', async () => {
    const source = mockSource()
    const first = vi.fn()
    const latest = vi.fn()
    const { result, rerender } = render({
      source,
      loupe: { defaultMagnification: 10, onMagnificationChange: first },
    })
    openLoupe(result)
    rerender({
      source,
      loupe: { defaultMagnification: 10, onMagnificationChange: latest },
    })
    wheel(-100)
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith(11)
  })

  it('follows a controlled magnification while open', async () => {
    const source = mockSource()
    const onChange = vi.fn()
    const { result, rerender } = render({
      source,
      loupe: { magnification: 4, onMagnificationChange: onChange },
    })
    openLoupe(result)
    wheel(-100)
    expect(onChange).toHaveBeenCalledWith(4.4)
    const label = getOverlay()!.firstElementChild!.lastElementChild!
    expect(label.textContent).not.toContain('×')

    rerender({
      source,
      loupe: { magnification: 20, onMagnificationChange: onChange },
    })
    expect(label.textContent).toContain('20×')
  })
})

describe('ColorPicker integration', () => {
  it('fits the eyeDropper prop of ColorPicker', () => {
    const { result } = render({ source: mockSource() })
    // Compile-time check: the loupe hook result is an EyeDropperLike.
    const dropper: EyeDropperLike = result.current
    expect(dropper.isSupported).toBe(true)
  })
})
