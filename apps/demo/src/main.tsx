import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { App } from './App'
import { loadPage } from './site/pages'
import { BrowserRouter, sitePath } from './site/router'
import { matchRoute, normalizePath } from './site/routes'
import './styles.css'
import './site/docs.css'

const root = document.getElementById('root')!
const path = sitePath(window.location.pathname)
const route = matchRoute(path)
const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

// Load the page before hydrating, so the prerendered HTML is reused as is.
const ready = route.kind === 'doc' ? loadPage(route.lang, route.doc.slug) : null
void Promise.resolve(ready).then(() => {
  // Prerendered for this path: hydrate. In dev, or 404.html served for some
  // other path: render from scratch.
  if (root.dataset.path === normalizePath(path)) {
    hydrateRoot(root, app)
  } else {
    root.textContent = ''
    createRoot(root).render(app)
  }
})
