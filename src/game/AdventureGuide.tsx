import { useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { CoinIcon, LockIcon, MedalIcon, PointsIcon, SkillIcon, SwordIcon, XpIcon } from './icons'
import { MonsterSprite } from './sprites'

const OPEN_KEY = 'pocards-adventure-guide-open'

const ICONS: Record<string, ReactNode> = {
  energy: <PointsIcon className="h-5 w-5" />,
  battle: <SwordIcon className="h-5 w-5" />,
  stages: <MonsterSprite id="slime" className="h-6 w-6" />,
  rewards: <CoinIcon className="h-5 w-5" />,
  skills: <SkillIcon id="charge" className="h-5 w-5" />,
  tree: <XpIcon className="h-5 w-5" />,
  boss: <MedalIcon className="h-5 w-5" />,
  tips: <LockIcon className="h-4 w-4 text-hard" />,
}

function initialOpen(): boolean {
  try {
    // Aberto na primeira visita; depois lembra a escolha
    return localStorage.getItem(OPEN_KEY) !== '0'
  } catch {
    return true
  }
}

/** Tutorial da Aventura: explica todas as mecânicas, recolhível. */
export default function AdventureGuide() {
  const t = useT()
  const g = t.hero.guide
  const [open, setOpen] = useState<boolean>(() => initialOpen())

  function toggle() {
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? '0' : '1')
      } catch {
        // sem armazenamento
      }
      return !o
    })
  }

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[15px]">?</span>
        <span className="flex-1 font-medium">{g.title}</span>
        <span className="text-[13px] text-muted">{open ? g.hide : g.show}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ol className="space-y-4 border-t border-line px-4 pb-4 pt-4">
          {g.sections.map((section) => (
            <li key={section.id} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2">
                {ICONS[section.id]}
              </span>
              <div className="min-w-0">
                <p className="font-medium leading-tight">{section.title}</p>
                <ul className="mt-1 space-y-1 text-[13px] leading-snug text-fg-soft">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-1.5">
                      <span className="text-muted">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
