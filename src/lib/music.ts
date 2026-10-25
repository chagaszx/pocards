import { getAudioContext } from './sound'

/**
 * Músicas do modo Herói, compostas na hora com a Web Audio API (sem arquivos):
 * uma para cada ambiente da Masmorra e uma para o chefe. As notas são
 * agendadas com antecedência no relógio do áudio, então a música continua
 * certinha mesmo com a aba em segundo plano.
 */

export type MusicTrack = 'slimeCave' | 'crypt' | 'goblinDen' | 'boss'

const MUSIC_VOLUME = 0.32
const LOOKAHEAD = 1.6 // segundos agendados à frente
const FADE = 1.2
/** Transição curta ao ligar/desligar pelo botão. */
const QUICK_FADE = 0.2

// ---------- Instrumentos ----------

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)

interface Voice {
  type?: OscillatorType
  gain?: number
  attack?: number
  release?: number
  filter?: number
  detune?: number
  slideTo?: number
  vibrato?: number
}

function tone(ctx: AudioContext, out: AudioNode, note: number, at: number, dur: number, v: Voice = {}) {
  const { type = 'triangle', gain = 0.1, attack = 0.01, release = 0.08, filter, detune = 0, slideTo, vibrato } = v
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(midi(note), at)
  osc.detune.value = detune
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(midi(slideTo), at + dur)
  if (vibrato) {
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = 5.5
    depth.gain.value = vibrato
    lfo.connect(depth)
    depth.connect(osc.detune)
    lfo.start(at)
    lfo.stop(at + dur + release + 0.05)
  }
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.linearRampToValueAtTime(gain, at + attack)
  amp.gain.setValueAtTime(gain, at + Math.max(attack, dur - release))
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur + release)
  let node: AudioNode = osc
  if (filter) {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = filter
    osc.connect(lp)
    node = lp
  }
  node.connect(amp)
  amp.connect(out)
  osc.start(at)
  osc.stop(at + dur + release + 0.05)
}

let noiseBuf: AudioBuffer | null = null
function hit(ctx: AudioContext, out: AudioNode, at: number, dur: number, freq: number, gain: number, type: BiquadFilterType = 'bandpass') {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(gain, at)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f)
  f.connect(amp)
  amp.connect(out)
  src.start(at, Math.random() * 0.5)
  src.stop(at + dur + 0.02)
}

function kick(ctx: AudioContext, out: AudioNode, at: number, gain = 0.32) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.frequency.setValueAtTime(130, at)
  osc.frequency.exponentialRampToValueAtTime(42, at + 0.16)
  amp.gain.setValueAtTime(gain, at)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
  osc.connect(amp)
  amp.connect(out)
  osc.start(at)
  osc.stop(at + 0.25)
}

function tom(ctx: AudioContext, out: AudioNode, at: number, from = 220, gain = 0.18) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(from * 0.55, at + 0.18)
  amp.gain.setValueAtTime(gain, at)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.24)
  osc.connect(amp)
  amp.connect(out)
  osc.start(at)
  osc.stop(at + 0.26)
}

function bell(ctx: AudioContext, out: AudioNode, note: number, at: number, gain = 0.05) {
  tone(ctx, out, note, at, 1.6, { type: 'sine', gain, attack: 0.005, release: 1.4 })
  tone(ctx, out, note + 19, at, 0.9, { type: 'sine', gain: gain * 0.35, attack: 0.005, release: 0.8, detune: 12 })
}

// ---------- Músicas ----------

interface TrackDef {
  bpm: number
  /** Toca o passo `step` (semicolcheia) do compasso `bar` no instante `at`. */
  play: (ctx: AudioContext, out: AudioNode, at: number, step: number, bar: number, sixteenth: number) => void
}

/**
 * Cada música é um arranjo longo (24 a 32 compassos, cerca de 1 minuto ou mais)
 * com introdução, partes A e B, uma pausa e a volta do tema, para não soar
 * como um trecho curto repetindo.
 */
type Line = (number | null)[]
type Chord = number[]
interface Bar {
  chord: Chord
  mel?: Line
  /** Partes que tocam neste compasso. */
  parts: string
}

