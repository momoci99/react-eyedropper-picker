import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoupeFeedback, createTickGate } from '../src/loupe/feedback'
import type { LoupeSoundEvent } from '../src/loupe/sound'
import {
  mockAudioContext,
  mockUserActivation,
  mockVibrate,
  resetAudioContext,
  resetBrowserMocks,
} from './audio-mocks'

describe('createTickGate', () => {
  it('plays the first tick at speed 0', () => {
    expect(createTickGate(25)(1000)).toBe(0)
  })

  it('merges ticks closer than minInterval to the last played one', () => {
    const gate = createTickGate(25)
    expect(gate(0)).not.toBeNull()
    expect(gate(10)).toBeNull()
    expect(gate(20)).toBeNull()
    // 25ms after the last *played* tick, not the last merged one.
    expect(gate(25)).not.toBeNull()
  })

  it('never merges with minInterval 0', () => {
    const gate = createTickGate(0)
    for (let t = 0; t < 50; t += 5) expect(gate(t)).not.toBeNull()
  })

  it('speeds up toward 1 on a fast sweep', () => {
    const gate = createTickGate(25)
    const speeds: number[] = []
    for (let t = 0; t <= 1000; t += 16) {
      const s = gate(t)
      if (s !== null) speeds.push(s)
    }
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1]!)
    }
    expect(speeds.at(-1)).toBe(1)
  })

  it('stays slow when ticks are far apart', () => {
    const gate = createTickGate(25)
    for (let t = 0; t <= 2000; t += 250) expect(gate(t)).toBe(0)
  })

  it('resets the speed after a pause', () => {
    const gate = createTickGate(25)
    for (let t = 0; t <= 500; t += 16) gate(t)
    expect(gate(1000)).toBe(0)
  })
})

describe('createLoupeFeedback', () => {
  beforeEach(() => mockAudioContext())
  afterEach(() => {
    resetAudioContext()
    resetBrowserMocks()
    vi.restoreAllMocks()
  })

  /** Sound with every event replaced by a spy, on a running context. */
  const withSpies = (haptics = false) => {
    const spies = {
      pixel: vi.fn(),
      zoom: vi.fn(),
      open: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
    }
    let time = 0
    const feedback = createLoupeFeedback(
      document,
      { sound: { play: spies }, haptics },
      () => time
    )!
    feedback.unlock()
    return {
      feedback,
      spies,
      at: (t: number) => {
        time = t
      },
    }
  }

  it('is null when sound and haptics are off', () => {
    expect(createLoupeFeedback(document, {})).toBeNull()
    expect(
      createLoupeFeedback(document, { sound: false, haptics: false })
    ).toBeNull()
  })

  it('is null for haptics alone where vibrate is missing', () => {
    expect(createLoupeFeedback(document, { haptics: true })).toBeNull()
  })

  it('plays each event', () => {
    const { feedback, spies } = withSpies()
    feedback.open()
    feedback.pixel()
    feedback.zoom()
    feedback.confirm()
    feedback.cancel()
    for (const e of Object.keys(spies) as LoupeSoundEvent[]) {
      expect(spies[e], e).toHaveBeenCalledTimes(1)
    }
    feedback.destroy()
  })

  it('merges fast pixel ticks and passes the speed', () => {
    const { feedback, spies, at } = withSpies()
    at(0)
    feedback.pixel()
    at(10)
    feedback.pixel()
    at(40)
    feedback.pixel()
    expect(spies.pixel).toHaveBeenCalledTimes(2)
    expect(spies.pixel.mock.calls[0]![1]).toBe(0)
    expect(spies.pixel.mock.calls[1]![1]).toBeGreaterThan(0)
    feedback.destroy()
  })

  it('gates zoom ticks separately from pixel ticks', () => {
    const { feedback, spies, at } = withSpies()
    at(0)
    feedback.pixel()
    feedback.zoom()
    at(5)
    feedback.zoom()
    expect(spies.pixel).toHaveBeenCalledTimes(1)
    expect(spies.zoom).toHaveBeenCalledTimes(1)
    feedback.destroy()
  })

  it('uses minTickInterval from the sound options', () => {
    const pixel = vi.fn()
    let time = 0
    const feedback = createLoupeFeedback(
      document,
      { sound: { minTickInterval: 100, play: { pixel } } },
      () => time
    )!
    feedback.unlock()
    feedback.pixel()
    time = 50
    feedback.pixel()
    time = 100
    feedback.pixel()
    expect(pixel).toHaveBeenCalledTimes(2)
    feedback.destroy()
  })

  describe('haptics', () => {
    it('vibrates on pixel ticks and confirm only', () => {
      mockUserActivation(true)
      const vibrate = mockVibrate()
      const { feedback } = withSpies(true)
      feedback.open()
      feedback.zoom()
      feedback.cancel()
      expect(vibrate).not.toHaveBeenCalled()
      feedback.pixel()
      expect(vibrate).toHaveBeenCalledTimes(1)
      feedback.confirm()
      expect(vibrate).toHaveBeenCalledTimes(2)
      expect(vibrate.mock.calls[1]![0]).toBeInstanceOf(Array)
      feedback.destroy()
    })

    it('vibrates once per played tick, not per merged one', () => {
      mockUserActivation(true)
      const vibrate = mockVibrate()
      const { feedback, at } = withSpies(true)
      at(0)
      feedback.pixel()
      at(10)
      feedback.pixel()
      expect(vibrate).toHaveBeenCalledTimes(1)
      feedback.destroy()
    })

    it('works without sound', () => {
      mockUserActivation(true)
      const vibrate = mockVibrate()
      const feedback = createLoupeFeedback(document, { haptics: true })!
      feedback.unlock()
      feedback.confirm()
      expect(vibrate).toHaveBeenCalledTimes(1)
      feedback.destroy()
    })

    it('waits for a user gesture', () => {
      mockUserActivation(false)
      const vibrate = mockVibrate()
      const feedback = createLoupeFeedback(document, { haptics: true })!
      feedback.confirm()
      expect(vibrate).not.toHaveBeenCalled()
    })

    it('ignores a throwing vibrate', () => {
      mockUserActivation(true)
      mockVibrate().mockImplementation(() => {
        throw new Error('not allowed')
      })
      const feedback = createLoupeFeedback(document, { haptics: true })!
      expect(() => feedback.confirm()).not.toThrow()
    })
  })
})
