import { describe, expect, it } from 'vitest'
import {
  clampMagnification,
  formatMagnification,
  keyMagnification,
  magnificationDetent,
  pinchMagnification,
  resolveMagnificationConfig,
  stepMagnification,
  wheelDeltaToNotches,
  wheelMagnification,
} from '../src/loupe/magnification'

const continuous = resolveMagnificationConfig()
const stepped = resolveMagnificationConfig({
  magnificationSteps: [2, 4, 8, 16, 32],
})

describe('resolveMagnificationConfig', () => {
  it('uses defaults 8, 1-64, continuous', () => {
    expect(continuous).toEqual({
      min: 1,
      max: 64,
      steps: undefined,
      defaultValue: 8,
    })
  })

  it('allows fractional values and no upper limit', () => {
    expect(
      resolveMagnificationConfig({
        defaultMagnification: 2.5,
        maxMagnification: 1000,
      })
    ).toMatchObject({ max: 1000, defaultValue: 2.5 })
  })

  it('keeps min at least 1 and max at least min', () => {
    expect(resolveMagnificationConfig({ minMagnification: 0.5 })).toMatchObject(
      { min: 1 }
    )
    expect(
      resolveMagnificationConfig({ minMagnification: 10, maxMagnification: 4 })
    ).toMatchObject({ min: 10, max: 10, defaultValue: 10 })
  })

  it('falls back to defaults for invalid numbers', () => {
    expect(
      resolveMagnificationConfig({
        defaultMagnification: Number.NaN,
        minMagnification: -1,
        maxMagnification: Infinity,
      })
    ).toEqual(continuous)
  })

  it('clamps the default into the range', () => {
    expect(
      resolveMagnificationConfig({ maxMagnification: 4 }).defaultValue
    ).toBe(4)
  })

  it('sorts, dedupes and range-filters steps', () => {
    expect(
      resolveMagnificationConfig({
        maxMagnification: 20,
        magnificationSteps: [16, 2, 0, 8, 2, 32, Number.NaN, 0.5],
      }).steps
    ).toEqual([2, 8, 16])
  })

  it('treats no usable steps as continuous', () => {
    expect(
      resolveMagnificationConfig({ magnificationSteps: [] }).steps
    ).toBeUndefined()
    expect(
      resolveMagnificationConfig({ magnificationSteps: [100] }).steps
    ).toBeUndefined()
  })
})

describe('clampMagnification', () => {
  it('limits to the range', () => {
    expect(clampMagnification(0.5, continuous)).toBe(1)
    expect(clampMagnification(12.5, continuous)).toBe(12.5)
    expect(clampMagnification(100, continuous)).toBe(64)
  })
})

describe('stepMagnification', () => {
  it('multiplies by 1.1 per step without steps', () => {
    expect(stepMagnification(8, 1, continuous)).toBe(8.8)
    expect(stepMagnification(8, 2, continuous)).toBe(9.68)
    expect(stepMagnification(8.8, -1, continuous)).toBe(8)
  })

  it('returns to the start value after in and out', () => {
    let m = 8
    for (let i = 0; i < 7; i++) m = stepMagnification(m, 1, continuous)
    for (let i = 0; i < 7; i++) m = stepMagnification(m, -1, continuous)
    expect(m).toBe(8)
  })

  it('stops at the range limits', () => {
    expect(stepMagnification(63, 1, continuous)).toBe(64)
    expect(stepMagnification(64, 1, continuous)).toBe(64)
    expect(stepMagnification(1, -1, continuous)).toBe(1)
  })

  it('moves between listed steps', () => {
    expect(stepMagnification(8, 1, stepped)).toBe(16)
    expect(stepMagnification(8, -1, stepped)).toBe(4)
    expect(stepMagnification(2, 3, stepped)).toBe(16)
  })

  it('snaps an in-between value to the neighbour in that direction', () => {
    expect(stepMagnification(10, 1, stepped)).toBe(16)
    expect(stepMagnification(10, -1, stepped)).toBe(8)
  })

  it('ignores float noise next to a step', () => {
    expect(stepMagnification(8.000000000001, 1, stepped)).toBe(16)
    expect(stepMagnification(7.999999999999, -1, stepped)).toBe(4)
  })

  it('stays past the last step', () => {
    expect(stepMagnification(32, 1, stepped)).toBe(32)
    expect(stepMagnification(48, 1, stepped)).toBe(48)
    expect(stepMagnification(48, -1, stepped)).toBe(32)
    expect(stepMagnification(2, -5, stepped)).toBe(2)
  })

  it('only clamps for zero steps', () => {
    expect(stepMagnification(10, 0, stepped)).toBe(10)
    expect(stepMagnification(100, 0, continuous)).toBe(64)
  })
})