const _ = null

function section(chords: Chord[], parts: string, mels?: Line[], times = 1): Bar[] {
  const bars: Bar[] = []
  for (let r = 0; r < times; r++) {
    chords.forEach((chord, i) => bars.push({ chord, parts, mel: mels?.[(r * chords.length + i) % mels.length] }))
  }
  return bars
}

const has = (bar: Bar, part: string) => bar.parts.split(' ').includes(part)

// ----- Caverna dos Slimes: lá menor, saltitante e misteriosa, com gotas (100 bpm, 32 compassos) -----

const Am = [57, 60, 64]
const F = [53, 57, 60]
const C = [55, 60, 64]
const G = [55, 59, 62]
const Dm = [57, 62, 65]
const E = [56, 59, 64]
const Em = [55, 59, 64]

const SLIME_M1: Line[] = [
  [76, _, _, 72, _, _, 74, _, 76, _, 79, _, 76, _, _, _],
  [77, _, _, 76, _, _, 72, _, 69, _, 72, _, 74, _, _, _],
  [76, _, _, 72, _, _, 67, _, 72, _, 74, _, 76, _, 79, _],
  [74, _, _, _, 71, _, 72, _, 74, _, _, _, _, _, _, _],
  [76, _, _, 72, _, _, 74, _, 76, _, 79, _, 81, _, _, _],
  [77, _, _, 76, _, _, 72, _, 69, _, 72, _, 74, _, _, _],
  [76, _, _, 72, _, _, 67, _, 72, _, 74, _, 76, _, 79, _],
  [74, _, 72, _, 71, _, 72, _, 69, _, _, _, _, _, _, _],
]
const SLIME_M2: Line[] = [
  [74, _, 77, _, 81, _, _, 79, 77, _, 76, _, 74, _, _, _],
  [76, _, 72, _, 69, _, _, 72, 76, _, _, _, 72, _, _, _],
  [71, _, 68, _, 71, _, 74, _, 76, _, _, 74, 71, _, _, _],
  [69, _, _, _, 72, _, 76, _, 81, _, _, _, _, _, _, _],
  [74, _, 77, _, 81, _, _, 79, 77, _, 76, _, 74, _, 72, _],
  [76, _, 72, _, 69, _, _, 72, 76, _, 77, _, 76, _, _, _],
  [71, _, 68, _, 71, _, 74, _, 76, _, _, 74, 71, _, _, _],
  [69, _, 71, _, 72, _, 74, _, 76, _, _, _, _, _, _, _],
]
const SLIME_SONG: Bar[] = [
  ...section([Am, F, C, G], 'arp drip pad'),
  ...section([Am, F, C, G], 'bass arp drip perc mel', SLIME_M1, 2),
  ...section([Dm, Am, E, Am], 'bass arp perc mel bell', SLIME_M2, 2),
  ...section([F, G, Em, Am], 'bass drip pad'),
  ...section([Am, F, C, G], 'bass arp drip perc mel high', SLIME_M1, 2),
]

const slimeCave: TrackDef = {
  bpm: 100,
  play(ctx, out, at, step, bar, s16) {
    const b = SLIME_SONG[bar % SLIME_SONG.length]
    const root = b.chord[0] - 24
    if (has(b, 'pad') && step === 0) {
      for (const n of b.chord) tone(ctx, out, n, at, s16 * 15, { type: 'sine', gain: 0.03, attack: 0.6, release: 0.6 })
    }
    if (has(b, 'bass')) {
      if (step === 0 || step === 10) tone(ctx, out, root, at, s16 * 4, { type: 'triangle', gain: 0.16, release: 0.12 })
      if (step === 6 || step === 14) tone(ctx, out, root + 12, at, s16 * 1.6, { type: 'triangle', gain: 0.1 })
    }
    if (has(b, 'arp') && step % 2 === 0) {
      const order = [0, 1, 2, 1, 0, 2, 1, 2]
      const n = b.chord[order[(step / 2) % 8]] + 12
      tone(ctx, out, n, at, s16 * 1.2, { type: 'sine', gain: has(b, 'mel') ? 0.035 : 0.05, release: 0.15 })
    }
    const m = b.mel?.[step]
    if (has(b, 'mel') && m != null) {
      tone(ctx, out, m + (has(b, 'high') ? 12 : 0), at, s16 * 2, { type: 'triangle', gain: 0.06, release: 0.25 })
      if (has(b, 'high')) tone(ctx, out, m, at, s16 * 2, { type: 'sine', gain: 0.03, release: 0.25 })
    }
    if (has(b, 'bell') && step === 8) bell(ctx, out, b.chord[2] + 24, at, 0.025)
    if (has(b, 'drip') && (step === 3 || step === 11) && Math.random() < 0.6) {
      tone(ctx, out, 88 + Math.floor(Math.random() * 6), at, 0.09, { type: 'sine', gain: 0.04, slideTo: 76 })
    }
    if (has(b, 'perc') && (step === 4 || step === 12)) hit(ctx, out, at, 0.06, 2400, 0.04, 'highpass')
  },
}

