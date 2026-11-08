import type { Element, ElementContent, Root } from 'hast'
import { visit } from 'unist-util-visit'
import { valueToEstree } from 'estree-util-value-to-estree'

const text = (node: ElementContent): string =>
  node.type === 'text'
    ? node.value
    : 'children' in node
      ? node.children.map(text).join('')
      : ''

/**
 * Exports `toc` (h2 and h3 with their ids) from each MDX page, for the
 * "On this page" list. Runs after rehype-slug, which adds the ids.
 */
export const rehypeToc = () => (tree: Root) => {
  const toc: { depth: number; id: string; text: string }[] = []
  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'h2' && node.tagName !== 'h3') return
    const id = node.properties.id
    if (typeof id !== 'string') return
    toc.push({
      depth: node.tagName === 'h2' ? 2 : 3,
      id,
      text: node.children.map(text).join(''),
    })
  })
  tree.children.unshift({
    // MDX's ESM node: `export const toc = [...]`.
    type: 'mdxjsEsm',
    value: '',
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: [
          {
            type: 'ExportNamedDeclaration',
            specifiers: [],
            attributes: [],
            source: null,
            declaration: {
              type: 'VariableDeclaration',
              kind: 'const',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id: { type: 'Identifier', name: 'toc' },
                  init: valueToEstree(toc),
                },
              ],
            },
          },
        ],
      },
    },
  } as never)
}
