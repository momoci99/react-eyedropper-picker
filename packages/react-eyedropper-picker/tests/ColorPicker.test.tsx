import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorPicker, useColorHistory, useColorPicker } from '../src'

afterEach(() => {
  delete (window as any).EyeDropper
})

describe('ColorPicker', () => {
  it('renders default value and emits on valid hex input', () => {
    const onChange = vi.fn()
    render(<ColorPicker defaultValue="#ff0000" onChange={onChange} />)
    const input = screen.getByLabelText('Hex color')
    expect(input).toHaveValue('#ff0000')
    fireEvent.change(input, { target: { value: '#00f' } })
    expect(onChange).toHaveBeenLastCalledWith('#0000ff')
    expect(input).toHaveValue('#00f')
  })

  it('ignores invalid hex', () => {
    const onChange = vi.fn()
    render(<ColorPicker onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Hex color'), {
      target: { value: '#zz' },
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('changes hue with keyboard', () => {
    const onChange = vi.fn()
    render(<ColorPicker defaultValue="#ff0000" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Hue' }), {
      key: 'End',
    })
    expect(onChange).toHaveBeenLastCalledWith('#ff0000')
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Hue' }), {
      key: 'ArrowRight',
      shiftKey: true,
    })
  })

  it('hides eye dropper button when unsupported', () => {
    render(<ColorPicker />)
    expect(screen.queryByLabelText('Pick color from screen')).toBeNull()
  })

  it('uses a custom eye dropper without native support', async () => {
    const eyeDropper = {
      open: vi.fn(async () => ({ sRGBHex: '#123456', x: 1, y: 2 })),
      isSupported: true,
    }
    const onChange = vi.fn()
    render(<ColorPicker onChange={onChange} eyeDropper={eyeDropper} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick a color' }))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('#123456'))
    expect(eyeDropper.open).toHaveBeenCalledOnce()
  })

  it('hides the button when the custom eye dropper is unsupported', () => {
    ;(window as any).EyeDropper = class {
      open = async () => ({ sRGBHex: '#abcdef' })
    }
    const eyeDropper = { open: vi.fn(), isSupported: false }
    render(<ColorPicker eyeDropper={eyeDropper} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ignores a cancelled custom eye dropper', async () => {
    const eyeDropper = {
      open: vi.fn(async () => {
        throw new DOMException('closed', 'AbortError')
      }),
      isSupported: true,
    }
    const onChange = vi.fn()
    render(<ColorPicker onChange={onChange} eyeDropper={eyeDropper} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick a color' }))
    await vi.waitFor(() => expect(eyeDropper.open).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('picks color from screen', async () => {
    ;(window as any).EyeDropper = class {
      open = async () => ({ sRGBHex: '#abcdef' })
    }
    const onChange = vi.fn()
    render(<ColorPicker onChange={onChange} />)
    fireEvent.click(await screen.findByLabelText('Pick color from screen'))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('#abcdef'))
    // The re-render can land after onChange under load.
    await vi.waitFor(() =>
      expect(screen.getByLabelText('Hex color')).toHaveValue('#abcdef')
    )
  })

  it('useColorPicker: pickColor and canPickColor, old names still work', async () => {
    const eyeDropper = {
      open: vi.fn(async () => ({ sRGBHex: '#123456' })),
      isSupported: true,
    }
    const { result } = renderHook(() => useColorPicker({ eyeDropper }))
    expect(result.current.canPickColor).toBe(true)
    expect(result.current.isEyeDropperSupported).toBe(true)
    expect(result.current.pickFromScreen).toBe(result.current.pickColor)
    let picked: string | null = null
    await act(async () => {
      picked = await result.current.pickColor()
    })
    expect(picked).toBe('#123456')
    expect(result.current.hex).toBe('#123456')
  })

  it('follows controlled value', () => {
    const { rerender } = render(<ColorPicker value="#ff0000" />)
    rerender(<ColorPicker value="#00ff00" />)
    expect(screen.getByLabelText('Hex color')).toHaveValue('#00ff00')
  })
})

describe('ColorPicker history', () => {
  afterEach(() => localStorage.clear())

  /** Eye dropper that picks each color in turn. */
  const dropper = (...colors: string[]) => ({
    open: vi.fn(async () => ({ sRGBHex: colors.shift() ?? '#000000' })),
    isSupported: true,
  })

  const pick = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Pick a color' }))
    await act(async () => {})
  }

  const swatches = () =>
    within(screen.getByRole('group', { name: 'Recent colors' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))

  it('is off by default', async () => {
    render(<ColorPicker eyeDropper={dropper('#123456')} />)
    await pick()
    expect(screen.queryByRole('group', { name: 'Recent colors' })).toBeNull()
  })

  it('shows nothing until the first pick', () => {
    render(<ColorPicker history eyeDropper={dropper()} />)
    expect(screen.queryByRole('group', { name: 'Recent colors' })).toBeNull()
  })

  it('adds eye dropper picks, newest first', async () => {
    render(<ColorPicker history eyeDropper={dropper('#111111', '#222222')} />)
    await pick()
    await pick()
    expect(swatches()).toEqual(['#222222', '#111111'])
  })

  it('adds nothing for a cancelled pick or a typed color', async () => {
    const eyeDropper = {
      open: vi.fn(async () => {
        throw new DOMException('cancelled', 'AbortError')
      }),
      isSupported: true,
    }
    render(
      <ColorPicker
        history={{ defaultColors: ['#111'] }}
        eyeDropper={eyeDropper}
      />
    )
    await pick()
    fireEvent.change(screen.getByLabelText('Hex color'), {
      target: { value: '#abcdef' },
    })
    expect(swatches()).toEqual(['#111111'])
  })

  it('applies a swatch on click and marks the current color', () => {
    const onChange = vi.fn()
    render(
      <ColorPicker
        defaultValue="#111111"
        onChange={onChange}
        history={{ defaultColors: ['#111111', '#222222'] }}
      />
    )
    const [first, second] = within(
      screen.getByRole('group', { name: 'Recent colors' })
    ).getAllByRole('button')
    expect(first!.style.boxShadow).toContain('0 0 0 3px')
    expect(second!.style.boxShadow).toContain('inset')
    fireEvent.click(second!)
    expect(onChange).toHaveBeenLastCalledWith('#222222')
    expect(screen.getByLabelText('Hex color')).toHaveValue('#222222')
  })

  it('passes options to useColorHistory', async () => {
    render(
      <ColorPicker
        history={{ max: 1, storageKey: 'picker' }}
        eyeDropper={dropper('#111111', '#222222')}
      />
    )
    await pick()
    await pick()
    expect(swatches()).toEqual(['#222222'])
    expect(JSON.parse(localStorage.getItem('picker')!)).toEqual(['#222222'])
  })

  it('shares a useColorHistory result', async () => {
    const { result } = renderHook(() => useColorHistory())
    const { rerender } = render(
      <ColorPicker history={result.current} eyeDropper={dropper('#111111')} />
    )
    await pick()
    expect(result.current.colors).toEqual(['#111111'])
    act(() => result.current.add('#333333'))
    rerender(
      <ColorPicker history={result.current} eyeDropper={dropper('#111111')} />
    )
    expect(swatches()).toEqual(['#333333', '#111111'])
  })
})
