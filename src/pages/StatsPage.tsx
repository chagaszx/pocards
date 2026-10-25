import LibraryTabs from '../components/LibraryTabs'
import { db } from '../db/db'
import { useT } from '../i18n'
import { dayKey, formatShortDate, weekdayInitial } from '../lib/date'
import { isMature, isNew } from '../lib/srs'
import { bestStreak, computeStreak, getStudyDays, lastDays } from '../lib/streak'
import { useLive } from '../lib/useLive'

const DAY = 86_400_000

function Tile({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 font-mono text-[28px] font-medium leading-none tracking-tight">{value}</p>
      {help && <p className="mt-2 text-xs leading-snug text-muted">{help}</p>}
    </div>
  )
}

/** Biblioteca › Resumo: estatísticas de estudo. */
export default function StatsPage() {
  const t = useT()
  const data = useLive(async () => {
    const [reviews, cards, decks, studyDays] = await Promise.all([
      db.reviews.toArray(),
      db.cards.toArray(),
      db.decks.count(),
      getStudyDays(),
    ])
    return { reviews, cards, decks, studyDays }
  }, [])

  if (!data) return <p className="text-muted">{t.common.loading}</p>

  const { reviews, cards, decks, studyDays } = data
  const now = new Date()
  const today = dayKey(now)

  const reviewsToday = reviews.filter((r) => r.day === today).length
  const recent = reviews.filter((r) => r.reviewedAt >= now.getTime() - 30 * DAY)
  const accuracy = recent.length ? Math.round((recent.filter((r) => r.grade > 1).length / recent.length) * 100) : null

  const week = lastDays(7, now).map((date) => ({
    date,
    key: dayKey(date),
    count: reviews.filter((r) => r.day === dayKey(date)).length,
  }))
  const weekMax = Math.max(1, ...week.map((d) => d.count))

  const states = { new: 0, young: 0, mature: 0 }
  for (const card of cards) {
    if (isNew(card.srs)) states.new += 1
    else if (isMature(card.srs)) states.mature += 1
    else states.young += 1
  }
  const stateParts = [
    { key: 'mature' as const, value: states.mature, className: 'bg-fg' },
    { key: 'young' as const, value: states.young, className: 'bg-muted' },
    { key: 'new' as const, value: states.new, className: 'bg-border-strong opacity-60' },
  ]

  return (
    <div className="flex flex-col gap-8">
      <section className="space-y-1">
        <h1 className="text-[26px] font-semibold tracking-tight">{t.library.title}</h1>
        <p className="text-[13px] text-muted">
          {t.common.nDecks(decks)} · {t.common.nCards(cards.length)}
        </p>
      </section>

      <LibraryTabs />

      <section>
        <p className="label mb-2">{t.stats.today}</p>
        <div className="grid grid-cols-2 gap-3">
          <Tile label={t.stats.reviewsToday} value={String(reviewsToday)} />
          <Tile
            label={t.stats.accuracy}
            value={accuracy === null ? '–' : `${accuracy}%`}
            help={t.stats.accuracyHelp}
          />
        </div>
      </section>

      <section>
        <p className="label mb-3">{t.stats.last7}</p>
        {reviews.length === 0 ? (
          <p className="border-t border-line pt-4 text-muted">{t.stats.noData}</p>
        ) : (
          <ol className="flex h-40 items-end justify-between gap-2 border-b border-line">
            {week.map((day) => {
              const isToday = day.key === today
              const label = t.stats.reviewsOn(day.count, formatShortDate(t.date, day.date))
              return (
                <li key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={label}>
                  <span className="sr-only">{label}</span>
                  <span aria-hidden="true" className={`font-mono text-xs ${isToday ? 'text-fg' : 'text-muted'}`}>
                    {day.count > 0 ? day.count : ''}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`w-full max-w-9 rounded-t ${isToday ? 'bg-fg' : 'bg-muted/50'}`}
                    style={{ height: `${Math.max((day.count / weekMax) * 100, day.count > 0 ? 4 : 0)}%` }}
                  />
                </li>
              )
            })}
          </ol>
        )}
        {reviews.length > 0 && (
          <ol className="mt-1.5 flex justify-between gap-2" aria-hidden="true">
            {week.map((day) => (
              <li
                key={day.key}
                className={`flex-1 text-center font-mono text-[11px] ${day.key === today ? 'text-fg' : 'text-muted'}`}
              >
                {weekdayInitial(t.date, day.date)}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <p className="label mb-2">{t.stats.streaks}</p>
        <div className="grid grid-cols-2 gap-3">
          <Tile label={t.stats.currentStreak} value={t.stats.days(computeStreak(studyDays, now))} />
          <Tile label={t.stats.bestStreak} value={t.stats.days(bestStreak(studyDays))} />
        </div>
      </section>

      <section>
        <p className="label mb-3">{t.stats.cardStates}</p>
        {cards.length > 0 && (
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {stateParts
              .filter((part) => part.value > 0)
              .map((part) => (
                <span key={part.key} className={part.className} style={{ flexGrow: part.value }} />
              ))}
          </div>
        )}
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {stateParts.map((part) => (
            <div key={part.key} className="rounded-2xl border border-line bg-surface p-4">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                <span className={`h-2 w-2 rounded-full ${part.className}`} aria-hidden="true" />
                {t.stats.states[part.key]}
              </dt>
              <dd className="mt-1 font-mono text-2xl font-medium tracking-tight">{part.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13px] leading-snug text-muted">{t.stats.statesHelp}</p>
      </section>

      <section>
        <p className="label mb-2">{t.stats.totals}</p>
        <dl className="grid grid-cols-3 gap-3">
          {[
            { label: t.stats.decks, value: decks },
            { label: t.stats.cards, value: cards.length },
            { label: t.stats.reviews, value: reviews.length },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-line bg-surface p-4">
              <dt className="text-[13px] text-muted">{item.label}</dt>
              <dd className="mt-1 font-mono text-2xl font-medium tracking-tight">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