// ----- Cripta Sombria: ré menor, lenta, órgão, sinos e batimento grave (66 bpm, 24 compassos) -----

const Dm3 = [50, 53, 57]
const Bb3 = [46, 50, 53]
const Gm3 = [43, 46, 50]
const A3 = [45, 49, 52]

const CRYPT_BELL: Line[] = [
  [74, _, _, _, 77, _, _, _, 76, _, _, _, 74, _, _, _],
  [70, _, _, _, 74, _, _, _, 77, _, _, _, _, _, _, _],
  [79, _, _, _, 77, _, _, _, 74, _, _, _, 70, _, _, _],
  [73, _, _, _, 76, _, _, _, 81, _, _, _, _, _, _, _],
  [74, _, _, _, 77, _, _, _, 81, _, _, _, 79, _, _, _],
  [77, _, _, _, 74, _, _, _, 70, _, _, _, _, _, _, _],
  [79, _, _, _, 82, _, _, _, 81, _, _, _, 79, _, _, _],
  [76, _, _, _, 73, _, _, _, 74, _, _, _, _, _, _, _],
]
const CRYPT_SONG: Bar[] = [
  ...section([Dm3, Bb3, Gm3, A3], 'pad heart'),
  ...section([Dm3, Bb3, Gm3, A3], 'pad heart bell', CRYPT_BELL, 2),
  ...section([Gm3, Dm3, Bb3, A3], 'pad heart organ choir', undefined, 2),
  ...section([Dm3, Bb3, Gm3, A3], 'pad heart bell choir', CRYPT_BELL.slice(4)),
]

const crypt: TrackDef = {
  bpm: 66,
  play(ctx, out, at, step, bar, s16) {
    const b = CRYPT_SONG[bar % CRYPT_SONG.length]
    if (has(b, 'pad') && step === 0) {
      for (const n of b.chord) tone(ctx, out, n, at, s16 * 15, { type: 'sawtooth', gain: 0.026, attack: 0.9, release: 0.9, filter: 900, detune: n % 2 ? 6 : -6 })
      tone(ctx, out, b.chord[0] - 12, at, s16 * 15, { type: 'sine', gain: 0.12, attack: 0.5, release: 0.8 })
    }
    if (has(b, 'heart') && (step === 0 || step === 3)) tom(ctx, out, at, 70, step === 0 ? 0.2 : 0.12)
    const m = b.mel?.[step]
    if (has(b, 'bell') && m != null) bell(ctx, out, m, at, 0.045)
    if (has(b, 'organ') && step % 2 === 0) {
      const order = [0, 1, 2, 1]
      tone(ctx, out, b.chord[order[(step / 2) % 4]] + 24, at, s16 * 1.8, { type: 'square', gain: 0.018, filter: 1400, release: 0.1 })
    }
    if (has(b, 'choir') && step === 0) {
      tone(ctx, out, b.chord[1] + 12, at, s16 * 14, { type: 'sine', gain: 0.03, attack: 0.8, release: 0.6, vibrato: 12 })
      tone(ctx, out, b.chord[2] + 12, at, s16 * 14, { type: 'sine', gain: 0.025, attack: 0.8, release: 0.6, vibrato: 12, detune: 8 })
    }
  },
}

