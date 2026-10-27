import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Segmented, Switch } from '../components/controls'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons'
import { db, getGameState, newGameState, regenEnergy, saveGameState, withGameDefaults } from '../db/db'
import type { GameState } from '../db/types'
import AdventureGuide from '../game/AdventureGuide'
import BattleScene from '../game/BattleScene'
import {
  BOSS_SKILLS,
  ENERGY,
  MONSTERS,
  NO_UPGRADES,
  UPGRADES,
  upgradeCost,
  type UpgradeDef,
  type UpgradeId,
  monsterGold,
  monsterStats,
  POINTS_PER_RUN,
  SKILLS,
  SKILL_SLOTS,
  skillDef,
  STAGES,
  STAGE_COUNT,
  warriorStats,
  xpToNext,
  type Biome,
  type MonsterId,
  type SkillDef,
  type SkillId,
} from '../game/data'
import { activeLoadout, equippedActives } from '../game/engine'
import { syncMedal } from '../game/medal'
import {
  CoinIcon,
  HeartIcon,
  LockIcon,
  MEDAL_COLORS,
  MedalIcon,
  PointsIcon,
  ShieldIcon,
  SkillIcon,
  SwordIcon,
  TrophyIcon,
  XpIcon,
} from '../game/icons'
import {
  chooseMusicStage,
  getHeroRun,
  isHeroBusy,
  setBattleSound,
  setHeroPageOpen,
  setMusicOn,
  setRunSpeed,
  startHeroRun,
  subscribeHeroRun,
} from '../game/runner'
import { MonsterSprite, WarriorSprite } from '../game/sprites'
import { useT } from '../i18n'
import { isMusicBlocked, subscribeMusicBlocked } from '../lib/music'
import { updateSettings, useSettings } from '../lib/settings'
import { playSound, unlockAudio } from '../lib/sound'
import { claimBossMedal, cleanNickname, fetchBossPodium, onlineConfigured, type PodiumEntry } from '../lib/online'
import { useLive } from '../lib/useLive'

const stageName = (index: number) => `1.${index}`

/** Monstros de uma fase sem repetir, na ordem da luta (quem atira de longe por último, chefe no fim). */
function stageLineup(monsters: MonsterId[]): { id: MonsterId; count: number }[] {
  const rank = (id: MonsterId) => (MONSTERS[id].boss ? 2 : MONSTERS[id].projectile ? 1 : 0)
  const list: { id: MonsterId; count: number }[] = []
  for (const id of [...monsters].sort((a, b) => rank(a) - rank(b))) {
    const found = list.find((m) => m.id === id)
    if (found) found.count += 1
    else list.push({ id, count: 1 })
  }
  return list
}
const BIOME_ORDER: Biome[] = ['slimeCave', 'crypt', 'goblinDen']
type Tab = 'batalha' | 'evolucao' | 'habilidades' | 'monstros'

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-mono text-[17px] font-medium leading-none">{value}</p>
    </div>
  )
}

// ---------- Ações das habilidades ----------

/** Compra uma habilidade (e equipa se houver espaço livre). */
async function buySkill(skill: SkillDef): Promise<boolean> {
  if (isHeroBusy()) return false
  return db.transaction('rw', db.game, async () => {
    const state = await getGameState()
    if (state.learned.includes(skill.id) || state.level < skill.level || state.gold < skill.cost) return false
    const equipped = equippedActives(state)
    await db.game.put({
      ...state,
      gold: state.gold - skill.cost,
      learned: [...state.learned, skill.id],
      // Ativas entram num espaço livre; passivas já funcionam ao aprender
      equipped: skill.kind === 'active' && equipped.length < SKILL_SLOTS ? [...equipped, skill.id] : equipped,
    })
    return true
  })
}

/** Equipa (no lugar de `replace`, se os espaços estiverem cheios) ou remove. */
async function setEquipped(id: SkillId, on: boolean, replace?: SkillId): Promise<void> {
  if (isHeroBusy()) return
  await db.transaction('rw', db.game, async () => {
    const state = await getGameState()
    let equipped = equippedActives(state)
    if (skillDef(id).kind !== 'active') return
    if (!on) equipped = equipped.filter((s) => s !== id)
    else if (state.learned.includes(id) && !equipped.includes(id)) {
      if (replace) equipped = equipped.map((s) => (s === replace ? id : s))
      else if (equipped.length < SKILL_SLOTS) equipped = [...equipped, id]
    }
    await db.game.put({ ...state, equipped })
  })
}

