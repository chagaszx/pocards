import { liveQuery } from 'dexie'
import { db, getGameState, regenEnergy, withGameDefaults } from '../db/db'
import type { ActiveRun, GameState } from '../db/types'
import { getSettings, subscribeSettings } from '../lib/settings'
import { currentMusic, playMusic, type MusicTrack } from '../lib/music'
import {
  createBattleLine,
  dropBattleLine,
  onAudioRunning,
  scheduleBattleSound,
  setBattleSoundEnabled,
  type SoundName,
} from '../lib/sound'
import { ENERGY, POINTS_PER_RUN, SKILLS, STAGES, xpToNext, type MonsterId, type SkillId } from './data'
import { activeLoadout, simulateRun, type RunResult } from './engine'
import { syncMedalFromServer } from './medal'

/**
 * "Motor" do modo Herói que vive fora das telas: a luta continua enquanto a
 * pessoa estuda ou navega por outras abas do app (e com a aba do navegador
 * em segundo plano). Ouro e experiência entram a cada inimigo derrotado.
 *
 * A luta é sorteada inteira no começo e fica salva no banco (activeRuns). Se o
 * app fechar ou recarregar no meio, o que faltava é pago na próxima abertura.
 */

/** Tempo que o resultado fica na tela antes da próxima fase. */
export const RESULT_MS = 1700

export interface HeroRun {
  id: number
  result: RunResult
  /** performance.now() do início. */
  startedAt: number
  speed: number
  /** Momentos (ms da luta) em que o herói sobe de nível, para a animação. */
  levelUps: { at: number; level: number }[]
  /** Habilidades equipadas nesta luta. */
  loadout: SkillId[]
}

/** Linha de áudio com os sons agendados da luta atual. */
let soundLine: GainNode | null = null
/** Solta a trava da luta atual (as outras abas sabem que ela está viva enquanto a trava existe). */
let runLock: (() => void) | null = null
let disposed = false
let pumpTimer: number | null = null
let liveSub: { unsubscribe(): void } | null = null
let regenTimer: number | null = null
/** Cancela os avisos de Configurações e do áudio liberado. */
let settingsSub: (() => void) | null = null
let audioSub: (() => void) | null = null

type NoticeInput =
  | { kind: 'levelUp'; level: number }
  | { kind: 'skill'; skill: SkillId }
  | { kind: 'bossWin'; count: number; pending: boolean }
export type HeroNotice = NoticeInput & { id: number }

let current: HeroRun | null = null
let processed = 0
let starting = false
/**
 * Esta aba comanda o herói? Quem comanda é a aba que a pessoa está usando:
 * ao abrir, focar ou tocar numa aba, ela assume e as outras param de jogar
 * (a fase que já estava rolando nelas termina em silêncio, sem perder nada).
 */
let leader = true
const tabId = Math.random().toString(36).slice(2)
let channel: BroadcastChannel | null = null
let initialized = false
let enabled = true
let latest: GameState | null = null
/** Gravações no banco em fila, uma depois da outra. */
let chain: Promise<unknown> = Promise.resolve()

const runListeners = new Set<() => void>()
const noticeListeners = new Set<(notice: HeroNotice) => void>()

export function getHeroRun(): HeroRun | null {
  return current
}

export function subscribeHeroRun(listener: () => void): () => void {
  runListeners.add(listener)
  return () => runListeners.delete(listener)
}

export function subscribeHeroNotices(listener: (notice: HeroNotice) => void): () => void {
  noticeListeners.add(listener)
  return () => noticeListeners.delete(listener)
}

/** Quanto da luta já passou (ms do tempo do jogo). */
export function runElapsed(run: HeroRun, now = performance.now()): number {
  return (now - run.startedAt) * run.speed
}

const emitRun = () => runListeners.forEach((listener) => listener())
const notify = (notice: NoticeInput) => {
  const full: HeroNotice = { ...notice, id: Date.now() + Math.random() }
  noticeListeners.forEach((listener) => listener(full))
}

// ---------- Sons ----------

interface Cue {
  at: number
  sound: SoundName
}

function deathSound(monster: MonsterId | null): SoundName {
  if (monster === 'slime' || monster === 'bigSlime') return 'slimeDeath'
  if (monster === 'skeleton') return 'boneDeath'
  if (monster === 'goblinKing') return 'bossDeath'
  return 'monsterDeath'
}

