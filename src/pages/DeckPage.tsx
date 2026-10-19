import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { addCard, db, deleteCard, deleteDeck, renameDeck, updateCard } from '../db/db'
import type { Flashcard } from '../db/types'
import { useLive } from '../lib/useLive'

export default function DeckPage() {
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
  const frontRef = useRef<HTMLTextAreaElement>(null)

  if (deck === undefined || cards === undefined) return <p className="text-muted">Carregando…</p>
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

  const now = Date.now()
  const dueCount = cards.filter((c) => c.due <= now).length
  const canSave = front.trim() !== '' && back.trim() !== ''

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    if (!canSave) return
    if (editingId) await updateCard(editingId, front, back)
    else await addCard(deckId, front, back)
    setFront('')
    setBack('')
    setEditingId(null)
    frontRef.current?.focus()
  }

  function handleShortcut(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) handleSubmit()
  }

  function startEditing(card: Flashcard) {
    setEditingId(card.id)
    setFront(card.front)
    setBack(card.back)
    frontRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditing() {
    setEditingId(null)
    setFront('')
    setBack('')
  }

  async function handleRename() {
    const name = window.prompt('Novo nome do baralho:', deck!.name)
    if (name?.trim()) await renameDeck(deckId, name)
  }

  async function handleDeleteDeck() {
    if (!window.confirm(`Excluir "${deck!.name}" e todos os seus ${cards!.length} cards?`)) return
    await deleteDeck(deckId)
    navigate('/')
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <Link to="/" className="text-sm text-muted">
          ← Baralhos
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold break-words">{deck.name}</h1>
          <Link
            to={`/estudar/${deckId}`}
            className={`btn btn-primary shrink-0 ${dueCount === 0 ? 'pointer-events-none opacity-40' : ''}`}
            aria-disabled={dueCount === 0}
          >
            Estudar{dueCount > 0 ? ` (${dueCount})` : ''}
          </Link>
        </div>
        <div className="flex gap-4 text-sm text-muted">
          <button onClick={handleRename} className="underline-offset-2 hover:underline">
            Renomear
          </button>
          <button onClick={handleDeleteDeck} className="text-accent-ink underline-offset-2 hover:underline">
            Excluir baralho
          </button>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="index-card space-y-3 rounded-2xl px-5 pb-5 pt-4">
        <p className="font-display text-lg font-semibold">{editingId ? 'Editar card' : 'Novo card'}</p>
        <div className="space-y-3 pt-4">
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Frente (pergunta)</span>
            <textarea
              ref={frontRef}
              className="field min-h-20 resize-y"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              onKeyDown={handleShortcut}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Verso (resposta)</span>
            <textarea
              className="field min-h-20 resize-y"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              onKeyDown={handleShortcut}
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" disabled={!canSave}>
            {editingId ? 'Salvar' : 'Adicionar'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={cancelEditing}>
              Cancelar
            </button>
          )}
          <span className="ml-auto hidden text-xs text-muted sm:inline">Ctrl + Enter para salvar</span>
        </div>
      </form>

      <section className="space-y-3">
        <p className="text-sm uppercase tracking-wider text-muted">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'}
        </p>
        <ul className="space-y-2">
          {cards.map((card) => (
            <li key={card.id} className="rounded-2xl border border-line bg-card p-4">
              <p className="whitespace-pre-wrap font-semibold">{card.front}</p>
              <p className="mt-1 whitespace-pre-wrap text-muted">{card.back}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <button onClick={() => startEditing(card)} className="underline-offset-2 hover:underline">
                  Editar
                </button>
                <button
                  onClick={() => window.confirm('Excluir este card?') && deleteCard(card.id)}
                  className="text-accent-ink underline-offset-2 hover:underline"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
