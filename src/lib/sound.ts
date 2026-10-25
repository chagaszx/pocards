import { getSettings } from './settings'

/**
 * Efeitos sonoros curtos, gerados na hora com a Web Audio API
 * (sem arquivos de áudio: nada para baixar e funciona offline).
 */
export type SoundName =
  | 'flip'
  | 'again'
  | 'hard'
  | 'good'
  | 'easy'
  | 'complete'
  | 'add'
  // Modo Herói
  | 'swing'
  | 'hit'
  | 'crit'
  | 'bite'
  | 'hurt'
  | 'bow'
  | 'throw'
  | 'projectileHit'
  | 'monsterDeath'
  | 'slimeDeath'
  | 'boneDeath'
  | 'bossDeath'
  | 'heroDeath'
  | 'coin'
  | 'skill'
  | 'charge'
  | 'warCry'
  | 'lava'
  | 'lavaLoop'
  | 'bossRoar'
  | 'heal'
  | 'quake'
  | 'step'
  | 'levelUp'
  | 'victory'
  | 'defeat'
  | 'buy'
  | 'equip'
  | 'select'
  | 'denied'

let context: AudioContext | null = null
/** Saída usada pelos sons agendados da batalha (permite silenciá-los de uma vez). */
let output: AudioNode | null = null
let battleBus: GainNode | null = null
const runningListeners = new Set<() => void>()

/**
 * Avisa quando o navegador libera o áudio. Os navegadores só deixam tocar som
 * depois do primeiro toque ou tecla na página (e podem pausar o áudio de novo,
 * por exemplo ao trocar o fone de ouvido).
 */
export function onAudioRunning(listener: () => void): () => void {
  runningListeners.add(listener)
  return () => runningListeners.delete(listener)
}

/** Qualquer toque ou tecla libera o áudio pausado (música e sons da batalha). */
function unlockOnGesture() {
  if (context && context.state !== 'running' && context.state !== 'closed') context.resume().catch(() => undefined)
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlockOnGesture, true)
  document.addEventListener('keydown', unlockOnGesture, true)
}

function audio(): AudioContext | null {
  if (!context) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const created = new Ctor()
    created.addEventListener('statechange', () => {
      if (created.state === 'running') runningListeners.forEach((listener) => listener())
    })
    context = created
  }
  // Sem um toque na página o navegador recusa; tenta de novo no próximo som
  if (context.state === 'suspended') context.resume().catch(() => undefined)
  return context
}

interface NoteOptions {
  type?: OscillatorType
  gain?: number
  slideTo?: number
}

function note(ctx: AudioContext, freq: number, at: number, duration: number, options: NoteOptions = {}) {
  const { type = 'sine', gain = 0.07, slideTo } = options
  const osc = ctx.createOscillator()
  const volume = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + duration)
  volume.gain.setValueAtTime(0.0001, at)
  volume.gain.exponentialRampToValueAtTime(gain, at + 0.012)
  volume.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  osc.connect(volume)
  volume.connect(output ?? ctx.destination)
  osc.start(at)
  osc.stop(at + duration + 0.03)
}

let noiseBuffer: AudioBuffer | null = null

/** Ruído branco (para golpes, passos, flechas…), criado uma vez. */
function noiseSource(ctx: AudioContext): AudioBufferSourceNode {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer
  return source
}

interface NoiseOptions {
  filter?: BiquadFilterType
  freq?: number
  freqTo?: number
  q?: number
  gain?: number
}

function noise(ctx: AudioContext, at: number, duration: number, options: NoiseOptions = {}) {
  const { filter = 'bandpass', freq = 1200, freqTo, q = 1, gain = 0.08 } = options
  const source = noiseSource(ctx)
  const biquad = ctx.createBiquadFilter()
  const volume = ctx.createGain()
  biquad.type = filter
  biquad.Q.value = q
  biquad.frequency.setValueAtTime(freq, at)
  if (freqTo) biquad.frequency.exponentialRampToValueAtTime(freqTo, at + duration)
  volume.gain.setValueAtTime(0.0001, at)
  volume.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.015, duration / 3))
  volume.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  source.connect(biquad)
  biquad.connect(volume)
  volume.connect(output ?? ctx.destination)
  source.start(at, Math.random() * 0.5)
  source.stop(at + duration + 0.03)
}

