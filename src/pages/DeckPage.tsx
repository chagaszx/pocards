import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import CardContent from '../components/CardContent'
import { ChevronLeftIcon, DotsIcon } from '../components/icons'
import RichTextField from '../components/RichTextField'
import { addCard, db, deleteCard, deleteCards, deleteDeck, renameDeck, updateCard } from '../db/db'
import type { Flashcard } from '../db/types'
import { useT } from '../i18n'
import { playSound } from '../lib/sound'
import { hasFormatting, toPlainText } from '../lib/markdown'
import { formatInterval } from '../lib/srs'
import { useLive } from '../lib/useLive'
import { useNow } from '../lib/useNow'

export default function DeckPage() {
  const t = useT()
  const { deckId = '' } = useParams()
  const navigate = useNavigate()
  // null = não existe; undefined = ainda carregando
  const deck = useLive(async () => (await db.decks.get(deckId)) ?? null, [deckId])
  const cards = useLive(
    async () => (await db.cards.where('deckId').equals(deckId).sortBy('createdAt')).reverse(),
    [deckId],
  )

  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const frontRef = useRef<HTMLTextAreaElement>(null)
  // Evita salvar o mesmo card duas vezes (clique duplo ou atalho repetido)
  const saving = useRef(false)
  const now = useNow()

  if (deck === undefined || cards === undefined) return <p className="text-muted">{t.common.loading}</p>
  if (deck === null) {
    return (
      <div className="space-y-4">
        <p>{t.common.deckMissing}</p>
        <Link to="/biblioteca" className="btn btn-ghost">
          {t.common.back}
        </Link>
      </div>
    )
  }

  const dueCount = cards.filter((c) => c.due <= now).length
  const canSave = front.trim() !== '' && back.trim() !== ''

  function resetForm() {
    setEditingId(null)
    setFront('')
    setBack('')
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    if (!canSave || saving.current) return
    saving.current = true
    try {
      if (editingId) {
        await updateCard(editingId, front, back)
      } else {
        await addCard(deckId, front, back)
        playSound('add')
      }
      resetForm()
      frontRef.current?.focus()
    } finally {
      saving.current = false
    }
  }

  function handleShortcut(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) handleSubmit()
    if (event.key === 'Escape' && editingId) resetForm()
  }

  function startEditing(card: Flashcard) {
    setEditingId(card.id)
    setFront(card.front)
    setBack(card.back)
    frontRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDeleteCard() {
    if (!editingId || !window.confirm(t.deck.deleteCardConfirm)) return
    await deleteCard(editingId)
    resetForm()
  }

  async function handleRename() {
    setMenuOpen(false)
    const name = window.prompt(t.deck.renamePrompt, deck!.name)
    if (name?.trim()) await renameDeck(deckId, name)
  }

  async function handleDeleteDeck() {
    setMenuOpen(false)
    if (!window.confirm(t.deck.deleteConfirm(deck!.name, cards!.length))) return
    await deleteDeck(deckId)
    navigate('/biblioteca')
  }

  function dueLabel(card: Flashcard) {
    return card.due <= now ? t.deck.today : t.deck.inTime(formatInterval(card.due - now, t.interval))
  }

  const allSelected = cards.length > 0 && cards.every((card) => selected.has(card.id))

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function editSelected() {
    const card = cards!.find((c) => selected.has(c.id))
    if (!card) return
    setSelected(new Set())
    startEditing(card)
  }

  async function deleteSelected() {
    const ids = [...selected]
    if (ids.length === 0 || !window.confirm(t.deck.deleteSelectedConfirm(ids.length))) return
    await deleteCards(ids)
    if (editingId && selected.has(editingId)) resetForm()
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-3">
        <Link to="/biblioteca" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ChevronLeftIcon />
          {t.deck.backLink}
        </Link>
        <h1 className="break-words text-[26px] font-semibold leading-tight tracking-tight">{deck.name}</h1>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted">
            {t.common.nCards(cards.length)} ·{' '}
            {dueCount > 0 ? <span className="text-fg">{t.common.nForToday(dueCount)}</span> : t.common.upToDate}
          </p>
          <div className="relative flex gap-2">
            <button
              type="button"
              className="btn btn-ghost w-11 px-0 text-muted"
              aria-label={t.deck.moreOptions}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <DotsIcon />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-10 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 text-sm shadow-xl shadow-black/20">
                <button className="block w-full px-4 py-2.5 text-left hover:bg-surface-2" onClick={handleRename}>
                  {t.deck.rename}
                </button>
                <button
                  className="block w-full px-4 py-2.5 text-left text-again hover:bg-surface-2"
                  onClick={handleDeleteDeck}
                >
                  {t.deck.delete}
                </button>
              </div>
            )}
            {dueCount > 0 && (
              <Link to={`/estudar/${deckId}`} className="btn btn-primary">
                {t.common.study}
              </Link>
            )}
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        {editingId && <p className="text-sm font-medium">{t.deck.editing}</p>}
        <RichTextField
          label={t.deck.frontSide}
          value={front}
          onChange={setFront}
          onKeyDown={handleShortcut}
          inputRef={frontRef}
        />
        <RichTextField label={t.deck.backSide} value={back} onChange={setBack} onKeyDown={handleShortcut} />
        {(hasFormatting(front) || hasFormatting(back)) && (
          <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
            <p className="label">{t.editor.preview}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CardContent text={front} className="font-medium" />
              <CardContent text={back} className="text-fg-soft" />
            </div>
          </div>
        )}
        <p className="text-[12px] leading-snug text-muted">{t.editor.help}</p>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-xs text-muted sm:inline">{t.deck.shortcut}</span>
          {editingId && (
            <button type="button" className="mr-auto py-2 text-sm text-again" onClick={handleDeleteCard}>
              {t.deck.deleteCard}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                {t.common.cancel}
              </button>
            )}
            <button className="btn btn-primary" disabled={!canSave}>
              {editingId ? t.common.save : t.deck.addCard}
            </button>
          </div>
        </div>
      </form>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="label">{t.deck.cardsTitle}</p>
          {cards.length > 0 && (
            <button
              type="button"
              className="py-1 text-[13px] text-muted hover:text-fg"
              onClick={() => (allSelected ? setSelected(new Set()) : setSelected(new Set(cards.map((c) => c.id))))}
            >
              {allSelected ? t.deck.clearSelection : t.deck.selectAll}
            </button>
          )}
        </div>
        {cards.length === 0 ? (
          <p className="border-t border-line pt-4 text-muted">{t.deck.noCards}</p>
        ) : (
          <ul className="border-t border-line">
            {cards.map((card) => {
              const isSelected = selected.has(card.id)
              return (
                <li key={card.id} className={`flex items-start gap-1 border-b border-line ${isSelected ? 'bg-surface' : ''}`}>
                  <label className="-ml-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center pt-0.5">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={isSelected}
                      onChange={() => toggleSelected(card.id)}
                      aria-label={t.deck.selectCard(toPlainText(card.front, t.editor.imageLabel))}
                    />
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-fg ${
                        isSelected ? 'border-fg bg-fg' : 'border-border-strong'
                      }`}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                          <path
                            d="M5 12.5l4.5 4.5L19 7.5"
                            fill="none"
                            stroke="var(--color-bg)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => (selected.size > 0 ? toggleSelected(card.id) : startEditing(card))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      if (selected.size > 0) toggleSelected(card.id)
                      else startEditing(card)
                    }}
                    className={`flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg py-3.5 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-fg ${editingId === card.id ? 'opacity-50' : ''}`}
                    aria-label={
                      selected.size > 0
                        ? t.deck.selectCard(toPlainText(card.front, t.editor.imageLabel))
                        : t.deck.editCard(toPlainText(card.front, t.editor.imageLabel))
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <CardContent text={card.front} compact className="text-[15px] font-medium" />
                      <CardContent text={card.back} compact className="mt-0.5 text-sm text-muted" />
                    </div>
                    <span className={`shrink-0 pt-0.5 font-mono text-xs ${card.due <= now ? 'text-fg' : 'text-muted'}`}>
                      {dueLabel(card)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {selected.size > 0 && (
        <div
          role="region"
          aria-label={t.deck.nSelected(selected.size)}
          className="sticky bottom-24 z-10 flex items-center gap-2 rounded-2xl border border-border bg-surface-2 p-2 pl-4 shadow-xl shadow-black/30"
        >
          <span className="mr-auto text-sm font-medium">{t.deck.nSelected(selected.size)}</span>
          {selected.size === 1 && (
            <button type="button" className="btn btn-ghost" onClick={editSelected}>
              {t.deck.editSelected}
            </button>
          )}
          <button type="button" className="btn btn-ghost text-again" onClick={deleteSelected}>
            {t.deck.deleteSelected}
          </button>
          <button
            type="button"
            className="btn btn-ghost w-11 px-0 text-muted"
            onClick={() => setSelected(new Set())}
            aria-label={t.deck.clearSelection}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
