import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useT } from '../i18n'
import { playSound } from '../lib/sound'
import { useSettings } from '../lib/settings'
import { MedalIcon, SkillIcon, XpIcon } from './icons'
import { initHeroRunner, setHeroRunnerEnabled, subscribeHeroNotices, type HeroNotice } from './runner'

const SHOW_MS = 4200

/**
 * Liga o motor do herói e mostra avisos em qualquer tela do app:
 * subiu de nível, habilidade nova disponível, chefe derrotado.
 */
export default function HeroToasts() {
  const t = useT()
  const { heroMode } = useSettings()
  const [notices, setNotices] = useState<HeroNotice[]>([])

  useEffect(() => {
    setHeroRunnerEnabled(heroMode)
    if (heroMode) initHeroRunner()
  }, [heroMode])

  useEffect(
    () =>
      subscribeHeroNotices((notice) => {
        if (notice.kind === 'skill') window.setTimeout(() => playSound('equip'), 700)
        setNotices((list) => [...list.slice(-2), notice])
        window.setTimeout(() => setNotices((list) => list.filter((n) => n.id !== notice.id)), SHOW_MS)
      }),
    [],
  )

  if (!heroMode || notices.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-40 mx-auto flex max-w-xl flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="hero-toast pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-border-strong bg-surface-2/95 px-4 py-3 shadow-lg backdrop-blur"
        >
          {notice.kind === 'levelUp' && (
            <>
              <XpIcon className="h-7 w-7 shrink-0" />
              <p className="flex-1 text-[14px] font-medium">{t.hero.toastLevel(notice.level)}</p>
            </>
          )}
          {notice.kind === 'skill' && (
            <>
              <SkillIcon id={notice.skill} className="h-8 w-8 shrink-0" />
              <p className="flex-1 text-[14px] font-medium leading-snug">{t.hero.toastSkill(t.hero.skillNames[notice.skill])}</p>
              <Link to="/aventura?aba=habilidades" className="btn btn-primary h-8 shrink-0 px-3 text-[12px]">
                {t.hero.toastSkillAction}
              </Link>
            </>
          )}
          {notice.kind === 'bossWin' && (
            <>
              <MedalIcon className="h-8 w-8 shrink-0" tier={1} />
              <p className="flex-1 text-[14px] font-medium leading-snug">{t.hero.toastBossWin(notice.pending)}</p>
              {notice.pending && (
                <Link to="/aventura?aba=monstros&chefe=1" className="btn btn-primary h-8 shrink-0 px-3 text-[12px]">
                  {t.hero.pendingAction}
                </Link>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
