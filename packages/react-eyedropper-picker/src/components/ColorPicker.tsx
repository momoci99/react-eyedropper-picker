import { useEffect, useState, type CSSProperties } from 'react'
import { useColorPicker, type UseColorPickerOptions } from '../hooks/useColorPicker'
import { SaturationPanel } from './SaturationPanel'
import { HueSlider } from './HueSlider'
import { EyeDropperButton } from './EyeDropperButton'
import { normalizeHex } from '../utils/color'

export type ColorPickerProps = UseColorPickerOptions & {
  /** Show the eye dropper button when the browser supports it. Default true. */
  showEyeDropper?: boolean
  /** Show the hex text input. Default true. */
  showInput?: boolean
  className?: string
  style?: CSSProperties
}

export const ColorPicker = ({
  showEyeDropper = true,
  showInput = true,
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
        background: '#fff',
        color: '#111',
        boxShadow: '0 4px 16px rgba(0,0,0,.12)',
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
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)',
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
              border: '1px solid rgba(0,0,0,.15)',
              borderRadius: 6,
              font: 'inherit',
              fontFamily: 'ui-monospace, monospace',
              boxSizing: 'border-box',
            }}
          />
        )}
        {showEyeDropper && isEyeDropperSupported && (
          <EyeDropperButton onClick={() => void pickFromScreen()} />
        )}
      </div>
    </div>
  )
}
