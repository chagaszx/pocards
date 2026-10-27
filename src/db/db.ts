import Dexie, { type EntityTable } from 'dexie'
import type { Card as SrsCard, Grade } from 'ts-fsrs'
import type { Deck, Flashcard, GameState, ImageRecord, Review } from './types'
import type { ParsedDeck } from '../lib/import/types'
import { imageIdsIn } from '../lib/markdown'
import { newSrsCard } from '../lib/srs'
import { dayKey } from '../lib/date'
import { ENERGY, NO_UPGRADES, POINTS_BY_GRADE, SKILLS, STAGE_COUNT, UPGRADES, WELCOME_POINTS, type SkillId } from '../game/data'

/**
 * Banco local do Pocards (IndexedDB). Tudo fica salvo no aparelho;
 * a sincronização com a nuvem entra na Fase 3.
 */
export const db = new Dexie('pocards') as Dexie & {
  decks: EntityTable<Deck, 'id'>
  cards: EntityTable<Flashcard, 'id'>
  reviews: EntityTable<Review, 'id'>
  images: EntityTable<ImageRecord, 'id'>
  game: EntityTable<GameState, 'id'>
}

db.version(1).stores({
  decks: 'id, createdAt',
  cards: 'id, deckId, due, createdAt',
})

// Versão 2: histórico de revisões (para a sequência de dias).
db.version(2).stores({
  decks: 'id, createdAt',
  cards: 'id, deckId, due, createdAt',
  reviews: 'id, day, cardId, deckId',
})

// Versão 3: imagens dos cards.
db.version(3).stores({
  decks: 'id, createdAt',
  cards: 'id, deckId, due, createdAt',
  reviews: 'id, day, cardId, deckId',
  images: 'id, createdAt',
})

// Versão 4: progresso do modo Herói.
db.version(4).stores({
  decks: 'id, createdAt',
  cards: 'id, deckId, due, createdAt',
  reviews: 'id, day, cardId, deckId',
  images: 'id, createdAt',
  game: 'id',
})

const newId = () => crypto.randomUUID()

// ---------- Modo Herói ----------

/** Estado inicial do herói (já com os pontos de boas-vindas). */
export function newGameState(): GameState {
  return {
    id: 'main',
    points: WELCOME_POINTS,
    totalPoints: WELCOME_POINTS,
    level: 1,
    xp: 0,
    gold: 0,
    unlockedStage: 1,
    selectedStage: 1,
    bossDefeated: false,
    auto: false,
    speed: 1,
    battleSound: true,
    music: true,
    upgrades: { ...NO_UPGRADES },
    lastEnergyAt: Date.now(),
    bossKills: 0,
    medal: 0,
    medalPending: false,
    medalName: '',
    runs: 0,
    wins: 0,
    learned: [],
    equipped: [],
  }
}

