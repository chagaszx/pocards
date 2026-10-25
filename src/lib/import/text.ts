import { htmlToText } from './html'
import type { ParsedCard, ParsedDeck } from './types'

export type Separator = '\t' | ',' | ';'

/** Separadores na ordem do seletor, com a chave do texto traduzido. */
export const SEPARATORS: { value: Separator; label: 'tab' | 'comma' | 'semicolon' }[] = [
  { value: '\t', label: 'tab' },
  { value: ',', label: 'comma' },
  { value: ';', label: 'semicolon' },
]

/** Remove as linhas de cabeçalho que o Anki coloca no topo (#separator:tab, #html:true…). */
function stripHeaderLines(text: string): string {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  let start = 0
  while (start < lines.length && lines[start].startsWith('#')) start += 1
  return lines.slice(start).join('\n')
}

/** Adivinha o separador olhando as primeiras linhas: tab, ponto e vírgula ou vírgula. */
export function detectSeparator(text: string): Separator {
  const sample = stripHeaderLines(text)
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .slice(0, 30)
  const linesWith = (sep: string) => sample.filter((line) => line.includes(sep)).length
  const candidates: Separator[] = ['\t', ';', ',']
  let best: Separator = '\t'
  let bestCount = 0
  for (const sep of candidates) {
    const count = linesWith(sep)
    if (count > bestCount) {
      best = sep
      bestCount = count
    }
  }
  return best
}

/** Lê texto delimitado respeitando aspas ("campo, com vírgula" e quebras de linha dentro de aspas). */
export function parseDelimited(text: string, separator: Separator): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"' && field === '') {
      inQuotes = true
    } else if (char === separator) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/**
 * Transforma texto (CSV, TSV, exportação do Quizlet ou "notas em texto" do Anki)
 * em um baralho: 1ª coluna = frente, 2ª coluna = verso.
 */
export function parseTextDeck(
  text: string,
  name: string,
  separator?: Separator,
): { deck: ParsedDeck; skipped: number; separator: Separator } {
  const sep = separator ?? detectSeparator(text)
  const rows = parseDelimited(stripHeaderLines(text), sep)
  const cards: ParsedCard[] = []
  let skipped = 0

  for (const row of rows) {
    if (row.every((cell) => cell.trim() === '')) continue
    const front = htmlToText(row[0] ?? '')
    const back = htmlToText(row[1] ?? '')
    if (!front || !back) {
      skipped += 1
      continue
    }
    cards.push({ front, back })
  }

  return { deck: { name, cards }, skipped, separator: sep }
}
