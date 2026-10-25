import { getSettings, useSettings, type Language } from '../lib/settings'
import en from './en'
import es from './es'
import pt, { type Dict } from './pt'

export type { Dict }

export const DICTIONARIES: Record<Language, Dict> = { pt, en, es }

/** Textos no idioma escolhido; a tela troca sozinha quando o idioma muda. */
export function useT(): Dict {
  return DICTIONARIES[useSettings().language]
}

/** Para uso fora de componentes (ex.: notificações). */
export function getT(): Dict {
  return DICTIONARIES[getSettings().language]
}
