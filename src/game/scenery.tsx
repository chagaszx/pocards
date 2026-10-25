import type { ReactNode } from 'react'
import type { Biome } from './data'

/**
 * Cenários da Masmorra, em camadas que deslizam em velocidades diferentes
 * (parallax) e com partículas animadas: esporos na Caverna dos Slimes,
 * névoa e poeira na Cripta, brasas no Covil dos Goblins.
 */

const W = 480 // largura de repetição de cada camada
const GROUND = 208 // topo do chão (a cena tem 232 px de altura)

interface Palette {
  sky: [string, string, string]
  wall: string
  wallLight: string
  rock: string
  rockLight: string
  ground: string
  groundEdge: string
  groundDots: string
  glow: string
}

const PALETTES: Record<Biome, Palette> = {
  slimeCave: {
    sky: ['#0b1d19', '#123029', '#08130f'],
    wall: '#0f2620',
    wallLight: '#1a3a31',
    rock: '#0a1814',
    rockLight: '#20453a',
    ground: '#18332a',
    groundEdge: '#2f5b49',
    groundDots: '#24473a',
    glow: '#7dffa0',
  },
  crypt: {
    sky: ['#120f1d', '#1d1830', '#0b0912'],
    wall: '#1c1729',
    wallLight: '#2a2340',
    rock: '#100d18',
    rockLight: '#3a3254',
    ground: '#262036',
    groundEdge: '#40375a',
    groundDots: '#1a1626',
    glow: '#c9b8ff',
  },
  goblinDen: {
    sky: ['#1d120a', '#2e1d10', '#120a05'],
    wall: '#2a190d',
    wallLight: '#3d2614',
    rock: '#170e07',
    rockLight: '#4a2f1a',
    ground: '#3a2616',
    groundEdge: '#5c3d22',
    groundDots: '#2c1c10',
    glow: '#ffb24d',
  },
}

/** Camada que se repete na horizontal e desliza conforme o herói anda. */
function Layer({ id, shift, children }: { id: string; shift: number; children: ReactNode }) {
  return (
    <>
      <defs>
        <pattern id={id} width={W} height="232" patternUnits="userSpaceOnUse" x={-(shift % W)}>
          {children}
        </pattern>
      </defs>
      <rect width="100%" height="232" fill={`url(#${id})`} />
    </>
  )
}

/** Chama que tremula com o relógio. */
function Flame({ x, y, size = 1, clock, phase = 0, color = '#ffb24d' }: { x: number; y: number; size?: number; clock: number; phase?: number; color?: string }) {
  const f = 1 + Math.sin(clock / 70 + phase) * 0.12 + Math.sin(clock / 37 + phase * 2) * 0.06
  return (
    <g transform={`translate(${x} ${y}) scale(${size} ${size * f})`}>
      <circle cx="0" cy="-4" r="14" fill={color} opacity="0.12" />
      <path d="M0 -14 C 5 -8, 6 -3, 4 1 C 2 4, -2 4, -4 1 C -6 -3, -4 -8, 0 -14 Z" fill={color} />
      <path d="M0 -8 C 2.4 -5, 3 -2, 2 0.5 C 1 2, -1 2, -2 0.5 C -3 -2, -2 -5, 0 -8 Z" fill="#fff3c4" />
    </g>
  )
}

// ---------- Caverna dos Slimes ----------

function Crystal({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-10" r="16" fill={color} opacity="0.1" />
      <path d="M-8 0 L-10 -14 L-6 -22 L-3 0 Z" fill={color} opacity="0.55" />
      <path d="M-3 0 L-2 -26 L3 -32 L6 0 Z" fill={color} opacity="0.85" />
      <path d="M5 0 L7 -16 L12 -20 L11 0 Z" fill={color} opacity="0.6" />
      <path d="M-1.5 -24 L1.5 -29 L2 -8" stroke="#ffffff" strokeWidth="1" opacity="0.6" fill="none" />
    </g>
  )
}

function Mushroom({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-9" r="11" fill={color} opacity="0.14" />
      <path d="M-1.5 0 C -2 -4, -1 -7, -1 -9 H1 C 1 -7, 2 -4, 1.5 0 Z" fill="#d8e6c8" />
      <path d="M-7 -8 C -7 -14, 7 -14, 7 -8 Z" fill={color} />
      <circle cx="-3" cy="-11" r="1" fill="#ffffff" opacity="0.8" />
      <circle cx="2.5" cy="-10" r="0.9" fill="#ffffff" opacity="0.8" />
    </g>
  )
}

