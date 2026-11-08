// Minimal animated GIF encoder for screen recordings (no dependency).
// Each frame stores only the rectangle that changed since the previous one,
// with its own palette; unchanged pixels inside it are transparent.

/** Weighted RGB distance (eyes are most sensitive to green). */
const dist = (p, r, g, b) =>
  (p[0] - r) ** 2 * 2 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 3

/** Median cut, then a few k-means passes. colors: [r, g, b, weight][] */
const medianCut = (colors, max) => {
  let boxes = [colors]
  while (boxes.length < max) {
    let best = -1
    let bestRange = -1
    let bestCh = 0
    boxes.forEach((b, i) => {
      if (b.length < 2) return
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255
        let hi = 0
        for (const c of b) {
          if (c[ch] < lo) lo = c[ch]
          if (c[ch] > hi) hi = c[ch]
        }
        if (hi - lo > bestRange) {
          bestRange = hi - lo
          best = i
          bestCh = ch
        }
      }
    })
    if (best < 0 || bestRange <= 0) break
    const b = boxes[best].sort((a, c) => a[bestCh] - c[bestCh])
    let total = 0
    for (const c of b) total += c[3]
    let acc = 0
    let cut = 0
    for (; cut < b.length - 1; cut++) {
      acc += b[cut][3]
      if (acc >= total / 2) break
    }
    boxes.splice(best, 1, b.slice(0, cut + 1), b.slice(cut + 1))
  }
  let pal = boxes.map((b) => {
    let r = 0
    let g = 0
    let bl = 0
    let n = 0
    for (const c of b) {
      r += c[0] * c[3]
      g += c[1] * c[3]
      bl += c[2] * c[3]
      n += c[3]
    }
    return [r / n, g / n, bl / n]
  })
  // k-means pulls the entries to where the pixels are.
  for (let it = 0; it < 6; it++) {
    const sum = pal.map(() => [0, 0, 0, 0])
    for (const c of colors) {
      let best = 0
      let bd = Infinity
      for (let i = 0; i < pal.length; i++) {
        const d = dist(pal[i], c[0], c[1], c[2])
        if (d < bd) {
          bd = d
          best = i
        }
      }
      const s = sum[best]
      s[0] += c[0] * c[3]
      s[1] += c[1] * c[3]
      s[2] += c[2] * c[3]
      s[3] += c[3]
    }
    pal = pal.map((p, i) =>
      sum[i][3]
        ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]]
        : p
    )
  }
  return pal.map((p) => p.map(Math.round))
}

/** LZW-compresses palette indices into GIF sub-blocks. */
const lzw = (indices, minCode) => {
  const clear = 1 << minCode
  const eoi = clear + 1
  const bytes = []
  let bitBuf = 0
  let bitLen = 0
  const emit = (code, size) => {
    bitBuf |= code << bitLen
    bitLen += size
    while (bitLen >= 8) {
      bytes.push(bitBuf & 255)
      bitBuf >>>= 8
      bitLen -= 8
    }
  }
  let size = minCode + 1
  let next = eoi + 1
  let dict = new Map()
  emit(clear, size)
  let prefix = indices[0]
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const key = prefix * 4096 + k
    const hit = dict.get(key)
    if (hit !== undefined) {
      prefix = hit
      continue
    }
    emit(prefix, size)
    if (next === 4096) {
      emit(clear, size)
      dict = new Map()
      size = minCode + 1
      next = eoi + 1
    } else {
      // Grow before the entry that would not fit: the decoder adds each
      // entry one code later, and grows when it does.
      if (next >= 1 << size) size++
      dict.set(key, next++)
    }
    prefix = k
  }
  emit(prefix, size)
  emit(eoi, size)
  if (bitLen > 0) bytes.push(bitBuf & 255)
  const out = []
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255)
    out.push(chunk.length, ...chunk)
  }
  out.push(0)
  return out
}

const u16 = (n) => [n & 255, (n >> 8) & 255]

/** A color that covers at least this many pixels counts as flat. */
const FLAT = 300
/** Leftover error a flat pixel may show before it is drawn again. */
const RESIDUAL = 4

/**
 * Encodes RGBA frames ({ width, height, data }) shown at `fps` into a
 * looping GIF.
 */
