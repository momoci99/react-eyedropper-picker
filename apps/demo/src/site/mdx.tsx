import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import { ClientOnly } from './client'
import { Link } from './router'

/**
 * A live example and its source. `code` is highlighted HTML from a
 * `?code` import (see vite.config.ts), so examples are real, type-checked
 * files and the shown source can't drift from what runs.
 */
export const Example = ({
  code,
  client = false,
  children,
}: {
  code: string
  /** Render only in the browser (canvas, storage, ...). */
  client?: boolean
  children: ReactNode
}) => (
  <figure className="example">
    <div className="example-live">
      {client ? (
        <ClientOnly fallback={<div className="example-placeholder" />}>
          {children}
        </ClientOnly>
      ) : (
        children
      )}
    </div>
    <div className="example-code" dangerouslySetInnerHTML={{ __html: code }} />
  </figure>
)

export const mdxComponents: MDXComponents = {
  // Site paths (`/getting-started/`) navigate in place; others are links.
  a: ({ href = '', ...rest }) =>
    href.startsWith('/') ? (
      <Link to={href} {...rest} />
    ) : (
      <a href={href} {...rest} />
    ),
  Example,
}
