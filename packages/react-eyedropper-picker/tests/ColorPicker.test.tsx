import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorPicker } from '../src'

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
    fireEvent.change(screen.getByLabelText('Hex color'), { target: { value: '#zz' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('changes hue with keyboard', () => {
    const onChange = vi.fn()
    render(<ColorPicker defaultValue="#ff0000" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Hue' }), { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith('#ff0000')
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Hue' }), { key: 'ArrowRight', shiftKey: true })
  })

  it('hides eye dropper button when unsupported', () => {
    render(<ColorPicker />)
    expect(screen.queryByLabelText('Pick color from screen')).toBeNull()
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

  it('follows controlled value', () => {
    const { rerender } = render(<ColorPicker value="#ff0000" />)
    rerender(<ColorPicker value="#00ff00" />)
    expect(screen.getByLabelText('Hex color')).toHaveValue('#00ff00')
  })
})
