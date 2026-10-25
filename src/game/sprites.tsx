import type { CSSProperties, ReactElement } from 'react'
import type { MonsterId, Projectile } from './data'

/**
 * Desenhos originais do modo Herói (SVG, sem arquivos externos).
 * Todos em viewBox 64×64 com o chão em y≈60. O herói olha para a direita
 * e os monstros para a esquerda.
 */

const OUTLINE = '#17171c'
const line = { stroke: OUTLINE, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

interface SpriteProps {
  className?: string
  style?: CSSProperties
}

export function WarriorSprite({ className, style, swing = 0 }: SpriteProps & { swing?: number }) {
  const steel = '#b4bdcb'
  const steelLight = '#e1e6ee'
  const steelDark = '#7c8697'
  const gold = '#e2b74a'
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <ellipse cx="30" cy="61.5" rx="15" ry="2.4" fill="#000" opacity="0.22" />
      {/* Capa */}
      <path d="M21 25 C 14 32, 11 44, 9 55 L 17 53 L 21 56 L 26 50 Z" fill="#8e1f2c" {...line} />
      <path d="M17 33 C 15 40, 14 46, 13 52 M21 36 C 20 42, 19 47, 19 53" stroke="#5e1420" strokeWidth="1.4" fill="none" />
      {/* Pernas: grevas e botas */}
      <rect x="22" y="45" width="7" height="11" rx="2" fill={steel} {...line} />
      <rect x="31" y="45" width="7" height="11" rx="2" fill={steel} {...line} />
      <path d="M23 49 H28 M32 49 H37" stroke={steelLight} strokeWidth="1.3" />
      <path d="M21 56 H30 V60 H20 Z M30 56 H39 L41 60 H30 Z" fill="#4a3426" {...line} />
      {/* Saiote de placas */}
      <path d="M20 42 H40 L41 48 H19 Z" fill={steelDark} {...line} />
      <path d="M25 42 V48 M30 42 V48 M35 42 V48" stroke="#5d6676" strokeWidth="1.2" />
      {/* Peitoral */}
      <path d="M19 26 H41 C 42 32, 42 38, 40 43 H20 C 18 38, 18 32, 19 26 Z" fill={steel} {...line} />
      <path d="M22 28 C 22 33, 23 37, 25 40" stroke={steelLight} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M30 27 V42" stroke={steelDark} strokeWidth="1.2" />
      <path d="M20 31 C 26 33, 34 33, 40 31" stroke={gold} strokeWidth="1.6" fill="none" />
      {/* Cinto */}
      <rect x="19.5" y="40" width="21" height="3.6" rx="1" fill="#5a3b26" stroke={OUTLINE} strokeWidth="1.4" />
      <rect x="28" y="39.6" width="5" height="4.4" rx="1" fill={gold} stroke={OUTLINE} strokeWidth="1.2" />
      {/* Elmo */}
      <path d="M21 13 C 21 6, 39 6, 39 13 V25 C 39 27, 21 27, 21 25 Z" fill={steel} {...line} />
      <path d="M24 10 C 26 8, 30 7.5, 32 8" stroke={steelLight} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M30 6.5 V26" stroke={gold} strokeWidth="1.8" />
      <rect x="28" y="15" width="12" height="3.4" rx="1.2" fill={OUTLINE} />
      <path d="M33 16.6 H38" stroke="#7cc8ff" strokeWidth="1" opacity="0.8" />
      <path d="M33 21 h1.4 M35.6 21 h1.4 M33 23 h1.4 M35.6 23 h1.4" stroke={OUTLINE} strokeWidth="1.1" strokeLinecap="round" />
      {/* Penacho */}
      <path d="M29 7 C 25 1, 15 1, 11 6 C 15 5.5, 17 7, 18 9 C 14 9, 12 11, 11 14 C 16 11, 22 10, 26 10 Z" fill="#c42a3a" {...line} />
      {/* Escudo */}
      <path d="M10 28 H24 V38 C 24 45, 17 49, 17 49 C 17 49, 10 45, 10 38 Z" fill="#3f58a8" {...line} />
      <path d="M12 30 H22 V38 C 22 43.5, 17 46.6, 17 46.6 C 17 46.6, 12 43.5, 12 38 Z" fill="none" stroke={gold} strokeWidth="1.3" />
      <path d="M17 31.5 V44 M13.5 36.5 H20.5" stroke={gold} strokeWidth="2.2" strokeLinecap="round" />
      {/* Ombreira */}
      <path d="M35 24 C 41 22, 46 25, 46 30 C 42 30, 38 30, 35 31 Z" fill={steel} {...line} />
      <path d="M37 26 C 40 25, 43 26, 44 28" stroke={steelLight} strokeWidth="1.3" fill="none" />
      {/* Braço, manopla e espada longa */}
      <rect x="38" y="29" width="7" height="11" rx="3" fill={steelDark} {...line} />
      {/* Espada gira em volta da mão nos golpes */}
      <g transform={`rotate(${swing} 46.5 39.5)`}>
        <path d="M48.5 36 L59 11 L62 12.3 L52 37.5 Z" fill={steelLight} {...line} />
        <path d="M50.5 35 L60 12.5" stroke="#9aa4b4" strokeWidth="1" />
        <path d="M43.8 33.4 L55 38.6" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
        <path d="M43.8 33.4 L55 38.6" stroke={gold} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M48.6 39.5 L46.6 44.5" stroke="#5a3b26" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="46.2" cy="45.4" r="1.6" fill={gold} stroke={OUTLINE} strokeWidth="1" />
        <rect x="43" y="36" width="7.6" height="6.6" rx="2.4" fill={steel} {...line} />
      </g>
    </svg>
  )
}