/** Número válido dentro de [min, max]; se não for um número, usa `fallback`. */
function num(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

const SKILL_IDS = new Set<string>(SKILLS.map((skill) => skill.id))
const skillList = (value: unknown): SkillId[] =>
  Array.isArray(value) ? [...new Set(value.filter((id): id is SkillId => SKILL_IDS.has(id)))] : []

/**
 * Completa campos que heróis salvos em versões antigas não têm e corrige
 * valores impossíveis (ex.: backup corrompido), para a Aventura nunca quebrar.
 */
export function withGameDefaults(saved: Partial<GameState>): GameState {
  const base = newGameState()
  const now = Date.now()
  const upgrades = { ...NO_UPGRADES }
  for (const def of UPGRADES) upgrades[def.id] = Math.round(num(saved.upgrades?.[def.id], 0, 0, def.max))
  const bossDefeated = Boolean(saved.bossDefeated)
  const medal = Math.round(num(saved.medal, 0, 0, 3))
  return {
    ...base,
    ...saved,
    id: 'main',
    points: num(saved.points, saved.points === undefined ? base.points : 0),
    totalPoints: num(saved.totalPoints, saved.totalPoints === undefined ? base.totalPoints : 0),
    level: Math.round(num(saved.level, 1, 1, 999)),
    xp: num(saved.xp, 0),
    gold: num(saved.gold, 0),
    unlockedStage: Math.round(num(saved.unlockedStage, 1, 1, STAGE_COUNT)),
    selectedStage: Math.round(num(saved.selectedStage, 1, 1, STAGE_COUNT)),
    speed: saved.speed === 2 ? 2 : 1,
    bossDefeated,
    auto: Boolean(saved.auto ?? base.auto),
    battleSound: Boolean(saved.battleSound ?? base.battleSound),
    music: Boolean(saved.music ?? base.music),
    upgrades,
    // Relógio da recarga: nunca no futuro (relógio do aparelho mudou) nem inválido
    lastEnergyAt: num(saved.lastEnergyAt, now, 0, now),
    bossKills: Math.round(num(saved.bossKills, bossDefeated ? 1 : 0)),
    medal,
    // Quem já venceu o chefe antes do ranking pode registrar a vitória
    medalPending: Boolean(saved.medalPending ?? (bossDefeated && !medal)),
    medalName: typeof saved.medalName === 'string' ? saved.medalName : '',
    runs: Math.round(num(saved.runs, 0)),
    wins: Math.round(num(saved.wins, 0)),
    learned: skillList(saved.learned),
    equipped: skillList(saved.equipped),
    activeRuns: Array.isArray(saved.activeRuns) ? saved.activeRuns.filter((run) => run?.result?.events?.length) : [],
  }
}

/**
 * Recarga de energia pelo tempo (funciona mesmo com o app fechado): +2 a cada
 * 15 min enquanto houver menos de 10. Com 10 ou mais, o relógio fica parado.
 */
export function withEnergyRegen(state: GameState, now = Date.now()): GameState {
  if (state.points >= ENERGY.cap) return state.lastEnergyAt === now ? state : { ...state, lastEnergyAt: now }
  const intervals = Math.floor((now - state.lastEnergyAt) / ENERGY.everyMs)
  if (intervals <= 0) return state
  const points = Math.min(ENERGY.cap, state.points + intervals * ENERGY.amount)
  const gained = points - state.points
  return {
    ...state,
    points,
    totalPoints: state.totalPoints + gained,
    lastEnergyAt: points >= ENERGY.cap ? now : state.lastEnergyAt + intervals * ENERGY.everyMs,
  }
}

/** Aplica a recarga de energia no banco (chamado de tempos em tempos). */
export async function regenEnergy(): Promise<void> {
  await db.transaction('rw', db.game, async () => {
    const saved = await db.game.get('main')
    if (!saved) return
    const state = withGameDefaults(saved)
    const next = withEnergyRegen(state)
    // Saves antigos (sem relógio) ou com o relógio no futuro: grava o relógio corrigido
    const clockFixed = typeof saved.lastEnergyAt !== 'number' || saved.lastEnergyAt !== state.lastEnergyAt
    if (clockFixed || next.points !== state.points || (next.lastEnergyAt !== state.lastEnergyAt && state.points < ENERGY.cap)) {
      await db.game.put(next)
    }
  })
}

export async function getGameState(): Promise<GameState> {
  const saved = await db.game.get('main')
  return saved ? withGameDefaults(saved) : newGameState()
}

export async function saveGameState(patch: Partial<GameState>): Promise<GameState> {
  return db.transaction('rw', db.game, async () => {
    const next = { ...(await getGameState()), ...patch, id: 'main' as const }
    await db.game.put(next)
    return next
  })
}

/** Pontos do herói ganhos por uma resposta (Errei 0 · Difícil 1 · Bom 2 · Fácil 4). */
export function pointsForGrade(grade: number): number {
  return POINTS_BY_GRADE[grade] ?? 0
}

// ---------- Imagens ----------

export async function saveImage(blob: Blob): Promise<string> {
  const id = newId()
  await db.images.add({ id, blob, type: blob.type, createdAt: Date.now() })
  return id
}

/**
 * Apaga imagens que nenhum card usa mais. Imagens da última hora são mantidas,
 * porque podem estar num card que ainda está sendo escrito.
 */
export async function pruneImages(): Promise<void> {
  const cutoff = Date.now() - 60 * 60_000
  const old = await db.images.where('createdAt').below(cutoff).primaryKeys()
  if (old.length === 0) return
  const used = new Set<string>()
  // toArray em vez de each: o Safari do iPhone às vezes recusa abrir cursores ("Unable to open cursor")
  for (const card of await db.cards.toArray()) {
    for (const id of imageIdsIn(`${card.front}\n${card.back}`)) used.add(id)
  }
  const unused = old.filter((id) => !used.has(String(id)))
  if (unused.length) await db.images.bulkDelete(unused.map(String))
}

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
    // Busca as chaves e apaga em lote (sem cursor, que o Safari do iPhone às vezes recusa)
    await db.cards.bulkDelete(await db.cards.where('deckId').equals(id).primaryKeys())
    await db.decks.delete(id)
  })
  void pruneImages()
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
  void pruneImages()
}

