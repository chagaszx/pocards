import { useState } from 'react'
import { Link } from 'react-router'
import { HeroIcon } from './icons'
import { useT } from '../i18n'
import { useSettings } from '../lib/settings'

const DISMISSED_KEY = 'pocards-adventure-teaser-dismissed'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Aviso curtinho na página inicial apresentando o modo Aventura. */
export default function AdventureTeaser() {
  const t = useT()
  const { heroMode } = useSettings()
  const [hidden, setHidden] = useState<boolean>(() => wasDismissed())
  if (!heroMode || hidden) return null

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // sem armazenamento: volta na próxima visita
    }
  }

  return (
    <aside className="relative flex items-center gap-3 rounded-2xl border border-[#a78bfa]/40 bg-[#a78bfa]/[0.07] py-3 pl-4 pr-10">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#a78bfa]/20 text-[#c4b5fd]">
        <HeroIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">{t.home.adventureTitle}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-fg-soft">{t.home.adventureText}</p>
      </div>
      <Link to="/aventura" className="btn btn-primary h-9 shrink-0 px-3 text-[13px]">
        {t.home.adventureButton}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.home.adventureDismiss}
        className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-fg"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </aside>
  )
}