function Slime({ body = '#5fc46a', shine = '#b9f0bf' }: { body?: string; shine?: string }) {
  return (
    <>
      <ellipse cx="32" cy="61" rx="17" ry="2.5" fill="#000" opacity="0.18" />
      <path d="M12 58 C 10 40, 22 26, 33 26 C 46 26, 54 40, 52 58 Z" fill={body} {...line} />
      <path d="M20 40 C 22 34, 26 31, 30 30" stroke={shine} strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="25" cy="44" rx="3" ry="4" fill={OUTLINE} />
      <ellipse cx="37" cy="44" rx="3" ry="4" fill={OUTLINE} />
      <circle cx="24" cy="42.5" r="1" fill="#fff" />
      <circle cx="36" cy="42.5" r="1" fill="#fff" />
      <path d="M27 51 Q31 54 35 51" stroke={OUTLINE} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  )
}


function Bat() {
  return (
    <>
      <ellipse cx="32" cy="61" rx="10" ry="2" fill="#000" opacity="0.12" />
      <path d="M26 30 C 18 18, 6 20, 3 28 C 8 27, 10 31, 12 34 C 15 31, 19 32, 22 36 Z" fill="#6b4d9a" {...line} />
      <path d="M38 30 C 46 18, 58 20, 61 28 C 56 27, 54 31, 52 34 C 49 31, 45 32, 42 36 Z" fill="#6b4d9a" {...line} />
      <ellipse cx="32" cy="34" rx="10" ry="11" fill="#7e5fb0" {...line} />
      <path d="M25 26 L24 18 L29 24 Z M39 26 L40 18 L35 24 Z" fill="#7e5fb0" {...line} />
      <circle cx="28" cy="32" r="2" fill="#ffdf5e" />
      <circle cx="36" cy="32" r="2" fill="#ffdf5e" />
      <path d="M29 39 L30 42 L31 39 M33 39 L34 42 L35 39" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </>
  )
}

