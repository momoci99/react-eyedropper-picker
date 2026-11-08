// Writes one HTML file per site path into dist/, from the SSR build in
// dist-server/, so GitHub Pages serves real pages (direct links, previews,
// no flash before JavaScript). Run after `vite build` and the SSR build.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const server = join(root, 'dist-server')
const base = process.env.DEMO_BASE ?? '/'

const { render, ALL_PATHS } = await import(
  pathToFileURL(join(server, 'entry-server.js')).href
)
const template = await readFile(join(dist, 'index.html'), 'utf8')
if (!template.includes('<div id="root"></div>')) {
  throw new Error('dist/index.html has no empty #root')
}

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const page = async (path) => {
  const { html, title, lang, description, alternates } = await render(path)
  const head = [
    `<title>${escape(title)}</title>`,
    description &&
      `<meta name="description" content="${escape(description)}" />`,
    ...alternates.map(
      (a) =>
        `<link rel="alternate" hreflang="${a.lang}" href="${base}${a.path.slice(1)}" />`
    ),
  ]
    .filter(Boolean)
    .join('\n    ')
  return template
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(/<title>.*<\/title>/, head)
    .replace(/\s*<meta\s+name="description"[^>]*>/, '')
    .replace(
      '<div id="root"></div>',
      `<div id="root" data-path="${path}">${html}</div>`
    )
}

for (const path of ALL_PATHS) {
  const out = join(dist, path, 'index.html')
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, await page(path))
}
// GitHub Pages serves 404.html for unknown paths. It renders from scratch
// in the browser (its data-path matches no real path).
await writeFile(join(dist, '404.html'), await page('/404/'))
await rm(server, { recursive: true, force: true })
console.log(`prerendered ${ALL_PATHS.length} pages + 404.html`)