/** Aba Herói: modo opcional em que o estudo vira pontos para o guerreiro avançar nas fases. */
export default function HeroPage() {
  const t = useT()
  const settings = useSettings()
  const [params, setParams] = useSearchParams()
  const tab: Tab = (['batalha', 'evolucao', 'habilidades', 'monstros'] as const).find((v) => v === params.get('aba')) ?? 'batalha'
  const saved = useLive(async () => (await db.game.get('main')) ?? null, [])
  const run = useSyncExternalStore(subscribeHeroRun, getHeroRun)

  // Música da fase escolhida enquanto esta aba estiver aberta
  useEffect(() => {
    setHeroPageOpen(true)
    return () => setHeroPageOpen(false)
  }, [])

  // Primeira visita: cria o herói com os pontos de boas-vindas.
  useEffect(() => {
    if (saved === null) void db.game.get('main').then((g) => (g ? undefined : db.game.put(newGameState())))
  }, [saved])

  if (!settings.heroMode) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-[26px] font-semibold tracking-tight">{t.hero.title}</h1>
        <p className="text-muted">{t.settings.heroDesc}</p>
        <button className="btn btn-primary" onClick={() => updateSettings({ heroMode: true })}>
          {t.settings.heroToggle}
        </button>
      </div>
    )
  }

  if (!saved) return <p className="text-muted">{t.common.loading}</p>
  const state = withGameDefaults(saved)

  function changeTab(next: Tab) {
    playSound('select')
    setParams(next === 'batalha' ? {} : { aba: next }, { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-semibold tracking-tight">
            {t.hero.title}
            {state.medal > 0 && (
              <span
                className="flex items-center gap-1 rounded-full border py-0.5 pl-1 pr-2 text-[12px] font-medium"
                style={{ borderColor: `${MEDAL_COLORS[state.medal].fill}80`, color: MEDAL_COLORS[state.medal].fill }}
                title={t.hero.yourMedal(state.medal)}
              >
                <MedalIcon className="h-5 w-5" tier={state.medal} />
                {t.hero.medalTier(state.medal)}
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {t.hero.className} · {t.hero.level(state.level)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="relative flex items-center justify-end gap-1 font-mono text-[18px] font-medium leading-none">
              <CoinIcon className="h-4 w-4" />
              {state.gold}
              <GainBubble value={state.gold} color="#f2c54b" />
            </p>
            <p className="mt-1 text-[12px] text-muted">{t.hero.gold}</p>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 font-mono text-[28px] font-medium leading-none tracking-tight">
              <PointsIcon className="h-5 w-5" />
              {state.points}
            </p>
            <p className="mt-1 text-[12px] text-muted">{t.hero.energy}</p>
            <EnergyTimer state={state} />
          </div>
        </div>
      </div>

      <AdventureGuide />

      <Segmented
        label={t.hero.title}
        value={tab}
        options={[
          { value: 'batalha', label: t.hero.tabs.battle },
          { value: 'evolucao', label: t.hero.tabs.tree },
          { value: 'habilidades', label: t.hero.tabs.skills },
          { value: 'monstros', label: t.hero.tabs.monsters },
        ]}
        onChange={changeTab}
      />

      {tab === 'batalha' && <BattleTab state={state} running={Boolean(run)} />}
      {tab === 'evolucao' && <TreeTab state={state} running={Boolean(run)} />}
      {tab === 'habilidades' && <SkillsTab state={state} running={Boolean(run)} />}
      {tab === 'monstros' && <MonstersTab state={state} />}

      <p className="text-[12px] leading-snug text-muted">{t.hero.intro}</p>

      {import.meta.env.DEV && <DevPanel state={state} disabled={Boolean(run)} />}
    </div>
  )
}

// ---------- Batalha ----------

function BattleTab({ state, running }: { state: GameState; running: boolean }) {
  const t = useT()
  const settings = useSettings()
  const run = useSyncExternalStore(subscribeHeroRun, getHeroRun)
  /** A música está pronta, mas o navegador espera um toque na página para tocar som. */
  const musicWaiting = useSyncExternalStore(subscribeMusicBlocked, isMusicBlocked)
  const stats = warriorStats(state.level)
  const need = xpToNext(state.level)
  const runsAvailable = Math.floor(state.points / POINTS_PER_RUN)
  const toNext = POINTS_PER_RUN - (state.points % POINTS_PER_RUN)
  const selected = Math.min(state.selectedStage, state.unlockedStage)
  const playingStage = run ? run.result.stage : selected
  const playingBiome = STAGES[playingStage - 1].biome
  const decimal = (n: number) => String(n).replace('.', settings.language === 'en' ? '.' : ',')

  function selectStage(index: number) {
    if (running || index < 1 || index > state.unlockedStage) return
    playSound('select')
    chooseMusicStage(index)
    void saveGameState({ selectedStage: index })
  }

  function play() {
    unlockAudio()
    void startHeroRun()
  }

  const overlay =
    state.points < POINTS_PER_RUN ? (
      <div className="space-y-2">
        <p className="text-[13px] text-white/85">{t.hero.needPoints}</p>
        <Link
          to="/"
          className="inline-flex h-9 items-center rounded-lg border border-white/25 bg-black/30 px-3 text-[13px] font-medium text-white hover:bg-black/45"
        >
          {t.hero.studyNow}
        </Link>
      </div>
    ) : (
      <p className="text-[13px] text-white/85">{t.hero.ready(stageName(selected))}</p>
    )

  return (
    <>
      <div className="space-y-3">
        <BattleScene
          run={run}
          stageLabel={stageName(playingStage)}
          biome={playingBiome}
          biomeName={t.hero.biomes[playingBiome]}
          equipped={activeLoadout(state)}
          overlay={overlay}
        />

        {settings.sound && state.music && musicWaiting && (
          <button
            type="button"
            className="flex w-full items-center justify-center rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-[13px] text-fg-soft hover:text-fg"
            onClick={() => unlockAudio()}
          >
            {t.hero.tapForMusic}
          </button>
        )}

        {state.medalPending && state.medal === 0 && (
          <Link
            to="/aventura?aba=monstros&chefe=1"
            className="flex items-center gap-3 rounded-xl border border-[#f2c54b]/50 bg-[#f2c54b]/10 px-3.5 py-2.5 text-[13px] leading-snug"
          >
            <MedalIcon className="h-6 w-6 shrink-0" tier={1} />
            <span className="flex-1 text-fg-soft">{t.hero.pendingNotice}</span>
            <span className="font-medium text-[#f2c54b]">{t.hero.pendingAction}</span>
          </Link>
        )}

        {/* Escolha da fase: dá para voltar às anteriores */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost h-11 w-11 shrink-0 px-0"
            aria-label={t.hero.prevStage}
            disabled={running || selected <= 1}
            onClick={() => selectStage(selected - 1)}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-medium">{t.hero.stage(stageName(selected))}</p>
            <p className="truncate text-[12px] text-muted">
              {t.hero.biomes[STAGES[selected - 1].biome]}
              {selected < state.unlockedStage && ` · ${t.hero.replay}`}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost h-11 w-11 shrink-0 px-0"
            aria-label={t.hero.nextStage}
            disabled={running || selected >= state.unlockedStage}
            onClick={() => selectStage(selected + 1)}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>

        <button
          className="btn btn-primary h-12 w-full gap-2"
          disabled={running || state.points < POINTS_PER_RUN}
          onClick={play}
        >
          {running ? t.hero.playing : `${t.hero.play} ${stageName(selected)}`}
          {!running && (
            <span className="flex items-center gap-0.5 font-mono text-[12px] opacity-70">
              <PointsIcon className="h-3.5 w-3.5" />
              {t.hero.playCost}
            </span>
          )}
        </button>

        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-fg-soft">{t.hero.runsAvailable(runsAvailable)}</span>
          <span className="font-mono text-muted">{t.hero.toNext(toNext)}</span>
        </div>
        <div className="h-[3px] rounded-full bg-line" aria-hidden="true">
          <div
            className="h-full rounded-full bg-[#a78bfa] transition-[width] duration-300"
            style={{ width: `${((state.points % POINTS_PER_RUN) / POINTS_PER_RUN) * 100}%` }}
          />
        </div>
        <div className="space-y-0.5 text-[12px] leading-snug text-muted">
          <p>{t.hero.pointsHelp}</p>
          <p>{t.hero.energyAuto}</p>
        </div>

        <ul className="border-t border-line">
          <li className="flex items-center gap-4 border-b border-line py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium" id="hero-auto">
                {t.hero.auto}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{t.hero.autoDesc}</p>
            </div>
            <Switch
              checked={state.auto}
              onChange={(value) => {
                unlockAudio()
                playSound('select')
                void saveGameState({ auto: value })
              }}
              labelledBy="hero-auto"
            />
          </li>
          <li className="flex items-center gap-4 border-b border-line py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium" id="hero-sound">
                {t.hero.battleSound}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{t.hero.battleSoundDesc}</p>
            </div>
            <Switch
              checked={state.battleSound}
              onChange={(value) => {
                unlockAudio()
                setBattleSound(value)
                void saveGameState({ battleSound: value })
              }}
              labelledBy="hero-sound"
            />
          </li>
          <li className="flex items-center gap-4 border-b border-line py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium" id="hero-music">
                {t.hero.music}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{t.hero.musicDesc}</p>
            </div>
            <Switch
              checked={state.music}
              onChange={(value) => {
                unlockAudio()
                setMusicOn(value)
                void saveGameState({ music: value })
              }}
              labelledBy="hero-music"
            />
          </li>
          {!settings.sound && (
            <li className="flex items-center gap-3 border-b border-line py-3.5">
              <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted">{t.hero.soundsOff}</p>
              <button
                type="button"
                className="btn btn-ghost h-9 shrink-0 px-3 text-[13px]"
                onClick={() => {
                  updateSettings({ sound: true })
                  playSound('good', true)
                }}
              >
                {t.hero.soundsOn}
              </button>
            </li>
          )}
          <li className="flex items-center gap-4 border-b border-line py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.hero.speed}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{t.hero.speedDesc}</p>
            </div>
            <div className="w-32 shrink-0">
              <Segmented
                label={t.hero.speed}
                value={String(state.speed)}
                options={[
                  { value: '1', label: '×1' },
                  { value: '2', label: '×2' },
                ]}
                onChange={(value) => {
                  playSound('select')
                  setRunSpeed(Number(value))
                  void saveGameState({ speed: Number(value) })
                }}
              />
            </div>
          </li>
        </ul>
      </div>

      {/* Mapa da Masmorra */}
      <section>
        <p className="label mb-3">{t.hero.stagesTitle}</p>
        <div className="space-y-4">
          {BIOME_ORDER.map((biome) => (
            <div key={biome}>
              <p className="mb-2 text-[13px] font-medium text-fg-soft">{t.hero.biomes[biome]}</p>
              <div className="grid grid-cols-4 gap-2">
                {STAGES.filter((stage) => stage.biome === biome).map((stage) => {
                  const unlocked = stage.index <= state.unlockedStage
                  const isSelected = stage.index === selected
                  const cleared = stage.index < state.unlockedStage || (stage.boss && state.bossDefeated)
                  const label = stageName(stage.index)
                  const lineup = stageLineup(stage.monsters)
                  return (
                    <button
                      key={stage.index}
                      type="button"
                      disabled={!unlocked || running}
                      aria-pressed={isSelected}
                      aria-label={unlocked ? t.hero.selectStage(label) : `${t.hero.stage(label)} · ${t.hero.locked}`}
                      onClick={() => selectStage(stage.index)}
                      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-center transition-colors ${
                        isSelected
                          ? 'border-fg bg-surface-2'
                          : unlocked
                            ? 'border-line bg-surface hover:bg-surface-2'
                            : 'border-line bg-surface opacity-40'
                      }`}
                    >
                      {/* Todos os monstros da fase, na ordem em que aparecem */}
                      <span
                        className={`flex items-end justify-center gap-0.5 ${unlocked ? '' : 'grayscale'}`}
                        title={lineup.map((m) => `${t.hero.monsters[m.id]} ×${m.count}`).join(', ')}
                      >
                        {lineup.map((m) => (
                          <span key={m.id} className="flex flex-col items-center">
                            <MonsterSprite id={m.id} className={MONSTERS[m.id].boss ? 'h-9 w-9' : 'h-6 w-6'} />
                            <span className="h-3 font-mono text-[9px] leading-3 text-muted">{m.count > 1 ? `×${m.count}` : ''}</span>
                          </span>
                        ))}
                      </span>
                      <span className="font-mono text-[12px] font-medium leading-none">{label}</span>
                      {stage.boss && <span className="font-mono text-[10px] leading-none text-muted">{t.hero.boss}</span>}
                      {stage.boss && state.medal > 0 && (
                        <span className="absolute left-1 top-1" title={t.hero.yourMedal(state.medal)}>
                          <MedalIcon className="h-5 w-5 drop-shadow" tier={state.medal} />
                        </span>
                      )}
                      {cleared && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-good" />}
                      {!unlocked && <LockIcon className="absolute left-1.5 top-1.5 h-3 w-3 text-muted" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {state.bossDefeated && <p className="mt-3 text-[13px] text-fg-soft">{t.hero.bossDefeated}</p>}
      </section>

      {/* Ficha do herói */}
      <section>
        <p className="label mb-2">{t.hero.sheet}</p>
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
          <WarriorSprite className="h-16 w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">
                {t.hero.className} · {t.hero.level(state.level)}
              </p>
              <p className="relative flex items-center gap-1 font-mono text-[12px] text-muted">
                <XpIcon className="h-3.5 w-3.5" />
                {state.xp}/{need}
                <GainBubble value={cumulativeXp(state.level, state.xp)} color="#46b7e8" />
              </p>
            </div>
            <div
              className="mt-2 h-1.5 rounded-full bg-line"
              role="progressbar"
              aria-label={t.hero.xp}
              aria-valuemin={0}
              aria-valuemax={need}
              aria-valuenow={state.xp}
            >
              <div
                className="h-full rounded-full bg-[#46b7e8] transition-[width] duration-300"
                style={{ width: `${(state.xp / need) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat icon={<HeartIcon className="h-3.5 w-3.5" />} label={t.hero.hp} value={String(stats.maxHp)} />
          <Stat icon={<SwordIcon className="h-3.5 w-3.5" />} label={t.hero.atk} value={decimal(stats.atk)} />
          <Stat icon={<ShieldIcon className="h-3.5 w-3.5" />} label={t.hero.def} value={decimal(stats.def)} />
          <Stat icon={<CoinIcon className="h-3.5 w-3.5" />} label={t.hero.gold} value={String(state.gold)} />
          <Stat
            icon={<TrophyIcon className="h-3.5 w-3.5" />}
            label={t.hero.record}
            value={t.hero.recordValue(state.wins, state.runs)}
          />
          <Stat icon={<PointsIcon className="h-3.5 w-3.5" />} label={t.hero.totalPoints} value={String(state.totalPoints)} />
        </div>
      </section>

      {/* Acessórios (em breve) */}
      <section>
        <p className="label mb-2">{t.hero.accessories}</p>
        <div className="grid grid-cols-3 gap-2">
          {(['weapon', 'armor', 'charm'] as const).map((slot) => (
            <div
              key={slot}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong px-2 py-4 text-center"
            >
              <p className="text-[13px] font-medium">{t.hero.slots[slot]}</p>
              <p className="font-mono text-[11px] text-muted">{t.hero.soon}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

// ---------- Ganhos ----------

/** Experiência total (somando todos os níveis), para saber quanto entrou. */
function cumulativeXp(level: number, xp: number): number {
  let total = xp
  for (let l = 1; l < level; l++) total += xpToNext(l)
  return total
}

/** Mostra "+N" subindo sempre que o valor aumenta (ouro somando na hora). */
function GainBubble({ value, color }: { value: number; color: string }) {
  const last = useRef(value)
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null)
  useEffect(() => {
    const diff = value - last.current
    last.current = value
    if (diff > 0) {
      setGain({ n: diff, key: Date.now() })
      const id = window.setTimeout(() => setGain(null), 1400)
      return () => window.clearTimeout(id)
    }
  }, [value])
  if (!gain) return null
  return (
    <span key={gain.key} className="hero-pop absolute -bottom-5 right-0 font-mono text-[12px] font-semibold" style={{ color }}>
      +{gain.n}
    </span>
  )
}

// ---------- Energia ----------

/** Contador da próxima recarga de energia (+2 a cada 15 min, até 10). */
function EnergyTimer({ state }: { state: GameState }) {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const due = state.points < ENERGY.cap && state.lastEnergyAt + ENERGY.everyMs <= now
  // Chegou a hora: recarrega na hora (sem esperar a conferência de 20 s)
  useEffect(() => {
    if (due) void regenEnergy().catch(() => undefined)
  }, [due, now])
  if (state.points >= ENERGY.cap) return <p className="font-mono text-[10.5px] text-muted">{t.hero.energyFull}</p>
  const left = Math.max(0, state.lastEnergyAt + ENERGY.everyMs - now)
  const mm = Math.floor(left / 60_000)
  const ss = Math.floor((left % 60_000) / 1000)
  return (
    <p className="font-mono text-[10.5px] text-[#a78bfa]" title={t.hero.energyHelp}>
      {t.hero.energyNext(`${mm}:${String(ss).padStart(2, '0')}`)}
    </p>
  )
}

// ---------- Árvore de evolução ----------

async function buyUpgrade(def: UpgradeDef): Promise<boolean> {
  if (isHeroBusy()) return false
  return db.transaction('rw', db.game, async () => {
    const state = await getGameState()
    const level = state.upgrades[def.id]
    const cost = upgradeCost(def.id, level)
    if (level >= def.max || state.gold < cost) return false
    await db.game.put({ ...state, gold: state.gold - cost, upgrades: { ...state.upgrades, [def.id]: level + 1 } })
    return true
  })
}

const UPGRADE_ICONS: Record<UpgradeId, (p: { className?: string }) => ReactNode> = {
  power: SwordIcon,
  guard: ShieldIcon,
  wisdom: XpIcon,
  fortune: CoinIcon,
}

const UPGRADE_COLORS: Record<UpgradeId, string> = {
  power: '#ff8a5c',
  guard: '#7c95e8',
  wisdom: '#46b7e8',
  fortune: '#f2c54b',
}

function TreeTab({ state, running }: { state: GameState; running: boolean }) {
  const t = useT()

  async function onBuy(def: UpgradeDef) {
    unlockAudio()
    const ok = await buyUpgrade(def)
    playSound(ok ? 'buy' : 'denied')
  }

  const fmt = (n: number) => String(Math.round(n * 1000) / 10).replace('.', t.hero.decimalSep)

  return (
    <>
      {running && <LockedNotice />}
      <section>
        <p className="label mb-2">{t.hero.treeTitle}</p>
        <p className="text-[13px] leading-snug text-muted">{t.hero.treeHelp}</p>
      </section>

      {/* Tronco com quatro galhos */}
      <div className="relative">
        <div className="absolute bottom-0 left-1/2 top-0 w-1 -translate-x-1/2 rounded-full bg-border" aria-hidden="true" />
        <ul className="relative grid grid-cols-2 gap-x-6 gap-y-3">
          {UPGRADES.map((def) => {
            const level = state.upgrades[def.id]
            const maxed = level >= def.max
            const cost = maxed ? 0 : upgradeCost(def.id, level)
            const canBuy = !maxed && state.gold >= cost && !running
            const Icon = UPGRADE_ICONS[def.id]
            const color = UPGRADE_COLORS[def.id]
            return (
              <li key={def.id} className="rounded-2xl border border-line bg-surface p-3.5" style={{ borderTopColor: color }}>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${color}22`, boxShadow: `inset 0 0 0 1px ${color}55` }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium leading-tight">{t.hero.upgradeNames[def.id]}</p>
                    <p className="font-mono text-[11px] text-muted">{t.hero.upgradeLevel(level, def.max)}</p>
                  </div>
                </div>

                {/* Nós do galho (um por nível) */}
                <div className="mt-3 flex flex-wrap gap-[3px]" aria-hidden="true">
                  {Array.from({ length: def.max }, (_, i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: i < level ? color : 'var(--color-line)' }}
                    />
                  ))}
                </div>

                <p className="mt-2.5 text-[12.5px] leading-snug text-fg-soft">
                  {t.hero.upgradeEffect[def.id](fmt(level * def.per))}
                  {!maxed && (
                    <span className="text-muted">
                      {' → '}
                      <span style={{ color }}>{fmt((level + 1) * def.per)}%</span>
                    </span>
                  )}
                </p>

                <button
                  className="btn btn-primary mt-3 h-9 w-full gap-1 px-2 text-[13px]"
                  disabled={!canBuy}
                  onClick={() => void onBuy(def)}
                  title={!maxed && !canBuy ? t.hero.missingGold(cost - state.gold) : undefined}
                >
                  {maxed ? (
                    t.hero.maxed
                  ) : (
                    <>
                      {t.hero.upgrade} · <CoinIcon className="h-3.5 w-3.5" />
                      {cost}
                    </>
                  )}
                </button>
                {!maxed && state.gold < cost && (
                  <p className="mt-1 text-center text-[11px] text-muted">{t.hero.missingGold(cost - state.gold)}</p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

// ---------- Habilidades ----------

function SkillsTab({ state, running }: { state: GameState; running: boolean }) {
  const t = useT()
  const equipped = equippedActives(state)
  /** Habilidade esperando escolher qual equipada ela substitui. */
  const [replacing, setReplacing] = useState<SkillId | null>(null)

  async function onBuy(skill: SkillDef) {
    unlockAudio()
    const ok = await buySkill(skill)
    playSound(ok ? 'buy' : 'denied')
  }

  async function onEquip(id: SkillId) {
    unlockAudio()
    if (equipped.length >= SKILL_SLOTS) {
      setReplacing(id)
      playSound('select')
      return
    }
    await setEquipped(id, true)
    playSound('equip')
  }

  async function onReplace(id: SkillId, old: SkillId) {
    await setEquipped(id, true, old)
    setReplacing(null)
    playSound('equip')
  }

  async function onRemove(id: SkillId) {
    unlockAudio()
    await setEquipped(id, false)
    playSound('equip')
  }

  function card(skill: SkillDef) {
    const learned = state.learned.includes(skill.id)
    const isEquipped = equipped.includes(skill.id)
    const levelOk = state.level >= skill.level
    const goldOk = state.gold >= skill.cost
    const reason = !levelOk
      ? t.hero.needLevelLong(skill.level)
      : !goldOk
        ? t.hero.missingGold(skill.cost - state.gold)
        : null

    return (
      <li
        key={skill.id}
        className={`rounded-2xl border p-4 ${
          isEquipped || (learned && skill.kind === 'passive') ? 'border-fg/50 bg-surface-2' : 'border-line bg-surface'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={learned || levelOk ? '' : 'opacity-50 grayscale'}>
            <SkillIcon id={skill.id} className="h-11 w-11" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-medium">{t.hero.skillNames[skill.id]}</p>
              <span className="rounded-md border border-border-strong px-1.5 py-px font-mono text-[10.5px] text-muted">
                {t.hero.kinds[skill.kind]}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-fg-soft">{t.hero.skillDescs[skill.id]}</p>
            <p className="mt-1 font-mono text-[11px] text-muted">{skill.vsFar ? t.hero.vsFar : skill.cooldownMs ? t.hero.cooldown(skill.cooldownMs / 1000) : skill.every ? t.hero.every(skill.every) : t.hero.always}</p>
          </div>
        </div>

        {/* Requisitos e botões */}
        {!learned ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[12px] ${
                levelOk ? 'border-good/50 text-good' : 'border-again/50 text-again'
              }`}
            >
              <XpIcon className="h-3.5 w-3.5" />
              {t.hero.needLevel(skill.level)}
            </span>
            <span
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[12px] ${
                goldOk ? 'border-good/50 text-good' : 'border-again/50 text-again'
              }`}
            >
              <CoinIcon className="h-3.5 w-3.5" />
              {skill.cost}
            </span>
            <button
              className="btn btn-primary ml-auto h-10 gap-1.5 px-4 text-[14px]"
              disabled={!levelOk || !goldOk}
              onClick={() => void onBuy(skill)}
            >
              <CoinIcon className="h-4 w-4" />
              {t.hero.buy} · {skill.cost}
            </button>
            {reason && <p className="w-full text-right text-[12px] text-muted">{reason}</p>}
          </div>
        ) : skill.kind === 'passive' ? (
          <div className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-good">
            <span className="h-2 w-2 rounded-full bg-good" />
            {t.hero.passiveOn}
          </div>
        ) : isEquipped ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-good">
              <span className="h-2 w-2 rounded-full bg-good" />
              {t.hero.equippedBadge}
            </span>
            <button className="btn btn-ghost ml-auto h-10 px-4 text-[14px]" onClick={() => void onRemove(skill.id)}>
              {t.hero.unequip}
            </button>
          </div>
        ) : replacing === skill.id ? (
          <div className="mt-3 space-y-2">
            <p className="text-[13px] text-fg-soft">{t.hero.replaceWith}</p>
            <div className="flex flex-wrap gap-2">
              {equipped.map((old) => (
                <button
                  key={old}
                  className="btn btn-ghost h-10 gap-2 px-3 text-[13px]"
                  onClick={() => void onReplace(skill.id, old)}
                >
                  <SkillIcon id={old} className="h-5 w-5" />
                  {t.hero.skillNames[old]}
                </button>
              ))}
              <button className="btn h-10 px-3 text-[13px] text-muted" onClick={() => setReplacing(null)}>
                {t.common.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[13px] text-muted">{t.hero.learnedBadge}</span>
            <button className="btn btn-primary ml-auto h-10 px-4 text-[14px]" onClick={() => void onEquip(skill.id)}>
              {t.hero.equip}
            </button>
          </div>
        )}
      </li>
    )
  }

  return (
    <fieldset disabled={running} className={`contents ${running ? '[&_button]:opacity-60' : ''}`}>
      {running && <LockedNotice />}
      <section>
        <p className="mb-3 text-[13px] leading-snug text-muted">{t.hero.skillsHelp}</p>
        <p className="label mb-2">{t.hero.equippedTitle}</p>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: SKILL_SLOTS }, (_, i) => {
            const id = equipped[i]
            const skill = id ? skillDef(id) : null
            return skill ? (
              <div key={i} className="flex items-center gap-2.5 rounded-xl border border-fg/50 bg-surface-2 p-2.5">
                <SkillIcon id={skill.id} className="h-9 w-9 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{t.hero.skillNames[skill.id]}</span>
                  <span className="block font-mono text-[10.5px] text-muted">{t.hero.kinds[skill.kind]}</span>
                </span>
                <button
                  type="button"
                  aria-label={`${t.hero.unequip} ${t.hero.skillNames[skill.id]}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg"
                  onClick={() => void onRemove(skill.id)}
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-xl border border-dashed border-border-strong p-2.5 text-muted"
              >
                <span className="h-9 w-9 shrink-0 rounded-[10px] border border-dashed border-border-strong" />
                <span className="min-w-0">
                  <span className="block text-[13px]">{t.hero.emptySlot}</span>
                  <span className="block font-mono text-[10.5px]">{t.hero.slot(i + 1)}</span>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {(['active', 'passive'] as const).map((kind) => (
        <section key={kind}>
          <p className="label mb-2">{t.hero.kindsPlural[kind]}</p>
          <ul className="space-y-2">{SKILLS.filter((skill) => skill.kind === kind).map(card)}</ul>
        </section>
      ))}
    </fieldset>
  )
}

/** Aviso: durante uma fase não dá para mudar fase, habilidades nem evolução. */
function LockedNotice() {
  const t = useT()
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-hard/40 bg-hard/10 px-3.5 py-2.5 text-[13px] leading-snug text-fg-soft">
      <LockIcon className="h-4 w-4 shrink-0 text-hard" />
      {t.hero.lockedDuringRun}
    </div>
  )
}

// ---------- Monstruário ----------

function monsterInfo(id: MonsterId) {
  const stages = STAGES.filter((stage) => stage.monsters.includes(id)).map((stage) => stage.index)
  const first = monsterStats(id, stages[0] ?? 1)
  const last = monsterStats(id, stages[stages.length - 1] ?? 1)
  return { stages, first, last }
}

const range = (a: number, b: number) => (Math.round(a) === Math.round(b) ? `${Math.round(a)}` : `${Math.round(a)}–${Math.round(b)}`)

function MonsterDetail({
  id,
  boss = false,
  defeated = false,
  medals = 0,
}: {
  id: MonsterId
  boss?: boolean
  defeated?: boolean
  medals?: number
}) {
  const t = useT()
  const base = MONSTERS[id]
  const { stages, first, last } = monsterInfo(id)
  const reach = base.projectile === 'arrow' ? t.hero.rangedBow : base.projectile === 'spear' ? t.hero.rangedSpear : t.hero.melee
  const rows: { icon: ReactNode; label: string; value: string }[] = [
    { icon: <HeartIcon className="h-4 w-4" />, label: t.hero.hp, value: range(first.maxHp, last.maxHp) },
    { icon: <SwordIcon className="h-4 w-4" />, label: t.hero.damage, value: range(first.atk, last.atk) },
    { icon: <ShieldIcon className="h-4 w-4" />, label: t.hero.def, value: String(base.def) },
    { icon: <XpIcon className="h-4 w-4" />, label: t.hero.xp, value: range(first.xp, last.xp) },
    {
      icon: <CoinIcon className="h-4 w-4" />,
      label: t.hero.gold,
      value: range(monsterGold(first.xp, base.boss), monsterGold(last.xp, base.boss)),
    },
  ]
  return (
    <div
      className={`rounded-2xl border p-4 ${boss ? 'border-[#f2c54b]/60 bg-[#f2c54b]/[0.06]' : 'border-fg/40 bg-surface-2'}`}
    >
      <div className="flex items-center gap-4">
        <MonsterSprite id={id} className={boss ? 'h-28 w-28 shrink-0' : 'h-20 w-20 shrink-0'} />
        <div className="min-w-0">
          {boss && <p className="label mb-1 text-[#f2c54b]">{t.hero.bossTitle}</p>}
          <p className="text-lg font-semibold leading-tight">{t.hero.monsters[id]}</p>
          <p
            className={`mt-1.5 inline-flex rounded-md border px-1.5 py-0.5 text-[12px] ${
              base.projectile ? 'border-hard/60 text-hard' : 'border-border-strong text-fg-soft'
            }`}
          >
            {reach}
          </p>
          {base.flying && <p className="mt-1 text-[12px] text-muted">{t.hero.flies}</p>}
          {boss && <p className="mt-1 text-[12px] text-muted">{defeated ? t.hero.defeated : t.hero.notDefeated}</p>}
          {boss && medals > 0 && <p className="mt-1 text-[12px] text-muted">{t.hero.bossWins(medals)}</p>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-line bg-surface px-3 py-2">
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              {row.icon}
              {row.label}
            </p>
            <p className="mt-1 font-mono text-[16px] font-medium leading-none">{row.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-muted">
        {t.hero.appearsIn}: {stages.map(stageName).join(' · ')}
        {boss &&
          ` · ${t.hero.escort}: ${STAGES[STAGE_COUNT - 1].monsters
            .filter((m) => !MONSTERS[m].boss)
            .map((m) => t.hero.monsters[m])
            .filter((name, i, all) => all.indexOf(name) === i)
            .join(', ')}`}
      </p>
      {stages.length > 1 && <p className="mt-1 text-[11px] text-muted">{t.hero.statsRangeNote}</p>}
    </div>
  )
}

function MonstersTab({ state }: { state: GameState }) {
  const t = useT()
  const [params, setParams] = useSearchParams()
  // A visão vem do endereço: o link "Registrar" (?chefe=1) abre o chefe mesmo com esta aba já aberta
  const view: 'monsters' | 'boss' = params.get('chefe') ? 'boss' : 'monsters'
  const setView = (next: 'monsters' | 'boss') =>
    setParams(next === 'boss' ? { aba: 'monstros', chefe: '1' } : { aba: 'monstros' }, { replace: true })
  const [selected, setSelected] = useState<MonsterId | null>(null)

  return (
    <>
      <Segmented
        label={t.hero.tabs.monsters}
        value={view}
        options={[
          { value: 'monsters', label: t.hero.monstersTab },
          { value: 'boss', label: `👑 ${t.hero.bossTab}` },
        ]}
        onChange={(v) => {
          playSound('select')
          setView(v)
        }}
      />

      {view === 'monsters' ? (
        <div className="space-y-5">
          <p className="text-[13px] text-muted">{t.hero.tapHint}</p>
          {BIOME_ORDER.map((biome) => {
            const ids = [
              ...new Set(STAGES.filter((s) => s.biome === biome).flatMap((s) => s.monsters)),
            ].filter((id) => !MONSTERS[id].boss)
            return (
              <section key={biome}>
                <p className="mb-2 text-[13px] font-medium text-fg-soft">{t.hero.biomes[biome]}</p>
                <div className="grid grid-cols-3 gap-2">
                  {ids.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={selected === id}
                      onClick={() => {
                        playSound('select')
                        setSelected(selected === id ? null : id)
                      }}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center transition-colors ${
                        selected === id ? 'border-fg bg-surface-2' : 'border-line bg-surface hover:bg-surface-2'
                      }`}
                    >
                      <MonsterSprite id={id} className="h-12 w-12" />
                      <span className="text-[12px] font-medium leading-tight">{t.hero.monsters[id]}</span>
                      <span className="font-mono text-[10px] text-muted">
                        {MONSTERS[id].projectile ? t.hero.rangedShort : t.hero.meleeShort}
                      </span>
                    </button>
                  ))}
                </div>
                {selected && ids.includes(selected) && (
                  <div className="mt-2">
                    <MonsterDetail id={selected} />
                  </div>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <>
          <BossPodium state={state} />
          <MonsterDetail id="goblinKing" boss defeated={state.bossDefeated} medals={state.bossKills} />
          <section>
            <p className="label mb-2">{t.hero.bossSkillsTitle}</p>
            <ul className="space-y-2">
              {BOSS_SKILLS.map((skill) => (
                <li key={skill} className="rounded-xl border border-[#f2c54b]/30 bg-surface px-3.5 py-3">
                  <p className="font-medium">{t.hero.bossSkillNames[skill]}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted">{t.hero.bossSkillDescs[skill]}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}

// ---------- Pódio mundial do chefe ----------

/** Os 3 primeiros jogadores do mundo a vencer o Rei Goblin, e o registro da sua vitória. */
function BossPodium({ state }: { state: GameState }) {
  const t = useT()
  const [podium, setPodium] = useState<PodiumEntry[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [name, setName] = useState(state.medalName ?? '')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const online = onlineConfigured()
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!online) return
    let active = true
    fetchBossPodium()
      .then((list) => {
        if (!active) return
        setPodium(list)
        setLoadError(false)
        // O servidor manda: medalha zerada lá some daqui (e volta, se for o caso)
        void syncMedal(list).catch(() => undefined)
      })
      .catch(() => active && setLoadError(true))
    return () => {
      active = false
    }
  }, [online, state.medal, reload])

  /** Onde a caixinha do CAPTCHA aparece, se o Turnstile pedir um clique. */
  const captchaBox = useRef<HTMLDivElement>(null)

  async function claim() {
    const nickname = cleanNickname(name)
    if (nickname.length < 2 || sending) return
    setSending(true)
    setMessage(null)
    unlockAudio()
    try {
      const rank = await claimBossMedal(nickname, captchaBox.current ?? undefined)
      await saveGameState({ medal: rank, medalPending: false, medalName: nickname })
      setMessage(rank > 0 ? t.hero.claimWon(rank) : t.hero.claimTooLate)
      playSound(rank > 0 ? 'levelUp' : 'select')
      setReload((n) => n + 1)
    } catch (err) {
      setMessage(String((err as Error)?.message).startsWith('captcha') ? t.hero.claimCaptchaError : t.hero.claimError)
      playSound('denied')
    } finally {
      setSending(false)
    }
  }

  const slots = [1, 2, 3].map((rank) => podium?.find((p) => p.rank === rank))

  return (
    <section className="rounded-2xl border border-[#f2c54b]/40 bg-surface p-4">
      <p className="label mb-1 text-[#f2c54b]">{t.hero.podiumTitle}</p>
      <p className="text-[13px] leading-snug text-muted">{t.hero.podiumHelp}</p>

      {!online ? (
        <p className="mt-3 rounded-xl border border-dashed border-border-strong px-3 py-2.5 text-[13px] text-fg-soft">
          {t.hero.podiumOff}
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {slots.map((entry, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
              <MedalIcon className="h-7 w-7 shrink-0" tier={i + 1} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-muted">{t.hero.medalTier(i + 1)}</span>
                <span className={`block truncate font-medium ${entry ? '' : 'text-muted'}`}>
                  {podium === null && !loadError ? t.hero.podiumLoading : entry ? entry.nickname : t.hero.podiumEmpty}
                </span>
              </span>
              {entry && (
                <span className="font-mono text-[11px] text-muted">
                  {new Date(entry.created_at).toLocaleDateString(t.date.locale)}
                </span>
              )}
            </li>
          ))}
          {loadError && <p className="text-[12px] text-again">{t.hero.podiumError}</p>}
        </ol>
      )}

      {state.medal > 0 && (
        <p className="mt-3 flex items-center gap-2 text-[14px] font-medium" style={{ color: MEDAL_COLORS[state.medal].fill }}>
          <MedalIcon className="h-6 w-6" tier={state.medal} />
          {t.hero.yourMedal(state.medal)}
        </p>
      )}

      {/* Registro da vitória */}
      {state.medalPending && state.medal === 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="font-medium">{t.hero.claimTitle}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">{online ? t.hero.claimText : t.hero.claimOff}</p>
          {online && (
            <div className="mt-3 flex gap-2">
              <input
                className="field h-10 flex-1"
                maxLength={24}
                placeholder={t.hero.claimName}
                aria-label={t.hero.claimName}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="btn btn-primary h-10 shrink-0 px-4"
                disabled={sending || cleanNickname(name).length < 2}
                onClick={() => void claim()}
              >
                {sending ? t.hero.claimSending : t.hero.claimButton}
              </button>
            </div>
          )}
          {online && <div ref={captchaBox} className="mt-3 empty:hidden" />}
        </div>
      )}
      {message && <p className="mt-3 text-[13px] leading-snug text-fg-soft">{message}</p>}
    </section>
  )
}

// ---------- Ferramentas de dev ----------

/**
 * Ferramentas de teste. Só aparecem no `npm run dev`
 * (somem sozinhas na versão publicada).
 */
function DevPanel({ state, disabled }: { state: GameState; disabled: boolean }) {
  const actions: { label: string; run: () => Promise<unknown> | void; confirm?: string }[] = [
    { label: '+1000 pontos', run: () => saveGameState({ points: state.points + 1000, totalPoints: state.totalPoints + 1000 }) },
    { label: 'Pontos ilimitados', run: () => saveGameState({ points: 999_999 }) },
    { label: 'Zerar pontos', run: () => saveGameState({ points: 0, lastEnergyAt: Date.now() }) },
    { label: 'Adiantar recarga (15 min)', run: () => saveGameState({ lastEnergyAt: state.lastEnergyAt - ENERGY.everyMs }) },
    { label: 'Zerar evolução', run: () => saveGameState({ upgrades: { ...NO_UPGRADES } }) },
    {
      label: 'Simular vitória no chefe',
      run: () => saveGameState({ bossKills: state.bossKills + 1, bossDefeated: true, medalPending: state.medal === 0 }),
    },
    { label: 'Limpar medalha (só local)', run: () => saveGameState({ medal: 0, medalPending: false }) },
    { label: '+1000 ouro', run: () => saveGameState({ gold: state.gold + 1000 }) },
    { label: 'Zerar ouro', run: () => saveGameState({ gold: 0 }) },
    { label: '+1 nível', run: () => saveGameState({ level: state.level + 1, xp: 0 }) },
    {
      label: 'Zerar XP, nível, ataque e defesa',
      confirm: 'Voltar o herói para o nível 1 (vida, ataque e defesa do nível 1)?',
      run: () => saveGameState({ level: 1, xp: 0 }),
    },
    { label: 'Liberar todas as fases', run: () => saveGameState({ unlockedStage: STAGE_COUNT }) },
    {
      label: 'Bloquear fases (voltar à 1.1)',
      run: () => saveGameState({ unlockedStage: 1, selectedStage: 1, bossDefeated: false }),
    },
    { label: 'Esquecer habilidades', run: () => saveGameState({ learned: [], equipped: [] }) },
    { label: 'Aprender todas as habilidades', run: () => saveGameState({ learned: SKILLS.map((skill) => skill.id) }) },
    {
      label: 'Zerar herói',
      confirm: 'Zerar TUDO do herói (nível, ouro, fases, habilidades e pontos)?',
      run: () => db.game.put(newGameState()),
    },
  ]
  return (
    <section className="rounded-2xl border border-dashed border-hard/60 p-4">
      <p className="label mb-1">Ferramentas de dev</p>
      <p className="mb-3 text-[12px] text-muted">Só aparecem no npm run dev. Não vão para a versão publicada.</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            className="btn btn-ghost h-9 px-3 text-[13px]"
            disabled={disabled}
            onClick={() => {
              if (action.confirm && !window.confirm(action.confirm)) return
              void action.run()
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  )
}