function buildCues(run: HeroRun): Cue[] {
  const { result } = run
  const cues: Cue[] = []
  let monster: MonsterId | null = null
  let berserkFrom: number | null = null
  for (const event of result.events) {
    switch (event.kind) {
      case 'spawn':
        monster = event.monster
        for (let at = event.at + 80; at < event.at + event.approach - 100; at += 300) cues.push({ at, sound: 'step' })
        break
      case 'heroHit':
        cues.push({ at: event.at - 90, sound: 'swing' })
        if (event.skill === 'quake') cues.push({ at: event.at, sound: 'quake' })
        cues.push({ at: event.at, sound: event.crit || event.skill ? 'crit' : 'hit' })
        break
      case 'heroHeal':
        cues.push({ at: event.at, sound: 'warCry' }, { at: event.at + 200, sound: 'heal' })
        break
      case 'bossSkill':
        if (event.skill === 'royalCharge') cues.push({ at: event.at, sound: 'charge' }, { at: event.at + 60, sound: 'bossRoar' })
        if (event.skill === 'kingsCry') cues.push({ at: event.at, sound: 'bossRoar' }, { at: event.at + 250, sound: 'heal' })
        if (event.skill === 'stomp') cues.push({ at: event.at + 200, sound: 'quake' })
        if (event.skill === 'kingsRage') cues.push({ at: event.at, sound: 'bossRoar' }, { at: event.at + 150, sound: 'lava' })
        break
      case 'charge':
        cues.push({ at: event.at - 60, sound: 'skill' }, { at: event.at, sound: 'charge' })
        for (let at = event.at + 60; at < event.until; at += 110) cues.push({ at, sound: 'step' })
        break
      case 'berserk':
        if (event.on) {
          berserkFrom = event.at
          cues.push({ at: event.at, sound: 'lava' })
        } else if (berserkFrom !== null) {
          // Chiado de lava enquanto a Fúria estiver ligada
          for (let at = berserkFrom + 1100; at < event.at; at += 1100) cues.push({ at, sound: 'lavaLoop' })
          berserkFrom = null
        }
        break
      case 'monsterHit':
        if (event.projectile) {
          cues.push({ at: event.at - event.flight, sound: event.projectile === 'arrow' ? 'bow' : 'throw' })
          cues.push({ at: event.at, sound: 'projectileHit' })
        } else {
          cues.push({ at: event.at - 70, sound: 'bite' })
        }
        cues.push({ at: event.at + 20, sound: 'hurt' })
        break
      case 'monsterDie':
        cues.push({ at: event.at, sound: deathSound(monster) }, { at: event.at + 260, sound: 'coin' })
        break
      case 'heroDie':
        cues.push({ at: event.at, sound: 'heroDeath' })
        break
      case 'end':
        cues.push({ at: event.at + 120, sound: event.won ? 'victory' : 'defeat' })
        break
    }
  }
  for (const up of run.levelUps) cues.push({ at: up.at + 350, sound: 'levelUp' })
  return cues
}

/** Agenda os sons da luta a partir do momento `from` (descarta os agendados antes). */
function scheduleSounds(run: HeroRun, from = 0) {
  dropBattleLine(soundLine)
  soundLine = null
  if (!leader || !getSettings().sound || !(latest?.battleSound ?? true)) return
  soundLine = createBattleLine()
  if (!soundLine) return
  for (const cue of buildCues(run)) {
    if (cue.at >= from - 30) scheduleBattleSound(cue.sound, (cue.at - from) / run.speed, soundLine)
  }
}

/** Liga/desliga os sons da batalha na hora (também os da luta em andamento). */
export function setBattleSound(on: boolean) {
  setBattleSoundEnabled(on)
  if (latest) latest = { ...latest, battleSound: on }
  if (!on) {
    dropBattleLine(soundLine)
    soundLine = null
  } else if (current) {
    scheduleSounds(current, runElapsed(current))
  }
}

/** Muda a velocidade na hora, inclusive da luta em andamento. */
export function setRunSpeed(speed: number) {
  if (latest) latest = { ...latest, speed }
  const run = current
  if (!run || run.speed === speed) return
  const elapsed = runElapsed(run)
  run.speed = speed
  run.startedAt = performance.now() - elapsed / speed
  scheduleSounds(run, elapsed)
  emitRun()
}

/** Liga/desliga a música na hora. */
export function setMusicOn(on: boolean) {
  if (latest) latest = { ...latest, music: on }
  if (!on) {
    playMusic(null, true)
  } else {
    updateMusic(true)
  }
}

// ---------- Música ----------

/**
 * Fase cuja música está tocando. Escolhida quando a música começa e trocada só
 * quando a pessoa escolhe outra fase com as setas ou no mapa: começar ou
 * terminar uma fase (ou liberar a próxima) não mexe na música.
 */
let musicStage: number | null = null

