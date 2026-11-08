import {
  createContext,
  startTransition,
  use,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'

/** Vite base: `/` locally, `/<repo>/` on GitHub Pages. */
const BASE = import.meta.env.BASE_URL

/** Full URL path of a site path, e.g. `/ko/` → `/<repo>/ko/`. */
export const href = (path: string) => BASE + path.replace(/^\//, '')

/** Site path of a full URL path. */
export const sitePath = (pathname: string) =>
  pathname.startsWith(BASE) ? `/${pathname.slice(BASE.length)}` : pathname

const PathContext = createContext('/')

export const usePath = () => use(PathContext)

/** Set by the mounted client router. */
let setPath: ((path: string) => void) | null = null

/** Client-side navigation. Keeps the old page until the new one loads. */
export const navigate = (path: string) => {
  const [p, hash = ''] = path.split('#')
  window.history.pushState(null, '', href(p!) + (hash && `#${hash}`))
  startTransition(() => setPath?.(p!))
}

/** Server: the path being prerendered. */
export const StaticRouter = ({
  path,
  children,
}: {
  path: string
  children: ReactNode
}) => <PathContext value={path}>{children}</PathContext>

/** Browser: follows the address bar, back and forward. */
export const BrowserRouter = ({ children }: { children: ReactNode }) => {
  const [path, set] = useState(() => sitePath(window.location.pathname))
  useEffect(() => {
    setPath = set
    const onPop = () =>
      startTransition(() => set(sitePath(window.location.pathname)))
    window.addEventListener('popstate', onPop)
    return () => {
      setPath = null
      window.removeEventListener('popstate', onPop)
    }
  }, [])
  return <PathContext value={path}>{children}</PathContext>
}

const isPlainClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

/** Link to a site path (`/getting-started/`). External links pass through. */
export const Link = ({
  to,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => {
  const [p, hash] = to.split('#')
  return (
    <a
      {...rest}
      href={href(p!) + (hash ? `#${hash}` : '')}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || !isPlainClick(e)) return
        e.preventDefault()
        navigate(to)
      }}
    />
  )
}
