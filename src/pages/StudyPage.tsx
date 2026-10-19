import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Grade } from 'ts-fsrs'
import { db, saveReview } from '../db/db'
import type { Flashcard } from '../db/types'
import { formatInterval, GRADE_OPTIONS, previewIntervals, review } from '../lib/srs'
import { useLive } from '../lib/useLive'

/** Cards que voltam em até 20 minutos (ex.: "Errei") reaparecem na mesma sessão. */
const REQUEUE_WINDOW_MS = 20 * 60_000

const TONE_CLASSES: Record<string, string> = {
  again: 'bg-again',
  hard: 'bg-hard',
  good: 'bg-good',
  easy: 'bg-easy',
}

export default function StudyPage() {
  const { deckId = '' } = useParams()
  const deck = useLive(async () => (await db.decks.get(deckId)) ?? null, [deckId])

  const [queue, setQueue] = useState<Flashcard[] | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [saving, setSaving] = useState(false)

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

  async function rate(grade: Grade) {
    if (!current || saving) return
    setSaving(true)
    const now = new Date()
    const updated = await saveReview(current, review(current.srs, grade, now), now)
    setReviewed((n) => n + 1)
    setRevealed(false)
    setQueue((q) => {
      if (!q) return q
      const rest = q.slice(1)
      return updated.due - now.getTime() <= REQUEUE_WINDOW_MS ? [...rest, updated] : rest
    })
    setSaving(false)
  }

  // Atalhos: espaço/enter mostra a resposta; 1 a 4 avaliam.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!current) return
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault()
        setRevealed(true)
        return
      }
      if (revealed) {
        const option = GRADE_OPTIONS.find((o) => o.key === event.key)
        if (option) rate(option.grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (deck === undefined || queue === null) return <p className="text-muted">Carregando…</p>
  if (deck === null) {
    return (
      <div className="space-y-4">
        <p>Este baralho não existe mais.</p>
        <Link to="/" className="btn btn-ghost">
          Voltar
        </Link>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="space-y-5 pt-6 text-center">
        <p className="font-display text-3xl font-semibold">Tudo revisado por agora</p>
        <p className="text-muted">
          {reviewed > 0
            ? `Você revisou ${reviewed} ${reviewed === 1 ? 'card' : 'cards'} de “${deck.name}”.`
            : `Nenhum card de “${deck.name}” vence agora.`}
        </p>
        <div className="flex justify-center gap-2">
          <Link to="/" className="btn btn-primary">
            Voltar aos baralhos
          </Link>
          <Link to={`/baralho/${deckId}`} className="btn btn-ghost">
            Adicionar cards
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70dvh] flex-col gap-5">
      <div className="flex items-center justify-between text-sm text-muted">
        <Link to={`/baralho/${deckId}`}>← {deck.name}</Link>
        <span>
          {queue.length} {queue.length === 1 ? 'restante' : 'restantes'}
        </span>
      </div>

      <article className="index-card flex flex-1 flex-col rounded-2xl px-6 pb-8 pt-4">
        <p className="text-xs uppercase tracking-wider text-muted">Pergunta</p>
        <p className="mt-8 whitespace-pre-wrap font-display text-2xl leading-8">{current.front}</p>
        {revealed && (
          <>
            <hr className="my-6 border-dashed border-line" />
            <p className="text-xs uppercase tracking-wider text-muted">Resposta</p>
            <p className="mt-2 whitespace-pre-wrap text-xl leading-8">{current.back}</p>
          </>
        )}
      </article>

      {revealed ? (
        <div className="grid grid-cols-4 gap-2">
          {GRADE_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => rate(option.grade)}
              disabled={saving}
              className={`btn flex-col gap-0 px-1 py-2.5 text-white ${TONE_CLASSES[option.tone]}`}
            >
              <span>{option.label}</span>
              <span className="text-xs font-normal opacity-85">
                {intervals ? formatInterval(intervals.get(option.grade) ?? 0) : ''}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn btn-primary py-3.5 text-lg" onClick={() => setRevealed(true)}>
          Mostrar resposta
        </button>
      )}
    </div>
  )
}
