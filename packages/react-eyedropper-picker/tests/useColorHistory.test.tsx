import { act, renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_HISTORY_MAX,
  useColorHistory,
  type UseColorHistoryOptions,
} from '../src/hooks/useColorHistory'

const KEY = 'test-history'

const setup = (options?: UseColorHistoryOptions) =>
  renderHook((props?: UseColorHistoryOptions) => useColorHistory(props), {
    initialProps: options,
  })

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('useColorHistory', () => {
  it('starts empty', () => {
    expect(setup().result.current.colors).toEqual([])
  })

  it('adds normalized colors newest first', () => {
    const { result } = setup()
    act(() => result.current.add('#F00'))
    act(() => result.current.add('#00ff00'))
    expect(result.current.colors).toEqual(['#00ff00', '#ff0000'])
  })

  it('moves a color that is already kept to the front', () => {
    const { result } = setup({ defaultColors: ['#111111', '#222222'] })
    act(() => result.current.add('#222'))
    expect(result.current.colors).toEqual(['#222222', '#111111'])
  })

  it('ignores invalid hex', () => {
    const { result } = setup()
    act(() => result.current.add('nope'))
    act(() => result.current.remove('nope'))
    expect(result.current.colors).toEqual([])
  })

  it(`keeps at most ${DEFAULT_HISTORY_MAX} by default`, () => {
    const { result } = setup()
    act(() => {
      for (let i = 0; i < 12; i++) result.current.add(`#00000${i.toString(16)}`)
    })
    expect(result.current.colors).toHaveLength(DEFAULT_HISTORY_MAX)
    expect(result.current.colors[0]).toBe('#00000b')
  })

  it('keeps at most max, and trims when max shrinks', () => {
    const { result, rerender } = setup({ max: 3 })
    act(() => {
      for (const c of ['#111', '#222', '#333', '#444']) result.current.add(c)
    })
    expect(result.current.colors).toEqual(['#444444', '#333333', '#222222'])
    rerender({ max: 1 })
    expect(result.current.colors).toEqual(['#444444'])
  })

  it('uses the default max for bad values', () => {
    for (const max of [0, -1, NaN, Infinity]) {
      const { result } = setup({ max })
      act(() => {
        for (let i = 0; i < 12; i++) {
          result.current.add(`#00000${i.toString(16)}`)
        }
      })
      expect(result.current.colors, String(max)).toHaveLength(
        DEFAULT_HISTORY_MAX
      )
    }
  })

  it('cleans defaultColors', () => {
    const { result } = setup({
      defaultColors: ['#ABC', 'nope', '#aabbcc', '#fff'],
    })
    expect(result.current.colors).toEqual(['#aabbcc', '#ffffff'])
  })

  it('removes and clears', () => {
    const { result } = setup({ defaultColors: ['#111', '#222', '#333'] })
    act(() => result.current.remove('#222'))
    expect(result.current.colors).toEqual(['#111111', '#333333'])
    act(() => result.current.clear())
    expect(result.current.colors).toEqual([])
  })

  it('keeps the same result while nothing changes', () => {
    const { result, rerender } = setup({ defaultColors: ['#111'] })
    const first = result.current
    rerender({ defaultColors: ['#111'] })
    expect(result.current).toBe(first)
  })

  describe('with storageKey', () => {
    it('saves to localStorage', () => {
      const { result } = setup({ storageKey: KEY })
      act(() => result.current.add('#123456'))
      expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['#123456'])
    })

    it('reads what was saved', () => {
      localStorage.setItem(KEY, JSON.stringify(['#abcdef', 'nope', '#ABCDEF']))
      const { result } = setup({ storageKey: KEY, defaultColors: ['#000'] })
      expect(result.current.colors).toEqual(['#abcdef'])
    })

    it('uses defaultColors while nothing is stored', () => {
      const { result } = setup({ storageKey: KEY, defaultColors: ['#000'] })
      expect(result.current.colors).toEqual(['#000000'])
      act(() => result.current.clear())
      expect(result.current.colors).toEqual([])
      expect(localStorage.getItem(KEY)).toBe('[]')
    })

    it('ignores broken stored data', () => {
      for (const raw of ['{', '{"a":1}', '"#fff"']) {
        localStorage.setItem(KEY, raw)
        const { result, unmount } = setup({ storageKey: KEY })
        expect(result.current.colors, raw).toEqual([])
        unmount()
      }
    })

    it('syncs hooks with the same key in one tab', () => {
      const a = setup({ storageKey: KEY })
      const b = setup({ storageKey: KEY })
      const other = setup({ storageKey: 'other' })
      act(() => a.result.current.add('#123456'))
      expect(b.result.current.colors).toEqual(['#123456'])
      expect(other.result.current.colors).toEqual([])
    })

    it('follows changes from other tabs', () => {
      const { result } = setup({ storageKey: KEY })
      act(() => {
        localStorage.setItem(KEY, JSON.stringify(['#654321']))
        window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
      })
      expect(result.current.colors).toEqual(['#654321'])
      act(() => {
        localStorage.clear()
        window.dispatchEvent(new StorageEvent('storage', { key: null }))
      })
      expect(result.current.colors).toEqual([])
    })

    it('keeps working in memory when localStorage refuses writes', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
      const a = setup({ storageKey: 'full' })
      const b = setup({ storageKey: 'full' })
      act(() => a.result.current.add('#123456'))
      expect(a.result.current.colors).toEqual(['#123456'])
      expect(b.result.current.colors).toEqual(['#123456'])
    })

    it('works when localStorage throws on read', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
      const { result } = setup({ storageKey: KEY, defaultColors: ['#000'] })
      expect(result.current.colors).toEqual(['#000000'])
    })

    it('stops listening on unmount', () => {
      const remove = vi.spyOn(window, 'removeEventListener')
      const { unmount } = setup({ storageKey: KEY })
      unmount()
      expect(remove).toHaveBeenCalledWith('storage', expect.any(Function))
    })

    it('renders defaultColors on the server', () => {
      localStorage.setItem(KEY, JSON.stringify(['#abcdef']))
      const Probe = () => (
        <>
          {useColorHistory({ storageKey: KEY, defaultColors: ['#000'] }).colors}
        </>
      )
      expect(renderToString(<Probe />)).toBe('#000000')
    })
  })
})
