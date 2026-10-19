import { Link, Outlet } from 'react-router'
import Logo from './Logo'

export default function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-10">
      <header className="flex items-center justify-between py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <span className="font-display text-2xl font-semibold tracking-tight">Pocards</span>
        </Link>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
