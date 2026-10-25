import type { Dict } from '../i18n'

/** "seg, 19 de out" / "Mon, Oct 19" / "lun, 19 de oct" */
export function formatShortDate(t: Dict['date'], date: Date = new Date()): string {
  return t.short(t.weekdays[date.getDay()], date.getDate(), t.months[date.getMonth()])
}

/** Inicial do dia da semana no idioma escolhido. */
export function weekdayInitial(t: Dict['date'], date: Date): string {
  return t.weekdayInitials[date.getDay()]
}

/** Dia local no formato AAAA-MM-DD (não usa UTC, para não "pular" de dia à noite). */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Texto sem acentos e em minúsculas, para buscas ("Inglês" acha "ingles"). */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
