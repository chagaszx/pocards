import { Link, useLocation } from 'react-router'
import { useT } from '../i18n'
import { useSettings } from '../lib/settings'
import { CardsIcon, HeroIcon, LibraryIcon, SettingsIcon } from './icons'

export default function TabBar() {
  const t = useT()
  const { pathname } = useLocation()
  const { heroMode } = useSettings()

  const tabs = [
    { to: '/', label: t.tabs.cards, Icon: CardsIcon, active: pathname === '/' },
    {
      to: '/biblioteca',
      label: t.tabs.library,
      Icon: LibraryIcon,
      active: ['/biblioteca', '/baralho', '/importar'].some((p) => pathname.startsWith(p)),
    },
    ...(heroMode ? [{ to: '/aventura', label: t.tabs.hero, Icon: HeroIcon, active: ['/aventura', '/heroi'].some((p) => pathname.startsWith(p)) }] : []),
    { to: '/configuracoes', label: t.tabs.settings, Icon: SettingsIcon, active: pathname.startsWith('/configuracoes') },
  ]

  return (
    <nav
      aria-label={t.tabs.label}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className={`mx-auto grid max-w-xl ${tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {tabs.map(({ to, label, Icon, active }) => (
          <li key={to}>
            <Link
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 pb-2.5 pt-3 text-[11px] font-medium transition-colors ${
                active ? 'text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              <Icon />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
