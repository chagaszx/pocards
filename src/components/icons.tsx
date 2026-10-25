/** Ícones em traço fino, usando a cor do texto (currentColor). */

interface IconProps {
  className?: string
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function ChevronRightIcon({ className = 'h-[18px] w-[18px]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M9 6l6 6-6 6" {...stroke} />
    </svg>
  )
}

export function ChevronLeftIcon({ className = 'h-4 w-4 shrink-0' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M15 6l-6 6 6 6" {...stroke} />
    </svg>
  )
}

export function DotsIcon({ className = 'h-[18px] w-[18px]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="6" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function SearchIcon({ className = 'h-[18px] w-[18px]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" {...stroke} />
      <path d="M16 16l4 4" {...stroke} />
    </svg>
  )
}

export function CardsIcon({ className = 'h-[22px] w-[22px]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="6" y="3.5" width="14" height="10.5" rx="2.5" {...stroke} />
      <rect x="4" y="8.5" width="15" height="12" rx="2.5" {...stroke} fill="var(--color-bg)" />
    </svg>
  )
}

export function LibraryIcon({ className = 'h-[22px] w-[22px]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="4" width="4.5" height="16" rx="1" {...stroke} />
      <rect x="10" y="4" width="4.5" height="16" rx="1" {...stroke} />
      <path d="M15.6 6.3l3.5-.9 3.2 12.4-3.5.9z" {...stroke} />
    </svg>
  )
}

export function SettingsIcon({ className = 'h-[22px] w-[22px]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...stroke} />
      <circle cx="15" cy="7" r="2" {...stroke} />
      <circle cx="9" cy="17" r="2" {...stroke} />
    </svg>
  )
}

export function HeroIcon({ className = 'h-[22px] w-[22px]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M14.5 4.5L20 4l-.5 5.5L10 19l-5-5z" {...stroke} />
      <path d="M7 12l5 5M4 20l3-3M5.5 15.5l3 3" {...stroke} />
    </svg>
  )
}

export function TrashIcon({ className = 'h-[18px] w-[18px]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" {...stroke} />
    </svg>
  )
}