export async function deleteCard(id: string): Promise<void> {
  await db.cards.delete(id)
  void pruneImages()
}

export async function deleteCards(ids: string[]): Promise<void> {
  await db.cards.bulkDelete(ids)
  void pruneImages()
}

/** Salva o resultado de uma revisão, registra no histórico e devolve o card atualizado. */
export async function saveReview(card: Flashcard, srs: SrsCard, grade: Grade, now: Date): Promise<Flashcard> {
  const updated: Flashcard = { ...card, srs, due: srs.due.getTime(), updatedAt: now.getTime() }
  await db.transaction('rw', db.cards, db.reviews, db.game, async () => {
    await db.cards.put(updated)
    const points = pointsForGrade(grade)
    if (points > 0) {
      const game = await getGameState()
      await db.game.put({ ...game, points: game.points + points, totalPoints: game.totalPoints + points })
    }
    await db.reviews.add({
      id: newId(),
      cardId: card.id,
      deckId: card.deckId,
      grade,
      reviewedAt: now.getTime(),
      day: dayKey(now),
    })
  })
  return updated
}

// ---------- Importação ----------

/** Cria os baralhos importados com todos os cards como novos. */
export async function importDecks(
  decks: (ParsedDeck & { sourceId?: string; cover?: string })[],
): Promise<{ decks: number; cards: number; ids: string[] }> {
  const start = Date.now()
  let cardCount = 0
  const ids: string[] = []

  await db.transaction('rw', db.decks, db.cards, async () => {
    for (const [deckIndex, parsed] of decks.entries()) {
      const deckId = newId()
      ids.push(deckId)
      await db.decks.add({
        id: deckId,
        name: parsed.name.trim() || 'Baralho importado',
        createdAt: start + deckIndex,
        ...(parsed.sourceId ? { sourceId: parsed.sourceId } : {}),
        ...(parsed.cover ? { cover: parsed.cover } : {}),
      })

      const now = new Date(start)
      const cards: Flashcard[] = parsed.cards.map((card, i) => {
        const srs = newSrsCard(now)
        return {
          id: newId(),
          deckId,
          front: card.front,
          back: card.back,
          // createdAt crescente mantém a ordem original dos cards
          createdAt: start + i,
          updatedAt: start,
          due: srs.due.getTime(),
          srs,
        }
      })
      await db.cards.bulkAdd(cards)
      cardCount += cards.length
    }
  })

  return { decks: decks.length, cards: cardCount, ids }
}

// ---------- Geral ----------

/** Apaga todos os baralhos, cards, imagens e histórico deste aparelho. */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.decks, db.cards, db.reviews, db.images, db.game], async () => {
    await db.game.clear()
    await db.reviews.clear()
    await db.cards.clear()
    await db.decks.clear()
    await db.images.clear()
  })
}
