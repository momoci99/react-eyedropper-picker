import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import rehypeShiki from '@shikijs/rehype'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { fileURLToPath } from 'node:url'
import { codeImport, SHIKI_THEMES } from './plugins/code-import.ts'
import { rehypeToc } from './plugins/rehype-toc.ts'

const lib = (path: string) =>
  fileURLToPath(
    new URL(
      `../../packages/react-eyedropper-picker/src/${path}`,
      import.meta.url
    )
  )

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/ (set by the Pages workflow).
  base: process.env.DEMO_BASE ?? '/',
  plugins: [
    codeImport(),
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          rehypeToc,
          [rehypeShiki, { themes: SHIKI_THEMES, defaultColor: false }],
        ],
      }),
    },
    react({ include: /\.(mdx|tsx?)$/ }),
  ],
  resolve: {
    // Use library source directly for instant HMR during development.
    // Exact matches, so the base alias doesn't swallow `/loupe`.
    alias: [
      {
        find: /^react-eyedropper-picker\/loupe$/,
        replacement: lib('loupe/index.ts'),
      },
      { find: /^react-eyedropper-picker$/, replacement: lib('index.ts') },
    ],
  },
})
