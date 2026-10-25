import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { MONSTERS, skillDef, type Biome, type BossSkillId, type MonsterId, type Projectile, type SkillId } from './data'
import type { BattleEvent } from './engine'
import { CoinIcon, HeartIcon, SkillIcon, XpIcon } from './icons'
import { RESULT_MS, runElapsed, type HeroRun } from './runner'
import Scenery from './scenery'
import { MonsterSprite, ProjectileSprite, SlashSprite, WarriorSprite } from './sprites'

const FLOAT_MS = 950
const LEVEL_UP_MS = 1500
const GROUND = 18 // distância do chão até a base da cena

// ---------- Estado da cena num instante ----------

type FloatKind = 'damage' | 'crit' | 'heroDamage' | 'heal' | 'xp' | 'gold' | 'skill' | 'bossSkill'

interface Float {
  key: string
  side: 'hero' | 'monster'
  kind: FloatKind
  text: string
  skill?: SkillId
  bossSkill?: BossSkillId
  age: number
}

interface Shot {
  key: number
  projectile: Projectile
  /** 0 → 1 do monstro até o herói. */
  progress: number
}

interface SceneState {
  heroHp: number
  monster: MonsterId | null
  monsterHp: number
  monsterMaxHp: number
  wave: number
  spawnAt: number
  approach: number
  heroHitAt: number
  heroHitStrong: boolean
  heroHitCrit: boolean
  heroHits: number
  monsterHitAt: number
  monsterMelee: boolean
  monsterHitSkill?: BossSkillId
  monsterShotAt: number
  monsterDieAt: number | null
  heroDieAt: number | null
  stunUntil: number
  heroStunUntil: number
  quakeAt: number
  stompAt: number
  healAt: number
  cryAt: number
  bossCryAt: number
  chargeAt: number
  chargeUntil: number
  chargedThisWave: boolean
  hitsSinceCharge: number
  berserk: boolean
  berserkAt: number
  bossRage: boolean
  bossRageAt: number
  bossChargeAt: number
  ended: boolean
  walked: number
  floats: Float[]
  shots: Shot[]
}

function sceneAt(events: BattleEvent[], elapsed: number, heroMaxHp: number): SceneState {
  const s: SceneState = {
    heroHp: heroMaxHp,
    monster: null,
    monsterHp: 0,
    monsterMaxHp: 1,
    wave: 0,
    spawnAt: -Infinity,
    approach: 1,
    heroHitAt: -Infinity,
    heroHitStrong: false,
    heroHitCrit: false,
    heroHits: 0,
    monsterHitAt: -Infinity,
    monsterMelee: true,
    monsterShotAt: -Infinity,
    monsterDieAt: null,
    heroDieAt: null,
    stunUntil: -Infinity,
    heroStunUntil: -Infinity,
    quakeAt: -Infinity,
    stompAt: -Infinity,
    healAt: -Infinity,
    cryAt: -Infinity,
    bossCryAt: -Infinity,
    chargeAt: -Infinity,
    chargeUntil: -Infinity,
    chargedThisWave: false,
    hitsSinceCharge: 0,
    berserk: false,
    berserkAt: -Infinity,
    bossRage: false,
    bossRageAt: -Infinity,
    bossChargeAt: -Infinity,
    ended: false,
    walked: 0,
    floats: [],
    shots: [],
  }
  events.forEach((event, index) => {
    // Projéteis aparecem antes do impacto
    if (event.kind === 'monsterHit' && event.projectile && event.at > elapsed) {
      const launch = event.at - event.flight
      if (launch <= elapsed) {
        s.shots.push({ key: index, projectile: event.projectile, progress: (elapsed - launch) / event.flight })
        s.monsterShotAt = launch
      }
      return
    }
    if (event.at > elapsed) return
    const age = elapsed - event.at
    const recent = age < FLOAT_MS
    switch (event.kind) {
      case 'spawn':
        s.monster = event.monster
        s.monsterHp = event.monsterHp
        s.monsterMaxHp = event.monsterMaxHp
        s.wave = event.wave
        s.spawnAt = event.at
        s.approach = event.approach
        s.monsterDieAt = null
        s.stunUntil = -Infinity
        s.chargedThisWave = false
        s.walked += Math.min(age, event.approach)
        break
      case 'charge':
        s.chargeAt = event.at
        s.chargeUntil = event.until
        if (!event.combat) {
          // Corrida até o próximo inimigo: o cenário passa rápido
          s.chargedThisWave = true
          s.hitsSinceCharge = 0
          s.walked += Math.min(age, event.until - event.at) * 2.5
        }
        if (recent) s.floats.push({ key: `${index}s`, side: 'hero', kind: 'skill', text: '', skill: 'charge', age })
        break
      case 'berserk':
        s.berserk = event.on
        s.berserkAt = event.at
        if (event.on && recent) s.floats.push({ key: `${index}s`, side: 'hero', kind: 'skill', text: '', skill: 'berserk', age })
        break
      case 'heroHit':
        s.monsterHp = event.monsterHp
        s.heroHp = event.heroHp
        s.heroHitAt = event.at
        s.heroHitStrong = event.crit || Boolean(event.skill)
        s.heroHitCrit = event.crit
        s.heroHits += 1
        if (event.skill !== 'charge') s.hitsSinceCharge += 1
        s.heroStunUntil = -Infinity
        if (event.stun) {
          s.stunUntil = event.at + 1040
          s.quakeAt = event.at
        }
        if (recent) {
          s.floats.push({
            key: `${index}d`,
            side: 'monster',
            kind: event.crit || event.skill ? 'crit' : 'damage',
            text: String(event.damage),
            age,
          })
          if (event.skill && event.skill !== 'charge')
            s.floats.push({ key: `${index}s`, side: 'hero', kind: 'skill', text: '', skill: event.skill, age })
          if (event.heal) {
            s.healAt = event.at
            s.floats.push({ key: `${index}h`, side: 'hero', kind: 'heal', text: `+${event.heal}`, age })
          }
        }
        break
      case 'heroHeal':
        s.heroHp = event.heroHp
        s.healAt = event.at
        s.cryAt = event.at
        if (recent) {
          s.floats.push({ key: `${index}s`, side: 'hero', kind: 'skill', text: '', skill: event.skill, age })
          if (event.amount > 0) s.floats.push({ key: `${index}h`, side: 'hero', kind: 'heal', text: `+${event.amount}`, age })
        }
        break
      case 'monsterHit':
        s.heroHp = event.heroHp
        s.monsterHitAt = event.at
        s.monsterMelee = !event.projectile
        s.monsterHitSkill = event.skill
        if (event.projectile) s.monsterShotAt = event.at - event.flight
        if (event.stun) {
          s.heroStunUntil = event.at + 1100
          s.stompAt = event.at
        }
        if (recent) s.floats.push({ key: `${index}`, side: 'hero', kind: 'heroDamage', text: `−${event.damage}`, age })
        break
      case 'bossSkill':
        if (event.skill === 'royalCharge') s.bossChargeAt = event.at
        if (event.skill === 'kingsCry') s.bossCryAt = event.at
        if (recent) s.floats.push({ key: `${index}b`, side: 'monster', kind: 'bossSkill', text: '', bossSkill: event.skill, age })
        break
      case 'bossHeal':
        s.monsterHp = event.monsterHp
        if (recent && event.amount > 0)
          s.floats.push({ key: `${index}bh`, side: 'monster', kind: 'heal', text: `+${event.amount}`, age })
        break
      case 'bossRage':
        s.bossRage = event.on
        s.bossRageAt = event.at
        break
      case 'monsterDie':
        s.monsterDieAt = event.at
        if (recent) {
          s.floats.push({ key: `${index}x`, side: 'monster', kind: 'xp', text: `+${event.xp}`, age })
          s.floats.push({ key: `${index}g`, side: 'monster', kind: 'gold', text: `+${event.gold}`, age: Math.max(0, age - 120) })
        }
        break
      case 'heroDie':
        s.heroDieAt = event.at
        break
      case 'end':
        s.ended = true
        break
    }
  })
  return s
}

