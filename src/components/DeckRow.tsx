import { Link } from 'react-router'
import type { Deck } from '../db/types'
import { useT } from '../i18n'
import DeckCover from './DeckCover'
import { ChevronRightIcon, TrashIcon } from './icons'

export interface DeckStats {
  total: number
  due: number
}

/**
 * Uma linha de baralho: nome, contagem e botão de estudar (ou abrir).
 * Com `onDelete`, mostra uma lixeira no lugar (modo de gerenciar).
 */
export default function DeckRow({
  deck,
  stats,
  onDelete,
}: {
  deck: Deck
  stats: DeckStats
  onDelete?: (deck: Deck) => void
}) {
  const t = useT()
  return (
    <li className="flex items-center gap-3 border-b border-line py-3.5">
      <DeckCover src={deck.cover} />
      <Link to={`/baralho/${deck.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium">{deck.name}</p>
        <p className="mt-0.5 text-[13px] text-muted">
          {t.common.nCards(stats.total)} ·{' '}
          {stats.due > 0 ? <span className="text-fg">{t.common.nToday(stats.due)}</span> : t.common.upToDate}
        </p>
      </Link>
      {onDelete ? (
        <button
          type="button"
          onClick={() => onDelete(deck)}
          className="btn btn-ghost w-11 px-0 text-again hover:border-again/50"
          aria-label={t.home.deleteDeck(deck.name)}
          title={t.home.deleteDeck(deck.name)}
        >
          <TrashIcon />
        </button>
      ) : stats.due > 0 ? (
        <Link to={`/estudar/${deck.id}`} className="btn btn-primary">
          {t.common.study}
        </Link>
      ) : (
        <Link
          to={`/baralho/${deck.id}`}
          className="btn btn-ghost w-11 px-0 text-muted"
          aria-label={t.common.openDeck(deck.name)}
        >
          <ChevronRightIcon />
        </Link>
      )}
    </li>
  )
}

/** Conta cards e cards vencidos por baralho. */
export function statsByDeck(cards: { deckId: string; due: number }[], now: number = Date.now()) {
  const stats = new Map<string, DeckStats>()
  for (const card of cards) {
    const s = stats.get(card.deckId) ?? { total: 0, due: 0 }
    s.total += 1
    if (card.due <= now) s.due += 1
    stats.set(card.deckId, s)
  }
  return stats
}