function SlimeCave({ p, offset, clock }: { p: Palette; offset: number; clock: number }) {
  return (
    <>
      {/* Parede do fundo com camadas de rocha */}
      <Layer id="sc-back" shift={offset * 0.15}>
        <path d={`M0 70 C 60 50, 110 80, 170 62 C 230 44, 300 76, 360 58 C 410 44, 450 66, ${W} 60 V${GROUND} H0 Z`} fill={p.wall} />
        <path d="M0 120 C 80 106, 160 128, 240 112 C 320 98, 400 122, 480 110" stroke={p.wallLight} strokeWidth="2" fill="none" opacity="0.6" />
        <path d="M0 150 C 90 140, 170 160, 260 146 C 340 134, 420 156, 480 144" stroke={p.wallLight} strokeWidth="1.5" fill="none" opacity="0.4" />
        <Crystal x={330} y={GROUND - 30} s={0.8} color="#3fd6c0" />
        <circle cx="120" cy="96" r="2" fill={p.glow} opacity="0.35" />
        <circle cx="400" cy="128" r="1.6" fill={p.glow} opacity="0.3" />
      </Layer>
      {/* Teto com estalactites */}
      <Layer id="sc-ceil" shift={offset * 0.4}>
        <path
          d="M0 0 H480 V18 L462 30 L450 16 L432 56 L416 20 L396 34 L380 14 L360 74 L344 18 L322 30 L304 12 L286 48 L270 16 L248 26 L230 10 L210 62 L194 18 L172 32 L156 12 L138 44 L120 16 L100 28 L84 12 L66 58 L50 16 L30 30 L14 12 L0 22 Z"
          fill={p.rock}
        />
        <path d="M360 74 L356 40 M210 62 L207 30 M66 58 L63 26" stroke={p.rockLight} strokeWidth="1.5" opacity="0.6" />
        {/* Gotas de gosma caindo */}
        {[
          [360, 74, 0],
          [210, 62, 900],
          [66, 58, 1700],
          [432, 56, 400],
        ].map(([x, y, ph], i) => {
          const fall = ((clock + ph) % 2600) / 2600
          return (
            <g key={i}>
              <ellipse cx={x} cy={y + 3} rx="2.2" ry="3" fill={p.glow} opacity="0.75" />
              <circle cx={x} cy={y + 6 + fall * (GROUND - y - 8)} r="1.8" fill={p.glow} opacity={1 - fall * 0.6} />
            </g>
          )
        })}
      </Layer>
      {/* Pilares, cristais e cogumelos */}
      <Layer id="sc-mid" shift={offset * 0.7}>
        <path d={`M40 ${GROUND} C 44 150, 36 110, 50 70 C 62 110, 58 150, 66 ${GROUND} Z`} fill={p.rock} />
        <path d="M50 76 C 47 110, 52 150, 50 200" stroke={p.rockLight} strokeWidth="1.4" opacity="0.5" fill="none" />
        <Crystal x={150} y={GROUND} s={1} color="#56f0a4" />
        <Crystal x={168} y={GROUND} s={0.6} color="#3fd6c0" />
        <Mushroom x={262} y={GROUND} s={1.2} color="#7dffa0" />
        <Mushroom x={276} y={GROUND} s={0.8} color="#4fe0d0" />
        <path d={`M380 ${GROUND} L396 150 L412 ${GROUND} Z`} fill={p.rock} />
        <Crystal x={440} y={GROUND} s={0.85} color="#8cff6a" />
      </Layer>
      {/* Poças de slime e um filhote espiando */}
      <Layer id="sc-near" shift={offset}>
        <ellipse cx="96" cy={GROUND + 2} rx="30" ry="4" fill={p.glow} opacity="0.3" />
        <ellipse cx="96" cy={GROUND + 1} rx="18" ry="2" fill={p.glow} opacity="0.5" />
        <path d={`M300 ${GROUND} C 300 ${GROUND - 12}, 322 ${GROUND - 12}, 322 ${GROUND} Z`} fill="#4cbf63" opacity="0.85" />
        <circle cx="307" cy={GROUND - 5} r="1.3" fill="#0b1d19" />
        <circle cx="314" cy={GROUND - 5} r="1.3" fill="#0b1d19" />
        <path d={`M200 ${GROUND} l6 -7 l7 3 l4 4 Z M410 ${GROUND} l5 -5 l8 1 l3 4 Z`} fill={p.rockLight} />
      </Layer>
    </>
  )
}

