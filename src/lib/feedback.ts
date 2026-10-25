import { APP_VERSION, FEEDBACK } from '../config'
import { db } from '../db/db'
import { getT } from '../i18n'
import { getSettings, resolvedTheme } from './settings'

export type FeedbackKind = 'bug' | 'idea' | 'other'

export interface FeedbackInput {
  kind: FeedbackKind
  message: string
  contact: string
  includeDiagnostics: boolean
}

/** Como o feedback vai ser enviado, de acordo com o que está configurado em src/config.ts. */
export type FeedbackChannel = 'direct' | 'email' | 'none'

export function feedbackChannel(): FeedbackChannel {
  if (FEEDBACK.web3formsKey) return 'direct'
  if (FEEDBACK.email) return 'email'
  return 'none'
}

export function canFallbackToEmail(): boolean {
  return FEEDBACK.email !== ''
}

/** Informações técnicas que ajudam a reproduzir um erro. Nenhum conteúdo dos cards vai junto. */
export async function collectDiagnostics(): Promise<Record<string, string>> {
  const settings = getSettings()
  const t = getT()
  const labels = t.feedback.diagLabels
  const [decks, cards] = await Promise.all([db.decks.count(), db.cards.count()])
  return {
    [labels.version]: APP_VERSION,
    [labels.page]: window.location.pathname,
    [labels.language]: t.settings.languages[settings.language],
    [labels.theme]: t.settings.themes[resolvedTheme()],
    [labels.screen]: `${window.innerWidth}×${window.innerHeight}`,
    [labels.browser]: navigator.userAgent,
    [labels.installed]: window.matchMedia('(display-mode: standalone)').matches ? labels.yes : labels.no,
    [labels.decks]: String(decks),
    [labels.cards]: String(cards),
  }
}

const KIND_SUBJECT: Record<FeedbackKind, string> = {
  bug: 'Erro',
  idea: 'Sugestão',
  other: 'Outro',
}

function buildBody(input: FeedbackInput, diagnostics: Record<string, string> | null): string {
  const lines = [input.message.trim()]
  if (input.contact.trim()) lines.push('', `Contato: ${input.contact.trim()}`)
  if (diagnostics) {
    lines.push('', '— Informações técnicas —')
    for (const [key, value] of Object.entries(diagnostics)) lines.push(`${key}: ${value}`)
  }
  return lines.join('\n')
}

function subject(input: FeedbackInput): string {
  return `[Pocards] ${KIND_SUBJECT[input.kind]}: ${input.message.trim().slice(0, 60)}`
}

/** Envia direto pelo Web3Forms. Lança erro se falhar. */
export async function sendFeedbackDirect(input: FeedbackInput): Promise<void> {
  const diagnostics = input.includeDiagnostics ? await collectDiagnostics() : null
  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: FEEDBACK.web3formsKey,
      subject: subject(input),
      from_name: 'Pocards',
      ...(input.contact.includes('@') ? { email: input.contact.trim(), replyto: input.contact.trim() } : {}),
      message: buildBody(input, diagnostics),
    }),
  })
  if (!response.ok) throw new Error(`feedback-failed-${response.status}`)
  // O Web3Forms pode responder 200 e mesmo assim recusar (ex.: chave inválida)
  const data = (await response.json().catch(() => null)) as { success?: boolean } | null
  if (data?.success === false) throw new Error('feedback-failed-rejected')
}

/** Monta um link mailto: que abre o app de e-mail da pessoa com tudo preenchido. */
export async function feedbackMailto(input: FeedbackInput): Promise<string> {
  const diagnostics = input.includeDiagnostics ? await collectDiagnostics() : null
  const params = `subject=${encodeURIComponent(subject(input))}&body=${encodeURIComponent(buildBody(input, diagnostics))}`
  return `mailto:${FEEDBACK.email}?${params}`
}