function Goblin({ crown = false, spear = false }: { crown?: boolean; spear?: boolean }) {
  return (
    <>
      <ellipse cx="32" cy="61" rx="15" ry="2.5" fill="#000" opacity="0.18" />
      {crown && <path d="M40 30 L52 56 L36 54 Z" fill="#7d2a8c" {...line} />}
      <rect x="24" y="47" width="6" height="12" rx="2" fill="#4a5a2a" {...line} />
      <rect x="34" y="47" width="6" height="12" rx="2" fill="#4a5a2a" {...line} />
      <rect x="21" y="32" width="22" height="18" rx="5" fill={spear ? '#5a6b8a' : '#8a6a3e'} {...line} />
      <path d="M21 42 H43" stroke={OUTLINE} strokeWidth="2" />
      {/* Cabeça */}
      <path d="M22 22 L8 16 L20 28 Z M42 22 L54 18 L44 28 Z" fill="#79b84c" {...line} />
      <rect x="20" y="14" width="24" height="20" rx="8" fill="#79b84c" {...line} />
      <circle cx="26" cy="23" r="2.3" fill="#ffe25a" stroke={OUTLINE} strokeWidth="1.2" />
      <circle cx="36" cy="23" r="2.3" fill="#ffe25a" stroke={OUTLINE} strokeWidth="1.2" />
      <circle cx="25.5" cy="23" r="1" fill={OUTLINE} />
      <circle cx="35.5" cy="23" r="1" fill={OUTLINE} />
      <path d="M26 29 H37" stroke={OUTLINE} strokeWidth="2" strokeLinecap="round" />
      <path d="M28 29 L29 31 L30 29 M33 29 L34 31 L35 29" fill="#fff" stroke={OUTLINE} strokeWidth="1" />
      {crown && <path d="M21 15 L22 6 L27 11 L32 4 L37 11 L42 6 L43 15 Z" fill="#f2c54b" {...line} />}
      {/* Braço e arma */}
      <rect x="15" y="34" width="7" height="11" rx="3" fill="#79b84c" {...line} />
      {crown ? (
        <>
          <rect x="9" y="22" width="4" height="30" rx="1.5" fill="#6b4a2e" {...line} />
          <circle cx="11" cy="20" r="5" fill="#9b6bd6" {...line} />
        </>
      ) : spear ? (
        <>
          <path d="M18 44 L6 8" stroke={OUTLINE} strokeWidth="4.4" strokeLinecap="round" />
          <path d="M18 44 L6 8" stroke="#8a6a3e" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M6 8 L3 1 L10 6 Z" fill="#cfd5de" {...line} />
        </>
      ) : (
        <path d="M17 42 L6 32 L8 30 L19 39 Z" fill="#cfd5de" {...line} />
      )}
    </>
  )
}




function BigSlime() {
  return (
    <>
      <ellipse cx="32" cy="61" rx="22" ry="3" fill="#000" opacity="0.2" />
      <path d="M6 58 C 4 34, 18 16, 32 16 C 48 16, 60 34, 58 58 Z" fill="#3fb6a8" {...line} />
      <path d="M14 36 C 16 28, 22 23, 28 21" stroke="#aef0e6" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <circle cx="44" cy="30" r="3" fill="#aef0e6" opacity="0.7" />
      <circle cx="20" cy="48" r="2.2" fill="#2a8a7f" />
      <path d="M20 36 L28 39 M44 36 L36 39" stroke={OUTLINE} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="25" cy="42" rx="3" ry="3.6" fill={OUTLINE} />
      <ellipse cx="39" cy="42" rx="3" ry="3.6" fill={OUTLINE} />
      <path d="M24 52 Q32 47 40 52" stroke={OUTLINE} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M10 58 C 10 62, 14 62, 14 58 M50 58 C 50 63, 55 63, 55 58" fill="#3fb6a8" {...line} />
    </>
  )
}

