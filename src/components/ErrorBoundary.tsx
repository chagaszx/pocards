import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { getT } from '../i18n'

interface Props {
  children: ReactNode
  /** Mudou (ex.: outra página)? O aviso some e a tela tenta de novo. */
  resetKey?: string
}

interface State {
  error: Error | null
  /** Cada "Tentar de novo" monta a tela do zero (consultas e estados novos). */
  attempt: number
}

/**
 * Um erro ao desenhar uma tela vira um aviso com saída, em vez de deixar o app
 * inteiro em branco. Os dados continuam salvos; dá para tentar de novo ou voltar.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro ao desenhar a tela:', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))
  }

  render() {
    if (!this.state.error) return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
    const t = getT().errors
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-again/40 bg-again/[0.06] p-5">
        <p className="font-medium">{t.title}</p>
        <p className="text-[13px] leading-snug text-fg-soft">{t.text}</p>
        {/* Detalhe técnico: ajuda a descobrir o problema num print ou no feedback */}
        <p className="break-all font-mono text-[11px] text-muted">
          {this.state.error.name}: {this.state.error.message}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}>
            {t.retry}
          </button>
          <a href="/" className="btn btn-ghost">
            {t.home}
          </a>
          <a href="/configuracoes/feedback" className="btn btn-ghost">
            {t.report}
          </a>
        </div>
      </div>
    )
  }
}
