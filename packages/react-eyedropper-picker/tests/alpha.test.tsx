import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AlphaSlider, ColorPicker, useColorPicker } from '../src'

const opacity = () => screen.getByRole('slider', { name: 'Opacity' })

describe('useColorPicker alpha', () => {
  it('is off by default: #rrggbb, alpha 1, setAlpha ignored', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useColorPicker({ defaultValue: '#33669980', onChange })
    )
    // Without alpha, 8 digits are invalid: the fallback.
    expect(result.current.hex).toBe('#000000')
    expect(result.current.alpha).toBe(1)
    act(() => result.current.setAlpha(0.5))
    expect(result.current.alpha).toBe(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('emits #rrggbbaa, always 8 digits', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useColorPicker({ alpha: true, defaultValue: '#336699', onChange })
    )
    expect(result.current.hex).toBe('#336699ff')
    act(() => result.current.setAlpha(0.5))
    expect(onChange).toHaveBeenLastCalledWith('#33669980')
    expect(result.current.alpha).toBe(0.5)
    // Changing the color keeps the alpha.
    act(() => result.current.setHsv({ h: 0, s: 100, v: 100 }))
    expect(onChange).toHaveBeenLastCalledWith('#ff000080')
    act(() => result.current.setAlpha(2))
    expect(result.current.hex).toBe('#ff0000ff')
  })

  it('setHex takes every length; no alpha digits means opaque', () => {
    const { result } = renderHook(() => useColorPicker({ alpha: true }))
    act(() => void result.current.setHex('#f008'))
    expect(result.current.hex).toBe('#ff000088')
    act(() => void result.current.setHex('#00ff00'))
    expect(result.current.hex).toBe('#00ff00ff')
    expect(result.current.setHex('#00ff0')).toBe(false)
  })

  it('follows a controlled value with alpha', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useColorPicker({ alpha: true, value }),
      { initialProps: { value: '#33669980' } }
    )
    expect(result.current.alpha).toBeCloseTo(0x80 / 255)
    rerender({ value: '#33669900' })
    expect(result.current.hex).toBe('#33669900')
  })

  it('a pick is opaque and returns #rrggbbaa', async () => {
    const onChange = vi.fn()
    const eyeDropper = {
      open: vi.fn(async () => ({ sRGBHex: '#123456' })),
      isSupported: true,
    }
    const { result } = renderHook(() =>
      useColorPicker({
        alpha: true,
        defaultValue: '#00000040',
        onChange,
        eyeDropper,
      })
    )
    let picked: string | null = null
    await act(async () => {
      picked = await result.current.pickFromScreen()
    })
    expect(picked).toBe('#123456ff')
    expect(onChange).toHaveBeenLastCalledWith('#123456ff')
  })

  it('calls onChange once per change under StrictMode', () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useColorPicker({ alpha: true, onChange }),
      { reactStrictMode: true }
    )
    act(() => result.current.setAlpha(0.25))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('AlphaSlider', () => {
  it('is a percent slider', () => {
    render(<AlphaSlider color="#336699" alpha={0.5} onChange={vi.fn()} />)
    expect(opacity()).toHaveAttribute('aria-valuenow', '50')
    expect(opacity()).toHaveAttribute('aria-valuetext', '50%')
  })

  it('moves by 1% with arrows, 10% with Shift, Home / End', () => {
    const onChange = vi.fn()
    render(<AlphaSlider color="#336699" alpha={0.5} onChange={onChange} />)
    fireEvent.keyDown(opacity(), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(0.51)
    fireEvent.keyDown(opacity(), { key: 'ArrowLeft', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(0.4)
    fireEvent.keyDown(opacity(), { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(opacity(), { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('stops at the ends', () => {
    const onChange = vi.fn()
    render(<AlphaSlider color="#336699" alpha={1} onChange={onChange} />)
    fireEvent.keyDown(opacity(), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('fades the color over a checkerboard', () => {
    render(<AlphaSlider color="#336699cc" alpha={0} onChange={vi.fn()} />)
    const bg = opacity().style.background
    // jsdom reports colors as rgb(); the alpha digits of `color` are dropped.
    expect(bg).toContain('rgba(51, 102, 153, 0), rgb(51, 102, 153)')
    expect(bg).toContain('repeating-conic-gradient')
  })
})

describe('ColorPicker alpha', () => {
  it('has no opacity slider by default', () => {
    render(<ColorPicker />)
    expect(screen.queryByRole('slider', { name: 'Opacity' })).toBeNull()
  })

  it('shows the slider and emits #rrggbbaa', () => {
    const onChange = vi.fn()
    render(<ColorPicker alpha defaultValue="#336699" onChange={onChange} />)
    const input = screen.getByLabelText('Hex color')
    expect(input).toHaveValue('#336699ff')
    fireEvent.keyDown(opacity(), { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('#33669900')
    expect(input).toHaveValue('#33669900')
  })

  it('takes typed alpha hex and keeps the typed form while it matches', () => {
    const onChange = vi.fn()
    render(<ColorPicker alpha onChange={onChange} />)
    const input = screen.getByLabelText('Hex color')
    fireEvent.change(input, { target: { value: '#f008' } })
    expect(onChange).toHaveBeenLastCalledWith('#ff000088')
    expect(input).toHaveValue('#f008')
    expect(opacity()).toHaveAttribute('aria-valuenow', '53')
  })

  it('shows the new format when alpha is turned on or off', () => {
    const { rerender } = render(<ColorPicker defaultValue="#336699" />)
    const input = screen.getByLabelText('Hex color')
    expect(input).toHaveValue('#336699')
    rerender(<ColorPicker defaultValue="#336699" alpha />)
    expect(input).toHaveValue('#336699ff')
    rerender(<ColorPicker defaultValue="#336699" />)
    expect(input).toHaveValue('#336699')
  })

  it('keeps picks with alpha in the history', async () => {
    const eyeDropper = {
      open: vi.fn(async () => ({ sRGBHex: '#123456' })),
      isSupported: true,
    }
    render(<ColorPicker alpha history eyeDropper={eyeDropper} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick a color' }))
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: '#123456ff' })).toBeTruthy()
    )
  })
})
