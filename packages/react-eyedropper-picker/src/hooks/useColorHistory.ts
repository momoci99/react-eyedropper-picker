import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { normalizeHex, normalizeHexAlpha } from '../utils/color'

/** `#rrggbb`, or `#rrggbbaa` for colors with alpha digits. */
const normalizeColor = (hex: string) =>
  normalizeHex(hex) ?? normalizeHexAlpha(hex)

export type UseColorHistoryOptions = {
  /** Most colors kept, newest first. Default 8. */
  max?: number
  /**
   * Saves the history in `localStorage` under this key and keeps every
   * picker with the same key in sync, across tabs too. Default: memory
   * only, lost on reload. The server renders `defaultColors`; the client
   * reads storage while hydrating.
   */
  storageKey?: string
  /** Starting colors, newest first. Used while nothing is stored. */
  defaultColors?: readonly string[]
}

export type UseColorHistoryResult = {
  /** Lowercase `#rrggbb` (`#rrggbbaa` with alpha), newest first, no duplicates. */
  colors: readonly string[]
  /** Puts a color first. Moves it there if already kept. Ignores invalid hex. */
  add: (hex: string) => void
  remove: (hex: string) => void
  clear: () => void
}

export const DEFAULT_HISTORY_MAX = 8

const EMPTY: readonly string[] = []

const resolveMax = (max: number | undefined) =>
  typeof max === 'number' && max >= 1 && max !== Infinity
    ? Math.floor(max)
    : DEFAULT_HISTORY_MAX

/** Valid, normalized, unique, at most `max`. */
const clean = (list: readonly unknown[], max: number): readonly string[] => {
  const out: string[] = []
  for (const item of list) {
    const hex = typeof item === 'string' ? normalizeColor(item) : null
    if (hex && !out.includes(hex)) out.push(hex)
    if (out.length === max) break
  }
  return out
}

const parse = (raw: string | null): unknown[] | null => {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

/** Same-tab subscribers per key. `storage` events only reach other tabs. */
const listeners = new Map<string, Set<() => void>>()
/** Values that `localStorage` refused (full, blocked), per key. */
const unsaved = new Map<string, string>()

const readRaw = (key: string): string | null => {
  if (unsaved.has(key)) return unsaved.get(key)!
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeRaw = (key: string, raw: string) => {
  try {
    window.localStorage.setItem(key, raw)
    unsaved.delete(key)
  } catch {
    unsaved.set(key, raw)
  }
  listeners.get(key)?.forEach((notify) => notify())
}

const subscribeKey = (key: string, notify: () => void) => {
  let set = listeners.get(key)
  if (!set) listeners.set(key, (set = new Set()))
  set.add(notify)
  const onStorage = (e: StorageEvent) => {
    // `key` is null when another tab called `localStorage.clear()`.
    if (e.key === key || e.key === null) notify()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    set.delete(notify)
    if (!set.size) listeners.delete(key)
    window.removeEventListener('storage', onStorage)
  }
}

const noSubscribe = () => () => {}

/**
 * Recently picked colors. `ColorPicker` adds eye dropper picks to it when
 * its `history` prop is on; pass this hook's result there to share one
 * history with other pickers or your own UI.
 */
export const useColorHistory = ({
  max: maxOption,
  storageKey,
  defaultColors,
}: UseColorHistoryOptions = {}): UseColorHistoryResult => {
  const max = resolveMax(maxOption)
  const defaultsKey = defaultColors?.join() ?? ''
  // Keyed by content, so an inline array doesn't change it every render.
  const defaults = useMemo(
    () => (defaultColors ? clean(defaultColors, max) : EMPTY),
    [defaultsKey, max]
  )

  const [memory, setMemory] = useState(defaults)

  // Snapshot must be the same array while the stored text is unchanged.
  const cache = useRef<{
    raw: string | null
    defaults: readonly string[]
    colors: readonly string[]
  }>(null)
  const read = useCallback(
    (key: string) => {
      const raw = readRaw(key)
      const c = cache.current
      if (c && c.raw === raw && c.defaults === defaults) return c.colors
      const list = parse(raw)
      const colors = list ? clean(list, max) : defaults
      cache.current = { raw, defaults, colors }
      return colors
    },
    [defaults, max]
  )

  const subscribe = useCallback(
    (notify: () => void) =>
      storageKey ? subscribeKey(storageKey, notify) : noSubscribe(),
    [storageKey]
  )
  const stored = useSyncExternalStore(
    subscribe,
    () => (storageKey ? read(storageKey) : EMPTY),
    () => (storageKey ? defaults : EMPTY)
  )
  const trimmed = useMemo(
    () => (memory.length > max ? memory.slice(0, max) : memory),
    [memory, max]
  )
  const colors = storageKey ? stored : trimmed

  const update = useCallback(
    (change: (prev: readonly string[]) => readonly string[]) => {
      if (storageKey) {
        const prev = read(storageKey)
        const next = change(prev)
        if (next !== prev) writeRaw(storageKey, JSON.stringify(next))
      } else {
        setMemory(change)
      }
    },
    [storageKey, read]
  )

  const add = useCallback(
    (hex: string) => {
      const color = normalizeColor(hex)
      if (!color) return
      update((prev) =>
        prev[0] === color ? prev : clean([color, ...prev], max)
      )
    },
    [update, max]
  )
  const remove = useCallback(
    (hex: string) => {
      const color = normalizeColor(hex)
      if (!color) return
      update((prev) =>
        prev.includes(color) ? prev.filter((c) => c !== color) : prev
      )
    },
    [update]
  )
  const clear = useCallback(() => update(() => EMPTY), [update])

  return useMemo(
    () => ({ colors, add, remove, clear }),
    [colors, add, remove, clear]
  )
}
