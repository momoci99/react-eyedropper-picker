import { afterEach, describe, expect, it } from 'vitest'
import {
  followFactor,
  followMagnification,
  followPoint,
  reducedMotionQuery,
  smoothingTimeConstant,
} from '../src/loupe/motion'
import { mockReducedMotion, resetReducedMotion } from './loupe-mocks'

describe('smoothingTimeConstant', () => {
  it('is 0 for no smoothing and bad values', () => {
    for (const v of [undefined, 0, -1, NaN]) {
      expect(smoothingTimeConstant(v)).toBe(0)
    }
  })

  it('grows with smoothing and clamps at 1', () => {
    expect(smoothingTimeConstant(0.5)).toBeGreaterThan(0)
    expect(smoothingTimeConstant(1)).toBeGreaterThan(smoothingTimeConstant(0.5))
    expect(smoothingTimeConstant(5)).toBe(smoothingTimeConstant(1))
  })
})

describe('followFactor', () => {
  it('covers everything without a time constant', () => {
    expect(followFactor(16, 0)).toBe(1)
  })

  it('moves the same at any frame rate', () => {
    const tau = 50
    const once = followFactor(16, tau)
    const half = followFactor(8, tau)
    // Two 8ms steps leave the same remainder as one 16ms step.
    expect((1 - half) ** 2).toBeCloseTo(1 - once, 10)
  })

  it('stays between 0 and 1', () => {
    expect(followFactor(-5, 50)).toBe(0)
    expect(followFactor(1e6, 50)).toBe(1)
  })
})

describe('followPoint', () => {
  const target = { x: 100, y: 50 }

  it('moves part of the way', () => {
    expect(followPoint({ x: 0, y: 0 }, target, 0.25)).toEqual({
      x: 25,
      y: 12.5,
    })
  })

  it('returns the target itself once close or at factor 1', () => {
    expect(followPoint({ x: 99.9, y: 50.1 }, target, 0.1)).toBe(target)
    expect(followPoint({ x: 0, y: 0 }, target, 1)).toBe(target)
  })
})

describe('followMagnification', () => {
  it('moves in log space: 2→4 and 16→32 take the same share', () => {
    expect(followMagnification(2, 4, 0.5)).toBeCloseTo(2 * Math.SQRT2, 10)
    expect(followMagnification(16, 32, 0.5) / 16).toBeCloseTo(
      followMagnification(2, 4, 0.5) / 2,
      10
    )
  })

  it('zooms out too', () => {
    const m = followMagnification(32, 8, 0.5)
    expect(m).toBeLessThan(32)
    expect(m).toBeGreaterThan(8)
  })

  it('snaps when close or at factor 1', () => {
    expect(followMagnification(8.001, 8, 0.1)).toBe(8)
    expect(followMagnification(2, 8, 1)).toBe(8)
  })
})

describe('reducedMotionQuery', () => {
  afterEach(() => resetReducedMotion())

  it('is false without matchMedia', () => {
    expect(reducedMotionQuery(window)()).toBe(false)
  })

  it('reads the preference live', () => {
    const query = mockReducedMotion(true)
    const reduced = reducedMotionQuery(window)
    expect(reduced()).toBe(true)
    query.matches = false
    expect(reduced()).toBe(false)
  })
})
