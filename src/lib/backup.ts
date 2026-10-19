import { db } from '../db/db'
import type { Deck, Flashcard } from '../db/types'

interface BackupFile {
  app: 'pocards'
  version: 1
  exportedAt: string
  decks: Deck[]
  cards: Flashcard[]
}

/** Baixa um arquivo .json com todos os baralhos e cards. */
export async function exportBackup(): Promise<void> {
  const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()])
  const data: BackupFile = {
    app: 'pocards',
    version: 1,
    exportedAt: new Date().toISOString(),
    decks,
    cards,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `pocards-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Importa um backup. Baralhos e cards com o mesmo id são substituídos;
 * os demais são mantidos. Devolve quantos itens entraram.
 */
export async function importBackup(text: string): Promise<{ decks: number; cards: number }> {
  const data = JSON.parse(text) as Partial<BackupFile>
  if (data.app !== 'pocards' || !Array.isArray(data.decks) || !Array.isArray(data.cards)) {
    throw new Error('Este arquivo não parece ser um backup do Pocards.')
  }

  // JSON transforma datas em texto; o FSRS precisa delas como Date.
  const cards = data.cards.map((card) => ({
    ...card,
    srs: {
      ...card.srs,
      due: new Date(card.srs.due),
      last_review: card.srs.last_review ? new Date(card.srs.last_review) : undefined,
    },
  }))

  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.decks.bulkPut(data.decks!)
    await db.cards.bulkPut(cards)
  })

  return { decks: data.decks.length, cards: cards.length }
}