function Zombie() {
  const skin = '#9fbf8a'
  const skinDark = '#6f8f62'
  return (
    <>
      <ellipse cx="33" cy="61.5" rx="15" ry="2.4" fill="#000" opacity="0.22" />
      {/* Pernas (calça rasgada) */}
      <path d="M27 44 L25 59 H31 L32 46 Z" fill="#4b3d33" {...line} />
      <path d="M35 45 L37 59 H43 L40 44 Z" fill="#3e332b" {...line} />
      <path d="M25 55 L27 53 L29 56 L31 54" stroke={OUTLINE} strokeWidth="1" fill={skin} />
      <path d="M24 59 H32 M36 59 H44" stroke={OUTLINE} strokeWidth="2.4" strokeLinecap="round" />
      {/* Braço de trás, caído */}
      <path d="M40 30 C 45 34, 46 40, 44 46" stroke={OUTLINE} strokeWidth="6.6" strokeLinecap="round" fill="none" />
      <path d="M40 30 C 45 34, 46 40, 44 46" stroke={skinDark} strokeWidth="4.4" strokeLinecap="round" fill="none" />
      {/* Tronco curvado, camisa rasgada */}
      <path d="M24 26 C 30 22, 40 23, 43 28 L 41 46 H26 C 24 40, 23 32, 24 26 Z" fill="#4f7a7a" {...line} />
      <path d="M26 46 L28 41 L30 46 L33 40 L36 46 L38 42 L41 46" fill={skin} stroke={OUTLINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M33 30 L30 36 L34 35" stroke="#2f4c4c" strokeWidth="1.4" fill="none" />
      <circle cx="37" cy="33" r="1.6" fill={skinDark} />
      {/* Braço da frente, esticado com garras */}
      <path d="M27 29 C 20 29, 14 30, 9 31" stroke={OUTLINE} strokeWidth="7" strokeLinecap="round" />
      <path d="M27 29 C 20 29, 14 30, 9 31" stroke={skin} strokeWidth="4.8" strokeLinecap="round" />
      <path d="M17 27.6 L19 32.6 M21 27.4 L22.4 31.8" stroke="#e6e0cc" strokeWidth="1.6" />
      <path d="M9 31 L4 28.5 M9 31 L3.6 31.6 M9 31 L4.6 34.4" stroke={OUTLINE} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9 31 L4 28.5 M9 31 L3.6 31.6 M9 31 L4.6 34.4" stroke={skin} strokeWidth="1" strokeLinecap="round" />
      {/* Cabeça inclinada */}
      <g transform="rotate(-10 30 16)">
        <path d="M20 12 C 20 5, 38 4, 39 12 L 38 22 C 36 27, 23 27, 21 22 Z" fill={skin} {...line} />
        <path d="M22 9 C 25 4, 31 3, 35 5 L 33 8 L 30 6 L 28 9 L 25 7 Z" fill="#3a2f28" stroke={OUTLINE} strokeWidth="1.2" />
        {/* Costura na testa */}
        <path d="M26 11.5 H35 M27.5 10 V13 M30 10 V13 M32.5 10 V13" stroke="#3a2f28" strokeWidth="1" />
        {/* Olhos: um fundo e brilhante, outro caído */}
        <ellipse cx="25" cy="16.5" rx="3.4" ry="3" fill="#2a3326" />
        <circle cx="25" cy="16.5" r="1.5" fill="#d9ff6a" />
        <ellipse cx="33" cy="17.5" rx="2.6" ry="2" fill="#2a3326" />
        <circle cx="33.4" cy="18" r="0.9" fill="#d9ff6a" />
        <path d="M23 21 C 26 24, 31 24, 34 21.5 L 33 24.5 C 30 26.5, 26 26.5, 24 24.5 Z" fill="#3a1f22" stroke={OUTLINE} strokeWidth="1.2" />
        <path d="M25.5 21.8 V23.4 M28.4 22.4 V24 M31.2 22.2 V23.8" stroke="#ece6d2" strokeWidth="1.2" />
        <path d="M36 14 C 37 16, 37 18, 36 20" stroke={skinDark} strokeWidth="1.2" fill="none" />
      </g>
    </>
  )
}

function SkeletonArcher() {
  return (
    <>
      <ellipse cx="32" cy="61" rx="14" ry="2.5" fill="#000" opacity="0.18" />
      <path d="M28 46 V59 M38 46 V59" stroke="#e9e6dc" strokeWidth="4" strokeLinecap="round" />
      <rect x="25" y="30" width="16" height="17" rx="4" fill="#3a3a44" {...line} />
      <path d="M27 34 H39 M27 38 H39 M27 42 H39" stroke="#e9e6dc" strokeWidth="2" strokeLinecap="round" />
      {/* Aljava */}
      <rect x="40" y="26" width="6" height="16" rx="2" fill="#6b4a2e" {...line} transform="rotate(18 43 34)" />
      <path d="M44 24 L46 18 M47 25 L50 20" stroke="#e9e6dc" strokeWidth="1.6" strokeLinecap="round" />
      {/* Cabeça */}
      <circle cx="33" cy="20" r="10" fill="#e9e6dc" {...line} />
      <rect x="28" y="26" width="10" height="6" rx="2" fill="#e9e6dc" {...line} />
      <circle cx="29" cy="19" r="2.8" fill={OUTLINE} />
      <circle cx="37" cy="19" r="2.8" fill={OUTLINE} />
      <circle cx="29" cy="19" r="1" fill="#ff8a5e" />
      <circle cx="37" cy="19" r="1" fill="#ff8a5e" />
      <path d="M31 29 V31 M33 29 V31 M35 29 V31" stroke={OUTLINE} strokeWidth="1.2" />
      {/* Arco apontado para a esquerda */}
      <path d="M14 18 C 4 26, 4 44, 14 52" fill="none" stroke={OUTLINE} strokeWidth="4.6" strokeLinecap="round" />
      <path d="M14 18 C 4 26, 4 44, 14 52" fill="none" stroke="#9a6b3e" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M14 18 L22 35 L14 52" fill="none" stroke="#e9e6dc" strokeWidth="1" />
      <path d="M22 35 H27" stroke="#e9e6dc" strokeWidth="4" strokeLinecap="round" />
      <path d="M9 35 H22" stroke="#c9b48e" strokeWidth="1.6" />
      <path d="M9 35 L12 33 V37 Z" fill="#cfd5de" />
    </>
  )
}

const MONSTER_ART: Record<MonsterId, () => ReactElement> = {
  slime: () => <Slime />,
  bat: Bat,
  bigSlime: BigSlime,
  zombie: Zombie,
  skeleton: SkeletonArcher,
  goblin: () => <Goblin />,
  spearGoblin: () => <Goblin spear />,
  goblinKing: () => <Goblin crown />,
}

export function MonsterSprite({ id, className }: SpriteProps & { id: MonsterId }) {
  const Art = MONSTER_ART[id]
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <Art />
    </svg>
  )
}