// ----- Covil dos Goblins: mi menor pentatônico, tambores tribais e flauta (118 bpm, 32 compassos) -----

const GOBLIN_A: Line[] = [
  [64, _, 67, _, 69, _, 67, 64, _, _, 62, _, 64, _, _, _],
  [64, _, 67, _, 71, _, 69, 67, _, _, 69, _, 71, 69, 67, _],
  [76, _, 74, _, 71, _, 69, _, 71, _, 69, 67, 64, _, _, _],
  [62, _, 64, _, 67, _, 64, 62, 59, _, _, _, 64, _, _, _],
]
const GOBLIN_B: Line[] = [
  [71, _, _, _, 74, _, 76, _, 74, _, 71, _, 69, _, _, _],
  [67, _, 69, _, 71, _, _, _, 74, _, _, _, 71, _, _, _],
  [76, _, 79, _, 76, _, 74, _, 71, _, 74, _, 76, _, _, _],
  [74, _, 71, _, 69, _, 67, _, 64, _, _, _, _, _, _, _],
]
const E2 = [40, 47]
const D2 = [38, 45]
const GOBLIN_SONG: Bar[] = [
  ...section([E2, E2, E2, E2], 'drums shaker'),
  ...section([E2, E2, E2, E2], 'drums shaker bass flute', GOBLIN_A, 2),
  ...section([D2, E2, D2, E2], 'drums2 shaker bass flute horn', GOBLIN_B, 2),
  ...section([E2, E2, E2, E2], 'toms chant'),
  ...section([E2, E2, E2, E2], 'drums shaker bass flute harmony', GOBLIN_A, 2),
]

const goblinDen: TrackDef = {
  bpm: 118,
  play(ctx, out, at, step, bar, s16) {
    const b = GOBLIN_SONG[bar % GOBLIN_SONG.length]
    if (has(b, 'drums')) {
      if ([0, 6, 8, 11].includes(step)) kick(ctx, out, at, 0.26)
      if (step === 4 || step === 12) tom(ctx, out, at, 210, 0.15)
      if (step === 14 && bar % 2 === 1) tom(ctx, out, at, 160, 0.13)
    }
    if (has(b, 'drums2')) {
      if ([0, 3, 8, 10].includes(step)) kick(ctx, out, at, 0.26)
      if ([4, 12, 14].includes(step)) tom(ctx, out, at, step === 14 ? 170 : 230, 0.15)
    }
    if (has(b, 'toms') && step % 4 === 0) tom(ctx, out, at, step === 0 ? 150 : 200, 0.17)
    if (has(b, 'chant') && (step === 4 || step === 12)) hit(ctx, out, at, 0.12, 700, 0.09)
    if (has(b, 'shaker') && step % 2 === 1) hit(ctx, out, at, 0.04, 6000, 0.025, 'highpass')
    if (has(b, 'bass') && (step === 0 || step === 8)) {
      tone(ctx, out, b.chord[step === 0 ? 0 : 1], at, s16 * 7, { type: 'sawtooth', gain: 0.07, filter: 300, release: 0.2 })
    }
    if (has(b, 'horn') && step === 0 && bar % 2 === 0) {
      tone(ctx, out, b.chord[0] + 12, at, s16 * 3, { type: 'sawtooth', gain: 0.045, filter: 900, attack: 0.05, release: 0.2, slideTo: b.chord[0] + 14 })
    }
    const m = b.mel?.[step]
    if (has(b, 'flute') && m != null) {
      tone(ctx, out, m, at, s16 * 1.8, { type: 'square', gain: 0.035, filter: 1800, vibrato: 18, release: 0.1 })
      if (has(b, 'harmony')) tone(ctx, out, m - 5, at, s16 * 1.8, { type: 'triangle', gain: 0.03, vibrato: 12, release: 0.1 })
    }
  },
}

// ----- Chefe: mi frígio, rápido, baixo pulsante, bumbo reto e metais (148 bpm, 32 compassos) -----