describe('wheelDeltaToNotches', () => {
  it('maps wheel up to positive notches per deltaMode', () => {
    expect(wheelDeltaToNotches(-100, 0)).toBe(1)
    expect(wheelDeltaToNotches(-3, 1)).toBe(1)
    expect(wheelDeltaToNotches(-1, 2)).toBe(1)
    expect(wheelDeltaToNotches(200, 0)).toBe(-2)
    expect(wheelDeltaToNotches(-4, 0)).toBe(0.04)
  })
})

describe('wheelMagnification', () => {
  it('zooms by 1.1 per notch, fractions included, without steps', () => {
    expect(wheelMagnification(8, 1, continuous)).toEqual({
      magnification: 8.8,
      remainder: 0,
    })
    const half = wheelMagnification(8, 0.5, continuous)
    expect(half.magnification).toBeCloseTo(8 * Math.sqrt(1.1), 5)
    expect(half.remainder).toBe(0)
  })

  it('moves one step per whole notch and carries the fraction', () => {
    expect(wheelMagnification(8, 1, stepped)).toEqual({
      magnification: 16,
      remainder: 0,
    })
    const first = wheelMagnification(8, 0.6, stepped)
    expect(first).toEqual({ magnification: 8, remainder: 0.6 })
    const second = wheelMagnification(8, first.remainder + 0.6, stepped)
    expect(second.magnification).toBe(16)
    expect(second.remainder).toBeCloseTo(0.2)
  })

  it('carries negative fractions when zooming out', () => {
    const r = wheelMagnification(8, -1.5, stepped)
    expect(r.magnification).toBe(4)
    expect(r.remainder).toBeCloseTo(-0.5)
  })
})

describe('pinchMagnification', () => {
  it('scales by the finger distance ratio', () => {
    expect(pinchMagnification(8, 100, 200, continuous)).toBe(16)
    expect(pinchMagnification(8, 100, 50, continuous)).toBe(4)
    expect(pinchMagnification(8, 100, 156.25, continuous)).toBe(12.5)
  })

  it('is continuous even with steps', () => {
    expect(pinchMagnification(8, 100, 150, stepped)).toBe(12)
  })

  it('clamps to the range', () => {
    expect(pinchMagnification(8, 100, 10000, continuous)).toBe(64)
    expect(pinchMagnification(8, 100, 1, continuous)).toBe(1)
  })

  it('keeps the start value for a zero distance', () => {
    expect(pinchMagnification(8, 0, 100, continuous)).toBe(8)
    expect(pinchMagnification(8, 100, 0, continuous)).toBe(8)
  })
})

describe('keyMagnification', () => {
  it('steps in with + and =', () => {
    expect(keyMagnification('+', 8, stepped)).toBe(16)
    expect(keyMagnification('=', 8, continuous)).toBe(8.8)
  })

  it('steps out with - and _', () => {
    expect(keyMagnification('-', 8, stepped)).toBe(4)
    expect(keyMagnification('_', 8.8, continuous)).toBe(8)
  })

  it('returns to the default with 0', () => {
    expect(keyMagnification('0', 32, stepped)).toBe(8)
    const custom = resolveMagnificationConfig({ defaultMagnification: 3 })
    expect(keyMagnification('0', 20, custom)).toBe(3)
  })

  it('ignores other keys', () => {
    expect(keyMagnification('a', 8, continuous)).toBeNull()
    expect(keyMagnification('ArrowUp', 8, continuous)).toBeNull()
  })
})

describe('formatMagnification', () => {
  it('shows at most one decimal', () => {
    expect(formatMagnification(8)).toBe('8×')
    expect(formatMagnification(12.5)).toBe('12.5×')
    expect(formatMagnification(9.68)).toBe('9.7×')
    expect(formatMagnification(8.000001)).toBe('8×')
  })
})

describe('magnificationDetent', () => {
  it('crosses exactly one detent per continuous step', () => {
    let value = continuous.min
    let detent = magnificationDetent(value, continuous)
    for (let i = 0; i < 40; i++) {
      value = stepMagnification(value, 1, continuous)
      const next = magnificationDetent(value, continuous)
      expect(next).toBe(detent + 1)
      detent = next
    }
  })

  it('crosses one per step from any start, also zooming out', () => {
    let value = 8
    let detent = magnificationDetent(value, continuous)
    for (let i = 0; i < 15; i++) {
      value = stepMagnification(value, -1, continuous)
      const next = magnificationDetent(value, continuous)
      expect(next).toBe(detent - 1)
      detent = next
    }
  })

  it('does not change for small continuous moves within a detent', () => {
    expect(magnificationDetent(8.01, continuous)).toBe(
      magnificationDetent(8.05, continuous)
    )
  })

  it('counts the steps at or below the value', () => {
    expect(magnificationDetent(1, stepped)).toBe(0)
    expect(magnificationDetent(2, stepped)).toBe(1)
    expect(magnificationDetent(3, stepped)).toBe(1)
    expect(magnificationDetent(8, stepped)).toBe(3)
    expect(magnificationDetent(8 * (1 - 1e-12), stepped)).toBe(3)
    expect(magnificationDetent(64, stepped)).toBe(5)
  })
})
