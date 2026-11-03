export type RGB = { r: number; g: number; b: number }
/** h: 0-360, s: 0-100, v: 0-100 */
export type HSV = { h: number; s: number; v: number }

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export const isValidHex = (hex: string): boolean => HEX_RE.test(hex.trim())

/** Normalizes `#abc`, `abc`, `#AABBCC` to lowercase `#aabbcc`. Returns null if invalid. */
export const normalizeHex = (hex: string): string | null => {
  const match = HEX_RE.exec(hex.trim())
  if (!match) return null
  let body = match[1]!.toLowerCase()
  if (body.length === 3) {
    body = body
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return `#${body}`
}

export const hexToRgb = (hex: string): RGB | null => {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const n = parseInt(normalized.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export const rgbToHex = ({ r, g, b }: RGB): string =>
  '#' +
  [r, g, b]
    .map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0'))
    .join('')

export const rgbToHsv = ({ r, g, b }: RGB): HSV => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 }
}

export const hsvToRgb = ({ h, s, v }: HSV): RGB => {
  const sn = clamp(s, 0, 100) / 100
  const vn = clamp(v, 0, 100) / 100
  const f = (n: number) => {
    const k = (n + (((h % 360) + 360) % 360) / 60) % 6
    return vn - vn * sn * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 }
}

export const hexToHsv = (hex: string): HSV | null => {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToHsv(rgb) : null
}

export const hsvToHex = (hsv: HSV): string => rgbToHex(hsvToRgb(hsv))
