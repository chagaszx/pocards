import { db, importDecks } from '../db/db'

/** Um baralho pronto da aba Explorar (arquivos em public/biblioteca). */
export interface CatalogEntry {
  id: string
  name: string
  category: string
  description: string
  count: number
  /** Imagem de capa (bandeira etc.), opcional. */
  cover?: string
}

export interface CatalogDeck extends Omit<CatalogEntry, 'count'> {
  cards: [string, string][]
}

let catalogCache: Promise<CatalogEntry[]> | null = null

export function fetchCatalog(): Promise<CatalogEntry[]> {
  catalogCache ??= fetch('/biblioteca/catalogo.json').then((res) => {
    if (!res.ok) throw new Error('Não consegui carregar os baralhos prontos.')
    return res.json() as Promise<CatalogEntry[]>
  })
  catalogCache.catch(() => (catalogCache = null))
  return catalogCache
}

export async function fetchCatalogDeck(id: string): Promise<CatalogDeck> {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Baralho não encontrado.')
  const res = await fetch(`/biblioteca/${id}.json`)
  if (!res.ok) throw new Error('Baralho não encontrado.')
  return (await res.json()) as CatalogDeck
}

/** Versão dos baralhos prontos. Aumente quando eles ganharem novidades (ex.: imagens). */
const CATALOG_VERSION = 5
const SYNC_KEY = 'pocards-catalog-version'

/**
 * Texto sem os "enfeites" que os baralhos prontos ganharam depois (linhas só com imagem,
 * créditos de foto), para comparar com a versão antiga do card.
 */
function withoutImages(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^\s*!\[[^\]]*\]\([^)\s]+\)\s*$/.test(line))
    .filter((line) => !/^\*(Foto|Imagem ilustrativa):/.test(line.trim()))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/**
 * Chave para reconhecer o "mesmo" card entre versões: o texto sem enfeites ou,
 * se o lado for só uma imagem (ex.: o quadrinho do elemento), o texto alternativo dela.
 */
function matchKey(text: string): string {
  return withoutImages(text) || (text.match(/!\[([^\]]*)\]/)?.[1] ?? '').trim()
}

function cardKey(front: string, back: string): string {
  return `${matchKey(front)}\u0000${matchKey(back)}`
}

/**
 * Atualiza os baralhos prontos que o usuário adicionou antes de uma novidade
 * (como as bandeiras e mapas). Só mexe nos cards que ele não editou, e o
 * progresso de estudo de cada card é mantido.
 */
export async function syncCatalogDecks(): Promise<void> {
  try {
    if (Number(localStorage.getItem(SYNC_KEY)) >= CATALOG_VERSION) return
  } catch {
    return
  }

  const decks = (await db.decks.toArray()).filter((deck) => deck.sourceId)
  for (const deck of decks) {
    let source: CatalogDeck
    try {
      source = await fetchCatalogDeck(deck.sourceId!)
    } catch {
      continue
    }
    const updates = new Map(source.cards.map(([front, back]) => [cardKey(front, back), { front, back }]))
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    await db.transaction('rw', db.decks, db.cards, async () => {
      if (source.cover && deck.cover !== source.cover) await db.decks.update(deck.id, { cover: source.cover })
      for (const card of cards) {
        const next = updates.get(cardKey(card.front, card.back))
        if (next && (next.front !== card.front || next.back !== card.back)) {
          await db.cards.update(card.id, { front: next.front, back: next.back })
        }
      }
    })
  }

  try {
    localStorage.setItem(SYNC_KEY, String(CATALOG_VERSION))
  } catch {
    // sem armazenamento: tenta de novo na próxima vez
  }
}

/** Adiciona um baralho pronto à biblioteca do usuário e devolve o id do novo baralho. */
export async function addCatalogDeck(id: string): Promise<string> {
  const deck = await fetchCatalogDeck(id)
  const result = await importDecks([
    {
      name: deck.name,
      sourceId: deck.id,
      cover: deck.cover,
      cards: deck.cards.map(([front, back]) => ({ front, back })),
    },
  ])
  return result.ids[0]
}
