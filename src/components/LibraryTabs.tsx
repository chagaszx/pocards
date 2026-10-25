import { Link, useLocation } from 'react-router'
import { useT } from '../i18n'

/** Alternância entre "Meus baralhos", "Explorar" e "Resumo" dentro da aba Biblioteca. */
export default function LibraryTabs() {
  const t = useT()
  const { pathname } = useLocation()

  const tabs = [
    { to: '/biblioteca', label: t.library.mine, active: pathname === '/biblioteca' },
    { to: '/biblioteca/explorar', label: t.library.explore, active: pathname.startsWith('/biblioteca/explorar') },
    { to: '/biblioteca/resumo', label: t.library.stats, active: pathname.startsWith('/biblioteca/resumo') },
  ]

  return (
    <nav aria-label={t.library.tabsLabel} className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          aria-current={tab.active ? 'page' : undefined}
          className={`flex min-h-10 items-center justify-center rounded-lg px-1 text-center text-[13px] font-medium leading-tight transition-colors ${
            tab.active ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
