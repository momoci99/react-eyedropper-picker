// Size budget: what each entry costs an app, minified + gzip.
// Bundles the built ESM entry (react external, as in an app) with
// rolldown, so shared chunks count where they load. Run after `pnpm build`.
// Fails when an entry goes over its budget.

import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'rolldown'

/** Bytes, minified + gzip. Raise on purpose, in the PR that needs it. */
const BUDGETS = {
  // 5.00 → 5.50 kB: alpha (AlphaSlider, #rrggbbaa parsing), always in ColorPicker.
  'react-eyedropper-picker': { file: 'dist/index.js', limit: 5_500 },
  'react-eyedropper-picker/loupe': { file: 'dist/loupe.js', limit: 12_000 },
}

const measure = async (file) => {
  const out = await build({
    input: fileURLToPath(new URL(`../${file}`, import.meta.url)),
    external: [/^react($|\/)/, /^react-dom($|\/)/],
    write: false,
    output: { format: 'esm', minify: true },
  })
  const code = out.output.map((chunk) => chunk.code ?? '').join('')
  return gzipSync(code).length
}

const kB = (n) => `${(n / 1000).toFixed(2)} kB`

const rows = []
for (const [entry, { file, limit }] of Object.entries(BUDGETS)) {
  const size = await measure(file)
  rows.push({ entry, size, limit, ok: size <= limit })
}

for (const r of rows) {
  const pct = Math.round((r.size / r.limit) * 100)
  console.log(
    `${r.ok ? 'ok  ' : 'OVER'} ${r.entry.padEnd(32)} ${kB(r.size).padStart(9)} / ${kB(r.limit)} (${pct}%)`
  )
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const table = [
    '### Bundle size (minified + gzip)',
    '',
    '| Entry | Size | Budget | |',
    '| --- | ---: | ---: | --- |',
    ...rows.map(
      (r) =>
        `| \`${r.entry}\` | ${kB(r.size)} | ${kB(r.limit)} | ${r.ok ? '✅' : '❌ over'} |`
    ),
    '',
  ].join('\n')
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, table)
}

const over = rows.filter((r) => !r.ok)
if (over.length) {
  console.error(
    `\nOver budget: ${over.map((r) => r.entry).join(', ')}. ` +
      'Make it smaller, or raise the budget in scripts/size.mjs on purpose.'
  )
  process.exit(1)
}
