import { inflateSync } from 'node:zlib'

/**
 * Decodes the PNGs Chrome's screencast sends (8-bit RGB or RGBA, not
 * interlaced) to RGBA pixels. Enough for this script, so no dependency.
 */
export const decodePng = (buf) => {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG')
  let width = 0
  let height = 0
  let bpp = 0
  const idat = []
  for (let pos = 8; pos < buf.length;) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('latin1', pos + 4, pos + 8)
    const body = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      const [depth, colorType, , , interlace] = body.subarray(8, 13)
      if (depth !== 8 || (colorType !== 2 && colorType !== 6) || interlace) {
        throw new Error(
          `Unsupported PNG: depth ${depth}, color type ${colorType}`
        )
      }
      bpp = colorType === 6 ? 4 : 3
    } else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const px = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const row = y * stride
    const up = row - stride
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[row + x - bpp] : 0
      const b = y > 0 ? px[up + x] : 0
      const c = x >= bpp && y > 0 ? px[up + x - bpp] : 0
      let v = raw[src + x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[row + x] = v & 255
    }
  }
  if (bpp === 4) return { width, height, data: px }
  const data = new Uint8Array(width * height * 4)
  for (let i = 0, j = 0; i < px.length; i += 3, j += 4) {
    data[j] = px[i]
    data[j + 1] = px[i + 1]
    data[j + 2] = px[i + 2]
    data[j + 3] = 255
  }
  return { width, height, data }
}
