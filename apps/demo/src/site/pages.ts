import type { MDXComponents } from 'mdx/types'
import type { ComponentType } from 'react'
import type { Lang } from './routes'

export type TocEntry = { depth: 2 | 3; id: string; text: string }

export type PageModule = {
  default: ComponentType<{ components?: MDXComponents }>
  /** h2 and h3 headings, from the `rehypeToc` plugin in vite.config.ts. */
  toc: TocEntry[]
}

const modules = import.meta.glob<PageModule>('../docs/*/*.mdx')

const cache = new Map<string, Promise<PageModule>>()

/**
 * Loads a doc page once: the same promise every time, for React's `use`.
 * Marked fulfilled when done (React reads `status` and `value`), so `use`
 * returns at once for a loaded page instead of suspending, e.g. while
 * hydrating.
 */
export const loadPage = (lang: Lang, slug: string): Promise<PageModule> => {
  const key = `../docs/${lang}/${slug}.mdx`
  let page = cache.get(key)
  if (!page) {
    const load = modules[key]
    if (!load) throw new Error(`No page ${key}`)
    const p = load().then((m) => {
      Object.assign(p, { status: 'fulfilled', value: m })
      return m
    })
    page = p
    cache.set(key, page)
  }
  return page
}
