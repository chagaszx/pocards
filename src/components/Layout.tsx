import Dexie from 'dexie'
import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { db, pruneImages } from '../db/db'
import { useT } from '../i18n'
import { syncCatalogDecks } from '../lib/catalog'
import { formatShortDate } from '../lib/date'
import { useDailyReminder } from '../lib/reminder'
import { useNow } from '../lib/useNow'
import HeroToasts from '../game/HeroToasts'
import BetaBanner from './BetaBanner'
import ErrorBoundary from './ErrorBoundary'
import Logo from './Logo'
import TabBar from './TabBar'

/**
 * Erro do banco local que vale um aviso (ex.: aparelho sem espaço). Só os do
 * Dexie: outros erros com nomes parecidos (áudio, internet) não são gravação.
 */
const isStorageError = (reason: unknown) => reason instanceof Dexie.DexieError

export default function Layout() {
  const t = useT()
  const { pathname } = useLocation()
  // Data do topo troca sozinha na virada do dia
  const now = useNow(60_000)
  /** O navegador bloqueou o armazenamento local (o app não funciona sem ele). */
  const [storageBlocked, setStorageBlocked] = useState(false)
  /** Uma gravação falhou (ex.: aparelho sem espaço). */
  const [saveFailed, setSaveFailed] = useState(false)
  useDailyReminder()
  // Atualiza baralhos prontos antigos (ex.: ganharam imagens) e limpa imagens sem uso
  useEffect(() => {
    void syncCatalogDecks().catch(() => undefined)
    void pruneImages().catch(() => undefined)
  }, [])
  // Confere se o banco local abre; se o navegador bloquear (ou travar), avisa em vez de ficar "Carregando…"
  useEffect(() => {
    let settled = false
    const timer = window.setTimeout(() => !settled && setStorageBlocked(true), 15_000)
    db.open()
      .then(() => {
        settled = true
        window.clearTimeout(timer)
      })
      .catch((err) => {
        settled = true
        window.clearTimeout(timer)
        console.error('Banco local indisponível:', err)
        setStorageBlocked(true)
      })
    return () => window.clearTimeout(timer)
  }, [])
  // Gravações que falham sem ninguém tratar (ex.: sem espaço) viram um aviso visível
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStorageError(event.reason)) setSaveFailed(true)
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])
  // Na sessão de estudo as abas somem, para manter o foco no card.
  const showTabs = !pathname.startsWith('/estudar')

  return (
    <div className={`mx-auto flex min-h-dvh max-w-xl flex-col px-5 ${showTabs ? 'pb-28' : 'pb-8'}`}>
      <header className="flex items-center justify-between pb-6 pt-7">
        <div className="flex items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-[22px] w-[22px]" />
            <span className="text-[17px] font-semibold tracking-tight">pocards</span>
          </Link>
          <Link
            to="/configuracoes/feedback"
            title={t.beta.badgeTitle}
            aria-label={t.beta.badgeTitle}
            className="rounded-md border border-border-strong px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-muted hover:text-fg"
          >
            {t.beta.badge}
          </Link>
        </div>
        <span className="font-mono text-xs text-muted">{formatShortDate(t.date, new Date(now))}</span>
      </header>
      <main className="flex flex-1 flex-col">
        {saveFailed && !storageBlocked && (
          <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-again/40 bg-again/[0.06] px-4 py-3 text-[13px] leading-snug">
            <span className="flex-1">{t.errors.saveFailed}</span>
            <button type="button" className="font-medium text-fg" onClick={() => setSaveFailed(false)}>
              {t.errors.dismiss}
            </button>
          </div>
        )}
        {storageBlocked ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-again/40 bg-again/[0.06] p-5">
            <p className="font-medium">{t.errors.storageTitle}</p>
            <p className="text-[13px] leading-snug text-fg-soft">{t.errors.storageText}</p>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              {t.errors.retry}
            </button>
          </div>
        ) : (
          <>
            {pathname === '/' && <BetaBanner />}
            {/* Um erro numa tela não derruba o app: aparece um aviso e o menu continua funcionando */}
            <ErrorBoundary resetKey={pathname}>
              <Outlet />
            </ErrorBoundary>
          </>
        )}
      </main>
      {showTabs && <TabBar />}
      <HeroToasts />
    </div>
  )
}