// ---------- Cripta Sombria ----------

function Tombstone({ x, s = 1, p }: { x: number; s?: number; p: Palette }) {
  return (
    <g transform={`translate(${x} ${GROUND}) scale(${s})`}>
      <path d="M-11 0 V-24 C -11 -34, 11 -34, 11 -24 V0 Z" fill="#3a3352" stroke="#15111f" strokeWidth="1.6" />
      <path d="M-8 -26 C -8 -31, -2 -32, 2 -31" stroke="#5a5078" strokeWidth="1.5" fill="none" />
      <path d="M0 -24 V-12 M-4.5 -19.5 H4.5" stroke="#211b30" strokeWidth="2" />
      <path d="M-11 -4 C -6 -7, -2 -3, 3 -5" stroke="#4d7a4a" strokeWidth="2" fill="none" opacity="0.8" />
      <rect x="-14" y="-2" width="28" height="3" rx="1" fill={p.rock} />
    </g>
  )
}

function Candelabra({ x, clock, p }: { x: number; clock: number; p: Palette }) {
  return (
    <g>
      <path d={`M${x} ${GROUND} V${GROUND - 46} M${x - 12} ${GROUND - 46} H${x + 12} M${x - 12} ${GROUND - 46} V${GROUND - 52} M${x + 12} ${GROUND - 46} V${GROUND - 52} M${x - 8} ${GROUND} H${x + 8}`} stroke="#6b5a3a" strokeWidth="2.4" fill="none" />
      {[-12, 0, 12].map((dx, i) => (
        <g key={dx}>
          <rect x={x + dx - 2} y={GROUND - (dx === 0 ? 60 : 58)} width="4" height={dx === 0 ? 14 : 8} fill="#e8e0c6" />
          <Flame x={x + dx} y={GROUND - (dx === 0 ? 61 : 59)} size={0.55} clock={clock} phase={i * 1.7} color={p.glow} />
        </g>
      ))}
    </g>
  )
}

