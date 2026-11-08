import { ImageColorPicker } from 'react-eyedropper-picker/loupe'
import photo from './pixel-art.png'

/** A short two-note chime instead of the built-in click. */
const chime = (ctx: AudioContext, _speed: number, output: AudioNode) => {
  const now = ctx.currentTime
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const start = now + i * 0.08
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.4, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
    osc.connect(gain).connect(output)
    osc.start(start)
    osc.stop(start + 0.3)
  }
}

export default function CustomSound() {
  return (
    <ImageColorPicker
      src={photo}
      alt="Pixel art landscape"
      width={288}
      style={{ imageRendering: 'pixelated', borderRadius: 8 }}
      loupe={{
        sound: {
          volume: 0.4,
          events: { pixel: false },
          play: { confirm: chime },
        },
      }}
    />
  )
}
