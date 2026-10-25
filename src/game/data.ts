/**
 * Dados do modo Herói: monstros, fases do Ato 1 (1.1 a 1.10), o Guerreiro e suas habilidades.
 * Os nomes exibidos ficam nas traduções (src/i18n); aqui só os ids.
 */

export type MonsterId = 'slime' | 'bat' | 'bigSlime' | 'zombie' | 'skeleton' | 'goblin' | 'spearGoblin' | 'goblinKing'

/** Projétil dos inimigos que atacam de longe. */
export type Projectile = 'arrow' | 'spear'

export interface MonsterBase {
  hp: number
  atk: number
  def: number
  /** Experiência base ao derrotar. */
  xp: number
  /** Ataca de longe: atira enquanto o herói se aproxima. */
  projectile?: Projectile
  /** Ataca mais devagar (mais tempo entre um disparo e outro). */
  slow?: boolean
  flying?: boolean
  boss?: boolean
}

export const MONSTERS: Record<MonsterId, MonsterBase> = {
  slime: { hp: 20, atk: 4, def: 0, xp: 5 },
  bat: { hp: 15, atk: 6, def: 0, xp: 6, flying: true },
  bigSlime: { hp: 34, atk: 6, def: 1, xp: 8 },
  zombie: { hp: 40, atk: 8, def: 1, xp: 10 },
  skeleton: { hp: 26, atk: 8, def: 2, xp: 11, projectile: 'arrow', slow: true },
  goblin: { hp: 36, atk: 10, def: 1, xp: 11 },
  spearGoblin: { hp: 26, atk: 8.5, def: 1, xp: 12, projectile: 'spear' },
  goblinKing: { hp: 700, atk: 20, def: 6, xp: 200, boss: true },
}

/** Ambientes da caverna do Ato 1. */
export type Biome = 'slimeCave' | 'crypt' | 'goblinDen'

export interface StageDef {
  /** 1 a 10 */
  index: number
  biome: Biome
  monsters: MonsterId[]
  boss?: boolean
}

export const STAGES: StageDef[] = [
  // 1.1–1.3 · Caverna dos Slimes (slimes, morcegos e slimes gigantes misturados)
  { index: 1, biome: 'slimeCave', monsters: ['slime', 'bat', 'slime', 'bigSlime'] },
  { index: 2, biome: 'slimeCave', monsters: ['bat', 'slime', 'bigSlime', 'bat'] },
  { index: 3, biome: 'slimeCave', monsters: ['bigSlime', 'bat', 'slime', 'bigSlime', 'bat'] },
  // 1.4–1.6 · Cripta (zumbis e esqueletos arqueiros). Quem ataca de longe fica sempre no fim.
  { index: 4, biome: 'crypt', monsters: ['zombie', 'zombie', 'skeleton'] },
  { index: 5, biome: 'crypt', monsters: ['zombie', 'zombie', 'skeleton', 'skeleton'] },
  { index: 6, biome: 'crypt', monsters: ['zombie', 'zombie', 'skeleton', 'skeleton', 'skeleton'] },
  // 1.7–1.10 · Covil dos Goblins (com lanceiros) e o chefe
  { index: 7, biome: 'goblinDen', monsters: ['goblin', 'goblin', 'goblin', 'spearGoblin'] },
  { index: 8, biome: 'goblinDen', monsters: ['goblin', 'goblin', 'spearGoblin', 'spearGoblin'] },
  { index: 9, biome: 'goblinDen', monsters: ['goblin', 'goblin', 'spearGoblin', 'spearGoblin', 'spearGoblin'] },
  { index: 10, biome: 'goblinDen', monsters: ['goblin', 'spearGoblin', 'goblinKing'], boss: true },
]

export const STAGE_COUNT = STAGES.length

/** Quantos pontos cada fase custa. */
export const POINTS_PER_RUN = 4

/** Pontos ganhos por resposta: Errei 0 · Difícil 1 · Bom 2 · Fácil 4 */
export const POINTS_BY_GRADE: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 4 }