function Crypt({ p, offset, clock }: { p: Palette; offset: number; clock: number }) {
  return (
    <>
      {/* Paredes de tijolo com janelas em arco e luz da lua */}
      <Layer id="cr-back" shift={offset * 0.15}>
        <rect width={W} height={GROUND} fill={p.wall} />
        {Array.from({ length: 9 }, (_, row) =>
          Array.from({ length: 13 }, (_, col) => (
            <rect
              key={`${row}-${col}`}
              x={col * 40 - (row % 2) * 20}
              y={30 + row * 20}
              width="38"
              height="18"
              rx="2"
              fill={p.wallLight}
              opacity={0.25 + ((row * 7 + col * 3) % 5) * 0.06}
            />
          )),
        )}
        {[110, 350].map((x) => (
          <g key={x}>
            <path d={`M${x - 22} 150 V80 C ${x - 22} 50, ${x + 22} 50, ${x + 22} 80 V150 Z`} fill="#0b0912" stroke="#3a3254" strokeWidth="3" />
            <path d={`M${x} 56 V150 M${x - 22} 100 H${x + 22}`} stroke="#3a3254" strokeWidth="2" />
            <path d={`M${x - 20} 150 L${x - 60} ${GROUND} H${x + 40} L${x + 20} 150 Z`} fill="#b9b2ff" opacity="0.06" />
            <circle cx={x + 8} cy="76" r="6" fill="#e8e4ff" opacity="0.5" />
          </g>
        ))}
      </Layer>
      {/* Abóbadas e correntes balançando */}
      <Layer id="cr-ceil" shift={offset * 0.4}>
        <path d={`M0 0 H${W} V24 C 420 24, 400 46, 360 46 C 320 46, 300 24, 240 24 C 180 24, 160 46, 120 46 C 80 46, 60 24, 0 24 Z`} fill={p.rock} />
        {[
          [70, 0],
          [300, 1.4],
          [430, 2.6],
        ].map(([x, ph]) => {
          const swing = Math.sin(clock / 700 + ph) * 6
          return (
            <g key={x} transform={`rotate(${swing} ${x} 24)`}>
              {Array.from({ length: 6 }, (_, i) => (
                <ellipse key={i} cx={x} cy={30 + i * 7} rx="2.4" ry="3.6" fill="none" stroke="#5a5078" strokeWidth="1.6" />
              ))}
              <path d={`M${x - 5} 74 C ${x - 5} 82, ${x + 5} 82, ${x + 5} 74`} stroke="#5a5078" strokeWidth="2" fill="none" />
            </g>
          )
        })}
        <path d="M150 24 L190 70 M170 24 L150 54 M140 40 L196 40" stroke="#ffffff" strokeWidth="0.7" opacity="0.15" />
      </Layer>
      {/* Pilares e candelabros */}
      <Layer id="cr-mid" shift={offset * 0.7}>
        <rect x="30" y="40" width="26" height={GROUND - 40} fill={p.rock} />
        <rect x="26" y="40" width="34" height="8" fill={p.rockLight} />
        <rect x="26" y={GROUND - 8} width="34" height="8" fill={p.rockLight} />
        <path d="M40 80 L46 100 L41 118" stroke="#000" strokeWidth="1.2" opacity="0.5" fill="none" />
        <Candelabra x={200} clock={clock} p={p} />
        <rect x="320" y="40" width="26" height={GROUND - 40} fill={p.rock} />
        <rect x="316" y="40" width="34" height="8" fill={p.rockLight} />
        <rect x="316" y={GROUND - 8} width="34" height="8" fill={p.rockLight} />
      </Layer>
      {/* Lápides, ossos e caixão */}
      <Layer id="cr-near" shift={offset}>
        <Tombstone x={120} p={p} />
        <Tombstone x={146} s={0.75} p={p} />
        <g transform={`translate(260 ${GROUND})`}>
          <path d="M-22 0 L-26 -10 L-14 -16 H14 L26 -10 L22 0 Z" fill="#4a3424" stroke="#1c120b" strokeWidth="1.6" />
          <path d="M0 -14 V-3 M-4 -10 H4" stroke="#c9b48e" strokeWidth="1.6" />
        </g>
        <g transform={`translate(400 ${GROUND})`} fill="#e9e6dc" opacity="0.8">
          <circle cx="0" cy="-5" r="5" />
          <circle cx="-2" cy="-5.5" r="1.3" fill="#1d1830" />
          <circle cx="2" cy="-5.5" r="1.3" fill="#1d1830" />
          <rect x="6" y="-3" width="14" height="2.4" rx="1.2" transform="rotate(-12 6 -3)" />
          <rect x="-20" y="-2.4" width="13" height="2.4" rx="1.2" transform="rotate(10 -20 -2)" />
        </g>
        <path d={`M440 20 L470 50 M455 20 L440 40 M440 30 L475 30`} stroke="#ffffff" strokeWidth="0.6" opacity="0.18" />
      </Layer>
    </>
  )
}

// ---------- Covil dos Goblins ----------

function Torch({ x, clock, phase, p }: { x: number; clock: number; phase: number; p: Palette }) {
  return (
    <g>
      <rect x={x - 2} y={GROUND - 44} width="4" height="44" fill="#5a3a1e" />
      <rect x={x - 4} y={GROUND - 48} width="8" height="6" rx="1" fill="#3a2410" />
      <Flame x={x} y={GROUND - 48} size={1} clock={clock} phase={phase} color={p.glow} />
    </g>
  )
}

