import { readFile } from 'node:fs/promises'
import { codeToHtml } from 'shiki'
import type { Plugin } from 'vite'

/** Light and dark code colors; docs.css switches with the color scheme. */
export const SHIKI_THEMES = { light: 'github-light', dark: 'github-dark' }

/**
 * `import code from './Example.tsx?code'`: the file's source as highlighted
 * HTML, made at build time (no highlighter in the browser bundle).
 */
export const codeImport = (): Plugin => ({
  name: 'code-import',
  enforce: 'pre',
  async load(id) {
    if (!id.endsWith('?code')) return null
    const file = id.slice(0, -'?code'.length)
    this.addWatchFile(file)
    const source = (await readFile(file, 'utf8')).trimEnd()
    const lang = file.endsWith('.tsx') ? 'tsx' : file.split('.').pop()!
    const html = await codeToHtml(source, {
      lang,
      themes: SHIKI_THEMES,
      defaultColor: false,
    })
    return `export default ${JSON.stringify(html)}`
  },
})
