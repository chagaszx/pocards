import { Link } from 'react-router'
import { useT } from '../i18n'

/**
 * Aviso fixo na página inicial: o Pocards está na versão inicial e pode ter
 * bugs, com um botão que leva direto para abrir um feedback.
 */
export default function BetaBanner() {
  const t = useT()
  return (
    <aside aria-label={t.beta.label} className="mb-6 rounded-2xl border border-hard/40 bg-hard/[0.07] p-4">
      <p className="flex items-center gap-2 font-medium">
        <span className="rounded-md border border-hard/60 px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-hard">
          {t.beta.badge}
        </span>
        {t.beta.title}
      </p>
      <p className="mt-1.5 text-[13px] leading-snug text-fg-soft">{t.beta.text}</p>
      <Link to="/configuracoes/feedback" className="btn btn-primary mt-3">
        {t.beta.button}
      </Link>
    </aside>
  )
}
