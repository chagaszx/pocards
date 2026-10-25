import type { SkillId } from './data'

/**
 * Identidade visual do modo Herói: ícones coloridos para ouro, vida, ataque,
 * defesa, experiência, pontos e cada habilidade.
 */

const OUTLINE = '#17171c'

interface IconProps {
  className?: string
}

const base = (className = 'h-4 w-4') => ({ viewBox: '0 0 24 24', className, 'aria-hidden': true as const })

/** Moeda de ouro. */
export function CoinIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="9" fill="#f2c54b" stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#c9952a" strokeWidth="1.4" />
      <path d="M12 8.6l2.4 3.4-2.4 3.4-2.4-3.4z" fill="#c9952a" />
      <path d="M7.5 9.5a5 5 0 0 1 3-3" stroke="#fff6cf" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Coração (vida). */
export function HeartIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path
        d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.5c0 5.9-8 10.6-8 10.6z"
        fill="#e5484d"
        stroke={OUTLINE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M7.2 9.6a2.2 2.2 0 0 1 2.2-1.8" stroke="#ffb3b5" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Espada (ataque). */
export function SwordIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9.6 12.6L19 3.4l1.6 1.6-9.2 9.4z" fill="#e7ebf2" stroke={OUTLINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 12.5l4 4" stroke={OUTLINE} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M7.5 12.5l4 4" stroke="#e2b74a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.8 15.2L4.5 19.5" stroke={OUTLINE} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M8.8 15.2L4.5 19.5" stroke="#8a5a2e" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** Escudo (defesa). */
export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3l7.5 2.8v5.6c0 4.8-3.3 8-7.5 9.6-4.2-1.6-7.5-4.8-7.5-9.6V5.8z" fill="#5c6fb0" stroke={OUTLINE} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 6v12M8 10.5h8" stroke="#e2b74a" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Estrela (experiência). */
export function XpIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path
        d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"
        fill="#46b7e8"
        stroke={OUTLINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 9.2l1-2.2" stroke="#c4ecff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** Raio (pontos ganhos estudando). */
export function PointsIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M13.5 2.5L5 13.5h6l-1.5 8L19 10h-6.2z" fill="#a78bfa" stroke={OUTLINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.6 5.5L9 10.5" stroke="#e4dcff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/** Troféu (vitórias). */
export function TrophyIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" fill="#f2c54b" stroke={OUTLINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 3 3.2M17 6h2.5a2.5 2.5 0 0 1-3 3.2" fill="none" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M12 13v3.5M8.5 20h7l-1-3.5h-5z" fill="#c9952a" stroke={OUTLINE} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** Cores das medalhas do ranking: 1 ouro, 2 prata, 3 bronze. */
export const MEDAL_COLORS: Record<number, { fill: string; ring: string; shine: string }> = {
  1: { fill: '#f2c54b', ring: '#c9952a', shine: '#fff6cf' },
  2: { fill: '#cfd6df', ring: '#8f99a6', shine: '#ffffff' },
  3: { fill: '#d38b4f', ring: '#9a5a2a', shine: '#ffe0c4' },
}

/** Medalha do ranking (ouro, prata ou bronze). */
export function MedalIcon({ className, tier = 1 }: IconProps & { tier?: number }) {
  const c = MEDAL_COLORS[tier] ?? MEDAL_COLORS[1]
  return (
    <svg {...base(className)}>
      <path d="M7 2h4l2 6H9z" fill="#3f58a8" stroke={OUTLINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M17 2h-4l-2 6h4z" fill="#c42a3a" stroke={OUTLINE} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="12" cy="15" r="6.6" fill={c.fill} stroke={OUTLINE} strokeWidth="1.5" />
      <circle cx="12" cy="15" r="4.6" fill="none" stroke={c.ring} strokeWidth="1.1" />
      <text x="12" y="17.6" textAnchor="middle" fontSize="7" fontWeight="700" fill={c.ring} fontFamily="ui-sans-serif, sans-serif">
        {tier}
      </text>
    </svg>
  )
}

/** Cadeado. */
export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6" y="11" width="12" height="9" rx="2" fill="currentColor" opacity="0.85" />
    </svg>
  )
}

/** Ícone de cada habilidade. */
export function SkillIcon({ id, className }: IconProps & { id: SkillId }) {
  const props = base(className)
  switch (id) {
    case 'charge': // Investida: seta de avanço
      return (
        <svg {...props}>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#f08a3c" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M5 12h9M11 7.5l5 4.5-5 4.5M17 7.5v9" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'warCry': // Grito de Guerra: ondas de som
      return (
        <svg {...props}>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#e5484d" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M6 10v4h2.5L12 17V7L8.5 10z" fill="#fff" />
          <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5M16.8 7.5a6.5 6.5 0 0 1 0 9" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'quake': // Golpe Sísmico: chão rachando
      return (
        <svg {...props}>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#8b5cf6" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M5 16h14M12 5v5l-2 2 3 2-1 2" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 13l-1.5-2M17 13l1.5-2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'toughSkin': // Pele Grossa: escudo
      return (
        <svg {...props}>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#5c6fb0" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M12 5.5l5 2v3.6c0 3.1-2.2 5.2-5 6.3-2.8-1.1-5-3.2-5-6.3V7.5z" fill="#fff" />
        </svg>
      )
    case 'bloodthirst': // Sede de Sangue: gota
      return (
        <svg {...props}>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#9f1d35" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M12 5.5c2.8 3.6 4.5 6 4.5 8a4.5 4.5 0 0 1-9 0c0-2 1.7-4.4 4.5-8z" fill="#fff" />
        </svg>
      )
    case 'berserk': // Fúria Berserker: chama
      return (
        <svg {...props}>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#d9480f" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M12 5c.5 3 3.8 4.4 3.8 8.2a3.8 3.8 0 0 1-7.6 0c0-1.7.8-2.8 1.8-3.6.1 1.3.8 2 1.6 2.3C11 9.6 11 7.2 12 5z" fill="#fff" />
        </svg>
      )
  }
}
