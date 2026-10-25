import { useSyncExternalStore } from 'react'

export type ThemeSetting = 'dark' | 'light' | 'system'
export type Language = 'pt' | 'en' | 'es'

export interface Settings {
  theme: ThemeSetting
  language: Language
  sound: boolean
  reminder: { enabled: boolean; time: string }
  /** Mostra a aba Herói (modo opcional, só para diversão). */
  heroMode: boolean
}

/** Mesma chave usada pelo script em index.html (aplica o tema antes de desenhar a tela). */
const STORAGE_KEY = 'pocards-settings'

function detectLanguage(): Language {
  const lang = (typeof navigator !== 'undefined' ? navigator.language : 'pt').slice(0, 2).toLowerCase()
  return lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt'
}

const DEFAULTS: Settings = {
  theme: 'dark',
  language: detectLanguage(),
  sound: true,
  reminder: { enabled: false, time: '20:00' },
  heroMode: true,
}

const THEMES: ThemeSetting[] = ['dark', 'light', 'system']
const LANGUAGES: Language[] = ['pt', 'en', 'es']

/** Usa o valor salvo só se ele for válido (um valor estranho não pode quebrar o app). */
function pick<T>(value: unknown, valid: (v: unknown) => boolean, fallback: T): T {
  return valid(value) ? (value as T) : fallback
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = (JSON.parse(raw) ?? {}) as Partial<Record<keyof Settings, unknown>> & { reminder?: Partial<Record<string, unknown>> }
      const isBool = (v: unknown) => typeof v === 'boolean'
      return {
        theme: pick(saved.theme, (v) => THEMES.includes(v as ThemeSetting), DEFAULTS.theme),
        language: pick(saved.language, (v) => LANGUAGES.includes(v as Language), DEFAULTS.language),
        sound: pick(saved.sound, isBool, DEFAULTS.sound),
        heroMode: pick(saved.heroMode, isBool, DEFAULTS.heroMode),
        reminder: {
          enabled: pick(saved.reminder?.enabled, isBool, DEFAULTS.reminder.enabled),
          time: pick(saved.reminder?.time, (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v), DEFAULTS.reminder.time),
        },
      }
    }
  } catch {
    // Armazenamento indisponível (aba anônima etc.) ou texto inválido: usa o padrão
  }
  return DEFAULTS
}

let current = load()
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Sem armazenamento: vale só até fechar a aba
  }
  applyToDocument()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Avisa quando alguma preferência muda (para quem vive fora das telas, como o motor do herói). */
export const subscribeSettings = subscribe

/** Preferências atuais; a tela atualiza sozinha quando mudam. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings)
}

const systemLight = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: light)') : null

export function resolvedTheme(): 'dark' | 'light' {
  if (current.theme === 'system') return systemLight?.matches ? 'light' : 'dark'
  return current.theme
}

const HTML_LANG: Record<Language, string> = { pt: 'pt-BR', en: 'en', es: 'es' }

/** Aplica tema e idioma na página (atributos do <html> e cor da barra do navegador). */
export function applyToDocument(): void {
  const theme = resolvedTheme()
  const root = document.documentElement
  root.dataset.theme = theme
  root.lang = HTML_LANG[current.language]
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#fafafa' : '#0f0f11')
}

systemLight?.addEventListener('change', () => {
  if (current.theme === 'system') applyToDocument()
})
