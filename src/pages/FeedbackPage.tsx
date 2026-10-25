import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Segmented } from '../components/controls'
import { ChevronLeftIcon } from '../components/icons'
import { useT } from '../i18n'
import {
  canFallbackToEmail,
  collectDiagnostics,
  feedbackChannel,
  feedbackMailto,
  sendFeedbackDirect,
  type FeedbackInput,
  type FeedbackKind,
} from '../lib/feedback'
import { playSound } from '../lib/sound'

const MIN_LENGTH = 10

type Status = 'idle' | 'sending' | 'sent' | 'emailOpened' | 'error' | 'offline'

/** Configurações › Enviar feedback: formulário para relatar erros e sugerir melhorias. */
export default function FeedbackPage() {
  const t = useT()
  const channel = feedbackChannel()

  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const [diagnostics, setDiagnostics] = useState<Record<string, string> | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [touched, setTouched] = useState(false)
  const honeypot = useRef<HTMLInputElement>(null)

  useEffect(() => {
    collectDiagnostics().then(setDiagnostics).catch(() => setDiagnostics(null))
  }, [])

  const input: FeedbackInput = { kind, message, contact, includeDiagnostics }
  const tooShort = message.trim().length < MIN_LENGTH

  async function openEmail() {
    window.location.href = await feedbackMailto(input)
    setStatus('emailOpened')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (tooShort || status === 'sending') return
    // Campo invisível preenchido = robô: finge que enviou e não gasta a cota de envios
    if (honeypot.current?.value) {
      setStatus('sent')
      return
    }

    if (channel === 'email') {
      await openEmail()
      return
    }
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }
    setStatus('sending')
    try {
      await sendFeedbackDirect(input)
      playSound('complete')
      setStatus('sent')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  function reset() {
    setMessage('')
    setContact('')
    setTouched(false)
    setStatus('idle')
  }

  const backLink = (
    <Link to="/configuracoes" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
      <ChevronLeftIcon />
      {t.feedback.back}
    </Link>
  )

  if (status === 'sent' || status === 'emailOpened') {
    return (
      <div className="flex flex-col gap-6">
        {backLink}
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-2xl font-semibold">
            {status === 'sent' ? t.feedback.sentTitle : t.feedback.emailOpenedTitle}
          </p>
          <p className="text-muted">{status === 'sent' ? t.feedback.sentText : t.feedback.emailOpenedText}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link to="/" className="btn btn-primary">
              {t.feedback.backHome}
            </Link>
            <button className="btn btn-ghost" onClick={reset}>
              {t.feedback.sendAnother}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-3">
        {backLink}
        <h1 className="text-[26px] font-semibold tracking-tight">{t.feedback.title}</h1>
        <p className="text-[13px] leading-snug text-muted">{t.feedback.intro}</p>
      </section>

      {channel === 'none' ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          {t.feedback.notConfigured}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="space-y-2">
            <p className="label">{t.feedback.kind}</p>
            <Segmented
              label={t.feedback.kind}
              value={kind}
              onChange={setKind}
              options={[
                { value: 'bug', label: t.feedback.kinds.bug },
                { value: 'idea', label: t.feedback.kinds.idea },
                { value: 'other', label: t.feedback.kinds.other },
              ]}
            />
          </div>

          <label className="block space-y-1.5">
            <span className="label block">{t.feedback.message}</span>
            <textarea
              className="field min-h-36 resize-y"
              placeholder={t.feedback.placeholders[kind]}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={4000}
              aria-invalid={touched && tooShort}
              aria-describedby="feedback-message-error"
            />
            {touched && tooShort && (
              <span id="feedback-message-error" className="block text-[13px] text-again">
                {t.feedback.tooShort}
              </span>
            )}
          </label>

          <label className="block space-y-1.5">
            <span className="label block">{t.feedback.contact}</span>
            <input
              type="email"
              className="field"
              autoComplete="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              aria-describedby="feedback-contact-help"
            />
            <span id="feedback-contact-help" className="block text-[13px] text-muted">
              {t.feedback.contactHelp}
            </span>
          </label>

          <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-fg)]"
              />
              <span>
                <span className="block font-medium">{t.feedback.diagnostics}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted">{t.feedback.diagnosticsHelp}</span>
              </span>
            </label>
            {includeDiagnostics && diagnostics && (
              <details className="pl-8 text-[13px]">
                <summary className="cursor-pointer py-1 text-muted hover:text-fg">{t.feedback.showDiagnostics}</summary>
                <dl className="mt-2 space-y-1 font-mono text-xs text-muted">
                  {Object.entries(diagnostics).map(([key, value]) => (
                    <div key={key} className="break-all">
                      <dt className="inline text-fg">{key}:</dt> <dd className="inline">{value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </div>

          {(status === 'error' || status === 'offline') && (
            <div role="alert" className="space-y-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              <p className="text-again">{status === 'offline' ? t.feedback.offline : t.feedback.error}</p>
              {status === 'error' && canFallbackToEmail() && (
                <button type="button" className="btn btn-ghost" onClick={openEmail}>
                  {t.feedback.tryEmail}
                </button>
              )}
            </div>
          )}

          {channel === 'email' && <p className="text-[13px] leading-snug text-muted">{t.feedback.emailModeNote}</p>}

          {/* Armadilha para robôs de spam: invisível para pessoas, robôs costumam preencher */}
          <input
            ref={honeypot}
            type="text"
            name="botcheck"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-px w-px opacity-0"
          />

          <button className="btn btn-primary h-12 text-base" disabled={status === 'sending'}>
            {status === 'sending' ? t.feedback.sending : channel === 'email' ? t.feedback.openEmail : t.feedback.send}
          </button>
        </form>
      )}
    </div>
  )
}
