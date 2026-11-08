import {
  ImageColorPicker,
  eyeDropperCursor,
} from 'react-eyedropper-picker/loupe'
import photo from './pixel-art.png'

export default function MotionLoupe() {
  return (
    <ImageColorPicker
      src={photo}
      alt="Pixel art landscape"
      width={288}
      style={{ imageRendering: 'pixelated', borderRadius: 8 }}
      loupe={{ smoothing: 0.4, cursor: eyeDropperCursor }}
    />
  )
}