const SOUNDS: Record<SoundName, (ctx: AudioContext, t: number) => void> = {
  // Virar o card: um "swish" curto subindo
  flip: (ctx, t) => note(ctx, 480, t, 0.08, { type: 'triangle', gain: 0.045, slideTo: 760 }),
  // Errei: tom grave descendo
  again: (ctx, t) => note(ctx, 240, t, 0.18, { type: 'triangle', gain: 0.07, slideTo: 150 }),
  // Difícil: tom médio, neutro
  hard: (ctx, t) => note(ctx, 349.23, t, 0.13, { type: 'triangle', gain: 0.06 }),
  // Bom: duas notas subindo
  good: (ctx, t) => {
    note(ctx, 523.25, t, 0.11)
    note(ctx, 659.25, t + 0.07, 0.13, { gain: 0.06 })
  },
  // Fácil: três notas subindo
  easy: (ctx, t) => {
    note(ctx, 659.25, t, 0.09, { gain: 0.06 })
    note(ctx, 783.99, t + 0.06, 0.09, { gain: 0.06 })
    note(ctx, 1046.5, t + 0.12, 0.16, { gain: 0.05 })
  },
  // Sessão concluída / importação feita: arpejo
  complete: (ctx, t) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => note(ctx, freq, t + i * 0.09, 0.22, { gain: 0.055 }))
  },
  // Card ou baralho adicionado: "plim"
  add: (ctx, t) => note(ctx, 880, t, 0.1, { gain: 0.05, slideTo: 1175 }),
  // ----- Modo Herói -----
  // Espada cortando o ar
  swing: (ctx, t) => noise(ctx, t, 0.14, { freq: 900, freqTo: 3200, q: 1.4, gain: 0.07 }),
  // Golpe acertando: baque + estalo
  hit: (ctx, t) => {
    note(ctx, 150, t, 0.09, { type: 'triangle', gain: 0.09, slideTo: 70 })
    noise(ctx, t, 0.06, { filter: 'highpass', freq: 1800, gain: 0.05 })
  },
  // Crítico / golpe de habilidade: baque forte + brilho metálico
  crit: (ctx, t) => {
    note(ctx, 120, t, 0.14, { type: 'triangle', gain: 0.11, slideTo: 55 })
    noise(ctx, t, 0.09, { filter: 'highpass', freq: 1400, gain: 0.07 })
    note(ctx, 1567.98, t + 0.02, 0.18, { type: 'sine', gain: 0.03 })
    note(ctx, 2093, t + 0.04, 0.16, { type: 'sine', gain: 0.02 })
  },
  // Monstro ataca de perto (mordida/garra)
  bite: (ctx, t) => {
    noise(ctx, t, 0.08, { freq: 2400, freqTo: 900, q: 2, gain: 0.06 })
    note(ctx, 110, t, 0.1, { type: 'sawtooth', gain: 0.025, slideTo: 80 })
  },
  // Herói levou dano
  hurt: (ctx, t) => {
    note(ctx, 196, t, 0.12, { type: 'square', gain: 0.03, slideTo: 98 })
    noise(ctx, t, 0.07, { filter: 'lowpass', freq: 900, gain: 0.06 })
  },
  // Arco disparando: corda vibrando + flecha saindo
  bow: (ctx, t) => {
    note(ctx, 220, t, 0.12, { type: 'triangle', gain: 0.06, slideTo: 150 })
    noise(ctx, t + 0.02, 0.18, { freq: 3000, freqTo: 1600, q: 3, gain: 0.03 })
  },
  // Lança arremessada: assobio mais longo
  throw: (ctx, t) => {
    noise(ctx, t, 0.32, { freq: 500, freqTo: 1800, q: 2.5, gain: 0.05 })
    note(ctx, 300, t, 0.08, { type: 'triangle', gain: 0.03 })
  },
  // Projétil acertando o herói (no escudo)
  projectileHit: (ctx, t) => {
    noise(ctx, t, 0.05, { filter: 'highpass', freq: 2500, gain: 0.06 })
    note(ctx, 880, t, 0.07, { type: 'square', gain: 0.02, slideTo: 440 })
  },
  // Monstro derrotado
  monsterDeath: (ctx, t) => {
    note(ctx, 520, t, 0.25, { type: 'square', gain: 0.025, slideTo: 130 })
    noise(ctx, t + 0.05, 0.2, { filter: 'lowpass', freq: 1200, freqTo: 300, gain: 0.04 })
  },
  // Slime estourando
  slimeDeath: (ctx, t) => {
    noise(ctx, t, 0.22, { filter: 'lowpass', freq: 1400, freqTo: 200, q: 6, gain: 0.08 })
    note(ctx, 330, t, 0.18, { type: 'sine', gain: 0.05, slideTo: 90 })
  },
  // Ossos desmontando
  boneDeath: (ctx, t) => {
    ;[0, 0.05, 0.09, 0.15, 0.2].forEach((d, i) =>
      noise(ctx, t + d, 0.035, { freq: 2200 - i * 250, q: 8, gain: 0.07 }),
    )
  },
  // Chefe derrotado: estrondo longo
  bossDeath: (ctx, t) => {
    noise(ctx, t, 0.9, { filter: 'lowpass', freq: 600, freqTo: 80, gain: 0.1 })
    note(ctx, 220, t, 0.7, { type: 'sawtooth', gain: 0.03, slideTo: 55 })
  },
  // Herói caiu
  heroDeath: (ctx, t) => {
    note(ctx, 300, t, 0.4, { type: 'triangle', gain: 0.06, slideTo: 110 })
    noise(ctx, t + 0.25, 0.15, { filter: 'lowpass', freq: 500, gain: 0.07 })
  },
  // Moedas
  coin: (ctx, t) => {
    note(ctx, 1318.51, t, 0.08, { type: 'square', gain: 0.02 })
    note(ctx, 1975.53, t + 0.07, 0.18, { type: 'square', gain: 0.02 })
  },
  // Habilidade ativada: energia subindo
  skill: (ctx, t) => {
    noise(ctx, t, 0.25, { freq: 400, freqTo: 4000, q: 3, gain: 0.04 })
    note(ctx, 440, t, 0.22, { type: 'sawtooth', gain: 0.025, slideTo: 880 })
  },
  // Investida: arrancada rápida
  charge: (ctx, t) => {
    noise(ctx, t, 0.38, { freq: 300, freqTo: 2600, q: 1.2, gain: 0.08 })
    note(ctx, 180, t, 0.3, { type: 'sawtooth', gain: 0.03, slideTo: 420 })
  },
  // Grito de Guerra: brado grave com eco
  warCry: (ctx, t) => {
    note(ctx, 147, t, 0.45, { type: 'sawtooth', gain: 0.05, slideTo: 196 })
    note(ctx, 220, t + 0.02, 0.4, { type: 'square', gain: 0.025, slideTo: 294 })
    noise(ctx, t, 0.35, { freq: 600, q: 0.8, gain: 0.04 })
    note(ctx, 196, t + 0.28, 0.35, { type: 'sawtooth', gain: 0.02 })
  },
  // Fúria Berserker: lava borbulhando e chiando
  lava: (ctx, t) => {
    noise(ctx, t, 0.9, { filter: 'lowpass', freq: 320, freqTo: 120, q: 4, gain: 0.12 })
    noise(ctx, t + 0.05, 0.7, { filter: 'highpass', freq: 3500, gain: 0.03 })
    ;[0.08, 0.22, 0.31, 0.47, 0.6].forEach((d, i) =>
      note(ctx, 90 + i * 25, t + d, 0.09, { type: 'sine', gain: 0.07, slideTo: 260 + i * 30 }),
    )
  },
  // Rugido do Rei Goblin
  bossRoar: (ctx, t) => {
    note(ctx, 98, t, 0.55, { type: 'sawtooth', gain: 0.06, slideTo: 73 })
    note(ctx, 147, t + 0.03, 0.5, { type: 'square', gain: 0.025, slideTo: 110 })
    noise(ctx, t, 0.5, { filter: 'bandpass', freq: 500, freqTo: 250, q: 1.5, gain: 0.07 })
  },
  lavaLoop: (ctx, t) => {
    noise(ctx, t, 0.6, { filter: 'lowpass', freq: 260, q: 5, gain: 0.06 })
    noise(ctx, t, 0.5, { filter: 'highpass', freq: 4000, gain: 0.015 })
    ;[0.05, 0.27, 0.41].forEach((d, i) => note(ctx, 110 + i * 30, t + d, 0.08, { type: 'sine', gain: 0.045, slideTo: 300 }))
  },
  // Cura
  heal: (ctx, t) => {
    ;[783.99, 987.77, 1174.66].forEach((f, i) => note(ctx, f, t + i * 0.06, 0.2, { gain: 0.04 }))
  },
  // Golpe Sísmico: tremor
  quake: (ctx, t) => {
    noise(ctx, t, 0.45, { filter: 'lowpass', freq: 220, freqTo: 60, q: 1, gain: 0.14 })
    note(ctx, 65, t, 0.4, { type: 'sine', gain: 0.1, slideTo: 40 })
  },
  // Passo
  step: (ctx, t) => noise(ctx, t, 0.05, { filter: 'lowpass', freq: 380, gain: 0.04 }),
  // Subiu de nível: fanfarra curta
  levelUp: (ctx, t) => {
    ;[392, 523.25, 659.25, 783.99].forEach((freq, i) => note(ctx, freq, t + i * 0.07, 0.16, { type: 'triangle', gain: 0.05 }))
    note(ctx, 1046.5, t + 0.3, 0.3, { type: 'triangle', gain: 0.045 })
  },
  // Fase concluída
  victory: (ctx, t) => {
    note(ctx, 523.25, t, 0.12, { type: 'triangle', gain: 0.05 })
    note(ctx, 659.25, t + 0.1, 0.12, { type: 'triangle', gain: 0.05 })
    note(ctx, 783.99, t + 0.2, 0.25, { type: 'triangle', gain: 0.05 })
  },
  // Fase perdida
  defeat: (ctx, t) => {
    note(ctx, 392, t, 0.16, { type: 'triangle', gain: 0.05 })
    note(ctx, 311.13, t + 0.14, 0.16, { type: 'triangle', gain: 0.05 })
    note(ctx, 233.08, t + 0.28, 0.32, { type: 'triangle', gain: 0.05, slideTo: 196 })
  },
  // Comprou uma habilidade
  buy: (ctx, t) => {
    note(ctx, 1318.51, t, 0.06, { type: 'square', gain: 0.02 })
    note(ctx, 1975.53, t + 0.05, 0.08, { type: 'square', gain: 0.02 })
    note(ctx, 2637, t + 0.1, 0.2, { type: 'square', gain: 0.015 })
  },
  // Equipou / desequipou
  equip: (ctx, t) => {
    noise(ctx, t, 0.04, { filter: 'highpass', freq: 3000, gain: 0.05 })
    note(ctx, 660, t + 0.02, 0.08, { type: 'triangle', gain: 0.04, slideTo: 990 })
  },
  // Toque de interface
  select: (ctx, t) => note(ctx, 740, t, 0.05, { type: 'triangle', gain: 0.035 }),
  // Sem ouro / bloqueado
  denied: (ctx, t) => {
    note(ctx, 180, t, 0.09, { type: 'square', gain: 0.025 })
    note(ctx, 150, t + 0.1, 0.12, { type: 'square', gain: 0.025 })
  },
}