const BOSS_RIFF = [0, 0, 12, 0, 1, 0, 3, 0, 0, 0, 12, 0, 6, 5, 3, 1]
const BOSS_ROOTS = [40, 36, 38, 35] // E, C, D, B
const BOSS_STAB: Chord[] = [
  [64, 67, 71],
  [60, 64, 67],
  [62, 66, 69],
  [59, 63, 66],
]
const BOSS_LEAD: Line[] = [
  [76, _, _, 77, _, _, 79, _, _, _, 77, _, 76, _, 74, _],
  [76, _, _, _, _, _, 71, _, _, _, 72, _, 74, _, _, _],
  [76, _, _, 77, _, _, 79, _, _, _, 81, _, 83, _, 81, _],
  [79, _, _, _, 77, _, _, _, 76, _, _, _, _, _, _, _],
]
const bossBars = (parts: string, times: number, mels?: Line[]) =>
  section(BOSS_STAB, parts, mels, times).map((bar, i) => ({ ...bar, chord: [BOSS_ROOTS[i % 4], ...bar.chord] }))
const BOSS_SONG: Bar[] = [
  ...bossBars('bass kick', 1),
  ...bossBars('bass kick snare hats stab', 2),
  ...bossBars('bass kick snare hats stab lead', 2, BOSS_LEAD),
  ...bossBars('half choir', 1),
  ...bossBars('bass kick snare hats16 stab lead high', 2, BOSS_LEAD),
]

const boss: TrackDef = {
  bpm: 148,
  play(ctx, out, at, step, bar, s16) {
    const b = BOSS_SONG[bar % BOSS_SONG.length]
    const [root, ...stab] = b.chord
    if (has(b, 'kick') && step % 4 === 0) kick(ctx, out, at, 0.3)
    if (has(b, 'snare') && (step === 4 || step === 12)) hit(ctx, out, at, 0.12, 1800, 0.12)
    if (has(b, 'hats') && step % 2 === 0) hit(ctx, out, at, 0.03, 7000, 0.03, 'highpass')
    if (has(b, 'hats16')) hit(ctx, out, at, 0.025, 7000, step % 2 ? 0.018 : 0.03, 'highpass')
    if (has(b, 'bass')) tone(ctx, out, root + BOSS_RIFF[step], at, s16 * 0.9, { type: 'sawtooth', gain: 0.06, filter: 700, release: 0.04 })
    if (has(b, 'stab') && (step === 0 || step === 10)) {
      for (const n of stab) tone(ctx, out, n - 12, at, s16 * 3, { type: 'sawtooth', gain: 0.03, filter: 2200, release: 0.15 })
    }
    if (has(b, 'half')) {
      if (step === 0 || step === 8) kick(ctx, out, at, 0.3)
      if (step === 8) hit(ctx, out, at, 0.2, 1500, 0.1)
      if (step === 0) tone(ctx, out, root, at, s16 * 15, { type: 'sawtooth', gain: 0.07, filter: 400, release: 0.3 })
    }
    if (has(b, 'choir') && step === 0) {
      for (const n of stab) tone(ctx, out, n, at, s16 * 15, { type: 'sine', gain: 0.03, attack: 0.4, release: 0.5, vibrato: 10 })
    }
    const m = b.mel?.[step]
    if (has(b, 'lead') && m != null) {
      tone(ctx, out, m + (has(b, 'high') ? 12 : 0), at, s16 * 2.4, { type: 'square', gain: 0.03, filter: 2600, vibrato: 10 })
    }
  },
}

const TRACKS: Record<MusicTrack, TrackDef> = { slimeCave, crypt, goblinDen, boss }

// ---------- Tocador ----------

interface Playing {
  track: MusicTrack
  gain: GainNode
  nextTime: number
  step: number
  bar: number
}

let playing: Playing | null = null
let master: GainNode | null = null
let timer: number | null = null
let wanted: MusicTrack | null = null
let waitingGesture = false
/** Contextos de áudio que já avisam quando o navegador pausa o som. */
const watched = new WeakSet<AudioContext>()

/** A música quer tocar, mas o navegador ainda espera um toque na página. */
let blocked = false
const blockedListeners = new Set<() => void>()

