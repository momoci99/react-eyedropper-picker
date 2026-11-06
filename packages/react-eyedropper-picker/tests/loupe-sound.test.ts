import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLoupeSound,
  DEFAULT_MIN_TICK_INTERVAL,
  DEFAULT_SOUND_VOLUME,
  MAX_VOICES,
  resolveSoundOptions,
  type LoupeSoundOptions,
} from '../src/loupe/sound'
import {
  FakeAudioContext,
  mockAudioContext,
  mockUserActivation,
  resetAudioContext,
  resetBrowserMocks,
  setVisibility,
} from './audio-mocks'

const allOn = {
  pixel: true,
  zoom: true,
  open: true,
  confirm: true,
  cancel: true,
}

describe('resolveSoundOptions', () => {
  it('is null when sound is off', () => {
    expect(resolveSoundOptions(undefined)).toBeNull()
    expect(resolveSoundOptions(false)).toBeNull()
  })

  it('uses the defaults for true', () => {
    expect(resolveSoundOptions(true)).toEqual({
      volume: DEFAULT_SOUND_VOLUME,
      events: allOn,
      minTickInterval: DEFAULT_MIN_TICK_INTERVAL,
      play: {},
    })
  })

  it('turns off only the events set to false', () => {
    expect(
      resolveSoundOptions({ events: { pixel: false, zoom: true } })!.events
    ).toEqual({ ...allOn, pixel: false })
  })

  it('clamps volume to 0..1 and ignores bad numbers', () => {
    expect(resolveSoundOptions({ volume: 2 })!.volume).toBe(1)
    expect(resolveSoundOptions({ volume: -1 })!.volume).toBe(0)
    expect(resolveSoundOptions({ volume: NaN })!.volume).toBe(
      DEFAULT_SOUND_VOLUME
    )
  })

  it('accepts minTickInterval 0 and ignores negative or non-finite', () => {
    expect(resolveSoundOptions({ minTickInterval: 0 })!.minTickInterval).toBe(0)
    for (const bad of [-5, Infinity, NaN]) {
      expect(
        resolveSoundOptions({ minTickInterval: bad })!.minTickInterval
      ).toBe(DEFAULT_MIN_TICK_INTERVAL)
    }
  })
})