function desiredTrack(): MusicTrack | null {
  if (!leader || !enabled || !latest || !latest.music || !getSettings().sound) return null
  musicStage ??= Math.min(latest.selectedStage, latest.unlockedStage)
  const def = STAGES[Math.min(Math.max(musicStage, 1), STAGES.length) - 1]
  return def.boss ? 'boss' : def.biome
}

/** Toca a música sem parar (só para se a pessoa desligar). */
function updateMusic(quick = false) {
  const track = desiredTrack()
  if (track) playMusic(track, quick)
  else if (currentMusic()) playMusic(null, true)
}

/** A pessoa escolheu outra fase: a música passa a ser a do ambiente dela. */
export function chooseMusicStage(stage: number): void {
  musicStage = stage
  updateMusic()
}

/** A aba Herói avisa quando abre/fecha (a música da fase escolhida toca nela). */
export function setHeroPageOpen(_open: boolean): void {
  updateMusic()
}

/** Há uma fase em andamento? (fase, habilidades e evolução ficam travadas) */
export function isHeroBusy(): boolean {
  return current != null || starting
}

// ---------- Recompensas ----------

interface Payout {
  fromLevel: number
  level: number
  learned: SkillId[]
  bossKill: boolean
  bossKills: number
  pending: boolean
}

/**
 * Paga as recompensas da luta salva, de `saved.processed` até o acontecimento `to`:
 * ouro e experiência de cada monstro derrotado e, no fim, o bônus da fase, a
 * vitória e a próxima fase. Devolve o herói atualizado (sem gravar).
 */
function payRun(state: GameState, saved: ActiveRun, to: number): { next: GameState; payout: Payout } {
  const { result } = saved
  const events = result.events
  const end = Math.min(to, events.length)
  let xpGain = 0
  let goldGain = 0
  let ended = false
  for (let i = saved.processed; i < end; i++) {
    const event = events[i]
    if (event.kind === 'monsterDie') {
      xpGain += event.xp
      goldGain += event.gold
    } else if (event.kind === 'end') {
      ended = true
    }
  }
  const next: GameState = { ...state }
  const bossKill = ended && result.won && STAGES[result.stage - 1]?.boss === true
  if (ended) {
    xpGain += result.clearXp
    goldGain += result.clearGold
    next.runs += 1
    next.wins += result.won ? 1 : 0
    next.unlockedStage = Math.max(next.unlockedStage, result.unlocked ?? 0)
    next.bossDefeated = next.bossDefeated || result.bossDefeatedNow
    // Venceu a fase escolhida: a próxima já fica escolhida
    if (result.unlocked && next.selectedStage === result.stage) next.selectedStage = result.unlocked
    if (bossKill) {
      next.bossKills += 1
      // Primeira vitória sem medalha: pode registrar no ranking mundial
      if (next.medal === 0) next.medalPending = true
    }
  }
  let level = next.level
  let xp = next.xp + xpGain
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level += 1
  }
  next.level = level
  next.xp = xp
  next.gold += goldGain
  const others = (state.activeRuns ?? []).filter((run) => run.id !== saved.id)
  next.activeRuns = end >= events.length ? others : [...others, { ...saved, processed: end }]
  return {
    next,
    payout: { fromLevel: state.level, level, learned: state.learned, bossKill, bossKills: next.bossKills, pending: next.medalPending },
  }
}

/** Avisa novos níveis, habilidades liberadas e vitória contra o chefe. */
function announce({ fromLevel, level, learned, bossKill, bossKills, pending }: Payout) {
  if (level > fromLevel) {
    notify({ kind: 'levelUp', level })
    for (const skill of SKILLS) {
      if (skill.level > fromLevel && skill.level <= level && !learned.includes(skill.id)) {
        notify({ kind: 'skill', skill: skill.id })
      }
    }
  }
  if (bossKill) notify({ kind: 'bossWin', count: bossKills, pending })
}

/** Grava o que a luta já pagou até o acontecimento `to` (em fila: uma gravação por vez). */
function payUpTo(runId: number, to: number): Promise<unknown> {
  chain = chain
    .then(() =>
      db.transaction('rw', db.game, async () => {
        const state = await getGameState()
        const saved = state.activeRuns?.find((run) => run.id === runId)
        // Já foi paga (por outra aba ou depois de recarregar) ou o herói foi zerado
        if (!saved || saved.processed >= to) return null
        const { next, payout } = payRun(state, saved, to)
        await db.game.put(next)
        return payout
      }),
    )
    .then((payout) => payout && announce(payout))
    .catch((err) => console.error('Erro ao salvar o herói:', err))
  return chain
}

