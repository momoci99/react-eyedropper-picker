import { describe, expect, it } from 'vitest'
import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  isValidHex,
  normalizeHex,
  rgbToHex,
} from '../src/utils/color'

describe('color utils', () => {
  it('normalizes hex', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('ff0000')).toBe('#ff0000')
    expect(normalizeHex(' #00FF00 ')).toBe('#00ff00')
    expect(normalizeHex('#ggg')).toBeNull()
    expect(normalizeHex('#abcd')).toBeNull()
    expect(isValidHex('#123456')).toBe(true)
  })

  it('converts hex <-> rgb', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 })
    expect(rgbToHex({ r: 255, g: 128, b: 0 })).toBe('#ff8000')
  })

  it.each([
    '#000000',
    '#ffffff',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#123456',
    '#abcdef',
    '#7f7f7f',
  ])('round-trips %s through HSV', (hex) => {
    expect(hsvToHex(hexToHsv(hex)!)).toBe(hex)
  })

  it('computes HSV', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 100, v: 100 })
    expect(hexToHsv('#0000ff')!.h).toBe(240)
  })
})
