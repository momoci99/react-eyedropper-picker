import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEyeDropper } from '../src/hooks/useEyeDropper'

const installEyeDropper = (impl: (opts: { signal: AbortSignal }) => Promise<{ sRGBHex: string }>) => {
  const open = vi.fn(impl)
  ;(window as any).EyeDropper = class {
    open = open
  }
  return open
}

afterEach(() => {
  delete (window as any).EyeDropper
})

describe('useEyeDropper', () => {
  it('reports unsupported and rejects open', async () => {
    const { result } = renderHook(() => useEyeDropper())
    expect(result.current.isSupported).toBe(false)
    await expect(result.current.open()).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
  })

  it('opens and resolves color', async () => {
    installEyeDropper(async () => ({ sRGBHex: '#123456' }))
    const { result } = renderHook(() => useEyeDropper())
    expect(result.current.isSupported).toBe(true)
    await expect(result.current.open()).resolves.toEqual({ sRGBHex: '#123456' })
  })

  it('close aborts pending open', async () => {
    let seen: AbortSignal | undefined
    installEyeDropper(
      ({ signal }) =>
        new Promise((_, reject) => {
          seen = signal
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        })
    )
    const { result } = renderHook(() => useEyeDropper())
    const p = result.current.open()
    act(() => result.current.close())
    await expect(p).rejects.toThrow('aborted')
    expect(seen?.aborted).toBe(true)
  })

  it('aborts on unmount', async () => {
    let seen: AbortSignal | undefined
    installEyeDropper(({ signal }) => {
      seen = signal
      return new Promise(() => {})
    })
    const { result, unmount } = renderHook(() => useEyeDropper())
    void result.current.open()
    unmount()
    expect(seen?.aborted).toBe(true)
  })
})