/** 0 → 1 → 0 ao longo de `duration`, começando em `start`. */
function pulse(age: number, start: number, duration: number): number {
  const p = (age - start) / duration
  if (p < 0 || p > 1) return 0
  return Math.sin(p * Math.PI)
}

/** 0 → 1 ao longo de `duration` (0 antes, null depois). */
function progress(age: number, duration: number): number | null {
  if (age < 0 || age > duration) return null
  return age / duration
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * Math.min(1, Math.max(0, p))
const easeOut = (p: number) => 1 - (1 - Math.min(1, Math.max(0, p))) ** 2

/** Ângulo da espada: prepara, corta e volta. */
function swingAngle(sinceHit: number): number {
  if (sinceHit < -220 || sinceHit > 260) return 0
  if (sinceHit < -90) return lerp(0, -45, (sinceHit + 220) / 130)
  if (sinceHit < 30) return lerp(-45, 80, easeOut((sinceHit + 90) / 120))
  return lerp(80, 0, (sinceHit - 30) / 230)
}

// ---------- Peças da interface ----------

function HpBar({ value, max, tone }: { value: number; max: number; tone: 'hero' | 'monster' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="flex w-[86px] items-center gap-1">
      {tone === 'hero' && <HeartIcon className="h-3 w-3 shrink-0" />}
      <div className="flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/55 ring-1 ring-black/40">
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{ width: `${pct}%`, background: tone === 'hero' ? '#46c46a' : '#e5484d' }}
          />
        </div>
        <p className="mt-0.5 text-center font-mono text-[9.5px] leading-none text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,.9)]">
          {Math.ceil(value)}/{max}
        </p>
      </div>
    </div>
  )
}

