import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Grade } from 'ts-fsrs'
import CardContent from '../components/CardContent'
import { ChevronLeftIcon } from '../components/icons'
import { db, pointsForGrade, saveReview } from '../db/db'
import type { Flashcard } from '../db/types'
import { useT } from '../i18n'
import { useSettings } from '../lib/settings'
import { playSound } from '../lib/sound'
import { formatInterval, GRADE_OPTIONS, previewIntervals, review, type GradeTone } from '../lib/srs'
import { useLive } from '../lib/useLive'

/** Cards que voltam em até 20 minutos (Errei = 5 min) reaparecem na mesma sessão. */
const REQUEUE_WINDOW_MS = 20 * 60_000

const DOT_CLASSES: Record<GradeTone, string> = {
  again: 'bg-again',
  hard: 'bg-hard',
  good: 'bg-good',
  easy: 'bg-easy',
}

export default function StudyPage() {
  const t = useT()
  const { deckId = '' } = useParams()
  const deck = useLive(async () => (await db.decks.get(deckId)) ?? null, [deckId])

  const [queue, setQueue] = useState<Flashcard[] | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [saving, setSaving] = useState(false)
  // Trava imediata (o estado `saving` só muda no próximo desenho da tela)
  const busy = useRef(false)
  const { heroMode } = useSettings()
  /** Aviso rápido dos pontos ganhos para o herói. */
  const [heroPop, setHeroPop] = useState<{ n: number; key: number } | null>(null)

  // A fila é montada uma vez ao abrir a sessão.
  useEffect(() => {
    let active = true
    const now = Date.now()
    db.cards
      .where('deckId')
      .equals(deckId)
      .filter((card) => card.due <= now)
      .sortBy('due')
      .then((list) => {
        if (active) setQueue(list)
      })
    return () => {
      active = false
    }
  }, [deckId])

  const current = queue?.[0]
  const intervals = useMemo(() => (current ? previewIntervals(current.srs) : null), [current])

  function reveal() {
    setRevealed(true)
    playSound('flip')
  }

  async function rate(grade: Grade, tone: GradeTone) {
    if (!current || saving || busy.current) return
    busy.current = true
    setSaving(true)
    try {
      const now = new Date()
      const updated = await saveReview(current, review(current.srs, grade, now), grade, now)
      const rest = (queue ?? []).slice(1)
      const nextQueue = updated.due - now.getTime() <= REQUEUE_WINDOW_MS ? [...rest, updated] : rest
      playSound(nextQueue.length === 0 ? 'complete' : tone)
      const gained = pointsForGrade(grade)
      if (heroMode && gained > 0) setHeroPop({ n: gained, key: now.getTime() })
      setReviewed((n) => n + 1)
      setRevealed(false)
      setQueue(nextQueue)
    } catch (err) {
      // Não conseguiu salvar: o card continua na tela para tentar de novo
      console.error('Erro ao salvar a revisão:', err)
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  // Atalhos: espaço/enter mostra a resposta; 1 a 4 avaliam.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!current) return
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault()
        reveal()
        return
      }
      if (revealed) {
        const option = GRADE_OPTIONS.find((o) => o.key === event.key)
        if (option) rate(option.grade, option.tone)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (deck === undefined || queue === null) return <p className="text-muted">{t.common.loading}</p>
  if (deck === null) {
    return (
      <div className="space-y-4">
        <p>{t.common.deckMissing}</p>
        <Link to="/" className="btn btn-ghost">
          {t.common.back}
        </Link>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 pb-16 text-center">
        <p className="font-mono text-5xl font-medium tracking-tighter">{reviewed}</p>
        <div className="space-y-1">
          <p className="text-xl font-semibold">{t.study.doneTitle}</p>
          <p className="text-muted">
            {reviewed > 0 ? t.study.doneReviewed(reviewed, deck.name) : t.study.doneNone(deck.name)}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/" className="btn btn-primary">
            {t.study.backToDecks}
          </Link>
          <Link to={`/baralho/${deckId}`} className="btn btn-ghost">
            {t.study.addCards}
          </Link>
        </div>
      </div>
    )
  }

  const total = reviewed + queue.length
  const progress = total === 0 ? 0 : (reviewed / total) * 100

  return (
    <div className="flex min-h-[72dvh] flex-1 flex-col gap-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            to={`/baralho/${deckId}`}
            className="flex min-h-11 min-w-0 items-center gap-1 text-sm text-muted hover:text-fg"
          >
            <ChevronLeftIcon />
            <span className="truncate">{deck.name}</span>
          </Link>
          <span className="relative font-mono text-[13px] text-muted">
            {heroPop && (
              <span
                key={heroPop.key}
                role="status"
                className="hero-pop absolute right-0 top-6 whitespace-nowrap rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] text-easy"
              >
                {t.study.heroPoints(heroPop.n)}
              </span>
            )}
            {reviewed} / {total}
          </span>
        </div>
        <div
          className="h-[3px] rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={reviewed}
          aria-label={t.study.progress}
        >
          <div className="h-full rounded-full bg-fg transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <article className="flex flex-1 flex-col justify-center gap-7 rounded-[18px] border border-line bg-surface px-6 py-8 text-center">
        <div className="space-y-2.5">
          <p className="label">{t.study.question}</p>
          <CardContent text={current.front} className="text-[30px] font-medium leading-tight tracking-tight" />
        </div>
        {revealed && (
          <>
            <div className="mx-auto h-px w-10 bg-border-strong" />
            <div className="space-y-2.5">
              <p className="label">{t.study.answer}</p>
              <CardContent text={current.back} className="text-xl leading-snug text-fg-soft" />
            </div>
          </>
        )}
      </article>

      {revealed ? (
        <div className="grid grid-cols-4 gap-2">
          {GRADE_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => rate(option.grade, option.tone)}
              disabled={saving}
              className="btn h-16 flex-col gap-1 border border-border bg-surface px-1 font-medium hover:bg-surface-2"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[option.tone]}`} aria-hidden="true" />
                {t.study.grades[option.tone]}
              </span>
              <span className="font-mono text-xs font-normal text-muted">
                {intervals ? formatInterval(intervals.get(option.grade) ?? 0, t.interval) : ''}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn btn-primary h-14 text-base" onClick={reveal}>
          {t.study.showAnswer}
        </button>
      )}
      <p className="hidden text-center font-mono text-xs text-muted sm:block">{t.study.shortcuts}</p>
    </div>
  )
}
