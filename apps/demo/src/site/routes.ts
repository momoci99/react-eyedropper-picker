export type Lang = 'en' | 'ko'

export const LANGS: readonly Lang[] = ['en', 'ko']

type Text = Record<Lang, string>

export type DocItem = { slug: string; title: Text; description: Text }

/** Sidebar order. Every item needs `docs/en/<slug>.mdx` and `docs/ko/<slug>.mdx`. */
export const NAV: { title: Text; items: DocItem[] }[] = [
  {
    title: { en: 'Start', ko: '시작' },
    items: [
      {
        slug: 'index',
        title: { en: 'Introduction', ko: '소개' },
        description: {
          en: 'React color picker with the native EyeDropper API and a pixel-accurate loupe for images in every browser.',
          ko: '순정 EyeDropper API와, 모든 브라우저에서 이미지 색을 픽셀 단위로 뽑는 확대경을 갖춘 React 컬러 피커.',
        },
      },
      {
        slug: 'getting-started',
        title: { en: 'Getting started', ko: '시작하기' },
        description: {
          en: 'Install the package, add a color picker, pick colors from an image.',
          ko: '패키지를 설치하고, 컬러 피커를 넣고, 이미지에서 색을 뽑습니다.',
        },
      },
    ],
  },
]

export const DOCS: DocItem[] = NAV.flatMap((s) => s.items)

/** A route: a doc page in one language, the playground, or not found. */
export type Route =
  | { kind: 'doc'; lang: Lang; doc: DocItem }
  | { kind: 'playground' }
  | { kind: 'not-found'; lang: Lang }

/** Site path (without the base) of a doc page. Always ends with `/`. */
export const docPath = (lang: Lang, slug: string) =>
  `${lang === 'en' ? '' : `/${lang}`}/${slug === 'index' ? '' : `${slug}/`}`

export const PLAYGROUND_PATH = '/playground/'

/** Adds the trailing slash; drops index.html. */
export const normalizePath = (path: string) => {
  const p = path.replace(/index\.html$/, '')
  return p.endsWith('/') ? p : `${p}/`
}

export const matchRoute = (path: string): Route => {
  const p = normalizePath(path)
  if (p === PLAYGROUND_PATH) return { kind: 'playground' }
  const lang: Lang = p === '/ko/' || p.startsWith('/ko/') ? 'ko' : 'en'
  const doc = DOCS.find((d) => docPath(lang, d.slug) === p)
  return doc ? { kind: 'doc', lang, doc } : { kind: 'not-found', lang }
}

/** Every path to prerender. */
export const ALL_PATHS = [
  ...LANGS.flatMap((lang) => DOCS.map((d) => docPath(lang, d.slug))),
  PLAYGROUND_PATH,
]

/** Previous and next pages in sidebar order. */
export const neighbors = (slug: string) => {
  const i = DOCS.findIndex((d) => d.slug === slug)
  return { prev: DOCS[i - 1], next: DOCS[i + 1] }
}
