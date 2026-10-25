export interface ParsedCard {
  front: string
  back: string
}

export interface ParsedDeck {
  name: string
  cards: ParsedCard[]
}

export interface ImportPreview {
  decks: ParsedDeck[]
  /** Itens ignorados (vazios, só áudio etc.). */
  skipped: number
  /** Imagens do pacote do Anki usadas nos cards (nome codificado → imagem). */
  media?: Map<string, Blob>
}
