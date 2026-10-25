import { useState } from 'react'
import { Link } from 'react-router'
import AdventureTeaser from '../components/AdventureTeaser'
import DeckRow, { statsByDeck } from '../components/DeckRow'
import { SearchIcon } from '../components/icons'
import { db, deleteDeck } from '../db/db'
import type { Deck } from '../db/types'
import { useT } from '../i18n'
import { dayKey, normalize, weekdayInitial } from '../lib/date'
import { computeStreak, getStudyDays, lastDays } from '../lib/streak'
import { useLive } from '../lib/useLive'
import { useNow } from '../lib/useNow'

export default function HomePage() {
  const t = useT()
  const decks = useLive(() => db.decks.orderBy('createdAt').toArray(), [])
  const cards = useLive(() => db.cards.toArray(), [])
  const studyDays = useLive(() => getStudyDays(), [])
  const [query, setQuery] = useState('')
  /** Modo de gerenciar: mostra todos os baralhos com a lixeira. */
  const [managing, setManaging] = useState(false)
  // Atualiza as contagens com a tela aberta (cards que vencem em minutos, virada do dia)
  const now = useNow()

  if (!decks || !cards || !studyDays) return <p className="text-muted">{t.common.loading}</p>

  const today = new Date(now)
  const stats = statsByDeck(cards, today.getTime())
  const dueToday = [...stats.values()].reduce((sum, s) => sum + s.due, 0)
  const streak = computeStreak(studyDays, today)
  const studiedToday = studyDays.has(dayKey(today))
  const week = lastDays(7, today)

  const searching = query.trim() !== ''
  const visibleDecks = searching
    ? decks.filter((deck) => normalize(deck.name).includes(normalize(query)))
    : managing
      ? decks
      : decks.filter((deck) => (stats.get(deck.id)?.due ?? 0) > 0)

  async function handleDelete(deck: Deck) {
    const total = stats.get(deck.id)?.total ?? 0
    if (!window.confirm(t.deck.deleteConfirm(deck.name, total))) return
    await deleteDeck(deck.id)
  }

  const hint =
    dueToday > 0
      ? studiedToday
        ? t.home.hintContinue
        : t.home.hintKeepStreak
      : studiedToday
        ? t.home.hintAllDone
        : t.home.hintNothingDue

  return (
    <div className="flex flex-col gap-8">
      <AdventureTeaser />
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="label">{t.home.streak}</p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-[40px] font-medium leading-none tracking-tighter">{streak}</span>
            <span className="text-sm text-muted">{t.home.days(streak)}</span>
          </p>
          <ol className="mt-4 flex justify-between" aria-label={t.home.last7}>
            {week.map((day) => {
              const done = studyDays.has(dayKey(day))
              const isToday = dayKey(day) === dayKey(today)
              return (
                <li key={dayKey(day)} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${done ? 'bg-fg' : isToday ? 'border border-border-strong' : 'bg-line'}`}
                    aria-label={`${day.toLocaleDateString(t.date.locale)}: ${done ? t.home.studied : t.home.notStudied}`}
                  />
                  <span className={`font-mono text-[10.5px] ${isToday ? 'text-fg' : 'text-muted'}`}>
                    {weekdayInitial(t.date, day)}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="flex flex-col rounded-2xl border border-line bg-surface p-4">
          <p className="label">{t.home.forToday}</p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-[40px] font-medium leading-none tracking-tighter">{dueToday}</span>
            <span className="text-sm text-muted">{t.home.cardsWord(dueToday)}</span>
          </p>
          <p className="mt-auto pt-4 text-[13px] leading-snug text-muted">{hint}</p>
        </div>
      </section>

      <label className="relative block">
        <span className="sr-only">{t.home.searchLabel}</span>
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">
          <SearchIcon />
        </span>
        <input
          type="search"
          className="field h-12 pl-11"
          placeholder={t.home.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="label">{searching ? t.home.results : managing ? t.home.allDecks : t.home.dueTitle}</p>
          {decks.length > 0 && (
            <button
              type="button"
              onClick={() => setManaging((m) => !m)}
              className={`text-[13px] font-medium ${managing ? 'text-fg' : 'text-muted hover:text-fg'}`}
              aria-pressed={managing}
            >
              {managing ? t.home.manageDone : t.home.manage}
            </button>
          )}
        </div>
        {managing && <p className="mb-3 text-[13px] leading-snug text-muted">{t.home.manageHint}</p>}
        {visibleDecks.length > 0 ? (
          <ul className="border-t border-line">
            {visibleDecks.map((deck) => (
              <DeckRow
                key={deck.id}
                deck={deck}
                stats={stats.get(deck.id) ?? { total: 0, due: 0 }}
                onDelete={managing ? handleDelete : undefined}
              />
            ))}
          </ul>
        ) : (
          <p className="border-t border-line pt-4 leading-relaxed text-muted">
            {searching ? (
              t.home.noResults(query.trim())
            ) : decks.length === 0 ? (
              <>
                {t.home.noDecks}{' '}
                <Link to="/biblioteca/explorar" className="text-fg underline underline-offset-4">
                  {t.home.startWithReady}
                </Link>
                .
              </>
            ) : (
              <>
                {t.home.noneDue}{' '}
                <Link to="/biblioteca" className="text-fg underline underline-offset-4">
                  {t.home.libraryLink}
                </Link>
                .
              </>
            )}
          </p>
        )}
      </section>
    </div>
  )
}
