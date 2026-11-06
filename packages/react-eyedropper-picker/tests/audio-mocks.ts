import { vi } from 'vitest'

type Call = [method: string, value: number, time: number]

class FakeParam {
  value = 0
  calls: Call[] = []
  setValueAtTime(value: number, time: number) {
    this.calls.push(['set', value, time])
    return this
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.calls.push(['ramp', value, time])
    return this
  }
}

class FakeNode {
  connections: unknown[] = []
  disconnected = false
  connect<T>(node: T): T {
    this.connections.push(node)
    return node
  }
  disconnect() {
    this.disconnected = true
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam()
}

class FakeFilter extends FakeNode {
  type = 'lowpass'
  frequency = new FakeParam()
  Q = new FakeParam()
}

class FakeSource extends FakeNode {
  starts: number[] = []
  start(time = 0) {
    this.starts.push(time)
  }
  stop() {}
}

class FakeOscillator extends FakeSource {
  type = 'sine'
  frequency = new FakeParam()
}

class FakeBufferSource extends FakeSource {
  buffer: unknown = null
}

/** Records the nodes Web Audio code creates; plays nothing. */
export class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  /** State of contexts made from now on. */
  static initialState: AudioContextState = 'suspended'

  state: AudioContextState = FakeAudioContext.initialState
  currentTime = 0
  sampleRate = 8000
  destination = new FakeNode()
  gains: FakeGain[] = []
  oscillators: FakeOscillator[] = []
  bufferSources: FakeBufferSource[] = []

  resume = vi.fn(() => {
    this.state = 'running'
    return Promise.resolve()
  })
  suspend = vi.fn(() => {
    this.state = 'suspended'
    return Promise.resolve()
  })

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  close() {
    this.state = 'closed'
    return Promise.resolve()
  }
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createBiquadFilter() {
    return new FakeFilter()
  }
  createOscillator() {
    const o = new FakeOscillator()
    this.oscillators.push(o)
    return o
  }
  createBufferSource() {
    const s = new FakeBufferSource()
    this.bufferSources.push(s)
    return s
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
  /** Oscillators plus buffer sources started so far. */
  get started() {
    return this.oscillators.length + this.bufferSources.length
  }
}

/** Installs `FakeAudioContext` as `window.AudioContext`. */
export const mockAudioContext = () => {
  FakeAudioContext.instances = []
  FakeAudioContext.initialState = 'suspended'
  vi.stubGlobal('AudioContext', FakeAudioContext)
}

/** Closes every fake context, so the next test gets a fresh shared one. */
export const resetAudioContext = () => {
  for (const ctx of FakeAudioContext.instances) ctx.close()
  vi.unstubAllGlobals()
}

const setNavigator = (key: string, value: unknown) =>
  Object.defineProperty(navigator, key, { value, configurable: true })

/** Pretends the page had (or had not) a user gesture. */
export const mockUserActivation = (hasBeenActive: boolean) =>
  setNavigator('userActivation', { hasBeenActive, isActive: hasBeenActive })

export const mockVibrate = () => {
  const vibrate = vi.fn((_pattern: VibratePattern) => true)
  setNavigator('vibrate', vibrate)
  return vibrate
}

export const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Removes the navigator / document overrides above. */
export const resetBrowserMocks = () => {
  delete (navigator as unknown as Record<string, unknown>).userActivation
  delete (navigator as unknown as Record<string, unknown>).vibrate
  delete (document as unknown as Record<string, unknown>).visibilityState
}
