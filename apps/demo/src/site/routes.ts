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
  {
    title: { en: 'Guides', ko: '가이드' },
    items: [
      {
        slug: 'color-picker',
        title: { en: 'ColorPicker', ko: 'ColorPicker' },
        description: {
          en: 'The ready-made picker: props, opacity, recent colors, touch and keyboard.',
          ko: '완성형 피커: props, 투명도, 최근 색, 터치와 키보드.',
        },
      },
      {
        slug: 'parts',
        title: { en: 'Building your own', ko: '직접 조합하기' },
        description: {
          en: 'useColorPicker, the panel and slider parts, useEyeDropper and color utilities.',
          ko: 'useColorPicker, 패널·슬라이더 부품, useEyeDropper, 색 변환 함수.',
        },
      },
      {
        slug: 'loupe',
        title: { en: 'Loupe', ko: '확대경' },
        description: {
          en: 'Pick pixel-accurate colors from images, canvas and video in every browser.',
          ko: '모든 브라우저에서 이미지, 캔버스, 영상의 색을 픽셀 단위로 정확하게 뽑습니다.',
        },
      },
      {
        slug: 'effects',
        title: { en: 'Sound, haptics and motion', ko: '소리, 진동, 모션' },
        description: {
          en: 'Ticks, clicks, vibration, smooth tracking, animations and the cursor.',
          ko: '틱, 딸깍, 진동, 부드러운 추적, 애니메이션, 커서.',
        },
      },
      {
        slug: 'theming',
        title: { en: 'Theming', ko: '테마' },
        description: {
          en: 'Light, dark and auto themes, and the CSS variables behind every color.',
          ko: '라이트, 다크, 자동 테마와 모든 색을 정하는 CSS 변수.',
        },
      },
    ],
  },
  {
    title: { en: 'Reference', ko: '레퍼런스' },
    items: [
      {
        slug: 'api',
        title: { en: 'API reference', ko: 'API 레퍼런스' },
        description: {
          en: 'Every export of react-eyedropper-picker and react-eyedropper-picker/loupe.',
          ko: 'react-eyedropper-picker와 react-eyedropper-picker/loupe의 모든 export.',
        },
      },
      {
        slug: 'browser-support',
        title: { en: 'Browser support', ko: '브라우저 지원' },
        description: {
          en: 'What works where, requirements, and how it is tested.',
          ko: '어디서 무엇이 되는지, 요구 사항, 테스트 방법.',
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