function setBlocked(value: boolean) {
  if (blocked === value) return
  blocked = value
  blockedListeners.forEach((listener) => listener())
}

/** A música está esperando um toque na página para começar? */
export function isMusicBlocked(): boolean {
  return blocked
}

export function subscribeMusicBlocked(listener: () => void): () => void {
  blockedListeners.add(listener)
  return () => blockedListeners.delete(listener)
}

/**
 * Se o navegador pausar o áudio no meio da música (fone trocado, aparelho
 * dormiu), ela volta sozinha no próximo toque, em vez de ficar muda.
 */
function watch(ctx: AudioContext) {
  if (watched.has(ctx)) return
  watched.add(ctx)
  ctx.addEventListener('statechange', () => {
    if (wanted && ctx.state !== 'closed') playMusic(wanted)
  })
}

function ensureMaster(ctx: AudioContext): GainNode {
  if (!master) {
    master = ctx.createGain()
    master.gain.value = MUSIC_VOLUME
    master.connect(ctx.destination)
  }
  return master
}

function schedule() {
  const ctx = getAudioContext()
  if (!ctx || !playing) return
  const def = TRACKS[playing.track]
  const s16 = 60 / def.bpm / 4
  while (playing.nextTime < ctx.currentTime + LOOKAHEAD) {
    if (playing.nextTime >= ctx.currentTime - 0.05) {
      try {
        def.play(ctx, playing.gain, playing.nextTime, playing.step, playing.bar, s16)
      } catch {
        // nota perdida não para a música
      }
    }
    playing.nextTime += s16
    playing.step += 1
    if (playing.step === 16) {
      playing.step = 0
      playing.bar += 1
    }
  }
}

function fadeOut(p: Playing, ctx: AudioContext, fade: number) {
  p.gain.gain.cancelScheduledValues(ctx.currentTime)
  p.gain.gain.setValueAtTime(p.gain.gain.value, ctx.currentTime)
  p.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade)
  // Desconecta logo depois do fade: as notas já agendadas param de soar.
  window.setTimeout(() => p.gain.disconnect(), (fade + 0.05) * 1000)
}

/** Espera um toque na tela para liberar o áudio (exigência dos navegadores). */
function waitForGesture() {
  if (waitingGesture) return
  waitingGesture = true
  const resume = () => {
    waitingGesture = false
    document.removeEventListener('pointerdown', resume)
    document.removeEventListener('keydown', resume)
    playMusic(wanted)
  }
  document.addEventListener('pointerdown', resume)
  document.addEventListener('keydown', resume)
}

/**
 * Troca a música (com transição suave). `null` para silêncio.
 * `quick`: transição curta, para o botão de ligar/desligar responder na hora.
 */
export function playMusic(track: MusicTrack | null, quick = false): void {
  wanted = track
  const ctx = getAudioContext()
  if (!ctx) {
    // Navegador sem áudio: não adianta pedir um toque
    setBlocked(false)
    return
  }
  watch(ctx)
  if (track && ctx.state !== 'running') {
    // Tenta liberar já (funciona logo após um clique); senão espera o próximo toque.
    setBlocked(true)
    ctx
      .resume()
      .then(() => {
        if (ctx.state === 'running' && wanted === track) playMusic(track, quick)
      })
      .catch(() => undefined)
    waitForGesture()
    return
  }
  setBlocked(false)
  if (playing?.track === track) return
  const fade = quick ? QUICK_FADE : FADE
  if (playing) {
    fadeOut(playing, ctx, fade)
    playing = null
  }
  if (!track) {
    if (timer != null) window.clearInterval(timer)
    timer = null
    return
  }
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fade)
  gain.connect(ensureMaster(ctx))
  playing = { track, gain, nextTime: ctx.currentTime + 0.03, step: 0, bar: 0 }
  schedule()
  if (timer == null) timer = window.setInterval(schedule, 250)
}

export function currentMusic(): MusicTrack | null {
  return playing?.track ?? null
}

// Ao recarregar o código no `npm run dev`, para a música antiga.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (timer != null) window.clearInterval(timer)
    timer = null
    playing?.gain.disconnect()
    playing = null
  })
}
