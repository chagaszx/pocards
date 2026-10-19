import type { Card as SrsCard } from 'ts-fsrs'

export interface Deck {
  id: string
  name: string
  createdAt: number
}

export interface Flashcard {
  id: string
  deckId: string
  front: string
  back: string
  createdAt: number
  updatedAt: number
  /** Próxima revisão (timestamp em ms), duplicado do srs.due para poder indexar. */
  due: number
  /** Estado do algoritmo FSRS para este card. */
  srs: SrsCard
}