/** Segura uma trava (Web Locks) enquanto a luta roda; ela some sozinha se a aba fechar. */
function lockRun(id: number): Promise<(() => void) | null> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) return Promise.resolve(null)
  return new Promise((granted) => {
    locks
      .request(`pocards-run-${id}`, () => new Promise<void>((release) => granted(release)))
      .catch(() => granted(null))
  })
}

/** Executa `fn` só se nenhuma aba estiver rodando esta luta (ela ficou pela metade). */
async function whenOrphan(saved: ActiveRun, fn: () => Promise<unknown>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (locks) {
    await locks.request(`pocards-run-${saved.id}`, { ifAvailable: true }, async (lock) => {
      if (lock) await fn()
    })
  } else if (Date.now() - saved.startedAt > saved.result.duration + 60_000) {
    // Sem Web Locks: espera passar o tempo da luta (em ×1) com folga
    await fn()
  }
}

/**
 * Fases que ficaram pela metade (o app fechou ou recarregou no meio da luta):
 * paga o que faltava, como se a luta tivesse terminado.
 */
async function settleOrphanRuns(): Promise<void> {
  const state = await getGameState()
  for (const saved of state.activeRuns ?? []) {
    if (current?.id === saved.id) continue
    await whenOrphan(saved, () => payUpTo(saved.id, saved.result.events.length))
  }
}

/** Momentos em que o herói vai subir de nível nesta luta. */
function planLevelUps(state: GameState, result: RunResult): { at: number; level: number }[] {
  const ups: { at: number; level: number }[] = []
  let level = state.level
  let xp = state.xp
  const gain = (amount: number, at: number) => {
    xp += amount
    while (xp >= xpToNext(level)) {
      xp -= xpToNext(level)
      level += 1
      ups.push({ at, level })
    }
  }
  for (const event of result.events) {
    if (event.kind === 'monsterDie') gain(event.xp, event.at)
    if (event.kind === 'end' && event.won) gain(result.clearXp, event.at)
  }
  return ups
}

// ---------- Ciclo da luta ----------

function pump() {
  pumpTimer = null
  if (disposed) return
  const run = current
  if (!run) return
  const elapsed = runElapsed(run)
  const events = run.result.events
  const from = processed
  while (processed < events.length && events[processed].at <= elapsed) processed += 1
  // Ouro e XP de quem caiu; no fim, bônus da fase, vitória e próxima fase
  if (processed > from) void payUpTo(run.id, processed)
  if (elapsed >= run.result.duration + RESULT_MS) {
    current = null
    processed = 0
    dropBattleLine(soundLine)
    soundLine = null
    // Solta a trava depois que tudo foi gravado
    const release = runLock
    runLock = null
    void chain.then(() => release?.())
    emitRun()
    updateMusic()
    // Próxima fase no automático
    window.setTimeout(() => void maybeAutoStart(), 400)
    return
  }
  // Em segundo plano o navegador espaça os timers; o tempo é pelo relógio, então nada se perde.
  pumpTimer = window.setTimeout(pump, 120)
}

/** Começa uma fase (gasta 4 pontos). */
export async function startHeroRun(): Promise<boolean> {
  claimLeadership()
  if (current || starting || !enabled) return false
  starting = true
  let release: (() => void) | null = null
  try {
    await chain
    const state = await getGameState()
    if (state.points < POINTS_PER_RUN) return false
    const stage = Math.min(state.selectedStage, state.unlockedStage)
    const result = simulateRun(state, stage)
    const id = Date.now() * 1000 + Math.floor(Math.random() * 1000)
    // A trava avisa as outras abas (e a próxima abertura do app) que esta luta está viva
    release = await lockRun(id)
    const ok = await db.transaction('rw', db.game, async () => {
      const fresh = await getGameState()
      // Confere de novo aqui dentro: outra aba pode ter acabado de gastar a energia
      if (fresh.points < POINTS_PER_RUN) return false
      await db.game.put({
        ...fresh,
        points: fresh.points - POINTS_PER_RUN,
        // Saiu do máximo: o relógio da recarga começa a contar agora
        lastEnergyAt: fresh.points >= ENERGY.cap ? Date.now() : fresh.lastEnergyAt,
        // A luta fica salva para nada se perder se o app fechar no meio
        activeRuns: [...(fresh.activeRuns ?? []), { id, result, processed: 0, startedAt: Date.now() }],
      })
      return true
    })
    if (!ok || disposed) return false
    const run: HeroRun = {
      id,
      result,
      startedAt: performance.now(),
      speed: state.speed,
      levelUps: planLevelUps(state, result),
      loadout: activeLoadout(state),
    }
    current = run
    runLock = release
    release = null
    processed = 0
    scheduleSounds(run)
    emitRun()
    updateMusic()
    pump()
    return true
  } finally {
    // Não começou: solta a trava (se a luta já estava salva, ela é paga na próxima abertura)
    release?.()
    starting = false
  }
}

