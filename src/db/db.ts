import Dexie, { type EntityTable } from 'dexie'
import type { Card as SrsCard } from 'ts-fsrs'
import type { Deck, Flashcard } from './types'
import { newSrsCard } from '../lib/srs'

/**
 * Banco local do Pocards (IndexedDB). Tudo fica salvo no aparelho;
 * a sincronização com a nuvem entra na Fase 3.
 */
export const db = new Dexie('pocards') as Dexie & {
  decks: EntityTable<Deck, 'id'>
  cards: EntityTable<Flashcard, 'id'>
}

db.version(1).stores({
  decks: 'id, createdAt',
  cards: 'id, deckId, due, createdAt',
})

const newId = () => crypto.randomUUID()

// ---------- Baralhos ----------

export async function createDeck(name: string): Promise<string> {
  const id = newId()
  await db.decks.add({ id, name: name.trim(), createdAt: Date.now() })
  return id
}

export async function renameDeck(id: string, name: string): Promise<void> {
  await db.decks.update(id, { name: name.trim() })
}

export async function deleteDeck(id: string): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.cards.where('deckId').equals(id).delete()
    await db.decks.delete(id)
  })
}

// ---------- Cards ----------

export async function addCard(deckId: string, front: string, back: string): Promise<void> {
  const now = new Date()
  const srs = newSrsCard(now)
  await db.cards.add({
    id: newId(),
    deckId,
    front: front.trim(),
    back: back.trim(),
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    due: srs.due.getTime(),
    srs,
  })
}

export async function updateCard(id: string, front: string, back: string): Promise<void> {
  await db.cards.update(id, { front: front.trim(), back: back.trim(), updatedAt: Date.now() })
}

export async function deleteCard(id: string): Promise<void> {
  await db.cards.delete(id)
}

/** Salva o resultado de uma revisão e devolve o card atualizado. */
export async function saveReview(card: Flashcard, srs: SrsCard, now: Date): Promise<Flashcard> {
  const updated: Flashcard = { ...card, srs, due: srs.due.getTime(), updatedAt: now.getTime() }
  await db.cards.put(updated)
  return updated
}