export const encodeGif = (frames, fps) => {
  const W = frames[0].width
  const H = frames[0].height
  const out = [
    ...Buffer.from('GIF89a'),
    ...u16(W),
    ...u16(H),
    0x00,
    0,
    0,
    // Loop forever.
    0x21,
    0xff,
    0x0b,
    ...Buffer.from('NETSCAPE2.0'),
    0x03,
    0x01,
    0,
    0,
    0x00,
  ]

  const same = (a, b, i) =>
    a.data[i * 4] === b.data[i * 4] &&
    a.data[i * 4 + 1] === b.data[i * 4 + 1] &&
    a.data[i * 4 + 2] === b.data[i * 4 + 2]
  const keyAt = (f, i) =>
    (f.data[i * 4] << 16) | (f.data[i * 4 + 1] << 8) | f.data[i * 4 + 2]

  // Identical frames become one with a longer delay, so every frame below
  // differs from the one before it.
  const groups = []
  for (let i = 0; i < frames.length; i++) {
    const prev = groups.at(-1)
    if (prev) {
      let diff = false
      for (let p = 0; p < W * H && !diff; p++) {
        if (!same(frames[i], frames[prev.index], p)) diff = true
      }
      if (!diff) {
        prev.count++
        continue
      }
    }
    groups.push({ index: i, count: 1 })
  }

  let prevFrame = null
  let quantized = 0
  // What a decoder shows now (palette colors), to fix leftovers later.
  const shown = new Uint8Array(W * H * 3)
  // Colors covering big flat areas of the current frame (pixel art, card).
  let flat = new Set()
  const flatColors = (f) => {
    const m = new Map()
    for (let i = 0; i < W * H; i++) {
      const k = keyAt(f, i)
      m.set(k, (m.get(k) || 0) + 1)
    }
    return new Set([...m].filter(([, n]) => n >= FLAT).map(([k]) => k))
  }
  // Draw a pixel when it changed, or when it should be a flat color but
  // still shows a dithered approximation (a "ghost" the loupe left behind).
  const needs = (f, i) => {
    if (!prevFrame || !same(f, prevFrame, i)) return true
    if (!flat.has(keyAt(f, i))) return false
    const d = f.data
    const o = i * 3
    return (
      Math.max(
        Math.abs(d[i * 4] - shown[o]),
        Math.abs(d[i * 4 + 1] - shown[o + 1]),
        Math.abs(d[i * 4 + 2] - shown[o + 2])
      ) > RESIDUAL
    )
  }

  const encodeRect = (f, x0, y0, x1, y1, delay) => {
    const w = x1 - x0 + 1
    const h = y1 - y0 + 1
    const counts = new Map()
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x
        if (!needs(f, i)) continue
        const key = keyAt(f, i)
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    }
    const rgb = (k) => [k >> 16, (k >> 8) & 255, k & 255]
    let palette
    if (counts.size <= 255) {
      palette = [...counts.keys()].map(rgb)
    } else {
      quantized++
      // Frequent colors (flat UI, pixel art) go in exactly; the rest
      // (gradients, antialiasing) share the remaining slots. sqrt weights,
      // so big smooth areas don't take every slot from small ones.
      const sorted = [...counts].sort((a, b) => b[1] - a[1])
      const fixed = sorted.filter(([, n]) => n >= FLAT).slice(0, 80)
      const rest = sorted.slice(fixed.length)
      palette = [
        ...fixed.map(([k]) => rgb(k)),
        ...medianCut(
          rest.map(([k, n]) => [...rgb(k), Math.sqrt(n)]),
          255 - fixed.length
        ),
      ]
    }
    const exact = new Map(
      palette.map((c, i) => [(c[0] << 16) | (c[1] << 8) | c[2], i])
    )
    const nearestCache = new Map()
    const nearest = (r, g, b) => {
      const key = (r << 16) | (g << 8) | b
      const v = exact.get(key) ?? nearestCache.get(key)
      if (v !== undefined) return v
      let best = 0
      let bd = Infinity
      palette.forEach((c, i) => {
        const d = dist(c, r, g, b)
        if (d < bd) {
          bd = d
          best = i
        }
      })
      nearestCache.set(key, best)
      return best
    }
    const transparent = palette.length
    const tableBits = Math.max(1, Math.ceil(Math.log2(palette.length + 1)))
    const indices = new Array(w * h)
    // Floyd–Steinberg error diffusion, only for colors not in the palette.
    const err = new Float32Array(w * h * 3)
    const spread = (x, y, e, k) => {
      if (x < 0 || x >= w || y >= h) return
      const o = (y * w + x) * 3
      err[o] += e[0] * k
      err[o + 1] += e[1] * k
      err[o + 2] += e[2] * k
    }
    // A little less than full diffusion, so less grain.
    const K = 0.75 / 16
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y0 + y) * W + (x0 + x)
        if (!needs(f, i)) {
          indices[y * w + x] = transparent
          continue
        }
        const hit = exact.get(keyAt(f, i))
        if (hit !== undefined) {
          indices[y * w + x] = hit
          shown.set(palette[hit], i * 3)
          continue
        }
        const o = (y * w + x) * 3
        const c = [0, 1, 2].map((ch) =>
          Math.max(
            0,
            Math.min(255, Math.round(f.data[i * 4 + ch] + err[o + ch]))
          )
        )
        const idx = nearest(c[0], c[1], c[2])
        indices[y * w + x] = idx
        shown.set(palette[idx], i * 3)
        const e = [0, 1, 2].map((ch) => c[ch] - palette[idx][ch])
        spread(x + 1, y, e, 7 * K)
        spread(x - 1, y + 1, e, 3 * K)
        spread(x, y + 1, e, 5 * K)
        spread(x + 1, y + 1, e, 1 * K)
      }
    }
    // Graphic control: keep the frame (disposal 1), transparent index on.
    out.push(0x21, 0xf9, 0x04, (1 << 2) | 1, ...u16(delay), transparent, 0x00)
    out.push(0x2c, ...u16(x0), ...u16(y0), ...u16(w), ...u16(h))
    out.push(0x80 | (tableBits - 1))
    for (let i = 0; i < 1 << tableBits; i++) {
      out.push(...(palette[i] || [0, 0, 0]))
    }
    const minCode = Math.max(2, tableBits)
    out.push(minCode)
    for (const b of lzw(indices, minCode)) out.push(b)
  }

  // 2 cs: the shortest delay browsers don't stretch to 100 ms. Used for the
  // first part of a frame split in two.
  const SPLIT_DELAY = 2
  for (const { index, count } of groups) {
    const f = frames[index]
    flat = flatColors(f)
    const delay = Math.round((100 * count) / fps)
    if (!prevFrame) {
      // First frame in two parts, each with its own palette.
      const mid = Math.floor(W * 0.6)
      encodeRect(f, 0, 0, mid - 1, H - 1, SPLIT_DELAY)
      encodeRect(f, mid, 0, W - 1, H - 1, delay)
      prevFrame = f
      continue
    }
    // Changed columns and rows. When an empty gap of columns separates a
    // left and a right part (loupe vs. picker), each gets its own palette.
    const colHas = new Uint8Array(W)
    let y0 = H
    let y1 = -1
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (needs(f, y * W + x)) {
          colHas[x] = 1
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    const cols = []
    for (let x = 0; x < W; x++) if (colHas[x]) cols.push(x)
    let gapAt = -1
    let gap = 0
    for (let i = 1; i < cols.length; i++) {
      if (cols[i] - cols[i - 1] > gap) {
        gap = cols[i] - cols[i - 1]
        gapAt = i
      }
    }
    const rowsOf = (xa, xb) => {
      let ya = H
      let yb = -1
      for (let y = 0; y < H; y++) {
        for (let x = xa; x <= xb; x++) {
          if (needs(f, y * W + x)) {
            if (y < ya) ya = y
            if (y > yb) yb = y
            break
          }
        }
      }
      return [ya, yb]
    }
    if (gap > 24) {
      const [la, lb] = [cols[0], cols[gapAt - 1]]
      const [ra, rb] = [cols[gapAt], cols.at(-1)]
      const [lya, lyb] = rowsOf(la, lb)
      const [rya, ryb] = rowsOf(ra, rb)
      encodeRect(f, ra, rya, rb, ryb, SPLIT_DELAY)
      encodeRect(f, la, lya, lb, lyb, delay)
    } else {
      encodeRect(f, cols[0], y0, cols.at(-1), y1, delay)
    }
    prevFrame = f
  }
  out.push(0x3b)
  return { gif: Buffer.from(out), frames: groups.length, quantized }
}