function GoblinDen({ p, offset, clock }: { p: Palette; offset: number; clock: number }) {
  return (
    <>
      {/* Paliçada de estacas ao fundo */}
      <Layer id="gd-back" shift={offset * 0.15}>
        <path d={`M0 60 C 80 40, 160 70, 240 52 C 320 36, 400 64, ${W} 50 V${GROUND} H0 Z`} fill={p.wall} />
        {Array.from({ length: 24 }, (_, i) => {
          const x = i * 20
          const h = 70 + ((i * 37) % 22)
          return <path key={i} d={`M${x} ${GROUND} V${GROUND - h} L${x + 8} ${GROUND - h - 10} L${x + 16} ${GROUND - h} V${GROUND} Z`} fill={p.wallLight} opacity="0.7" />
        })}
        <path d={`M0 ${GROUND - 40} H${W} M0 ${GROUND - 66} H${W}`} stroke="#22140a" strokeWidth="3" opacity="0.7" />
      </Layer>
      {/* Teto de rocha com estandartes */}
      <Layer id="gd-ceil" shift={offset * 0.4}>
        <path d="M0 0 H480 V20 L450 34 L420 18 L380 40 L340 16 L300 30 L260 14 L220 38 L180 18 L140 32 L100 14 L60 36 L20 18 L0 26 Z" fill={p.rock} />
        {[120, 360].map((x, i) => {
          const sway = Math.sin(clock / 900 + i) * 2
          return (
            <g key={x}>
              <path d={`M${x - 16} 26 H${x + 16}`} stroke="#5a3a1e" strokeWidth="3" />
              <path d={`M${x - 13} 28 H${x + 13} V${66 + sway} L${x} ${58 + sway} L${x - 13} ${66 - sway} Z`} fill="#8e2a1c" stroke="#3a120a" strokeWidth="1.4" />
              <circle cx={x} cy="42" r="5.5" fill="#e9e0c8" />
              <circle cx={x - 2} cy="41.5" r="1.3" fill="#3a120a" />
              <circle cx={x + 2} cy="41.5" r="1.3" fill="#3a120a" />
              <path d={`M${x - 6} 50 L${x + 6} 54 M${x + 6} 50 L${x - 6} 54`} stroke="#e9e0c8" strokeWidth="1.6" />
            </g>
          )
        })}
      </Layer>
      {/* Tendas e suporte de lanças */}
      <Layer id="gd-mid" shift={offset * 0.7}>
        <g>
          <path d={`M30 ${GROUND} L80 120 L130 ${GROUND} Z`} fill="#6b4626" stroke="#2a180a" strokeWidth="2" />
          <path d={`M55 ${GROUND - 46} L105 ${GROUND - 46} M42 ${GROUND - 22} L118 ${GROUND - 22}`} stroke="#8a6034" strokeWidth="4" opacity="0.7" />
          <path d={`M68 ${GROUND} L80 156 L92 ${GROUND} Z`} fill="#1a0f06" />
          <path d="M80 120 L74 108 M80 120 L86 106" stroke="#5a3a1e" strokeWidth="2.4" />
        </g>
        <g transform={`translate(250 ${GROUND})`}>
          <path d="M-20 0 V-30 M20 0 V-30 M-24 -28 H24" stroke="#5a3a1e" strokeWidth="3" />
          {[-14, -5, 4, 13].map((dx) => (
            <g key={dx}>
              <path d={`M${dx} -2 L${dx + 3} -52`} stroke="#7a5530" strokeWidth="2" />
              <path d={`M${dx + 3} -52 l-2.4 -6 l5 3 Z`} fill="#c9cfd8" />
            </g>
          ))}
        </g>
        <path d={`M380 ${GROUND} L420 140 L460 ${GROUND} Z`} fill="#5a3a20" stroke="#2a180a" strokeWidth="2" />
        <path d={`M392 ${GROUND - 30} L448 ${GROUND - 30}`} stroke="#8e2a1c" strokeWidth="4" opacity="0.7" />
      </Layer>
      {/* Tochas, fogueira, barris e caixotes */}
      <Layer id="gd-near" shift={offset}>
        <Torch x={60} clock={clock} phase={0} p={p} />
        <g transform={`translate(180 ${GROUND})`}>
          <path d="M-16 0 L14 -6 M-14 -6 L16 0" stroke="#4a2c12" strokeWidth="4" strokeLinecap="round" />
          <Flame x={-4} y={-4} size={1.3} clock={clock} phase={1} color={p.glow} />
          <Flame x={5} y={-3} size={1} clock={clock} phase={2.2} color="#ff7a3c" />
          {[0, 1, 2].map((i) => {
            const k = ((clock / 2200 + i / 3) % 1)
            return <circle key={i} cx={Math.sin(k * 6 + i) * 6} cy={-24 - k * 60} r={5 + k * 8} fill="#6b5a4a" opacity={0.25 * (1 - k)} />
          })}
        </g>
        <g transform={`translate(300 ${GROUND})`}>
          <rect x="-11" y="-22" width="22" height="22" rx="5" fill="#7a4e2a" stroke="#2a180a" strokeWidth="1.6" />
          <path d="M-11 -15 H11 M-11 -7 H11" stroke="#3a2410" strokeWidth="2" />
          <rect x="13" y="-14" width="16" height="14" fill="#8a6034" stroke="#2a180a" strokeWidth="1.6" />
          <path d="M13 -14 L29 0 M29 -14 L13 0" stroke="#2a180a" strokeWidth="1.2" />
        </g>
        <Torch x={420} clock={clock} phase={3} p={p} />
      </Layer>
    </>
  )
}

