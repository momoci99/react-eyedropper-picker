import { describe, expect, it } from 'vitest'
import {
  hexToHsv,
  hexToRgb,
  hexToRgba,
  normalizeHexAlpha,
  rgbaToHex,
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

describe('alpha utils', () => {
  it('normalizes every hex length to #rrggbbaa', () => {
    expect(normalizeHexAlpha('#abc')).toBe('#aabbccff')
    expect(normalizeHexAlpha('abcd')).toBe('#aabbccdd')
    expect(normalizeHexAlpha(' #AABBCC ')).toBe('#aabbccff')
    expect(normalizeHexAlpha('#AABBCC80')).toBe('#aabbcc80')
    for (const bad of ['#ab', '#abcde', '#aabbccd', 'nope', '']) {
      expect(normalizeHexAlpha(bad)).toBeNull()
    }
  })

  it('parses and formats RGBA', () => {
    expect(hexToRgba('#33669980')).toEqual({
      r: 0x33,
      g: 0x66,
      b: 0x99,
      a: 0x80 / 255,
    })
    expect(hexToRgba('#336699')!.a).toBe(1)
    expect(hexToRgba('nope')).toBeNull()
    expect(rgbaToHex({ r: 51, g: 102, b: 153, a: 0.5 })).toBe('#33669980')
    expect(rgbaToHex({ r: 0, g: 0, b: 0, a: 2 })).toBe('#000000ff')
    expect(rgbaToHex({ r: 0, g: 0, b: 0, a: -1 })).toBe('#00000000')
  })

  it('leaves normalizeHex without alpha', () => {
    expect(normalizeHex('#aabbcc80')).toBeNull()
  })
})
