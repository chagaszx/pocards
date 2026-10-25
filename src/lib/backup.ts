import { db, withGameDefaults } from '../db/db'
import type { Deck, Flashcard, GameState, ImageRecord, Review } from '../db/types'
import { blobToDataUrl, dataUrlToBlob } from './images'
import { newSrsCard } from './srs'

interface BackupImage {
  id: string
  createdAt: number
  /** A imagem em texto (data URL), para caber no arquivo JSON. */
  data: string
}

interface BackupFile {
  app: 'pocards'
  version: 1
  exportedAt: string
  decks: Deck[]
  cards: Flashcard[]
  /** Histórico de revisões (backups antigos não têm). */
  reviews?: Review[]
  /** Imagens dos cards (backups antigos não têm). */
  images?: BackupImage[]
  /** Progresso do modo Herói (backups antigos não têm). */
  game?: GameState
}

/** Baixa um arquivo .json com todos os baralhos, cards, imagens e o histórico. */
export async function exportBackup(): Promise<void> {
  const [decks, cards, reviews, images, game] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.images.toArray(),
    db.game.get('main'),
  ])
  const data: BackupFile = {
    app: 'pocards',
    version: 1,
    exportedAt: new Date().toISOString(),
    decks,
    cards,
    reviews,
    game,
    images: await Promise.all(
      images.map(async (image) => ({ id: image.id, createdAt: image.createdAt, data: await blobToDataUrl(image.blob) })),
    ),
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `pocards-backup-${new Date().toISOString().slice(0, 10)}.json`
  // Alguns navegadores (Firefox, Safari) só baixam se o link estiver na página
  // e cancelam o download se o endereço for apagado na mesma hora.
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Importa um backup. Itens com o mesmo id são substituídos;
 * os demais são mantidos. Devolve quantos itens entraram.
 */
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const toDate = (v: unknown, fallback: Date): Date => {
  const d = isStr(v) || isNum(v) ? new Date(v) : fallback
  return Number.isNaN(d.getTime()) ? fallback : d
}

/** Baralho do arquivo, só com campos válidos (um arquivo malicioso não pode quebrar as telas). */
function cleanDeck(raw: unknown): Deck | null {
  if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.name)) return null
  return {
    id: raw.id,
    name: raw.name,
    createdAt: isNum(raw.createdAt) ? raw.createdAt : Date.now(),
    ...(isStr(raw.sourceId) ? { sourceId: raw.sourceId } : {}),
    ...(isStr(raw.cover) ? { cover: raw.cover } : {}),
  }
}

/** Card do arquivo: frente e verso em texto e o estado do FSRS com números válidos. */
function cleanCard(raw: unknown): Flashcard | null {
  if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.deckId) || !isStr(raw.front) || !isStr(raw.back)) return null
  const now = new Date()
  const base = newSrsCard(now)
  const srs = isObj(raw.srs) ? raw.srs : {}
  // JSON transforma datas em texto; o FSRS precisa delas como Date.
  const due = toDate(srs.due, now)
  const card: Flashcard['srs'] = { ...base, due }
  for (const key of ['stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state'] as const) {
    if (isNum(srs[key])) (card as unknown as Record<string, number>)[key] = srs[key] as number
  }
  if (srs.last_review) card.last_review = toDate(srs.last_review, now)
  return {
    id: raw.id,
    deckId: raw.deckId,
    front: raw.front,
    back: raw.back,
    createdAt: isNum(raw.createdAt) ? raw.createdAt : now.getTime(),
    updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : now.getTime(),
    due: due.getTime(),
    srs: card,
  }
}

function cleanReview(raw: unknown): Review | null {
  if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.cardId) || !isStr(raw.deckId) || !isStr(raw.day)) return null
  if (!isNum(raw.grade) || !isNum(raw.reviewedAt)) return null
  return { id: raw.id, cardId: raw.cardId, deckId: raw.deckId, grade: raw.grade, reviewedAt: raw.reviewedAt, day: raw.day }
}

function cleanImage(raw: unknown): ImageRecord | null {
  if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.data) || !raw.data.startsWith('data:')) return null
  const blob = dataUrlToBlob(raw.data)
  return { id: raw.id, blob, type: blob.type, createdAt: isNum(raw.createdAt) ? raw.createdAt : Date.now() }
}

const notNull = <T,>(value: T | null): value is T => value !== null

export async function importBackup(text: string): Promise<{ decks: number; cards: number }> {
  const data = JSON.parse(text) as Partial<Record<keyof BackupFile, unknown>>
  if (data.app !== 'pocards' || !Array.isArray(data.decks) || !Array.isArray(data.cards)) {
    throw new Error('invalid-backup')
  }

  // Só entra o que for válido; itens estranhos ou corrompidos ficam de fora.
  const decks = data.decks.map(cleanDeck).filter(notNull)
  const cards = data.cards.map(cleanCard).filter(notNull)
  const reviews = (Array.isArray(data.reviews) ? data.reviews : []).map(cleanReview).filter(notNull)
  const images = (Array.isArray(data.images) ? data.images : []).map(cleanImage).filter(notNull)

  const game = isObj(data.game) && data.game.id === 'main' ? withGameDefaults(data.game as Partial<GameState>) : undefined

  await db.transaction('rw', [db.decks, db.cards, db.reviews, db.images, db.game], async () => {
    if (decks.length > 0) await db.decks.bulkPut(decks)
    if (cards.length > 0) await db.cards.bulkPut(cards)
    if (reviews.length > 0) await db.reviews.bulkPut(reviews)
    if (images.length > 0) await db.images.bulkPut(images)
    if (game) {
      // Fica com o herói mais avançado (o do aparelho ou o do backup).
      const current = await db.game.get('main')
      if (!current || game.totalPoints >= withGameDefaults(current).totalPoints) await db.game.put(game)
    }
  })

  return { decks: decks.length, cards: cards.length }
}