/** Pontos de boas-vindas, para a pessoa já ver o herói em ação. */
export const WELCOME_POINTS = 8

/** Energia: recarrega sozinha 2 pontos a cada 15 min, até juntar 10. */
export const ENERGY = { everyMs: 15 * 60_000, amount: 2, cap: 10 }

// ---------- Árvore de evolução (comprada com ouro) ----------

export type UpgradeId = 'power' | 'guard' | 'wisdom' | 'fortune'

export interface UpgradeDef {
  id: UpgradeId
  max: number
  /** Preço do primeiro nível. */
  base: number
  /** Cada nível fica `growth` vezes mais caro. */
  growth: number
  /** Ganho por nível (fração: 0.04 = 4%). */
  per: number
}

/**
 * Os primeiros níveis custam o que se ganha em 1 ou 2 fases; os últimos
 * pedem dezenas de vitórias contra o chefe.
 */
export const UPGRADES: UpgradeDef[] = [
  { id: 'power', max: 25, base: 20, growth: 1.3, per: 0.04 }, // +4% de dano
  { id: 'guard', max: 20, base: 20, growth: 1.32, per: 0.02 }, // −2% de dano recebido
  { id: 'wisdom', max: 20, base: 15, growth: 1.3, per: 0.06 }, // +6% de experiência
  { id: 'fortune', max: 20, base: 15, growth: 1.3, per: 0.06 }, // +6% de ouro
]

export type Upgrades = Record<UpgradeId, number>

export const NO_UPGRADES: Upgrades = { power: 0, guard: 0, wisdom: 0, fortune: 0 }

export function upgradeDef(id: UpgradeId): UpgradeDef {
  return UPGRADES.find((u) => u.id === id)!
}

/** Preço para subir do nível `level` para o próximo. */
export function upgradeCost(id: UpgradeId, level: number): number {
  const def = upgradeDef(id)
  const raw = def.base * def.growth ** level
  // Arredonda para números "bonitos"
  const step = raw < 100 ? 5 : raw < 1000 ? 10 : 50
  return Math.round(raw / step) * step
}

/** Efeito somado dos níveis comprados. */
export function upgradeEffects(u: Partial<Upgrades> = {}) {
  const lv = { ...NO_UPGRADES, ...u }
  return {
    atkMult: 1 + lv.power * upgradeDef('power').per,
    damageTaken: 1 - lv.guard * upgradeDef('guard').per,
    xpMult: 1 + lv.wisdom * upgradeDef('wisdom').per,
    goldMult: 1 + lv.fortune * upgradeDef('fortune').per,
  }
}

// ---------- Habilidades ----------

export type SkillId = 'charge' | 'warCry' | 'quake' | 'toughSkin' | 'bloodthirst' | 'berserk'
export type SkillKind = 'active' | 'passive'

export interface SkillDef {
  id: SkillId
  kind: SkillKind
  /** Nível mínimo para aprender. */
  level: number
  /** Ouro para aprender. */
  cost: number
  /** Ativas: dispara a cada N golpes do herói. */
  every?: number
  /** Ativas: dispara a cada X ms de luta. */
  cooldownMs?: number
  /** Ativas: dispara ao avistar um inimigo distante. */
  vsFar?: boolean
}

/**
 * 3 ativas e 3 passivas. As primeiras são mais fracas e baratas;
 * as de nível alto são bem mais fortes.
 */
export const SKILLS: SkillDef[] = [
  // Ativas (disparam sozinhas)
  { id: 'charge', kind: 'active', level: 2, cost: 30, vsFar: true, every: 3 },
  { id: 'warCry', kind: 'active', level: 5, cost: 160, cooldownMs: 15_000 },
  { id: 'quake', kind: 'active', level: 8, cost: 450, every: 4 },
  // Passivas (sempre ligadas)
  { id: 'toughSkin', kind: 'passive', level: 2, cost: 30 },
  { id: 'bloodthirst', kind: 'passive', level: 4, cost: 120 },
  { id: 'berserk', kind: 'passive', level: 7, cost: 350 },
]

