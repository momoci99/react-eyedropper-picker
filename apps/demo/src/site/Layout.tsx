import { Suspense, use, useEffect, useState, type ReactNode } from 'react'
import { LanguageSuggest, rememberLang } from './language'
import { mdxComponents } from './mdx'
import { loadPage, type TocEntry } from './pages'
import { Link, usePath } from './router'
import {
  docPath,
  matchRoute,
  NAV,
  neighbors,
  PLAYGROUND_PATH,
  type DocItem,
  type Lang,
} from './routes'

const UI: Record<
  Lang,
  {
    docs: string
    playground: string
    menu: string
    onThisPage: string
    prev: string
    next: string
    other: string
    notFound: string
    home: string
  }
> = {
  en: {
    docs: 'Docs',
    playground: 'Playground',
    menu: 'Menu',
    onThisPage: 'On this page',
    prev: 'Previous',
    next: 'Next',
    other: '한국어',
    notFound: 'Page not found.',
    home: 'Go to the introduction',
  },
  ko: {
    docs: '문서',
    playground: '플레이그라운드',
    menu: '메뉴',
    onThisPage: '이 페이지',
    prev: '이전',
    next: '다음',
    other: 'English',
    notFound: '페이지를 찾을 수 없어요.',
    home: '소개로 가기',
  },
}

const other = (lang: Lang): Lang => (lang === 'en' ? 'ko' : 'en')

const Header = ({
  lang,
  otherPath,
}: {
  lang: Lang
  otherPath: string | null
}) => {
  const t = UI[lang]
  return (
    <header className="site-header">
      <Link to={docPath(lang, 'index')} className="site-name">
        react-eyedropper-picker
      </Link>
      <nav className="site-links" aria-label="Site">
        <Link to={docPath(lang, 'index')}>{t.docs}</Link>
        <Link to={PLAYGROUND_PATH}>{t.playground}</Link>
        <a href="https://github.com/momoci99/react-eyedropper-picker">GitHub</a>
        <a href="https://www.npmjs.com/package/react-eyedropper-picker">npm</a>
        {otherPath && (
          <Link
            to={otherPath}
            lang={other(lang)}
            hrefLang={other(lang)}
            onClick={() => rememberLang(other(lang))}
          >
            {t.other}
          </Link>
        )}
      </nav>
    </header>
  )
}

const Sidebar = ({ lang, slug }: { lang: Lang; slug: string }) => {
  const [open, setOpen] = useState(false)
  return (
    <aside className="sidebar" data-open={open}>
      <button
        type="button"
        className="sidebar-toggle"
        aria-expanded={open}
        aria-controls="sidebar-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {UI[lang].menu}
      </button>
      <nav id="sidebar-nav" aria-label={UI[lang].docs}>
        {NAV.map((section) => (
          <div key={section.title.en} className="sidebar-section">
            <p className="sidebar-title">{section.title[lang]}</p>
            <ul>
              {section.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    to={docPath(lang, item.slug)}
                    aria-current={item.slug === slug ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.title[lang]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}

const Toc = ({ lang, toc }: { lang: Lang; toc: TocEntry[] }) =>
  toc.length > 0 && (
    <nav className="toc" aria-label={UI[lang].onThisPage}>
      <p className="sidebar-title">{UI[lang].onThisPage}</p>
      <ul>
        {toc.map((h) => (
          <li key={h.id} data-depth={h.depth}>
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  )

const PrevNext = ({ lang, slug }: { lang: Lang; slug: string }) => {
  const { prev, next } = neighbors(slug)
  const t = UI[lang]
  const item = (doc: DocItem | undefined, label: string, rel: string) =>
    doc && (
      <Link to={docPath(lang, doc.slug)} rel={rel} className={rel}>
        <span className="muted small">{label}</span>
        <span>{doc.title[lang]}</span>
      </Link>
    )
  return (
    <nav className="prev-next" aria-label={`${t.prev} / ${t.next}`}>
      {item(prev, t.prev, 'prev')}
      {item(next, t.next, 'next')}
    </nav>
  )
}

const DocPage = ({ lang, doc }: { lang: Lang; doc: DocItem }) => {
  const page = use(loadPage(lang, doc.slug))
  const Content = page.default
  return (
    <div className="doc-body">
      <article className="doc" lang={lang}>
        <Content components={mdxComponents} />
        <PrevNext lang={lang} slug={doc.slug} />
      </article>
      <Toc lang={lang} toc={page.toc} />
    </div>
  )
}

/** Title for `<title>` and the tab. */
export const pageTitle = (path: string) => {
  const route = matchRoute(path)
  const site = 'react-eyedropper-picker'
  if (route.kind === 'playground') return `Playground · ${site}`
  if (route.kind === 'not-found') return site
  return route.doc.slug === 'index'
    ? site
    : `${route.doc.title[route.lang]} · ${site}`
}

/** Keeps the tab title, `<html lang>` and scroll in step with the route. */
const useRouteEffects = (path: string, lang: Lang) => {
  useEffect(() => {
    document.title = pageTitle(path)
    document.documentElement.lang = lang
    const id = decodeURIComponent(window.location.hash.slice(1))
    const target = id && document.getElementById(id)
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [path, lang])
}

export const Site = ({ playground }: { playground: ReactNode }) => {
  const path = usePath()
  const route = matchRoute(path)
  const lang: Lang = route.kind === 'playground' ? 'en' : route.lang
  useRouteEffects(path, lang)

  if (route.kind === 'playground') {
    return (
      <>
        <Header lang="en" otherPath={null} />
        {playground}
      </>
    )
  }

  const otherPath =
    route.kind === 'doc' ? docPath(other(lang), route.doc.slug) : null
  return (
    <>
      <Header lang={lang} otherPath={otherPath} />
      {otherPath && <LanguageSuggest lang={lang} otherPath={otherPath} />}
      <div className="docs-layout">
        <Sidebar
          lang={lang}
          slug={route.kind === 'doc' ? route.doc.slug : ''}
        />
        <main className="docs-main">
          {route.kind === 'doc' ? (
            <Suspense>
              <DocPage lang={lang} doc={route.doc} />
            </Suspense>
          ) : (
            <article className="doc">
              <h1>404</h1>
              <p>{UI[lang].notFound}</p>
              <p>
                <Link to={docPath(lang, 'index')}>{UI[lang].home}</Link>
              </p>
            </article>
          )}
        </main>
      </div>
    </>
  )
}