/** Projéteis dos inimigos de longe (apontando para a esquerda). */
export function ProjectileSprite({ type, className, style }: SpriteProps & { type: Projectile }) {
  return type === 'arrow' ? (
    <svg viewBox="0 0 40 10" className={className} style={style} aria-hidden="true">
      <path d="M6 5 H36" stroke="#c9b48e" strokeWidth="2" />
      <path d="M1 5 L8 1.5 V8.5 Z" fill="#cfd5de" stroke={OUTLINE} strokeWidth="1" />
      <path d="M32 5 L38 1 M32 5 L38 9" stroke="#e9e6dc" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 56 10" className={className} style={style} aria-hidden="true">
      <path d="M8 5 H54" stroke={OUTLINE} strokeWidth="4" strokeLinecap="round" />
      <path d="M8 5 H54" stroke="#8a6a3e" strokeWidth="2" strokeLinecap="round" />
      <path d="M0 5 L10 1 V9 Z" fill="#cfd5de" stroke={OUTLINE} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

/** Rastro do golpe de espada. */
export function SlashSprite({ className, style, strong = false }: SpriteProps & { strong?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} style={style} aria-hidden="true">
      <path
        d="M10 6 C 34 8, 44 26, 36 44 C 38 28, 28 14, 10 6 Z"
        fill={strong ? '#ffd45e' : '#ffffff'}
        opacity="0.9"
      />
    </svg>
  )
}