/** Números das habilidades (usados no motor e nas descrições). */
export const SKILL_VALUES = {
  /** Investida: corre até o inimigo distante sem tomar dano e abre com 1,6× de dano. */
  chargeMult: 1.6,
  /** Investida recarrega com 3 golpes do herói. */
  chargeEvery: 3,
  /** Grito de Guerra (a cada 15 s): cura 30% da vida e +40% de dano nos 3 golpes seguintes. */
  warCryHeal: 0.3,
  warCryBuff: 1.4,
  warCryBuffHits: 3,
  /** Golpe Sísmico: 3× de dano e o inimigo perde o próximo ataque. */
  quakeMult: 3,
  /** Pele Grossa: −12% de dano recebido. */
  toughSkin: 0.88,
  /** Sede de Sangue: cura 15% do dano causado. */
  bloodthirst: 0.15,
  /** Fúria Berserker: abaixo de 50% de vida, +50% de dano e +15% de chance de crítico. */
  berserkBelow: 0.5,
  berserkMult: 1.5,
  berserkCrit: 0.15,
}

// ---------- Habilidades do chefe ----------

/** O Rei Goblin usa versões das habilidades do herói. */
export type BossSkillId = 'royalCharge' | 'kingsCry' | 'stomp' | 'kingsRage'

export const BOSS_SKILLS: BossSkillId[] = ['royalCharge', 'kingsCry', 'stomp', 'kingsRage']

export const BOSS_VALUES = {
  /** Investida Real: avança e abre a luta com 1,6× de dano. */
  chargeMult: 1.6,
  /** Grito do Rei: a cada 12 s, cura 10% da vida e +30% de dano nos 2 ataques seguintes. */
  cryEveryMs: 12_000,
  cryFirstMs: 6_000,
  cryHeal: 0.1,
  cryBuff: 1.3,
  cryBuffHits: 2,
  /** Pisão Sísmico: a cada 4 ataques, 2× de dano e o herói perde o próximo golpe. */
  stompEvery: 4,
  stompMult: 2,
  /** Fúria do Rei: abaixo de 50% de vida, +40% de dano. */
  rageBelow: 0.5,
  rageMult: 1.4,
}

/** Quantas habilidades podem ficar equipadas ao mesmo tempo. */
export const SKILL_SLOTS = 2

export function skillDef(id: SkillId): SkillDef {
  return SKILLS.find((skill) => skill.id === id)!
}

// ---------- Atributos ----------

/** Atributos do Guerreiro em cada nível. */
export function warriorStats(level: number) {
  return {
    maxHp: Math.round(60 + 12 * (level - 1)),
    atk: Math.round((10 + 2.5 * (level - 1)) * 10) / 10,
    def: Math.round((1 + 0.6 * (level - 1)) * 10) / 10,
  }
}

/** Chance base de golpe crítico (1,8× de dano). */
export const BASE_CRIT = 0.1

/** Experiência necessária para passar do nível `level` para o próximo. */
export function xpToNext(level: number): number {
  return Math.round(36 * level ** 1.45)
}

/** Atributos de um monstro numa fase (os monstros ficam mais fortes fase a fase). */
export function monsterStats(id: MonsterId, stageIndex: number) {
  const base = MONSTERS[id]
  if (base.boss) return { ...base, maxHp: base.hp }
  const step = stageIndex - 1
  return {
    ...base,
    maxHp: Math.round(base.hp * (1 + 0.25 * step)),
    atk: Math.round(base.atk * (1 + 0.19 * step) * 10) / 10,
    xp: Math.round(base.xp * (1 + 0.1 * step)),
  }
}

/** Ouro deixado por um monstro. */
export function monsterGold(xp: number, boss = false): number {
  return boss ? 150 : Math.max(1, Math.round(xp / 2))
}

/** Ouro extra por completar a fase. */
export function clearBonusGold(stageIndex: number): number {
  return 4 + 2 * stageIndex
}

/** Experiência extra por completar a fase. */
export function clearBonusXp(stageIndex: number): number {
  return 8 + 4 * stageIndex
}
