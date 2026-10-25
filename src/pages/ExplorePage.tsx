import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import DeckCover from '../components/DeckCover'
import LibraryTabs from '../components/LibraryTabs'
import { SearchIcon } from '../components/icons'
import { db } from '../db/db'
import { useT } from '../i18n'
import { addCatalogDeck, fetchCatalog, type CatalogEntry } from '../lib/catalog'
import { normalize } from '../lib/date'
import { playSound } from '../lib/sound'
import { useLive } from '../lib/useLive'

/** Biblioteca › Explorar: baralhos prontos para adicionar com um toque. */
export default function ExplorePage() {
  const t = useT()
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  // Quais baralhos prontos já estão na biblioteca (sourceId → id do baralho do usuário)
  const added = useLive(async () => {
    const map = new Map<string, string>()
    for (const deck of await db.decks.toArray()) if (deck.sourceId) map.set(deck.sourceId, deck.id)
    return map
  }, [])

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch(() => setError(t.explore.loadError))
  }, [t])

  async function handleAdd(entry: CatalogEntry) {
    setAdding(entry.id)
    try {
      const deckId = await addCatalogDeck(entry.id)
      playSound('add')
      navigate(`/baralho/${deckId}`)
    } catch {
      setError(t.explore.addError)
      setAdding(null)
    }
  }

  const categoryLabel = (name: string) => t.explore.categories[name] ?? name
  const categories = catalog ? [...new Set(catalog.map((entry) => entry.category))] : []
  const visible = (catalog ?? []).filter(
    (entry) =>
      (!category || entry.category === category) &&
      (!query.trim() ||
        normalize(`${entry.name} ${entry.description} ${entry.category} ${categoryLabel(entry.category)}`).includes(
          normalize(query),
        )),
  )

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-1">
        <h1 className="text-[26px] font-semibold tracking-tight">{t.library.title}</h1>
        <p className="text-[13px] text-muted">{t.explore.subtitle}</p>
      </section>

      <LibraryTabs />

      <label className="relative block">
        <span className="sr-only">{t.explore.searchLabel}</span>
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">
          <SearchIcon />
        </span>
        <input
          type="search"
          className="field h-12 pl-11"
          placeholder={t.explore.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {categories.length > 1 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label={t.explore.categoriesLabel}>
          {[null, ...categories].map((cat) => {
            const active = category === cat
            return (
              <button
                key={cat ?? 'all'}
                onClick={() => setCategory(cat)}
                aria-pressed={active}
                className={`min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                  active ? 'border-fg bg-fg text-bg' : 'border-border text-muted hover:text-fg'
                }`}
              >
                {cat ? categoryLabel(cat) : t.explore.all}
              </button>
            )
          })}
        </div>
      )}

      {t.explore.contentNote && <p className="text-[13px] text-muted">{t.explore.contentNote}</p>}

      {error && (
        <p role="alert" className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-again">
          {error}
        </p>
      )}

      {!catalog && !error ? (
        <p className="text-muted">{t.common.loading}</p>
      ) : (
        <section>
          <p className="label mb-2">{t.common.nDecks(visible.length)}</p>
          {visible.length === 0 ? (
            <p className="border-t border-line pt-4 text-muted">{t.explore.noResults(query.trim())}</p>
          ) : (
            <ul className="border-t border-line">
              {visible.map((entry) => {
                const myDeckId = added?.get(entry.id)
                return (
                  <li key={entry.id} className="flex items-center gap-3 border-b border-line py-3.5">
                    <DeckCover src={entry.cover} />
                    <Link to={`/biblioteca/explorar/${entry.id}`} className="min-w-0 flex-1">
                      <p className="font-medium">{entry.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{entry.description}</p>
                      <p className="mt-1 font-mono text-xs text-muted">
                        {t.common.nCards(entry.count)} · {categoryLabel(entry.category)}
                      </p>
                    </Link>
                    {myDeckId ? (
                      <Link to={`/baralho/${myDeckId}`} className="btn btn-ghost shrink-0 text-muted">
                        {t.explore.added}
                      </Link>
                    ) : (
                      <button
                        className="btn btn-primary shrink-0"
                        onClick={() => handleAdd(entry)}
                        disabled={adding !== null}
                      >
                        {adding === entry.id ? t.explore.adding : t.explore.add}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <p className="text-[13px] leading-snug text-muted">
        {t.explore.notFound}{' '}
        <Link to="/importar" className="text-fg underline underline-offset-4">
          {t.explore.importLink}
        </Link>
        .
      </p>
    </div>
  )
}
