import { useState } from 'react'
import { useHydrated } from './client'
import { Link } from './router'
import type { Lang } from './routes'

const KEY = 'rep-docs-lang'

/** The language the reader chose before, if any. */
const savedLang = (): Lang | null => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'en' || v === 'ko' ? v : null
  } catch {
    return null
  }
}

/** Remembers a choice, so the suggestion stops showing. */
export const rememberLang = (lang: Lang) => {
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // Storage blocked: the suggestion may show again, nothing breaks.
  }
}

/** First of the browser's languages that the docs have. */
const browserLang = (): Lang | null => {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0]
    if (base === 'ko' || base === 'en') return base
  }
  return null
}

const TEXT: Record<Lang, { message: string; go: string; stay: string }> = {
  ko: {
    message: '이 문서는 한국어로도 볼 수 있어요.',
    go: '한국어로 보기',
    stay: '닫기',
  },
  en: {
    message: 'This page is also available in English.',
    go: 'Read in English',
    stay: 'Dismiss',
  },
}

/**
 * On a first visit, suggests the browser's language when the page is in the
 * other one. Never redirects: the reader decides, and the choice is kept.
 */
export const LanguageSuggest = ({
  lang,
  otherPath,
}: {
  lang: Lang
  otherPath: string
}) => {
  const hydrated = useHydrated()
  const [closed, setClosed] = useState(false)
  if (!hydrated || closed || savedLang()) return null
  const wanted = browserLang()
  if (!wanted || wanted === lang) return null
  const t = TEXT[wanted]
  return (
    <div className="lang-suggest" role="status" lang={wanted}>
      <span>{t.message}</span>
      <Link to={otherPath} onClick={() => rememberLang(wanted)}>
        {t.go}
      </Link>
      <button
        type="button"
        onClick={() => {
          rememberLang(lang)
          setClosed(true)
        }}
      >
        {t.stay}
      </button>
    </div>
  )
}