function FloatText({ float, x, label }: { float: Float; x: number; label?: string }) {
  const p = float.age / FLOAT_MS
  const isLabel = float.kind === 'skill' || float.kind === 'bossSkill'
  const rise = isLabel ? 10 : 30
  const colors: Record<FloatKind, string> = {
    damage: '#ffffff',
    crit: '#ffd45e',
    heroDamage: '#ff6b6b',
    heal: '#5ee08a',
    xp: '#7fd4ff',
    gold: '#f2c54b',
    skill: '#ffffff',
    bossSkill: '#e7b6ff',
  }
  const offsetY = float.kind === 'gold' ? -18 : isLabel ? -4 : 0
  const pop = float.kind === 'crit' || float.kind === 'damage' ? 1 + pulse(float.age, 0, 220) * (float.kind === 'crit' ? 0.45 : 0.2) : 1
  return (
    <span
      className="pointer-events-none absolute flex items-center gap-1 whitespace-nowrap font-mono font-bold"
      style={{
        left: x,
        // Nomes de habilidade aparecem no alto, no centro da cena
        bottom: isLabel ? 178 + p * rise : 146 + offsetY + p * rise,
        opacity: p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25,
        color: colors[float.kind],
        fontSize: float.kind === 'crit' ? 19 : isLabel ? 12 : 14,
        textShadow: '0 1px 2px rgba(0,0,0,.9), 0 0 6px rgba(0,0,0,.5)',
        transform: `translateX(-50%) scale(${isLabel ? 1 + pulse(float.age, 0, 260) * 0.15 : pop})`,
      }}
    >
      {float.kind === 'xp' && <XpIcon className="h-3.5 w-3.5" />}
      {float.kind === 'gold' && <CoinIcon className="h-3.5 w-3.5" />}
      {float.kind === 'heal' && <HeartIcon className="h-3 w-3" />}
      {float.kind === 'skill' && float.skill && <SkillIcon id={float.skill} className="h-4 w-4" />}
      {label ?? float.text}
    </span>
  )
}

function StunStars({ x, bottom, clock }: { x: number; bottom: number; clock: number }) {
  return (
    <svg
      className="pointer-events-none absolute h-5 w-12 -translate-x-1/2"
      style={{ left: x, bottom }}
      viewBox="0 0 48 20"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => {
        const a = clock / 180 + (i * Math.PI * 2) / 3
        return (
          <path
            key={i}
            transform={`translate(${24 + Math.cos(a) * 16} ${10 + Math.sin(a) * 4})`}
            d="M0 -4 L1.2 -1.2 L4 0 L1.2 1.2 L0 4 L-1.2 1.2 L-4 0 L-1.2 -1.2 Z"
            fill="#ffd45e"
          />
        )
      })}
    </svg>
  )
}

/** Aura de fogo (Fúria Berserker do herói ou Fúria do Rei, em roxo). */
function FireAura({ clock, strength, tone = 'fire', size = 120 }: { clock: number; strength: number; tone?: 'fire' | 'royal'; size?: number }) {
  const [c1, c2, c3] = tone === 'fire' ? ['#ff6a1a', '#ff7a1a', '#ffb03b'] : ['#a83cff', '#9b4dff', '#d48bff']
  const id = `aura-${tone}`
  return (
    <svg
      className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2"
      style={{ opacity: strength, width: size, height: size }}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={id} cx="50%" cy="62%" r="50%">
          <stop offset="0%" stopColor={c1} stopOpacity="0.55" />
          <stop offset="60%" stopColor={c1} stopOpacity="0.2" />
          <stop offset="100%" stopColor={c1} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="72" rx={44 + Math.sin(clock / 120) * 3} ry={48 + Math.sin(clock / 90) * 3} fill={`url(#${id})`} />
      {Array.from({ length: 7 }, (_, i) => {
        const x = 22 + i * 12.5
        const h = 18 + Math.abs(Math.sin(clock / 110 + i * 1.3)) * 22
        const base = 112 - Math.abs(i - 3) * 4
        return (
          <path
            key={i}
            d={`M${x - 6} ${base} C ${x - 5} ${base - h * 0.6}, ${x + 2} ${base - h * 0.7}, ${x} ${base - h} C ${x + 6} ${base - h * 0.6}, ${x + 6} ${base - 4}, ${x + 6} ${base} Z`}
            fill={i % 2 ? c2 : c3}
            opacity="0.7"
          />
        )
      })}
      {Array.from({ length: 5 }, (_, i) => {
        const k = (clock / 900 + i / 5) % 1
        return <circle key={i} cx={30 + ((i * 37) % 60) + Math.sin(k * 8 + i) * 4} cy={104 - k * 90} r={1.6} fill={c3} opacity={1 - k} />
      })}
    </svg>
  )
}

