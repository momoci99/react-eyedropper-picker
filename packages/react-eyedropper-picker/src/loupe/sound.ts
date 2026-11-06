/** Moments the loupe can make a sound for. */
export type LoupeSoundEvent = 'pixel' | 'zoom' | 'open' | 'confirm' | 'cancel'

/**
 * Plays a custom sound. Connect to `output` (not `ctx.destination`) so
 * `volume` applies. `speed` is 0 (slow) to 1 (fast), for `pixel` and
 * `zoom`; other events get 0.
 */
export type LoupeSoundPlayer = (
  ctx: AudioContext,
  speed: number,
  output: AudioNode
) => void

export type LoupeSoundOptions = {
  /** 0 to 1. Default 0.5. */
  volume?: number
  /** Turn single events off, e.g. `{ pixel: false }`. All on by default. */
  events?: Partial<Record<LoupeSoundEvent, boolean>>
  /** Ticks closer than this (ms) merge into one. Default 25. */
  minTickInterval?: number
  /** Replace the built-in sound of an event. */
  play?: Partial<Record<LoupeSoundEvent, LoupeSoundPlayer>>
}

export type ResolvedSoundOptions = {
  volume: number
  events: Record<LoupeSoundEvent, boolean>
  minTickInterval: number
  play: Partial<Record<LoupeSoundEvent, LoupeSoundPlayer>>
}

export const DEFAULT_SOUND_VOLUME = 0.5
export const DEFAULT_MIN_TICK_INTERVAL = 25

/** Built-in sounds playing at once; more are dropped. */
export const MAX_VOICES = 6

/** Random pitch change per tick: ±5%. */
const PITCH_JITTER = 0.05

const EVENTS: readonly LoupeSoundEvent[] = [
  'pixel',
  'zoom',
  'open',
  'confirm',
  'cancel',
]

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n)

/**
 * `false` / `undefined` → null (no sound). `true` → defaults. Bad numbers
 * fall back to the defaults, so a bad prop never throws.
 */
export const resolveSoundOptions = (
  sound: boolean | LoupeSoundOptions | undefined
): ResolvedSoundOptions | null => {
  if (!sound) return null
  const o = sound === true ? {} : sound
  const events = {} as Record<LoupeSoundEvent, boolean>
  for (const e of EVENTS) events[e] = o.events?.[e] !== false
  return {
    volume: isFiniteNumber(o.volume)
      ? Math.min(1, Math.max(0, o.volume))
      : DEFAULT_SOUND_VOLUME,
    events,
    minTickInterval:
      isFiniteNumber(o.minTickInterval) && o.minTickInterval >= 0
        ? o.minTickInterval
        : DEFAULT_MIN_TICK_INTERVAL,
    play: o.play ?? {},
  }
}

// ── AudioContext ──

type AudioWindow = Window & {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

/** One AudioContext per window, shared by every loupe (browsers limit them). */
const contexts = new WeakMap<Window, AudioContext>()

const getContext = (win: AudioWindow, create: boolean) => {
  const ctx = contexts.get(win)
  if (ctx && ctx.state !== 'closed') return ctx
  if (!create) return null
  const Ctor = win.AudioContext ?? win.webkitAudioContext
  if (!Ctor) return null
  try {
    const next = new Ctor()
    contexts.set(win, next)
    return next
  } catch {
    return null
  }
}

/** True when the page had a user gesture, so audio may start. */
export const hasUserActivation = (win: Window): boolean =>
  win.navigator.userActivation?.hasBeenActive === true

// ── Built-in sounds ──

/** Plays at `t` into `out`; returns its length in seconds. */
type Voice = (
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  speed: number,
  jitter: number
) => number

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

/** 0.5 s of white noise, made once per context. */
const noiseBuffer = (ctx: BaseAudioContext) => {
  let buffer = noiseBuffers.get(ctx)
  if (!buffer) {
    const length = Math.ceil(ctx.sampleRate / 2)
    buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(ctx, buffer)
  }
  return buffer
}

/** Gain that jumps to `peak` and decays to silence over `decay` seconds. */
const envelope = (
  ctx: BaseAudioContext,
  t: number,
  peak: number,
  decay: number,
  attack = 0.001
) => {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  return g
}

/** Filtered noise burst: the "click" part of mechanical sounds. */
const noiseBurst = (
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  type: BiquadFilterType,
  frequency: number,
  q: number,
  peak: number,
  decay: number
) => {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(frequency, t)
  filter.Q.setValueAtTime(q, t)
  const g = envelope(ctx, t, peak, decay)
  src.connect(filter).connect(g).connect(out)
  src.start(t, Math.random() * 0.4)
  src.stop(t + decay + 0.01)
  return src
}

/** Short tone with a pitch glide. */
const tone = (
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  type: OscillatorType,
  from: number,
  to: number,
  peak: number,
  decay: number
) => {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, t)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + decay)
  const g = envelope(ctx, t, peak, decay)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + decay + 0.01)
  return osc
}

/** Ratchet tick. Faster moves sound a bit louder and higher. */
const pixelVoice: Voice = (ctx, out, t, speed, jitter) => {
  const lift = 1 + 0.3 * speed
  const level = 0.6 + 0.4 * speed
  noiseBurst(
    ctx,
    out,
    t,
    'bandpass',
    3200 * lift * jitter,
    3,
    0.5 * level,
    0.012
  )
  tone(
    ctx,
    out,
    t,
    'sine',
    2100 * lift * jitter,
    2100 * lift * jitter,
    0.08 * level,
    0.01
  )
  return 0.025
}

