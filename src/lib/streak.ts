import { db } from '../db/db'
import { dayKey } from './date'

/**
 * Todos os dias (AAAA-MM-DD) em que houve pelo menos uma revisão.
 * Também considera a última revisão de cada card, para quem já estudava
 * antes do histórico existir.
 */
export async function getStudyDays(): Promise<Set<string>> {
  // Lê tudo de uma vez (getAll): o Safari do iPhone às vezes recusa abrir cursores,
  // usados por consultas como uniqueKeys ("UnknownError: Unable to open cursor")
  const [reviews, cards] = await Promise.all([db.reviews.toArray(), db.cards.toArray()])
  const days = new Set<string>(reviews.map((review) => String(review.day)))
  for (const card of cards) {
    if (card.srs.last_review) days.add(dayKey(new Date(card.srs.last_review)))
  }
  return days
}

/**
 * Dias seguidos estudando. Se ainda não estudou hoje, a sequência
 * continua valendo a partir de ontem (só zera se pular um dia inteiro).
 */
export function computeStreak(days: Set<string>, today: Date = new Date()): number {
  const cursor = new Date(today)
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Maior sequência de dias seguidos já feita. */
export function bestStreak(days: Set<string>): number {
  let best = 0
  let run = 0
  let previous: number | null = null
  for (const key of [...days].sort()) {
    const [y, m, d] = key.split('-').map(Number)
    const dayNumber = Date.UTC(y, m - 1, d) / 86_400_000
    run = previous !== null && dayNumber - previous === 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = dayNumber
  }
  return best
}

/** Os últimos `count` dias, do mais antigo para hoje. */
export function lastDays(count: number, today: Date = new Date()): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (count - 1 - i))
    return d
  })
}
