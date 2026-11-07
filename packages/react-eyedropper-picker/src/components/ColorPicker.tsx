import { useEffect, useState, type CSSProperties } from 'react'
import {
  useColorPicker,
  type UseColorPickerOptions,
} from '../hooks/useColorPicker'
import { SaturationPanel } from './SaturationPanel'
import { HueSlider } from './HueSlider'
import { EyeDropperButton } from './EyeDropperButton'
import { normalizeHex } from '../utils/color'
import { themeColorScheme, themeVar, type ColorPickerTheme } from '../theme'

export type ColorPickerProps = UseColorPickerOptions & {
  /**
   * Show the eye dropper button when `eyeDropper.isSupported` (by default:
   * when the browser has the native EyeDropper API). Default true.
   */
  showEyeDropper?: boolean
  /** Show the hex text input. Default true. */
  showInput?: boolean
  /**
   * `'light'` (default), `'dark'`, or `'auto'` to follow the OS setting.
   * Colors can also be set with `--rep-*` CSS variables.
   */
  theme?: ColorPickerTheme
  className?: string
  style?: CSSProperties
}

export const ColorPicker = ({
  showEyeDropper = true,
  showInput = true,
  theme = 'light',
  className,
  style,
  ...options
}: ColorPickerProps) => {
  const { hex, hsv, setHex, setHsv, pickFromScreen, isEyeDropperSupported } =
    useColorPicker(options)

  // Local draft so typing partial hex doesn't get overwritten
  const [draft, setDraft] = useState(hex)
  useEffect(() => {
    setDraft((d) => (normalizeHex(d) === hex ? d : hex))
  }, [hex])

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: 240,
        padding: 12,
        borderRadius: 10,
        colorScheme: themeColorScheme(theme),
        background: themeVar('bg', theme),
        color: themeVar('fg', theme),
        boxShadow: `0 4px 16px ${themeVar('shadow', theme)}`,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <SaturationPanel hsv={hsv} onChange={setHsv} />
      <HueSlider hue={hsv.h} onChange={(h) => setHsv({ ...hsv, h })} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: 6,
            background: hex,
            boxShadow: `inset 0 0 0 1px ${themeVar('border', theme)}`,
          }}
        />
        {showInput && (
          <input
            aria-label="Hex color"
            value={draft}
            spellCheck={false}
            onChange={(e) => {
              setDraft(e.target.value)
              setHex(e.target.value)
            }}
            onBlur={() => setDraft(hex)}
            style={{
              flex: 1,
              minWidth: 0,
              height: 32,
              padding: '0 8px',
              border: `1px solid ${themeVar('border', theme)}`,
              borderRadius: 6,
              background: themeVar('input-bg', theme),
              color: 'inherit',
              font: 'inherit',
              fontFamily: 'ui-monospace, monospace',
              boxSizing: 'border-box',
            }}
          />
        )}
        {showEyeDropper && isEyeDropperSupported && (
          <EyeDropperButton
            onClick={() => void pickFromScreen()}
            style={{ borderColor: themeVar('border', theme) }}
            // A custom eye dropper (e.g. the loupe) may not pick from the screen.
            {...(options.eyeDropper && {
              'aria-label': 'Pick a color',
              title: 'Pick a color',
            })}
          />
        )}
      </div>
    </div>
  )
}
