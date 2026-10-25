import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import DeckRow, { statsByDeck } from '../components/DeckRow'
import LibraryTabs from '../components/LibraryTabs'
import { createDeck, db } from '../db/db'
import { useT } from '../i18n'
import { playSound } from '../lib/sound'
import { useLive } from '../lib/useLive'
import { useNow } from '../lib/useNow'

/** Biblioteca › Meus baralhos: todos os baralhos e a criação de novos. */
export default function DecksPage() {
  const t = useT()
  const decks = useLive(() => db.decks.orderBy('createdAt').toArray(), [])
  const cards = useLive(() => db.cards.toArray(), [])
  const [name, setName] = useState('')
  const now = useNow()
  // Evita criar o baralho duas vezes com um clique duplo
  const busy = useRef(false)

  if (!decks || !cards) return <p className="text-muted">{t.common.loading}</p>

  const stats = statsByDeck(cards, now)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || busy.current) return
    busy.current = true
    try {
      await createDeck(name)
      playSound('add')
      setName('')
    } finally {
      busy.current = false
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[26px] font-semibold tracking-tight">{t.library.title}</h1>
          <p className="text-[13px] text-muted">
            {t.common.nDecks(decks.length)} · {t.common.nCards(cards.length)}
          </p>
        </div>
        <Link to="/importar" className="btn btn-ghost shrink-0">
          {t.library.import}
        </Link>
      </section>

      <LibraryTabs />

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          className="field"
          placeholder={t.library.newDeckPlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={t.library.newDeckLabel}
        />
        <button className="btn btn-primary shrink-0" disabled={!name.trim()}>
          {t.common.create}
        </button>
      </form>

      <section>
        <p className="label mb-2">{t.library.allDecks}</p>
        {decks.length === 0 ? (
          <p className="border-t border-line pt-4 leading-relaxed text-muted">
            {t.library.emptyStart}{' '}
            <Link to="/biblioteca/explorar" className="text-fg underline underline-offset-4">
              {t.library.emptyReady}
            </Link>
            {t.library.emptyCreate}{' '}
            <Link to="/importar" className="text-fg underline underline-offset-4">
              {t.library.emptyImport}
            </Link>
            .
          </p>
        ) : (
          <ul className="border-t border-line">
            {decks.map((deck) => (
              <DeckRow key={deck.id} deck={deck} stats={stats.get(deck.id) ?? { total: 0, due: 0 }} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
