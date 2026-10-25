import type { Card as SrsCard } from 'ts-fsrs'
import type { SkillId, Upgrades } from '../game/data'
import type { RunResult } from '../game/engine'

export interface Deck {
  id: string
  name: string
  createdAt: number
  /** Id do baralho pronto de onde ele veio (aba Explorar), se for o caso. */
  sourceId?: string
  /** Imagem de capa (ex.: bandeira), para baralhos prontos. */
  cover?: string
}

export interface Flashcard {
  id: string
  deckId: string
  front: string
  back: string
  createdAt: number
  updatedAt: number
  /** Próxima revisão (timestamp em ms), duplicado do srs.due para poder indexar. */
  due: number
  /** Estado do algoritmo FSRS para este card. */
  srs: SrsCard
}

/** Imagem usada nos cards (referenciada no texto como ![](img:id)). */
export interface ImageRecord {
  id: string
  blob: Blob
  type: string
  createdAt: number
}

/** Uma revisão feita (usada para a sequência de dias e, no futuro, estatísticas). */
export interface Review {
  id: string
  cardId: string
  deckId: string
  /** 1 = Errei, 2 = Difícil, 3 = Bom, 4 = Fácil */
  grade: number
  reviewedAt: number
  /** Dia local no formato AAAA-MM-DD, para contar dias estudados. */
  day: string
}

/** Progresso do modo Herói (um único registro, id 'main'). */
export interface GameState {
  id: 'main'
  /** Pontos disponíveis para jogar fases (ganhos respondendo cards). */
  points: number
  /** Total de pontos já ganhos. */
  totalPoints: number
  level: number
  /** Experiência dentro do nível atual. */
  xp: number
  gold: number
  /** Maior fase liberada (1 a 10). */
  unlockedStage: number
  /** Fase escolhida para jogar. */
  selectedStage: number
  bossDefeated: boolean
  /** Jogar sozinho enquanto houver pontos. */
  auto: boolean
  /** Velocidade da animação (1 ou 2). */
  speed: number
  /** Sons da batalha (também em segundo plano). */
  battleSound: boolean
  /** Música temática das fases. */
  music: boolean
  /** Níveis comprados na árvore de evolução. */
  upgrades: Upgrades
  /** Última recarga de energia (ms). A energia sobe 2 a cada 15 min, até 10. */
  lastEnergyAt: number
  /** Quantas vezes o chefe foi derrotado. */
  bossKills: number
  /** Medalha única do ranking mundial: 1 ouro, 2 prata, 3 bronze, 0 nenhuma. */
  medal: number
  /** Venceu o chefe mas ainda não registrou no ranking mundial. */
  medalPending: boolean
  /** Nome usado no ranking. */
  medalName: string
  runs: number
  wins: number
  /** Habilidades aprendidas (compradas com ouro). */
  learned: SkillId[]
  /** Habilidades equipadas (até 2). */
  equipped: SkillId[]
  /**
   * Fases em andamento. Ficam salvas para nada se perder se o app fechar ou
   * recarregar no meio da luta: o que faltar entra na próxima vez que ele abrir.
   */
  activeRuns?: ActiveRun[]
}

/** Uma fase em andamento, com o resultado já sorteado e o que já foi pago. */
export interface ActiveRun {
  id: number
  result: RunResult
  /** Quantos acontecimentos da luta já tiveram as recompensas aplicadas. */
  processed: number
  /** Date.now() do início. */
  startedAt: number
}
