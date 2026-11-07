import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ColorPicker, EyeDropperButton } from '../src'
import { themeColorScheme, themeVar } from '../src/theme'

describe('themeVar', () => {
  it('wraps the default in an overridable CSS variable', () => {
    expect(themeVar('bg')).toBe('var(--rep-bg, #fff)')
    expect(themeVar('bg', 'light')).toBe('var(--rep-bg, #fff)')
    expect(themeVar('bg', 'dark')).toBe('var(--rep-bg, #1f1f23)')
  })

  it('uses light-dark() for auto', () => {
    expect(themeVar('fg', 'auto')).toBe(
      'var(--rep-fg, light-dark(#111, #f2f2f5))'
    )
  })
})

describe('themeColorScheme', () => {
  it('matches the theme, both for auto', () => {
    expect(themeColorScheme()).toBe('light')
    expect(themeColorScheme('dark')).toBe('dark')
    expect(themeColorScheme('auto')).toBe('light dark')
  })
})

describe('ColorPicker theme', () => {
  const root = (container: HTMLElement) =>
    container.firstElementChild as HTMLElement

  it('is light by default', () => {
    const { container } = render(<ColorPicker defaultValue="#336699" />)
    expect(root(container).style.background).toBe('var(--rep-bg, #fff)')
    expect(root(container).style.colorScheme).toBe('light')
  })

  it('uses dark colors for theme="dark", inputs included', () => {
    const { container } = render(
      <ColorPicker defaultValue="#336699" theme="dark" />
    )
    expect(root(container).style.background).toBe('var(--rep-bg, #1f1f23)')
    expect(root(container).style.color).toBe('var(--rep-fg, #f2f2f5)')
    expect(root(container).style.colorScheme).toBe('dark')
    const input = screen.getByLabelText('Hex color')
    expect(input.style.background).toBe('var(--rep-input-bg, #2a2a30)')
    expect(input.style.color).toBe('inherit')
  })

  it('follows the OS for theme="auto"', () => {
    const { container } = render(
      <ColorPicker defaultValue="#336699" theme="auto" />
    )
    expect(root(container).style.background).toContain('light-dark(')
    expect(root(container).style.colorScheme).toBe('light dark')
  })

  it('lets style override the theme', () => {
    const { container } = render(
      <ColorPicker theme="dark" style={{ background: 'navy' }} />
    )
    expect(root(container).style.background).toBe('navy')
  })
})

describe('EyeDropperButton', () => {
  it('uses the border variable', () => {
    render(<EyeDropperButton />)
    expect(screen.getByRole('button').style.border).toContain(
      'var(--rep-border'
    )
  })
})
