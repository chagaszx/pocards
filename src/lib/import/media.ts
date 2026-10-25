import { importDecks, saveImage } from '../../db/db'
import { compressImage } from '../images'
import type { ParsedDeck } from './types'

const ANKI_IMAGE = /!\[([^\]\n]*)\]\(anki:([^)\s]+)\)/g

/** Nomes (codificados) dos arquivos de imagem do Anki usados no texto. */
export function ankiMediaRefs(text: string): string[] {
  return [...text.matchAll(ANKI_IMAGE)].map((m) => m[2])
}

/**
 * Salva os baralhos importados junto com as imagens:
 * cada ![](anki:arquivo) vira ![](img:id) apontando para a imagem salva no aparelho.
 * Imagens que não vieram no pacote são removidas do texto.
 */
export async function importDecksWithMedia(
  decks: ParsedDeck[],
  media: Map<string, Blob> | undefined,
): Promise<{ decks: number; cards: number; images: number }> {
  const savedIds = new Map<string, string>()

  if (media && media.size > 0) {
    const used = new Set<string>()
    for (const deck of decks) for (const card of deck.cards) for (const ref of ankiMediaRefs(`${card.front}\n${card.back}`)) used.add(ref)
    for (const ref of used) {
      const blob = media.get(ref)
      if (!blob) continue
      const compressed = await compressImage(blob).catch(() => blob)
      savedIds.set(ref, await saveImage(compressed))
    }
  }

  const resolve = (text: string) =>
    text
      .replace(ANKI_IMAGE, (_m, alt: string, ref: string) => (savedIds.has(ref) ? `![${alt}](img:${savedIds.get(ref)})` : ''))
      .replace(/\n{3,}/g, '\n\n')
      .trim()

  const resolved = decks.map((deck) => ({
    ...deck,
    cards: deck.cards
      .map((card) => ({ front: resolve(card.front), back: resolve(card.back) }))
      .filter((card) => card.front && card.back),
  }))

  const result = await importDecks(resolved.filter((deck) => deck.cards.length > 0))
  return { decks: result.decks, cards: result.cards, images: savedIds.size }
}
