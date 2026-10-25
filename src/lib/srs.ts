import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as SrsCard,
  type Grade,
} from 'ts-fsrs'
import type { Dict } from '../i18n'

/**
 * FSRS (o mesmo algoritmo do Anki) usado só para medir a força da memória
 * de cada card. As datas de revisão vêm da tabela INTERVALS abaixo.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: false }))

export type GradeTone = 'again' | 'hard' | 'good' | 'easy'

export interface GradeOption {
  grade: Grade
  key: string
  tone: GradeTone
}

export const GRADE_OPTIONS: GradeOption[] = [
  { grade: Rating.Again, key: '1', tone: 'again' },
  { grade: Rating.Hard, key: '2', tone: 'hard' },
  { grade: Rating.Good, key: '3', tone: 'good' },
  { grade: Rating.Easy, key: '4', tone: 'easy' },
]

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/**
 * Tempos fixos de cada resposta, em qualquer revisão:
 * Errei 5 min · Difícil 30 min · Bom 1 dia · Fácil 3 dias.
 * O FSRS continua calculando a "força da memória" de cada card
 * (usada nas estatísticas), mas não decide mais a data da revisão.
 */
export const INTERVALS: Record<GradeTone, number> = {
  again: 5 * MINUTE,
  hard: 30 * MINUTE,
  good: 1 * DAY,
  easy: 3 * DAY,
}

function toneOf(grade: Grade): GradeTone {
  return GRADE_OPTIONS.find((option) => option.grade === grade)?.tone ?? 'good'
}

export function newSrsCard(now: Date = new Date()): SrsCard {
  return createEmptyCard(now)
}

export function review(card: SrsCard, grade: Grade, now: Date = new Date()): SrsCard {
  const next = scheduler.next(card, now, grade).card
  return { ...next, due: new Date(now.getTime() + INTERVALS[toneOf(grade)]) }
}

/** Quanto tempo (ms) até a próxima revisão para cada resposta possível. */
export function previewIntervals(card: SrsCard, now: Date = new Date()): Map<Grade, number> {
  const result = new Map<Grade, number>()
  for (const option of GRADE_OPTIONS) {
    result.set(option.grade, review(card, option.grade, now).due.getTime() - now.getTime())
  }
  return result
}

/** Formata um intervalo em ms de forma curta: "10 min", "3 d", "2 meses". */
export function formatInterval(ms: number, t: Dict['interval']): string {
  const minutes = ms / MINUTE
  if (minutes < 1) return t.lessThanMinute
  if (minutes < 60) return t.minutes(Math.round(minutes))
  const hours = minutes / 60
  if (hours < 24) return t.hours(Math.round(hours))
  const days = hours / 24
  if (days < 30) return t.days(Math.round(days))
  if (days < 365) return t.months(Math.round(days / 30))
  return t.years(Math.round((days / 365) * 10) / 10)
}

/** Card "dominado": o FSRS estima que você lembraria dele por 21 dias ou mais. */
export function isMature(card: SrsCard): boolean {
  return card.state !== State.New && card.stability >= 21
}

export function isNew(card: SrsCard): boolean {
  return card.state === State.New
}
