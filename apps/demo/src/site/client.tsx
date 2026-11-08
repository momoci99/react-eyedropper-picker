import { useSyncExternalStore, type ReactNode } from 'react'

const noop = () => () => {}

/**
 * False on the server and during hydration, true after. For UI that needs
 * the browser (canvas, localStorage, navigator) without a hydration mismatch.
 */
export const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false
  )

/** Renders `children` only in the browser, `fallback` until then. */
export const ClientOnly = ({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) => (useHydrated() ? children : fallback)
