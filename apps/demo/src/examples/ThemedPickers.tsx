import type { CSSProperties } from 'react'
import { ColorPicker } from 'react-eyedropper-picker'

/** CSS variables can be set on any element above the picker. */
const solarized = {
  '--rep-bg': '#fdf6e3',
  '--rep-fg': '#586e75',
  '--rep-border': '#d9cfb3',
  '--rep-input-bg': '#eee8d5',
} as CSSProperties

export default function ThemedPickers() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <ColorPicker theme="light" defaultValue="#2563eb" />
      <ColorPicker theme="dark" defaultValue="#f97316" />
      <div style={solarized}>
        <ColorPicker defaultValue="#268bd2" />
      </div>
    </div>
  )
}
