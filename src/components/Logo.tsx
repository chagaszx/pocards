/** Marca do Pocards: duas fichas sobrepostas, em traço fino. Segue o tema (claro/escuro). */
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="5" y="3" width="15" height="11" rx="2.5" fill="none" stroke="var(--color-muted)" strokeWidth="1.5" />
      <rect x="3" y="8" width="16" height="12" rx="2.5" fill="var(--color-bg)" stroke="var(--color-fg)" strokeWidth="1.5" />
    </svg>
  )
}