async function maybeAutoStart() {
  if (disposed || !leader || !enabled || current || starting) return
  const state = latest ?? (await getGameState())
  if (state.auto && state.points >= POINTS_PER_RUN) await startHeroRun()
}

/** Esta aba assume o comando do herói (e avisa as outras). */
function claimLeadership() {
  channel?.postMessage({ type: 'claim', id: tabId })
  if (leader) return
  leader = true
  updateMusic()
  void maybeAutoStart()
}

/** Outra aba assumiu: esta para de tocar e não começa novas fases. */
function yieldLeadership() {
  if (!leader) return
  leader = false
  dropBattleLine(soundLine)
  soundLine = null
  playMusic(null, true)
}

const onVisible = () => {
  if (document.visibilityState === 'visible') claimLeadership()
}

function setupTabLeadership() {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('pocards-hero')
    channel.onmessage = (event: MessageEvent<{ type: string; id: string }>) => {
      if (event.data?.type === 'claim' && event.data.id !== tabId) yieldLeadership()
    }
  }
  // Ao abrir, a aba visível assume; depois, quem for focada ou tocada.
  if (document.visibilityState === 'visible') claimLeadership()
  else leader = false
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', claimLeadership)
  window.addEventListener('pointerdown', claimLeadership, { capture: true, passive: true })
}

/**
 * Liga o motor (chamado uma vez quando o app abre). A aba em uso comanda o herói,
 * para não gastar pontos em dobro nem tocar sons numa aba escondida.
 */
export function initHeroRunner(): void {
  if (initialized) return
  initialized = true
  setupTabLeadership()
  // Fases que ficaram pela metade (o app fechou no meio): paga o que faltava
  void settleOrphanRuns().catch((err) => console.error('Erro ao terminar a fase pendente:', err))
  // Medalha do ranking: confere com o servidor (só para quem já registrou neste aparelho)
  void syncMedalFromServer().catch(() => undefined)
  // Recarga de energia: confere agora e a cada 20 s
  void regenEnergy().catch(() => undefined)
  regenTimer = window.setInterval(() => {
    void regenEnergy().catch(() => undefined)
    void settleOrphanRuns().catch(() => undefined)
  }, 20_000)
  liveSub = liveQuery(() => db.game.get('main')).subscribe({
    next: (saved) => {
      latest = saved ? withGameDefaults(saved) : null
      if (latest) setBattleSoundEnabled(latest.battleSound)
      updateMusic()
      void maybeAutoStart()
    },
    error: (err) => console.error('Erro ao ler o herói:', err),
  })
  // Sons ligados/desligados em Configurações: música e batalha obedecem na hora
  let soundOn = getSettings().sound
  settingsSub = subscribeSettings(() => {
    const on = getSettings().sound
    if (on === soundOn) return
    soundOn = on
    if (current) scheduleSounds(current, runElapsed(current))
    updateMusic(true)
  })
  // O navegador liberou o áudio (primeiro toque) no meio de uma luta: os sons dela voltam dali em diante
  audioSub = onAudioRunning(() => {
    if (current && !soundLine) scheduleSounds(current, runElapsed(current))
  })
}

/** Liga/desliga o modo Herói inteiro (a luta atual termina normalmente). */
export function setHeroRunnerEnabled(on: boolean): void {
  enabled = on
  updateMusic()
  if (on) void maybeAutoStart()
}

/** Fase atual para mostrar quando não há luta. */
export function stageBiome(stage: number) {
  return STAGES[Math.min(Math.max(stage, 1), STAGES.length) - 1].biome
}

// Ao recarregar o código no `npm run dev`, desliga este motor para não ficar
// um motor antigo rodando junto com o novo (sons e lutas em dobro).
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true
    if (pumpTimer != null) window.clearTimeout(pumpTimer)
    liveSub?.unsubscribe()
    settingsSub?.()
    audioSub?.()
    if (regenTimer != null) window.clearInterval(regenTimer)
    channel?.close()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', claimLeadership)
    window.removeEventListener('pointerdown', claimLeadership, { capture: true })
    dropBattleLine(soundLine)
    soundLine = null
    current = null
    // Solta a trava: o motor novo termina de pagar esta luta
    runLock?.()
    runLock = null
    playMusic(null, true)
  })
}
