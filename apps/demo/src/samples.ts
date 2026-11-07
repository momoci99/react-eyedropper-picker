// Sample sources drawn on canvases, so the demo needs no image files and
// never hits CORS.

const PIXEL_ART_PALETTE = {
  sky: ['#1e1b4b', '#312e81', '#4338ca', '#6366f1', '#a5b4fc'],
  sun: '#fde68a',
  sunCore: '#fbbf24',
  hillFar: '#0f766e',
  hillNear: '#15803d',
  ground: '#3f6212',
  wall: '#fef3c7',
  roof: '#b91c1c',
  door: '#78350f',
  window: '#facc15',
}

/** 48x32 pixel landscape. Shown large, so each source pixel is a big cell. */
export const drawPixelArt = (canvas: HTMLCanvasElement) => {
  const w = 48
  const h = 32
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const p = PIXEL_ART_PALETTE
  const px = (x: number, y: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, 1, 1)
  }

  // Sky in bands.
  for (let y = 0; y < h; y++) {
    const band = Math.min(p.sky.length - 1, Math.floor((y / 20) * p.sky.length))
    ctx.fillStyle = p.sky[band]!
    ctx.fillRect(0, y, w, 1)
  }
  // Stars.
  for (const [x, y] of [
    [3, 2],
    [11, 4],
    [19, 1],
    [27, 3],
    [41, 2],
    [45, 6],
    [7, 7],
  ]) {
    px(x!, y!, '#fff')
  }
  // Sun.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - 36, y - 11)
      if (d < 3.2) px(x, y, p.sunCore)
      else if (d < 5) px(x, y, p.sun)
    }
  }
  // Hills.
  for (let x = 0; x < w; x++) {
    const far = Math.round(19 + 3 * Math.sin(x / 6))
    const near = Math.round(24 + 2 * Math.sin(x / 4 + 2))
    ctx.fillStyle = p.hillFar
    ctx.fillRect(x, far, 1, h - far)
    ctx.fillStyle = p.hillNear
    ctx.fillRect(x, near, 1, h - near)
  }
  ctx.fillStyle = p.ground
  ctx.fillRect(0, 28, w, 4)
  // House.
  ctx.fillStyle = p.wall
  ctx.fillRect(10, 21, 9, 7)
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = p.roof
    ctx.fillRect(10 + i, 20 - i, 9 - 2 * i, 1)
  }
  ctx.fillStyle = p.door
  ctx.fillRect(13, 24, 2, 4)
  px(16, 23, p.window)
  px(17, 23, p.window)
}

/**
 * 720x420 color field: hue left to right, white at the top, black at the
 * bottom, with 1px lines to aim at.
 */
export const drawColorField = (canvas: HTMLCanvasElement) => {
  const w = 720
  const h = 420
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const hue = ctx.createLinearGradient(0, 0, w, 0)
  for (let i = 0; i <= 6; i++)
    hue.addColorStop(i / 6, `hsl(${i * 60} 100% 50%)`)
  ctx.fillStyle = hue
  ctx.fillRect(0, 0, w, h)

  const light = ctx.createLinearGradient(0, 0, 0, h)
  light.addColorStop(0, 'rgba(255, 255, 255, 1)')
  light.addColorStop(0.5, 'rgba(255, 255, 255, 0)')
  light.addColorStop(0.5, 'rgba(0, 0, 0, 0)')
  light.addColorStop(1, 'rgba(0, 0, 0, 1)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, w, h)

  // 1px lines in alternating colors: easy to miss without a loupe.
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#000' : '#fff'
    ctx.fillRect(60 + i * 50, 60, 1, h - 120)
  }
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillText('1px lines: try 32× and up', 64, 48)
}

/** Draws a sample once and returns it as a PNG data URL for an `<img>`. */
export const toDataUrl = (draw: (canvas: HTMLCanvasElement) => void) => {
  const canvas = document.createElement('canvas')
  draw(canvas)
  return canvas.toDataURL('image/png')
}

/** Video sample: 16:9 frames, 10 CSS px per pixel-art pixel. */
const VIDEO_SCALE = 10
const VIDEO_WIDTH = 480
const VIDEO_HEIGHT = 270
/** Video pixels scrolled per second. */
const VIDEO_SPEED = 60

/**
 * Plays the pixel art scrolling sideways in `video`, from a canvas stream:
 * no video file, same origin. Returns a cleanup function.
 */
export const playPixelArtVideo = (video: HTMLVideoElement) => {
  const art = document.createElement('canvas')
  drawPixelArt(art)
  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_WIDTH
  canvas.height = VIDEO_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx || !canvas.captureStream) return () => {}
  ctx.imageSmoothingEnabled = false

  const tile = art.width * VIDEO_SCALE
  // Bottom of the art; the frame is shorter than the art.
  const top = VIDEO_HEIGHT - art.height * VIDEO_SCALE
  let raf = 0
  const draw = (now: number) => {
    // Whole video pixels, so art pixels keep sharp edges while it glides.
    const shift = Math.floor((now / 1000) * VIDEO_SPEED) % tile
    for (let x = -shift; x < VIDEO_WIDTH; x += tile) {
      ctx.drawImage(art, x, top, tile, art.height * VIDEO_SCALE)
    }
    raf = requestAnimationFrame(draw)
  }
  draw(performance.now())

  // No frame rate: a new frame each time the canvas changes (every rAF).
  const stream = canvas.captureStream()
  video.srcObject = stream
  video.play().catch(() => {})
  return () => {
    cancelAnimationFrame(raf)
    for (const track of stream.getTracks()) track.stop()
    video.srcObject = null
  }
}
