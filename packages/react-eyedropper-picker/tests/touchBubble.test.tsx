import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ColorPicker, HueSlider, SaturationPanel } from '../src'

const press = (el: Element, pointerType: string) =>
  fireEvent.pointerDown(el, { pointerType, button: 0, pointerId: 1 })

/** The bubble's colored teardrop, or null. */
const bubble = (slider: Element) =>
  slider.querySelector('[aria-hidden="true"] > div') as HTMLElement | null

const panel = () => screen.getByRole('slider', { name: /Saturation/ })
const hue = () => screen.getByRole('slider', { name: 'Hue' })

describe('touch bubble', () => {
  it('shows the color above the finger while dragging by touch', () => {
    render(
      <SaturationPanel hsv={{ h: 0, s: 100, v: 100 }} onChange={vi.fn()} />
    )
    expect(bubble(panel())).toBeNull()
    press(panel(), 'touch')
    expect(bubble(panel())).toHaveStyle({ background: '#ff0000' })
    fireEvent.pointerUp(panel())
    expect(bubble(panel())).toBeNull()
  })

  it('follows the handle', () => {
    const { rerender } = render(
      <SaturationPanel hsv={{ h: 0, s: 100, v: 100 }} onChange={vi.fn()} />
    )
    press(panel(), 'touch')
    rerender(
      <SaturationPanel hsv={{ h: 120, s: 25, v: 40 }} onChange={vi.fn()} />
    )
    const anchor = bubble(panel())!.parentElement!
    expect(anchor.style.left).toBe('25%')
    expect(anchor.style.top).toBe('60%')
  })

  it('stays hidden for mouse and pen', () => {
    render(<SaturationPanel hsv={{ h: 0, s: 50, v: 50 }} onChange={vi.fn()} />)
    press(panel(), 'mouse')
    expect(bubble(panel())).toBeNull()
    press(panel(), 'pen')
    expect(bubble(panel())).toBeNull()
  })

  it('hides when the touch is cancelled or capture is lost', () => {
    render(<SaturationPanel hsv={{ h: 0, s: 50, v: 50 }} onChange={vi.fn()} />)
    press(panel(), 'touch')
    fireEvent.pointerCancel(panel())
    expect(bubble(panel())).toBeNull()
    press(panel(), 'touch')
    fireEvent.lostPointerCapture(panel())
    expect(bubble(panel())).toBeNull()
  })

  it('can be turned off', () => {
    render(
      <SaturationPanel
        hsv={{ h: 0, s: 50, v: 50 }}
        onChange={vi.fn()}
        touchBubble={false}
      />
    )
    press(panel(), 'touch')
    expect(bubble(panel())).toBeNull()
  })

  it('shows the hue on the hue slider', () => {
    render(<HueSlider hue={180} onChange={vi.fn()} />)
    press(hue(), 'touch')
    expect(bubble(hue())).toHaveStyle({ background: 'hsl(180, 100%, 50%)' })
    expect(bubble(hue())!.parentElement!.style.left).toBe('50%')
  })

  it('ColorPicker passes touchBubble to both', () => {
    const { rerender } = render(<ColorPicker defaultValue="#336699" />)
    press(panel(), 'touch')
    // jsdom has no layout: the press lands at (0, 0), which is white.
    expect(bubble(panel())).toHaveStyle({ background: '#ffffff' })
    fireEvent.pointerUp(panel())
    rerender(<ColorPicker defaultValue="#336699" touchBubble={false} />)
    press(panel(), 'touch')
    press(hue(), 'touch')
    expect(bubble(panel())).toBeNull()
    expect(bubble(hue())).toBeNull()
  })
})