/** Toca um efeito, se os sons estiverem ligados (ou `force` para testar). */
export function playSound(name: SoundName, force = false): void {
  if (!force && !getSettings().sound) return
  try {
    const ctx = audio()
    if (ctx) SOUNDS[name](ctx, ctx.currentTime + 0.005)
  } catch {
    // Áudio indisponível: segue sem som
  }
}

/** Saída exclusiva dos sons da batalha do herói. */
function battleOutput(ctx: AudioContext): GainNode {
  if (!battleBus) {
    battleBus = ctx.createGain()
    battleBus.gain.value = battleEnabled ? 1 : 0
    battleBus.connect(ctx.destination)
  }
  return battleBus
}

let battleEnabled = true

/**
 * Cria uma "linha" de áudio para os sons de uma luta. Desconectar a linha
 * cala na hora todos os sons já agendados nela (ao mudar a velocidade,
 * desligar o som ou trocar de luta).
 */
export function createBattleLine(): GainNode | null {
  try {
    const ctx = audio()
    if (!ctx || ctx.state !== 'running') return null
    const line = ctx.createGain()
    line.connect(battleOutput(ctx))
    return line
  } catch {
    return null
  }
}

/** Cala e descarta uma linha de sons da batalha. */
export function dropBattleLine(line: GainNode | null): void {
  if (!line) return
  try {
    line.gain.value = 0
    line.disconnect()
  } catch {
    // já desconectada
  }
}

