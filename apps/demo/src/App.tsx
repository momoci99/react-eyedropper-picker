import { lazy, Suspense } from 'react'
import { ClientOnly } from './site/client'
import { Site } from './site/Layout'

// The playground draws on canvases while rendering and is the heaviest page:
// browser only, loaded on demand.
const Playground = lazy(() =>
  import('./Playground').then((m) => ({ default: m.Playground }))
)

const loading = <p className="page muted">Loading the playground…</p>

export const App = () => (
  <Site
    playground={
      <ClientOnly fallback={loading}>
        <Suspense fallback={loading}>
          <Playground />
        </Suspense>
      </ClientOnly>
    }
  />
)
