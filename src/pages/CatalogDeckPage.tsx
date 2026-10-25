import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import CardContent from '../components/CardContent'
import DeckCover from '../components/DeckCover'
import { ChevronLeftIcon } from '../components/icons'
import { db } from '../db/db'
import { useT } from '../i18n'
import { addCatalogDeck, fetchCatalogDeck, type CatalogDeck } from '../lib/catalog'
import { playSound } from '../lib/sound'
import { useLive } from '../lib/useLive'

const PREVIEW_COUNT = 8

/** Detalhes de um baralho pronto: descrição, amostra de cards e botão de adicionar. */
export default function CatalogDeckPage() {
  const t = useT()
  const { catalogId = '' } = useParams()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<CatalogDeck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const myDeck = useLive(
    async () => (await db.decks.toArray()).find((d) => d.sourceId === catalogId) ?? null,
    [catalogId],
  )

  useEffect(() => {
    setDeck(null)
    setError(null)
    fetchCatalogDeck(catalogId)
      .then(setDeck)
      .catch(() => setError(t.catalogDeck.notFound))
  }, [catalogId, t])

  async function handleAdd() {
    setAdding(true)
    try {
      const deckId = await addCatalogDeck(catalogId)
      playSound('add')
      navigate(`/baralho/${deckId}`)
    } catch {
      setError(t.explore.addError)
      setAdding(false)
    }
  }

  const backLink = (
    <Link to="/biblioteca/explorar" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
      <ChevronLeftIcon />
      {t.catalogDeck.back}
    </Link>
  )

  if (error && !deck) {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="text-muted">{error}</p>
      </div>
    )
  }
  if (!deck || myDeck === undefined) return <p className="text-muted">{t.common.loading}</p>

  const cards = showAll ? deck.cards : deck.cards.slice(0, PREVIEW_COUNT)

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-3">
        {backLink}
        <DeckCover src={deck.cover} size="lg" />
        <p className="label">{t.explore.categories[deck.category] ?? deck.category}</p>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{deck.name}</h1>
        <p className="leading-relaxed text-muted">{deck.description}</p>
        <p className="font-mono text-xs text-muted">{t.common.nCards(deck.cards.length)}</p>
      </section>

      {myDeck ? (
        <div className="flex gap-2">
          <Link to={`/baralho/${myDeck.id}`} className="btn btn-ghost flex-1">
            {t.catalogDeck.alreadyAdded}
          </Link>
          <Link to={`/estudar/${myDeck.id}`} className="btn btn-primary">
            {t.common.study}
          </Link>
        </div>
      ) : (
        <button className="btn btn-primary h-12 text-base" onClick={handleAdd} disabled={adding}>
          {adding ? t.explore.adding : t.catalogDeck.addToLibrary}
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm text-again">
          {error}
        </p>
      )}

      <section>
        <p className="label mb-2">{showAll ? t.catalogDeck.allCards : t.catalogDeck.sample}</p>
        <ul className="border-t border-line">
          {cards.map(([front, back], i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 border-b border-line py-3 text-sm">
              <CardContent text={front} compact className="font-medium" />
              <CardContent text={back} compact className="text-muted" />
            </li>
          ))}
        </ul>
        {!showAll && deck.cards.length > PREVIEW_COUNT && (
          <button className="mt-3 py-2 text-sm text-muted hover:text-fg" onClick={() => setShowAll(true)}>
            {t.catalogDeck.seeAll(deck.cards.length)}
          </button>
        )}
      </section>
    </div>
  )
}