/** Zoom detent: lower and woodier than the pixel tick. */
const zoomVoice: Voice = (ctx, out, t, speed, jitter) => {
  const level = 0.7 + 0.3 * speed
  tone(ctx, out, t, 'triangle', 620 * jitter, 520 * jitter, 0.28 * level, 0.03)
  noiseBurst(ctx, out, t, 'lowpass', 1800, 0.7, 0.2 * level, 0.008)
  return 0.04
}

/** Opening "whoosh": noise through a rising band. */
const openVoice: Voice = (ctx, out, t) => {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.setValueAtTime(1.2, t)
  filter.frequency.setValueAtTime(500, t)
  filter.frequency.exponentialRampToValueAtTime(2600, t + 0.14)
  const g = envelope(ctx, t, 0.3, 0.12, 0.04)
  src.connect(filter).connect(g).connect(out)
  src.start(t)
  src.stop(t + 0.18)
  return 0.18
}

/** Confirm "click-clack": two crisp clicks, the second higher. */
const confirmVoice: Voice = (ctx, out, t) => {
  noiseBurst(ctx, out, t, 'highpass', 2000, 0.7, 0.45, 0.008)
  tone(ctx, out, t, 'sine', 1250, 1100, 0.25, 0.04)
  const t2 = t + 0.035
  noiseBurst(ctx, out, t2, 'highpass', 2600, 0.7, 0.5, 0.008)
  tone(ctx, out, t2, 'sine', 1760, 1560, 0.3, 0.06)
  return 0.1
}

/** Cancel: a low falling tone. */
const cancelVoice: Voice = (ctx, out, t) => {
  tone(ctx, out, t, 'sine', 300, 180, 0.3, 0.15)
  return 0.16
}

const VOICES: Record<LoupeSoundEvent, Voice> = {
  pixel: pixelVoice,
  zoom: zoomVoice,
  open: openVoice,
  confirm: confirmVoice,
  cancel: cancelVoice,
}

const JITTERED: ReadonlySet<LoupeSoundEvent> = new Set(['pixel', 'zoom'])

// ── Engine ──

export type LoupeSound = {
  /**
   * Call from a user gesture (`open()`, pointerdown, keydown): creates or
   * resumes the AudioContext. Browsers keep audio muted until then.
   */
  unlock: () => void
  /** `speed` is 0 (slow) to 1 (fast). Does nothing while muted or hidden. */
  play: (event: LoupeSoundEvent, speed?: number) => void
  /** Disconnects this loupe's output. The shared context stays. */
  destroy: () => void
}

/**
 * Sounds synthesized with Web Audio: no audio files, no network.
 *
 * The AudioContext is made on `unlock()`, or on the first `play()` once
 * the page had a user gesture. Sounds pause while the tab is hidden.
 */
export const createLoupeSound = (
  doc: Document,
  options: ResolvedSoundOptions
): LoupeSound => {
  const win = doc.defaultView as AudioWindow
  let output: GainNode | null = null
  let outputCtx: AudioContext | null = null
  /** End times (context seconds) of built-in sounds still playing. */
  let voices: number[] = []
  /** `unlock()` called resume; play even though it is still pending. */
  let resuming = false
  let destroyed = false

  const outputFor = (ctx: AudioContext) => {
    if (outputCtx !== ctx) {
      output?.disconnect()
      output = ctx.createGain()
      output.gain.value = options.volume
      output.connect(ctx.destination)
      outputCtx = ctx
      voices = []
    }
    return output!
  }

  const resume = (ctx: AudioContext) => {
    resuming = true
    ctx.resume().then(
      () => (resuming = false),
      () => (resuming = false)
    )
  }

  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') getContext(win, false)?.suspend()
  }
  doc.addEventListener('visibilitychange', onVisibility)

  return {
    unlock: () => {
      if (destroyed) return
      const ctx = getContext(win, true)
      if (ctx && ctx.state !== 'running') resume(ctx)
    },

    play: (event, speed = 0) => {
      if (destroyed || !options.events[event]) return
      if (doc.visibilityState === 'hidden') return
      const ctx = getContext(win, hasUserActivation(win))
      if (!ctx) return
      if (ctx.state !== 'running' && !resuming) {
        // Hidden tab or a gesture since: wake it, skip this one sound.
        if (hasUserActivation(win)) resume(ctx)
        return
      }
      const out = outputFor(ctx)

      const custom = options.play[event]
      if (custom) {
        try {
          custom(ctx, speed, out)
        } catch (error) {
          // A broken custom sound must not break picking.
          console.error(error)
        }
        return
      }

      const t = ctx.currentTime
      voices = voices.filter((end) => end > t)
      if (voices.length >= MAX_VOICES) return
      const jitter = JITTERED.has(event)
        ? 1 + (Math.random() * 2 - 1) * PITCH_JITTER
        : 1
      voices.push(t + VOICES[event](ctx, out, t, speed, jitter))
    },

    destroy: () => {
      if (destroyed) return
      destroyed = true
      doc.removeEventListener('visibilitychange', onVisibility)
      // Let sounds already playing (the confirm click) finish.
      const out = output
      const ctx = outputCtx
      if (out && ctx) {
        const left = Math.max(0, ...voices.map((end) => end - ctx.currentTime))
        win.setTimeout(() => out.disconnect(), left * 1000 + 50)
      }
      output = null
      outputCtx = null
    },
  }
}
