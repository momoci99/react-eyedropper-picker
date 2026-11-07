import { useEffect, useState, type CSSProperties } from 'react'
import {
  useColorPicker,
  type UseColorPickerOptions,
} from '../hooks/useColorPicker'
import { SaturationPanel } from './SaturationPanel'
import { HueSlider } from './HueSlider'
import { AlphaSlider, overCheckerboard } from './AlphaSlider'
import { EyeDropperButton } from './EyeDropperButton'
import {
  useColorHistory,
  type UseColorHistoryOptions,
  type UseColorHistoryResult,
} from '../hooks/useColorHistory'
import { normalizeHex, normalizeHexAlpha } from '../utils/color'
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
  /**
   * Show recently picked colors under the input; click one to use it.
   * Eye dropper picks are added. `true` keeps them in memory; options
   * (e.g. `storageKey`) are passed to `useColorHistory`; a
   * `useColorHistory()` result shares one history with your own code.
   * Default false.
   */
  history?: boolean | UseColorHistoryOptions | UseColorHistoryResult
  /**
   * While dragging the panel or hue slider by touch, show the color in a
   * bubble above the finger. Default true.
   */
  touchBubble?: boolean
  className?: string
  style?: CSSProperties
}

export const ColorPicker = ({
  showEyeDropper = true,
  showInput = true,
  theme = 'light',
  history = false,
  touchBubble = true,
  className,
  style,
  ...options
}: ColorPickerProps) => {
  const {
    hex,
    hsv,
    alpha,
    setHex,
    setHsv,
    setAlpha,
    pickFromScreen,
    isEyeDropperSupported,
  } = useColorPicker(options)
  const normalize = options.alpha ? normalizeHexAlpha : normalizeHex

  const external = isHistoryResult(history) ? history : null
  const own = useColorHistory(
    typeof history === 'object' && !isHistoryResult(history)
      ? history
      : undefined
  )
  const recent = history ? (external ?? own) : null

  // Local draft so typing partial hex doesn't get overwritten
  const [draft, setDraft] = useState(hex)
  useEffect(() => {
    setDraft((d) => (normalize(d) === hex ? d : hex))
  }, [hex, normalize])
  // Turning alpha on or off changes the format: show the new one.
  const [draftAlpha, setDraftAlpha] = useState(options.alpha)
  if (draftAlpha !== options.alpha) {
    setDraftAlpha(options.alpha)
    setDraft(hex)
  }

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
      <SaturationPanel hsv={hsv} onChange={setHsv} touchBubble={touchBubble} />
      <HueSlider
        hue={hsv.h}
        onChange={(h) => setHsv({ ...hsv, h })}
        touchBubble={touchBubble}
      />
      {options.alpha && (
        <AlphaSlider
          color={hex}
          alpha={alpha}
          onChange={setAlpha}
          touchBubble={touchBubble}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: 6,
            background: overCheckerboard(hex),
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
            onClick={() =>
              void pickFromScreen().then((picked) => {
                if (picked) recent?.add(picked)
              })
            }
            style={{ borderColor: themeVar('border', theme) }}
            // A custom eye dropper (e.g. the loupe) may not pick from the screen.
            {...(options.eyeDropper && {
              'aria-label': 'Pick a color',
              title: 'Pick a color',
            })}
          />
        )}
      </div>
      {recent && recent.colors.length > 0 && (
        <RecentColors
          colors={recent.colors}
          current={normalizeHexAlpha(hex)!}
          theme={theme}
          onSelect={setHex}
        />
      )}
    </div>
  )
}

const isHistoryResult = (
  history: ColorPickerProps['history']
): history is UseColorHistoryResult =>
  typeof history === 'object' && 'add' in history

type RecentColorsProps = {
  colors: readonly string[]
  /** `#rrggbbaa`, to compare with any stored form. */
  current: string
  theme: ColorPickerTheme
  onSelect: (hex: string) => void
}

const RecentColors = ({
  colors,
  current,
  theme,
  onSelect,
}: RecentColorsProps) => (
  <div
    role="group"
    aria-label="Recent colors"
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(20px, 1fr))',
      gap: 6,
    }}
  >
    {colors.map((color) => (
      <button
        key={color}
        type="button"
        aria-label={color}
        title={color}
        onClick={() => onSelect(color)}
        style={{
          aspectRatio: '1',
          padding: 0,
          border: 'none',
          borderRadius: 4,
          background: overCheckerboard(color),
          boxShadow:
            normalizeHexAlpha(color) === current
              ? `0 0 0 2px ${themeVar('bg', theme)}, 0 0 0 3px ${themeVar('fg', theme)}`
              : `inset 0 0 0 1px ${themeVar('border', theme)}`,
          cursor: 'pointer',
        }}
      />
    ))}
  </div>
)
