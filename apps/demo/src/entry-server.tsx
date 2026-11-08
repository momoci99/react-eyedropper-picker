import { StrictMode } from 'react'
import { prerender } from 'react-dom/static'
import { App } from './App'
import { pageTitle } from './site/Layout'
import { loadPage } from './site/pages'
import { StaticRouter } from './site/router'
import { ALL_PATHS, docPath, LANGS, matchRoute } from './site/routes'

export { ALL_PATHS }

/** HTML and head data of one site path, for scripts/prerender.mjs. */
export const render = async (path: string) => {
  const route = matchRoute(path)
  if (route.kind === 'doc') await loadPage(route.lang, route.doc.slug)
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter path={path}>
        <App />
      </StaticRouter>
    </StrictMode>,
    // Keep every page inline. By default React moves large Suspense content
    // into a hidden <div> plus a script that swaps it in later: invisible
    // until then, and doubled if the reader navigates before it runs.
    { progressiveChunkSize: Number.POSITIVE_INFINITY }
  )
  const html = await new Response(prelude).text()
  const lang = route.kind === 'playground' ? 'en' : route.lang
  const description =
    route.kind === 'doc' ? route.doc.description[route.lang] : null
  const alternates =
    route.kind === 'doc'
      ? LANGS.map((l) => ({ lang: l, path: docPath(l, route.doc.slug) }))
      : []
  return { html, title: pageTitle(path), lang, description, alternates }
}
