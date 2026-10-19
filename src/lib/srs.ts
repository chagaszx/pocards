import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card as SrsCard,
  type Grade,
} from 'ts-fsrs'

/**
 * Repetição espaçada com FSRS (o mesmo algoritmo adotado pelo Anki).
 * `enable_fuzz` espalha um pouco as datas para os cards não vencerem todos no mesmo dia.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: true }))

export interface GradeOption {
  grade: Grade
  label: string
  key: string
  tone: 'again' | 'hard' | 'good' | 'easy'
}

export const GRADE_OPTIONS: GradeOption[] = [
  { grade: Rating.Again, label: 'Errei', key: '1', tone: 'again' },
  { grade: Rating.Hard, label: 'Difícil', key: '2', tone: 'hard' },
  { grade: Rating.Good, label: 'Bom', key: '3', tone: 'good' },
  { grade: Rating.Easy, label: 'Fácil', key: '4', tone: 'easy' },
]

export function newSrsCard(now: Date = new Date()): SrsCard {
  return createEmptyCard(now)
}

export function review(card: SrsCard, grade: Grade, now: Date = new Date()): SrsCard {
  return scheduler.next(card, now, grade).card
}

/** Quanto tempo (ms) até a próxima revisão para cada resposta possível. */
export function previewIntervals(card: SrsCard, now: Date = new Date()): Map<Grade, number> {
  const preview = scheduler.repeat(card, now)
  const result = new Map<Grade, number>()
  for (const option of GRADE_OPTIONS) {
    result.set(option.grade, preview[option.grade].card.due.getTime() - now.getTime())
  }
  return result
}

/** Formata um intervalo em ms de forma curta: "10 min", "3 d", "2 meses". */
export function formatInterval(ms: number): string {
  const minutes = ms / 60_000
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)} h`
  const days = hours / 24
  if (days < 30) return `${Math.round(days)} d`
  const months = Math.round(days / 30)
  if (days < 365) return `${months} ${months === 1 ? 'mês' : 'meses'}`
  const years = Math.round((days / 365) * 10) / 10
  return `${String(years).replace('.', ',')} ${years === 1 ? 'ano' : 'anos'}`
}
