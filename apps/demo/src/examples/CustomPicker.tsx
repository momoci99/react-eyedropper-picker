import {
  AlphaSlider,
  EyeDropperButton,
  HueSlider,
  SaturationPanel,
  useColorPicker,
} from 'react-eyedropper-picker'

export default function CustomPicker() {
  const { hex, hsv, alpha, setHsv, setAlpha, pickColor, canPickColor } =
    useColorPicker({ defaultValue: '#22c55e', alpha: true })
  return (
    <div style={{ display: 'grid', gap: 12, width: 280 }}>
      <SaturationPanel hsv={hsv} onChange={setHsv} style={{ height: 120 }} />
      <HueSlider hue={hsv.h} onChange={(h) => setHsv({ ...hsv, h })} />
      <AlphaSlider color={hex} alpha={alpha} onChange={setAlpha} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {canPickColor && <EyeDropperButton onClick={pickColor} />}
        <code>{hex}</code>
      </div>
    </div>
  )
}