/** Faíscas do impacto de um golpe. */
function ImpactSpark({ x, bottom, p, strong }: { x: number; bottom: number; p: number; strong: boolean }) {
  const r = 8 + p * (strong ? 30 : 20)
  return (
    <svg
      className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 translate-y-1/2"
      style={{ left: x, bottom, opacity: 1 - p }}
      viewBox="-48 -48 96 96"
      aria-hidden="true"
    >
      <circle r={r * 0.6} fill={strong ? '#ffd45e' : '#ffffff'} opacity={0.35 * (1 - p)} />
      {Array.from({ length: strong ? 10 : 7 }, (_, i) => {
        const a = (i / (strong ? 10 : 7)) * Math.PI * 2 + 0.3
        return (
          <path
            key={i}
            d={`M${Math.cos(a) * r * 0.5} ${Math.sin(a) * r * 0.5} L${Math.cos(a) * r} ${Math.sin(a) * r}`}
            stroke={strong ? '#ffd45e' : '#ffffff'}
            strokeWidth={strong ? 3 : 2}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

/** Onda de choque (Grito de Guerra, Grito do Rei, Golpe Sísmico). */
function Shockwave({ x, bottom, p, color, ground = false }: { x: number; bottom: number; p: number; color: string; ground?: boolean }) {
  const r = 10 + p * 90
  return (
    <svg
      className="pointer-events-none absolute -translate-x-1/2 translate-y-1/2"
      style={{ left: x, bottom, width: 220, height: ground ? 60 : 220, opacity: 1 - p }}
      viewBox={ground ? '-110 -30 220 60' : '-110 -110 220 220'}
      aria-hidden="true"
    >
      {ground ? (
        <ellipse rx={r * 1.1} ry={r * 0.18} fill="none" stroke={color} strokeWidth={4 * (1 - p) + 1} />
      ) : (
        <>
          <circle r={r} fill="none" stroke={color} strokeWidth={5 * (1 - p) + 1} />
          <circle r={r * 0.7} fill="none" stroke={color} strokeWidth={2} opacity="0.5" />
        </>
      )}
    </svg>
  )
}

/** Fumacinha quando um monstro é derrotado. */
function DeathPuff({ x, p }: { x: number; p: number }) {
  return (
    <svg
      className="pointer-events-none absolute h-28 w-28 -translate-x-1/2"
      style={{ left: x, bottom: GROUND - 6, opacity: 1 - p }}
      viewBox="-56 -100 112 112"
      aria-hidden="true"
    >
      {[
        [-18, -20, 0.9],
        [14, -26, 1.1],
        [0, -40, 1.3],
        [-10, -58, 0.8],
        [20, -50, 0.7],
      ].map(([dx, dy, k], i) => (
        <circle key={i} cx={dx * (0.6 + p)} cy={dy * (0.5 + p * 0.8)} r={(6 + p * 14) * k} fill="#d8d4cc" opacity="0.55" />
      ))}
    </svg>
  )
}

/** Moedas saltando do monstro derrotado. */
function CoinBurst({ x, p }: { x: number; p: number }) {
  return (
    <>
      {[-1, 0, 1].map((dir, i) => {
        const t = Math.min(1, p * 1.2 - i * 0.08)
        if (t <= 0) return null
        const cx = x + dir * 26 * t
        const cy = GROUND + 50 + Math.sin(t * Math.PI) * 50 - t * 10
        return (
          <span key={i} className="pointer-events-none absolute" style={{ left: cx - 7, bottom: cy, opacity: 1 - Math.max(0, t - 0.7) / 0.3 }}>
            <CoinIcon className="h-3.5 w-3.5" />
          </span>
        )
      })}
    </>
  )
}

/** Brilho subindo da cura. */
function HealSparkles({ x, p }: { x: number; p: number }) {
  return (
    <svg
      className="pointer-events-none absolute h-28 w-20 -translate-x-1/2"
      style={{ left: x, bottom: GROUND, opacity: 1 - p }}
      viewBox="0 0 80 112"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }, (_, i) => {
        const y = 100 - p * 80 - (i % 3) * 14
        const sx = 12 + ((i * 29) % 56)
        return (
          <path
            key={i}
            transform={`translate(${sx} ${y})`}
            d="M0 -4 V4 M-4 0 H4"
            stroke="#7dffa0"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

// ---------- Barra de habilidades ----------

type SkillHud = { id: SkillId; state: 'ready' | 'cooldown' | 'active' | 'idle' | 'used'; label: string; fraction?: number }

function SkillBar({ skills }: { skills: SkillHud[] }) {
  if (skills.length === 0) return null
  return (
    <div className="absolute right-3 top-2 flex gap-1.5">
      {skills.map((skill) => {
        const glow = skill.state === 'ready' || skill.state === 'active'
        return (
          <div key={skill.id} className="flex flex-col items-center gap-0.5">
            <div
              className="relative h-7 w-7 overflow-hidden rounded-[8px]"
              style={{
                boxShadow: glow
                  ? `0 0 0 1.5px ${skill.state === 'active' ? '#ff8a3c' : '#7dffa0'}, 0 0 8px ${skill.state === 'active' ? '#ff8a3c88' : '#7dffa088'}`
                  : '0 0 0 1px rgba(255,255,255,.18)',
                opacity: skill.state === 'idle' || skill.state === 'used' ? 0.45 : 1,
              }}
            >
              <SkillIcon id={skill.id} className="h-7 w-7" />
              {skill.state === 'cooldown' && skill.fraction != null && (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `conic-gradient(rgba(0,0,0,.72) ${skill.fraction * 360}deg, transparent 0deg)`,
                  }}
                />
              )}
            </div>
            <span
              className="rounded px-1 font-mono text-[8.5px] font-semibold leading-tight"
              style={{
                color: skill.state === 'ready' ? '#7dffa0' : skill.state === 'active' ? '#ffb070' : 'rgba(255,255,255,.75)',
                background: 'rgba(0,0,0,.45)',
              }}
            >
              {skill.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Cena ----------

export default function BattleScene({
  run,
  stageLabel,
  biome,
  biomeName,
  equipped,
  overlay,
}: {
  run: HeroRun | null
  stageLabel: string
  biome: Biome
  biomeName: string
  /** Habilidades equipadas (para a barra quando não há luta). */
  equipped: SkillId[]
  /** Mensagem quando o herói está parado. */
  overlay?: ReactNode
}) {
  const t = useT()
  const box = useRef<HTMLElement | null>(null)
  const [width, setWidth] = useState(360)
  const [elapsed, setElapsed] = useState(0)
  const [idleClock, setIdleClock] = useState(0)

  // Largura da cena (as posições são em pixels).
  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setWidth(el.clientWidth || 360)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // A luta roda no motor do herói (mesmo fora desta tela); aqui só desenhamos o momento atual.
  useEffect(() => {
    if (!run) return
    let frame = 0
    const tick = () => {
      const time = runElapsed(run)
      setElapsed(time)
      if (time < run.result.duration + RESULT_MS) frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [run])

  // Herói parado respirando, cenário vivo.
  useEffect(() => {
    if (run) return
    const id = window.setInterval(() => setIdleClock((c) => c + 1), 50)
    return () => window.clearInterval(id)
  }, [run])

  const result = run?.result
  const heroMaxHp = result?.heroMaxHp ?? 1
  const scene = result ? sceneAt(result.events, elapsed, heroMaxHp) : null
  const clock = run ? elapsed : idleClock * 50

  // ----- Posições (centro dos personagens, em px) -----
  const heroX = Math.max(56, width * 0.16)
  const meetX = heroX + 104
  const age = scene ? elapsed - scene.spawnAt : 0
  const base = scene?.monster ? MONSTERS[scene.monster] : null
  const ranged = Boolean(base?.projectile)
  const isBoss = Boolean(base?.boss)
  const flying = Boolean(base?.flying)
  const monsterSize = isBoss ? 128 : 84
  const standX = width * 0.8

  let monsterX = meetX + (isBoss ? 18 : 0)
  if (scene?.monster) {
    if (ranged) {
      monsterX = age < 260 ? lerp(width + 60, standX, easeOut(age / 260)) : lerp(standX, meetX, (age - 260) / (scene.approach - 260))
    } else {
      monsterX = lerp(width + 60, meetX + (isBoss ? 18 : 0), easeOut(age / scene.approach))
    }
  }

  const walking = scene ? age < scene.approach && !scene.ended && scene.heroDieAt == null : false
  const bob = scene ? (walking ? -Math.abs(Math.sin(elapsed / 85)) * 4 : 0) : Math.sin(clock / 750) * -1.2

  // ----- Herói -----
  const sinceHeroHit = scene ? elapsed - scene.heroHitAt : Infinity
  const swing = swingAngle(sinceHeroHit)
  const heroLunge = pulse(sinceHeroHit, -140, 320) * 40
  const sinceHurt = scene ? elapsed - scene.monsterHitAt : Infinity
  const heroHurt = sinceHurt >= 0 && sinceHurt < 160
  const heroKnock = pulse(sinceHurt, 0, 220) * (scene?.monsterHitSkill ? -14 : -6)
  const heroDown = scene?.heroDieAt != null ? Math.min(1, (elapsed - scene.heroDieAt) / 400) : 0
  const charging = scene ? elapsed >= scene.chargeAt && elapsed < scene.chargeUntil : false
  const chargeP = scene && charging ? (elapsed - scene.chargeAt) / (scene.chargeUntil - scene.chargeAt) : 0
  const chargeLean = charging ? 12 : 0
  const chargeDash = charging ? Math.sin(chargeP * Math.PI) * 26 : 0
  const berserk = Boolean(scene?.berserk) && !scene?.ended
  const berserkIn = scene ? Math.min(1, (elapsed - scene.berserkAt) / 300) : 0
  const heroStunned = scene ? elapsed < scene.heroStunUntil && heroDown === 0 : false
  const cryP = scene ? progress(elapsed - scene.cryAt, 650) : null
  const healP = scene ? progress(elapsed - scene.healAt, 700) : null
  const levelUp = run?.levelUps.filter((up) => elapsed >= up.at && elapsed < up.at + LEVEL_UP_MS).pop()
  const levelP = levelUp ? (elapsed - levelUp.at) / LEVEL_UP_MS : null

  // ----- Monstro -----
  const sinceMonsterHit = scene ? elapsed - scene.monsterHitAt : Infinity
  const monsterLunge = scene?.monsterMelee ? pulse(sinceMonsterHit, -130, 280) * (isBoss ? 30 : 36) : 0
  const monsterSquash = scene?.monsterMelee ? pulse(sinceMonsterHit, -130, 280) * 0.12 : 0
  const recoil = scene ? pulse(elapsed - scene.monsterShotAt, 0, 220) * 6 : 0
  const knockback = pulse(sinceHeroHit, 0, 260) * (scene?.heroHitStrong ? 18 : 9)
  const monsterFlash = sinceHeroHit >= 0 && sinceHeroHit < 120
  const dyingAge = scene?.monsterDieAt != null ? elapsed - scene.monsterDieAt : null
  const dying = dyingAge != null ? Math.min(1, dyingAge / 520) : 0
  const stunned = scene ? elapsed < scene.stunUntil && dying === 0 : false
  const breathe = 1 + Math.sin(clock / (scene?.monster === 'slime' || scene?.monster === 'bigSlime' ? 220 : 340)) * 0.035
  const bossCharging = isBoss && scene ? elapsed - scene.bossChargeAt < 380 && elapsed >= scene.bossChargeAt : false
  const bossRage = Boolean(scene?.bossRage) && dying === 0
  const bossRageIn = scene ? Math.min(1, (elapsed - scene.bossRageAt) / 300) : 0
  const bossCryP = scene ? progress(elapsed - scene.bossCryAt, 650) : null

  // Tremor (Golpe Sísmico do herói, Pisão do rei)
  const shakeAge = scene ? Math.min(elapsed - scene.quakeAt, elapsed - scene.stompAt) : Infinity
  const shake = pulse(shakeAge, 0, 380) * Math.sin(elapsed / 18) * 5
  const quakeP = scene ? progress(elapsed - scene.quakeAt, 600) : null
  const stompP = scene ? progress(elapsed - scene.stompAt, 600) : null
  const impactP = progress(sinceHeroHit, 220)
  const critFlash = scene?.heroHitCrit && sinceHeroHit >= 0 && sinceHeroHit < 90

  const showResult = scene?.ended && result
  const slash = sinceHeroHit >= -40 && sinceHeroHit < 180

  // ----- Barra de habilidades -----
  const loadout = run?.loadout ?? equipped
  const skills: SkillHud[] = loadout
    .filter((id) => skillDef(id).kind === 'active' || id === 'berserk')
    .map((id) => {
    const def = skillDef(id)
    if (id === 'charge') {
      if (!scene) return { id, state: 'cooldown', label: t.hero.hud.hits(def.every ?? 3), fraction: 1 }
      if (charging) return { id, state: 'active', label: t.hero.hud.go }
      // Recarrega com 3 golpes depois de usada
      const every = def.every ?? 3
      if (scene.hitsSinceCharge < every) {
        const left = every - scene.hitsSinceCharge
        return { id, state: 'cooldown', label: t.hero.hud.hits(left), fraction: left / every }
      }
      // Pronta: dispara ao avançar até o próximo inimigo
      return { id, state: 'ready', label: t.hero.hud.ready }
    }
    if (id === 'warCry') {
      const cd = def.cooldownMs ?? 15_000
      const left = scene && scene.cryAt > -Infinity ? cd - (elapsed - scene.cryAt) : 0
      if (left <= 0) return { id, state: 'ready', label: t.hero.hud.ready }
      return { id, state: 'cooldown', label: `${Math.ceil(left / 1000)}s`, fraction: left / cd }
    }
    if (id === 'quake') {
      const every = def.every ?? 4
      const done = (scene?.heroHits ?? 0) % every
      const left = every - done
      if (left === 1) return { id, state: 'ready', label: t.hero.hud.next }
      return { id, state: 'cooldown', label: t.hero.hud.hits(left), fraction: left / every }
    }
    if (id === 'berserk') {
      return berserk ? { id, state: 'active', label: t.hero.hud.on } : { id, state: 'idle', label: t.hero.hud.off }
    }
    return { id, state: 'idle', label: t.hero.hud.passive }
  })

  return (
    <section
      ref={box}
      aria-label={t.hero.sceneLabel}
      className="relative h-[232px] select-none overflow-hidden rounded-[18px] border border-line"
    >
      <div className="absolute inset-0" style={{ transform: `translateX(${shake}px)` }}>
        <Scenery biome={biome} offset={(scene?.walked ?? 0) * 0.14} clock={clock} width={width} />

        {/* Pilar de luz ao subir de nível */}
        {levelP != null && (
          <div
            className="pointer-events-none absolute bottom-[18px] -translate-x-1/2"
            style={{
              left: heroX,
              width: 70,
              height: 200,
              opacity: Math.sin(levelP * Math.PI) * 0.8,
              background: 'linear-gradient(to top, rgba(255,212,94,.55), rgba(255,212,94,0))',
              filter: 'blur(2px)',
            }}
          />
        )}

        {/* Herói */}
        <div className="absolute bottom-[18px] flex -translate-x-1/2 flex-col items-center" style={{ left: heroX }}>
          {scene && <HpBar value={scene.heroHp} max={heroMaxHp} tone="hero" />}
          {berserk && <FireAura clock={elapsed} strength={berserkIn} />}
          {charging && (
            <>
              <div
                className="pointer-events-none absolute bottom-0"
                style={{ left: -54 + chargeDash, opacity: 0.25, transform: `rotate(${chargeLean}deg)`, transformOrigin: '50% 90%' }}
              >
                <WarriorSprite className="h-[92px] w-[92px]" />
              </div>
              <svg className="pointer-events-none absolute -left-16 bottom-6 h-16 w-24" viewBox="0 0 96 64" aria-hidden="true">
                {[10, 24, 38, 50].map((y, i) => (
                  <path
                    key={y}
                    d={`M${8 + ((elapsed / 4 + i * 23) % 30)} ${y} H${60 + ((elapsed / 4 + i * 23) % 30)}`}
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.45"
                  />
                ))}
              </svg>
            </>
          )}
          <div
            className="relative"
            style={{
              transform: `translate(${heroLunge + chargeDash + heroKnock}px, ${bob + heroDown * 12}px) rotate(${
                heroDown * -80 + pulse(sinceHeroHit, -140, 320) * 8 + chargeLean
              }deg)`,
              transformOrigin: '50% 90%',
              filter: heroHurt
                ? 'brightness(1.6) sepia(1) hue-rotate(-40deg) saturate(4)'
                : healP != null
                  ? `drop-shadow(0 0 ${6 * Math.sin(healP * Math.PI)}px #5ee08a)`
                  : cryP != null
                    ? `drop-shadow(0 0 ${8 * Math.sin(cryP * Math.PI)}px #ff9a3c)`
                    : undefined,
              opacity: 1 - heroDown * 0.35,
            }}
          >
            <WarriorSprite className="h-[92px] w-[92px]" swing={heroDown > 0 ? 0 : swing} />
          </div>
        </div>
        {heroStunned && <StunStars x={heroX} bottom={GROUND + 96} clock={elapsed} />}
        {cryP != null && <Shockwave x={heroX} bottom={GROUND + 46} p={cryP} color="#ff9a3c" />}
        {healP != null && <HealSparkles x={heroX} p={healP} />}

        {/* Monstro */}
        {scene?.monster && (
          <div className="absolute bottom-[18px] flex -translate-x-1/2 flex-col items-center" style={{ left: monsterX }}>
            {dying === 0 && <HpBar value={scene.monsterHp} max={scene.monsterMaxHp} tone="monster" />}
            {bossRage && <FireAura clock={elapsed} strength={bossRageIn} tone="royal" size={160} />}
            {bossCharging && (
              <div className="pointer-events-none absolute bottom-0" style={{ left: 40, opacity: 0.25 }}>
                <MonsterSprite id={scene.monster} className="h-[128px] w-[128px]" />
              </div>
            )}
            <div
              style={{
                transform: `translate(${-monsterLunge + recoil + knockback}px, ${
                  flying ? -16 + Math.sin(elapsed / 150) * 4 : 0
                }px) scale(${(1 - dying * 0.3) * (1 + monsterSquash)}, ${(1 - dying * 0.3) * (dying ? 1 : breathe) * (1 - monsterSquash * 0.6)}) rotate(${dying * 24}deg)`,
                transformOrigin: '50% 90%',
                filter: monsterFlash ? 'brightness(2.6)' : undefined,
                opacity: 1 - dying,
              }}
            >
              <MonsterSprite id={scene.monster} className={isBoss ? 'h-[128px] w-[128px]' : 'h-[84px] w-[84px]'} />
            </div>
            {dying === 0 && (
              <p className="mt-0.5 rounded-md bg-black/60 px-1.5 py-px text-[11px] font-semibold leading-tight text-white [text-shadow:0_1px_1px_rgba(0,0,0,.8)]">
                {isBoss && '👑 '}
                {t.hero.monsters[scene.monster]}
              </p>
            )}
          </div>
        )}

        {stunned && <StunStars x={monsterX} bottom={GROUND + monsterSize + 2} clock={elapsed} />}
        {bossCryP != null && <Shockwave x={monsterX} bottom={GROUND + 60} p={bossCryP} color="#c77dff" />}
        {quakeP != null && <Shockwave x={monsterX} bottom={GROUND + 2} p={quakeP} color="#c9a46b" ground />}
        {stompP != null && <Shockwave x={heroX + 50} bottom={GROUND + 2} p={stompP} color="#a35cff" ground />}
        {dyingAge != null && dyingAge < 650 && <DeathPuff x={monsterX} p={dyingAge / 650} />}
        {dyingAge != null && dyingAge < 900 && <CoinBurst x={monsterX} p={dyingAge / 900} />}

        {/* Rastro da espada e faíscas */}
        {slash && scene?.monster && (
          <SlashSprite
            strong={scene.heroHitStrong}
            className="pointer-events-none absolute h-16 w-16 -translate-x-1/2"
            style={{
              left: monsterX - 8,
              bottom: GROUND + monsterSize * 0.3,
              opacity: Math.max(0, 1 - Math.max(0, sinceHeroHit) / 180),
              transform: `translateX(-50%) rotate(${lerp(-30, 20, (sinceHeroHit + 40) / 220)}deg) scale(${scene.heroHitStrong ? 1.25 : 1})`,
            }}
          />
        )}
        {impactP != null && scene?.monster && (
          <ImpactSpark x={monsterX - 10} bottom={GROUND + monsterSize * 0.5} p={impactP} strong={scene.heroHitStrong} />
        )}

        {/* Lanças e flechas voando, com rastro */}
        {scene?.shots.map((shot) => {
          const fromX = monsterX - 26
          const toX = heroX + 22
          const x = lerp(fromX, toX, shot.progress)
          const arc = shot.projectile === 'spear' ? Math.sin(shot.progress * Math.PI) * 22 : Math.sin(shot.progress * Math.PI) * 6
          const tilt = shot.projectile === 'spear' ? (shot.progress - 0.5) * 30 : (shot.progress - 0.5) * 10
          return (
            <div key={shot.key}>
              <div
                className="pointer-events-none absolute h-[2px] rounded-full bg-white/30"
                style={{ left: x + 6, bottom: 66 + arc, width: 34, transform: `rotate(${tilt}deg)` }}
              />
              <ProjectileSprite
                type={shot.projectile}
                className={`pointer-events-none absolute -translate-x-1/2 ${shot.projectile === 'spear' ? 'h-3 w-14' : 'h-2.5 w-10'}`}
                style={{ left: x, bottom: 62 + arc, transform: `translateX(-50%) rotate(${tilt}deg)` }}
              />
            </div>
          )
        })}

        {/* Números e nomes flutuando */}
        {scene?.floats.map((float) => (
          <FloatText
            key={float.key}
            float={float}
            x={float.kind === 'skill' || float.kind === 'bossSkill' ? width / 2 : float.side === 'hero' ? heroX : monsterX}
            label={
              float.kind === 'skill' && float.skill
                ? `${t.hero.skillNames[float.skill]}!`
                : float.kind === 'bossSkill' && float.bossSkill
                  ? `${t.hero.bossSkillNames[float.bossSkill]}!`
                  : undefined
            }
          />
        ))}

        {critFlash && <div className="pointer-events-none absolute inset-0 bg-white/10" />}
      </div>

      {/* Topo: fase e ondas */}
      <div className="absolute inset-x-3 top-2.5 flex items-center justify-between gap-2 font-mono text-[11px] text-white/80">
        <span className="flex items-center gap-1.5">
          <span className="rounded-md border border-white/20 bg-black/40 px-1.5 py-0.5 text-white">{stageLabel}</span>
          <span className="truncate [text-shadow:0_1px_2px_rgba(0,0,0,.9)]">{biomeName}</span>
          {run && run.speed > 1 && <span className="text-white/60">×{run.speed}</span>}
        </span>
        {result && (
          <span className="flex items-center gap-1" aria-label={t.hero.wave((scene?.wave ?? 0) + 1, result.waves)}>
            {Array.from({ length: result.waves }, (_, i) => {
              const done = i < (scene?.wave ?? 0) || (i === scene?.wave && scene.monsterDieAt != null)
              return (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: done ? '#ffffff' : i === scene?.wave ? '#ffffff88' : '#ffffff30' }}
                />
              )
            })}
          </span>
        )}
        <span style={{ width: Math.max(0, loadout.length * 34 - 6) }} />
      </div>

      <SkillBar skills={skills} />

      {/* Subiu de nível */}
      {levelUp && !showResult && (
        <div
          className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center"
          style={{
            opacity: Math.min(1, (LEVEL_UP_MS - (elapsed - levelUp.at)) / 300),
            transform: `scale(${1 + pulse(elapsed - levelUp.at, 0, 300) * 0.25})`,
          }}
        >
          <span className="flex items-center gap-1.5 rounded-full border border-[#ffd45e]/60 bg-black/60 px-3 py-1 text-[15px] font-bold text-[#ffd45e]">
            <XpIcon className="h-4 w-4" />
            {t.hero.levelUp(levelUp.level)}
          </span>
        </div>
      )}

      {/* Resultado da fase */}
      {showResult && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 text-center text-white backdrop-blur-[2px]">
          <p className="text-lg font-semibold">{result.won ? t.hero.victory : t.hero.defeat}</p>
          <div className="space-y-1 font-mono text-[12.5px] text-white/85">
            <p className="flex items-center justify-center gap-3">
              <span className="text-white/60">{t.hero.resultEnemies}</span>
              <span className="flex items-center gap-1">
                <XpIcon className="h-4 w-4" />+{result.xpGained - result.clearXp}
              </span>
              <span className="flex items-center gap-1">
                <CoinIcon className="h-4 w-4" />+{result.goldGained - result.clearGold}
              </span>
            </p>
            {result.won && (
              <p className="flex items-center justify-center gap-3 text-[#ffd45e]">
                <span className="text-[#ffd45e]/80">{t.hero.resultBonus}</span>
                <span className="flex items-center gap-1">
                  <XpIcon className="h-4 w-4" />+{result.clearXp}
                </span>
                <span className="flex items-center gap-1">
                  <CoinIcon className="h-4 w-4" />+{result.clearGold}
                </span>
              </p>
            )}
          </div>
          {result.levelsGained > 0 && (
            <p className="text-[13px] font-semibold text-[#ffd45e]">{t.hero.levelUp(run?.levelUps[run.levelUps.length - 1]?.level ?? 1)}</p>
          )}
          {result.unlocked && <p className="text-[13px] text-white/70">{t.hero.unlocked(`1.${result.unlocked}`)}</p>}
          {!result.won && <p className="text-[13px] text-white/70">{t.hero.defeatHint}</p>}
        </div>
      )}

      {/* Herói parado */}
      {!run && overlay && (
        <div className="absolute left-[30%] right-3 top-14 flex justify-center text-center text-white">{overlay}</div>
      )}
    </section>
  )
}
