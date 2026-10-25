import type { ReactNode } from 'react'

/** Linha de configuração: título, descrição e o controle à direita. */
export function SettingRow({
  title,
  description,
  children,
  id,
}: {
  title: string
  description?: string
  children: ReactNode
  id?: string
}) {
  return (
    <li className="flex items-center gap-4 border-b border-line py-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium" id={id}>
          {title}
        </p>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
      </div>
      {children}
    </li>
  )
}

/** Interruptor liga/desliga acessível. */
export function Switch({
  checked,
  onChange,
  labelledBy,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  labelledBy: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
        checked ? 'border-fg bg-fg' : 'border-border-strong bg-surface-2'
      }`}
    >
      <span
        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${
          checked ? 'left-[calc(100%-1.5rem)] bg-bg' : 'left-1 bg-muted'
        }`}
      />
    </button>
  )
}

/** Grupo de botões em que só um fica selecionado (ex.: Escuro / Claro / Sistema). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl border border-line bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 min-w-0 flex-1 truncate rounded-lg px-1.5 text-[13px] font-medium transition-colors sm:px-3 ${
            value === option.value ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
