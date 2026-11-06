/**
 * - `'light'` (default) and `'dark'`: fixed colors.
 * - `'auto'`: follows the user's OS setting with CSS `light-dark()`, no
 *   JavaScript, so it is right on the first paint (SSR included).
 *
 * Any color can be overridden with the `--rep-*` CSS variables.
 */
export type ColorPickerTheme = 'light' | 'dark' | 'auto'

/** Light and dark default of each `--rep-<name>` variable. */
const TOKENS = {
  bg: ['#fff', '#1f1f23'],
  fg: ['#111', '#f2f2f5'],
  border: ['rgba(0,0,0,.15)', 'rgba(255,255,255,.18)'],
  'input-bg': ['#fff', '#2a2a30'],
  /** Color of the picker's drop shadow. */
  shadow: ['rgba(0,0,0,.12)', 'rgba(0,0,0,.5)'],
} as const satisfies Record<string, readonly [light: string, dark: string]>

export type ThemeToken = keyof typeof TOKENS

/** `var(--rep-<name>, <default for theme>)`, for inline styles. */
export const themeVar = (
  name: ThemeToken,
  theme: ColorPickerTheme = 'light'
): string => {
  const [light, dark] = TOKENS[name]
  const value =
    theme === 'dark'
      ? dark
      : theme === 'auto'
        ? `light-dark(${light}, ${dark})`
        : light
  return `var(--rep-${name}, ${value})`
}

/** `color-scheme` for the theme: native inputs and `light-dark()` follow it. */
export const themeColorScheme = (theme: ColorPickerTheme = 'light') =>
  theme === 'auto' ? 'light dark' : theme