describe('createLoupeSound', () => {
  beforeEach(() => mockAudioContext())
  afterEach(() => {
    resetAudioContext()
    resetBrowserMocks()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const make = (options: LoupeSoundOptions | true = true) =>
    createLoupeSound(document, resolveSoundOptions(options)!)

  /** Unlocked, resumed sound and its context. */
  const unlocked = async (options: LoupeSoundOptions | true = true) => {
    const sound = make(options)
    sound.unlock()
    await Promise.resolve()
    return { sound, ctx: FakeAudioContext.instances.at(-1)! }
  }

  it('creates no AudioContext until it may play', () => {
    const sound = make()
    sound.play('open')
    expect(FakeAudioContext.instances).toHaveLength(0)
    sound.destroy()
  })

  it('creates and resumes the context on unlock', () => {
    const sound = make()
    sound.unlock()
    const ctx = FakeAudioContext.instances[0]!
    expect(ctx.resume).toHaveBeenCalledTimes(1)
    sound.destroy()
  })

  it('plays right after unlock, before resume finishes', () => {
    const sound = make()
    sound.unlock()
    sound.play('open')
    expect(FakeAudioContext.instances[0]!.started).toBeGreaterThan(0)
    sound.destroy()
  })

  it('shares one context between loupes', () => {
    const a = make()
    const b = make()
    a.unlock()
    b.unlock()
    expect(FakeAudioContext.instances).toHaveLength(1)
    a.destroy()
    b.destroy()
  })

  it('creates the context on play once the page had a gesture', () => {
    FakeAudioContext.initialState = 'running'
    mockUserActivation(true)
    const sound = make()
    sound.play('confirm')
    const ctx = FakeAudioContext.instances[0]!
    expect(ctx.started).toBeGreaterThan(0)
    sound.destroy()
  })

  it('does nothing without a Web Audio API', () => {
    vi.stubGlobal('AudioContext', undefined)
    const sound = make()
    expect(() => {
      sound.unlock()
      sound.play('open')
    }).not.toThrow()
    sound.destroy()
  })

  it('routes sound through a gain set to the volume', async () => {
    const { sound, ctx } = await unlocked({ volume: 0.2 })
    sound.play('cancel')
    const output = ctx.gains[0]!
    expect(output.gain.value).toBe(0.2)
    expect(output.connections).toEqual([ctx.destination])
    sound.destroy()
  })

  it('skips events that are turned off', async () => {
    const { sound, ctx } = await unlocked({ events: { pixel: false } })
    sound.play('pixel', 1)
    expect(ctx.started).toBe(0)
    sound.play('zoom')
    expect(ctx.started).toBeGreaterThan(0)
    sound.destroy()
  })

  it('plays every built-in event', async () => {
    const { sound, ctx } = await unlocked()
    for (const e of ['pixel', 'zoom', 'open', 'confirm', 'cancel'] as const) {
      const before = ctx.started
      sound.play(e)
      ctx.currentTime += 1
      expect(ctx.started, e).toBeGreaterThan(before)
    }
    sound.destroy()
  })

  it('calls a custom player with the context, speed and output', async () => {
    const pixel = vi.fn()
    const { sound, ctx } = await unlocked({ play: { pixel } })
    sound.play('pixel', 0.7)
    expect(pixel).toHaveBeenCalledWith(ctx, 0.7, ctx.gains[0])
    expect(ctx.started).toBe(0)
    sound.destroy()
  })

  it('logs a throwing custom player instead of throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = new Error('boom')
    const { sound } = await unlocked({
      play: {
        open: () => {
          throw boom
        },
      },
    })
    expect(() => sound.play('open')).not.toThrow()
    expect(error).toHaveBeenCalledWith(boom)
    sound.destroy()
  })

  it(`plays at most ${MAX_VOICES} built-in sounds at once`, async () => {
    const { sound, ctx } = await unlocked()
    // `cancel` is a single oscillator.
    for (let i = 0; i < MAX_VOICES + 4; i++) sound.play('cancel')
    expect(ctx.oscillators).toHaveLength(MAX_VOICES)
    ctx.currentTime += 1
    sound.play('cancel')
    expect(ctx.oscillators).toHaveLength(MAX_VOICES + 1)
    sound.destroy()
  })

  /** Frequency the pixel tick's tone starts at. */
  const tickPitch = (ctx: FakeAudioContext) =>
    ctx.oscillators.at(-1)!.frequency.calls[0]![1]

  it('varies the tick pitch by up to ±5%', async () => {
    const { sound, ctx } = await unlocked()
    const random = vi.spyOn(Math, 'random')
    random.mockReturnValue(0)
    sound.play('pixel')
    const low = tickPitch(ctx)
    random.mockReturnValue(0.5)
    ctx.currentTime += 1
    sound.play('pixel')
    const mid = tickPitch(ctx)
    random.mockReturnValue(0.999999)
    ctx.currentTime += 1
    sound.play('pixel')
    const high = tickPitch(ctx)
    expect(low / mid).toBeCloseTo(0.95, 5)
    expect(high / mid).toBeCloseTo(1.05, 5)
    sound.destroy()
  })

  it('raises the tick pitch with speed', async () => {
    const { sound, ctx } = await unlocked()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    sound.play('pixel', 0)
    const slow = tickPitch(ctx)
    ctx.currentTime += 1
    sound.play('pixel', 1)
    expect(tickPitch(ctx)).toBeGreaterThan(slow)
    sound.destroy()
  })

  it('stays silent and suspends while the tab is hidden', async () => {
    const { sound, ctx } = await unlocked()
    setVisibility('hidden')
    expect(ctx.suspend).toHaveBeenCalled()
    sound.play('open')
    expect(ctx.started).toBe(0)
    sound.destroy()
  })

  it('wakes the context after the tab is shown, skipping that sound', async () => {
    mockUserActivation(true)
    const { sound, ctx } = await unlocked()
    setVisibility('hidden')
    setVisibility('visible')
    ctx.resume.mockClear()
    sound.play('pixel')
    expect(ctx.resume).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    sound.play('pixel')
    expect(ctx.started).toBeGreaterThan(0)
    sound.destroy()
  })

  it('does not wake a suspended context without a gesture', async () => {
    const { sound, ctx } = await unlocked()
    ctx.state = 'suspended'
    ctx.resume.mockClear()
    sound.play('pixel')
    expect(ctx.resume).not.toHaveBeenCalled()
    expect(ctx.started).toBe(0)
    sound.destroy()
  })

  it('disconnects after sounds finish on destroy, then stays silent', async () => {
    vi.useFakeTimers()
    const { sound, ctx } = await unlocked()
    sound.play('confirm')
    const output = ctx.gains[0]!
    sound.destroy()
    expect(output.disconnected).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(output.disconnected).toBe(true)

    const before = ctx.started
    sound.unlock()
    sound.play('open')
    expect(ctx.started).toBe(before)
  })

  it('stops listening for visibility on destroy', async () => {
    const { sound, ctx } = await unlocked()
    sound.destroy()
    setVisibility('hidden')
    expect(ctx.suspend).not.toHaveBeenCalled()
  })
})