// ---------- Cena completa ----------

/** Partículas no ar (esporos, poeira ou brasas), em coordenadas da tela. */
function Particles({ biome, width, clock, glow }: { biome: Biome; width: number; clock: number; glow: string }) {
  const count = biome === 'crypt' ? 10 : 14
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const seed = (i * 0.618) % 1
        const speed = biome === 'goblinDen' ? 0.035 : biome === 'slimeCave' ? 0.012 : 0.006
        const y = GROUND - ((clock * speed * (0.6 + seed) + seed * GROUND) % GROUND)
        const x = (seed * width + Math.sin(clock / 1400 + i) * 14 + (biome === 'crypt' ? clock * 0.004 : 0)) % width
        const flicker = 0.4 + 0.6 * Math.abs(Math.sin(clock / 300 + i))
        const color = biome === 'goblinDen' ? (i % 2 ? '#ffb24d' : '#ff7a3c') : glow
        return <circle key={i} cx={x} cy={y} r={biome === 'crypt' ? 1.1 : 1.5} fill={color} opacity={flicker * (biome === 'crypt' ? 0.35 : 0.7)} />
      })}
    </svg>
  )
}

export default function Scenery({ biome, offset, clock, width }: { biome: Biome; offset: number; clock: number; width: number }) {
  const p = PALETTES[biome]
  return (
    <>
      <div className="absolute inset-0" style={{ background: `linear-gradient(${p.sky[0]}, ${p.sky[1]} 55%, ${p.sky[2]})` }} />
      <svg className="absolute inset-x-0 top-0 h-[232px] w-full" aria-hidden="true">
        {biome === 'slimeCave' && <SlimeCave p={p} offset={offset} clock={clock} />}
        {biome === 'crypt' && <Crypt p={p} offset={offset} clock={clock} />}
        {biome === 'goblinDen' && <GoblinDen p={p} offset={offset} clock={clock} />}
        {/* Chão com pedrinhas */}
        <defs>
          <pattern id={`ground-${biome}`} width="96" height="24" patternUnits="userSpaceOnUse" x={-(offset % 96)} y={GROUND}>
            <rect width="96" height="24" fill={p.ground} />
            <rect width="96" height="2.5" fill={p.groundEdge} />
            <ellipse cx="14" cy="9" rx="5" ry="2" fill={p.groundDots} />
            <ellipse cx="50" cy="15" rx="7" ry="2.4" fill={p.groundDots} />
            <ellipse cx="80" cy="8" rx="4" ry="1.6" fill={p.groundDots} />
            <circle cx="34" cy="19" r="1.2" fill={p.groundEdge} />
            <circle cx="66" cy="6" r="1" fill={p.groundEdge} />
          </pattern>
        </defs>
        <rect x="0" y={GROUND} width="100%" height="24" fill={`url(#ground-${biome})`} />
      </svg>
      {biome === 'crypt' && (
        <>
          {/* Névoa rasteira */}
          <div
            className="pointer-events-none absolute bottom-[10px] h-10 w-[160%] rounded-[50%] bg-[#c9b8ff] opacity-[0.07] blur-md"
            style={{ left: `${-30 + Math.sin(clock / 4000) * 12}%` }}
          />
          <div
            className="pointer-events-none absolute bottom-[0px] h-8 w-[140%] rounded-[50%] bg-[#ffffff] opacity-[0.05] blur-md"
            style={{ left: `${-20 - Math.sin(clock / 5200) * 14}%` }}
          />
        </>
      )}
      <Particles biome={biome} width={width} clock={clock} glow={p.glow} />
      {/* Vinheta para dar profundidade */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 60%, transparent 55%, rgba(0,0,0,0.45) 100%)' }}
      />
    </>
  )
}
