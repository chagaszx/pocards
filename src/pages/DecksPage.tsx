import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { createDeck, db } from '../db/db'
import { exportBackup, importBackup } from '../lib/backup'
import { useLive } from '../lib/useLive'

export default function DecksPage() {
  const decks = useLive(() => db.decks.orderBy('createdAt').toArray(), [])
  const cards = useLive(() => db.cards.toArray(), [])
  const [name, setName] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const now = Date.now()
  const stats = new Map<string, { total: number; due: number }>()
  for (const card of cards ?? []) {
    const s = stats.get(card.deckId) ?? { total: 0, due: 0 }
    s.total += 1
    if (card.due <= now) s.due += 1
    stats.set(card.deckId, s)
  }
  const dueToday = [...stats.values()].reduce((sum, s) => sum + s.due, 0)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await createDeck(name)
    setName('')
  }

  async function handleImport(file: File | undefined) {
    if (!file) return
    try {
      const result = await importBackup(await file.text())
      alert(`Backup importado: ${result.decks} baralhos e ${result.cards} cards.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível importar o arquivo.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  if (!decks || !cards) return <p className="text-muted">Carregando…</p>

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-wider text-muted">Hoje</p>
        <h1 className="font-display text-3xl font-semibold">
          {dueToday === 0
            ? 'Nada para revisar agora'
            : `${dueToday} ${dueToday === 1 ? 'card para revisar' : 'cards para revisar'}`}
        </h1>
      </section>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          className="field"
          placeholder="Nome do novo baralho"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nome do novo baralho"
        />
        <button className="btn btn-primary shrink-0" disabled={!name.trim()}>
          Criar
        </button>
      </form>

      {decks.length === 0 ? (
        <div className="index-card rounded-2xl px-5 pb-6 pt-4">
          <p className="font-display text-lg font-semibold">Comece criando um baralho</p>
          <p className="mt-6 leading-8 text-muted">
            Um baralho junta cards de um mesmo assunto, como “Inglês — verbos” ou “Anatomia”.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {decks.map((deck) => {
            const s = stats.get(deck.id) ?? { total: 0, due: 0 }
            return (
              <li
                key={deck.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
              >
                <Link to={`/baralho/${deck.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{deck.name}</p>
                  <p className="text-sm text-muted">
                    {s.total} {s.total === 1 ? 'card' : 'cards'}
                    {s.due > 0 && <span className="text-accent-ink"> · {s.due} para hoje</span>}
                  </p>
                </Link>
                {s.due > 0 ? (
                  <Link to={`/estudar/${deck.id}`} className="btn btn-primary">
                    Estudar
                  </Link>
                ) : (
                  <Link to={`/baralho/${deck.id}`} className="btn btn-ghost">
                    Abrir
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <section className="flex flex-wrap gap-2 border-t border-line pt-5 text-sm">
        <button className="btn btn-ghost" onClick={() => exportBackup()}>
          Exportar backup
        </button>
        <button className="btn btn-ghost" onClick={() => fileInput.current?.click()}>
          Importar backup
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handleImport(e.target.files?.[0])}
        />
      </section>
    </div>
  )
}