/**
 * Agenda um som da batalha para daqui a `delayMs`, no relógio do áudio,
 * dentro de uma linha (veja createBattleLine). Assim os sons continuam
 * certinhos mesmo com a aba em segundo plano.
 */
export function scheduleBattleSound(name: SoundName, delayMs: number, line: GainNode): boolean {
  try {
    const ctx = audio()
    if (!ctx || ctx.state !== 'running') return false
    output = line
    SOUNDS[name](ctx, ctx.currentTime + 0.02 + Math.max(0, delayMs) / 1000)
    return true
  } catch {
    return false
  } finally {
    output = null
  }
}

/** Liga/desliga na hora os sons da batalha. */
export function setBattleSoundEnabled(enabled: boolean): void {
  battleEnabled = enabled
  if (battleBus && context) {
    battleBus.gain.cancelScheduledValues(context.currentTime)
    battleBus.gain.setValueAtTime(enabled ? 1 : 0, context.currentTime)
  }
}

/** Libera o áudio (precisa ser chamado num clique ou toque). */
export function unlockAudio(): void {
  try {
    audio()
  } catch {
    // sem áudio
  }
}

/** AudioContext compartilhado (usado também pela música). */
export function getAudioContext(): AudioContext | null {
  try {
    return audio()
  } catch {
    return null
  }
}

// Ao recarregar o código no `npm run dev`, fecha o áudio antigo para nenhum som ficar órfão.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.removeEventListener('pointerdown', unlockOnGesture, true)
    document.removeEventListener('keydown', unlockOnGesture, true)
    void context?.close()
    context = null
    battleBus = null
  })
}
