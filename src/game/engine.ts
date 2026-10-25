import {
  BASE_CRIT,
  BOSS_VALUES as B,
  MONSTERS,
  type BossSkillId,
  clearBonusGold,
  clearBonusXp,
  upgradeEffects,
  type Upgrades,
  monsterGold,
  monsterStats,
  SKILL_SLOTS,
  SKILL_VALUES as V,
  skillDef,
  STAGES,
  STAGE_COUNT,
  warriorStats,
  xpToNext,
  type MonsterId,
  type Projectile,
  type SkillId,
} from './data'

/** Estado do herói usado nas lutas. */
export interface HeroProgress {
  level: number
  /** Experiência acumulada dentro do nível atual. */
  xp: number
  gold: number
  /** Maior fase liberada (1 a 10). */
  unlockedStage: number
  /** Chefe do Ato 1 já derrotado. */
  bossDefeated: boolean
  runs: number
  wins: number
  /** Habilidades aprendidas. */
  learned: SkillId[]
  /** Habilidades equipadas (até SKILL_SLOTS). */
  equipped: SkillId[]
  /** Níveis da árvore de evolução. */
  upgrades?: Partial<Upgrades>
}

/** Acontecimentos de uma luta, com o tempo (ms) em que aparecem na animação. */
export type BattleEvent =
  | {
      at: number
      kind: 'spawn'
      monster: MonsterId
      wave: number
      monsterHp: number
      monsterMaxHp: number
      /** Tempo até o encontro (maior para quem ataca de longe). */
      approach: number
    }
  | {
      at: number
      kind: 'heroHit'
      damage: number
      crit: boolean
      skill?: SkillId
      stun?: boolean
      /** Vida recuperada com o golpe (Sede de Sangue). */
      heal?: number
      monsterHp: number
      heroHp: number
    }
  | { at: number; kind: 'heroHeal'; amount: number; heroHp: number; skill: SkillId }
  /** Investida: o herói corre até o inimigo distante (sem tomar dano) até `until`. */
  | { at: number; kind: 'charge'; until: number; combat?: boolean }
  /** Fúria Berserker ligou (vida abaixo de 50%) ou desligou (curou acima). */
  | { at: number; kind: 'berserk'; on: boolean }
  /** O chefe usou uma habilidade (para o nome aparecer na tela). */
  | { at: number; kind: 'bossSkill'; skill: BossSkillId }
  | { at: number; kind: 'bossHeal'; amount: number; monsterHp: number }
  /** Fúria do Rei ligou/desligou. */
  | { at: number; kind: 'bossRage'; on: boolean }
  | {
      at: number
      kind: 'monsterHit'
      damage: number
      heroHp: number
      /** Ataque à distância: o projétil sai `flight` ms antes do impacto. */
      projectile?: Projectile
      flight: number
      /** Habilidade do chefe usada neste ataque. */
      skill?: BossSkillId
      /** O herói fica atordoado e perde o próximo golpe. */
      stun?: boolean
    }
  | { at: number; kind: 'monsterDie'; xp: number; gold: number }
  | { at: number; kind: 'heroDie' }
  | { at: number; kind: 'end'; won: boolean }

export interface RunResult {
  stage: number
  won: boolean
  events: BattleEvent[]
  heroMaxHp: number
  waves: number
  xpGained: number
  /** Parte da experiência que vem do bônus de completar a fase. */
  clearXp: number
  /** Ouro do bônus de completar a fase. */
  clearGold: number
  goldGained: number
  levelsGained: number
  /** Nova fase liberada por esta vitória (se houver). */
  unlocked?: number
  bossDefeatedNow: boolean
  duration: number
}

/** Gerador de números aleatórios com semente (permite testar o equilíbrio). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const TIMING = {
  /** Encontro com inimigo corpo a corpo. */
  meleeApproach: 750,
  /** Encontro com inimigo que atira (o herói caminha sob fogo). */
  rangedApproach: 1700,
  /** Disparos durante a aproximação (ms depois de aparecer). */
  rangedShots: [250, 950],
  /** Inimigos lentos (esqueleto) atiram com mais calma. */
  slowShots: [450, 1350],
  flight: { arrow: 380, spear: 520 } as Record<Projectile, number>,
  slowFlight: 500,
  /** Disparo à queima-roupa, já no corpo a corpo. */
  closeFlight: 160,
  turn: 520,
  /** Turno de um inimigo lento. */
  slowTurn: 820,
  /** Investida: avista o inimigo e dispara a corrida. */
  chargeStart: 260,
  /** Investida logo após derrotar um inimigo (quase instantânea). */
  chargeQuickStart: 90,
  chargeDash: 420,
  die: 650,
}

/**
 * Trava de segurança: uma fase nunca passa disso (em tempo de jogo). Nenhuma
 * combinação real chega perto (a mais longa testada tem menos de 1 min), mas
 * dados adulterados nunca podem deixar uma luta sem fim travando o app.
 */
const MAX_RUN_MS = 30 * 60_000

function roll(atk: number, def: number, random: () => number): number {
  return Math.max(1, Math.round(atk * (0.85 + random() * 0.3) - def))
}

/** Habilidades equipadas válidas (aprendidas, sem repetição, no máximo SKILL_SLOTS). */
/** Ativas equipadas (até SKILL_SLOTS espaços). */
export function equippedActives(progress: Pick<HeroProgress, 'learned' | 'equipped'>): SkillId[] {
  return [...new Set(progress.equipped)]
    .filter((id) => progress.learned.includes(id) && skillDef(id).kind === 'active')
    .slice(0, SKILL_SLOTS)
}

/**
 * Habilidades em uso na luta: as ativas equipadas mais todas as passivas
 * aprendidas (passivas não ocupam espaço).
 */
export function activeLoadout(progress: Pick<HeroProgress, 'learned' | 'equipped'>): SkillId[] {
  const passives = progress.learned.filter((id) => skillDef(id).kind === 'passive')
  return [...equippedActives(progress), ...new Set(passives)]
}

/**
 * Simula uma ida à fase: o herói enfrenta os monstros em sequência, com a vida
 * acumulando entre eles. Devolve os acontecimentos (para a animação) e o resultado.
 */
export function simulateRun(progress: HeroProgress, stageIndex: number, random: () => number = Math.random): RunResult {
  const stage = STAGES[Math.min(Math.max(stageIndex, 1), STAGE_COUNT) - 1]
  const base = warriorStats(progress.level)
  const boost = upgradeEffects(progress.upgrades)
  const hero = { ...base, atk: base.atk * boost.atkMult }
  const loadout = activeLoadout(progress)
  const has = (id: SkillId) => loadout.includes(id)
  let heroHp = hero.maxHp
  let t = 0
  let attacks = 0
  let buffHits = 0
  let nextCry = 0
  /** Golpes desde a última Investida (começa descarregada: precisa de 3 golpes). */
  let hitsSinceCharge = 0
  let berserkOn = false
  let xp = 0
  let gold = 0
  let won = true
  const events: BattleEvent[] = []

  /** Liga/desliga a Fúria Berserker conforme a vida (desliga sozinha ao curar acima de 50%). */
  const checkBerserk = (at: number) => {
    if (!has('berserk')) return
    const should = heroHp > 0 && heroHp < hero.maxHp * V.berserkBelow
    if (should !== berserkOn) {
      berserkOn = should
      events.push({ at, kind: 'berserk', on: should })
    }
  }

  const takeHit = (raw: number) => {
    let damage = raw
    if (has('toughSkin')) damage = Math.max(1, Math.round(damage * V.toughSkin))
    if (boost.damageTaken < 1) damage = Math.max(1, Math.round(damage * boost.damageTaken))
    heroHp = Math.max(0, heroHp - damage)
    return damage
  }

  // Quem ataca de longe fica sempre no fim da fase (antes do chefe).
  const rank = (id: MonsterId) => (MONSTERS[id].boss ? 2 : MONSTERS[id].projectile ? 1 : 0)
  const order = stage.monsters.map((id, i) => ({ id, i })).sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i)

  for (const [wave, { id }] of order.entries()) {
    const m = monsterStats(id, stage.index)
    let monsterHp = m.maxHp
    // Investida ao avançar: contra quem atira de longe e sempre que passa para o próximo
    // inimigo (ele ainda está longe). Com o inimigo colado no herói, não dá para usar.
    // Recarga: depois de usada, precisa de 3 golpes do herói para ficar disponível de novo.
    const charging = has('charge') && (Boolean(m.projectile) || wave > 0) && hitsSinceCharge >= V.chargeEvery
    if (charging) hitsSinceCharge = 0
    const approach = charging
      ? (wave > 0 ? TIMING.chargeQuickStart : TIMING.chargeStart) + TIMING.chargeDash
      : m.projectile
        ? TIMING.rangedApproach
        : TIMING.meleeApproach
    events.push({ at: t, kind: 'spawn', monster: id, wave, monsterHp, monsterMaxHp: m.maxHp, approach })

    if (charging) {
      // Corre até o inimigo: nenhum disparo acerta durante a corrida.
      events.push({ at: t + approach - TIMING.chargeDash, kind: 'charge', until: t + approach })
    } else if (m.projectile) {
      const flight = m.slow ? TIMING.slowFlight : TIMING.flight[m.projectile]
      for (const shot of m.slow ? TIMING.slowShots : TIMING.rangedShots) {
        if (heroHp <= 0) break
        const damage = takeHit(roll(m.atk, hero.def, random))
        const at = t + shot + flight
        events.push({ at, kind: 'monsterHit', damage, heroHp, projectile: m.projectile, flight })
        checkBerserk(at)
      }
    }
    t += approach

    let stunned = false
    let chargeHit = charging
    // Chefe
    const boss = Boolean(m.boss)
    let bossAttacks = 0
    let bossBuff = 0
    let bossRage = false
    let nextBossCry = t + B.cryFirstMs
    let heroStunned = false
    const checkRage = (at: number) => {
      if (!boss) return
      const should = monsterHp > 0 && monsterHp < m.maxHp * B.rageBelow
      if (should !== bossRage) {
        bossRage = should
        events.push({ at, kind: 'bossRage', on: should })
        if (should) events.push({ at, kind: 'bossSkill', skill: 'kingsRage' })
      }
    }
    if (boss) {
      // Investida Real: o rei avança e ataca primeiro
      events.push({ at: t - 380, kind: 'bossSkill', skill: 'royalCharge' })
      const dmg = takeHit(roll(m.atk * B.chargeMult, hero.def, random))
      events.push({ at: t, kind: 'monsterHit', damage: dmg, heroHp, flight: 0, skill: 'royalCharge' })
      checkBerserk(t)
      t += TIMING.turn
    }
    while (monsterHp > 0 && heroHp > 0) {
      // Luta que não termina nunca: o herói cai de exaustão
      if (t > MAX_RUN_MS) {
        heroHp = 0
        break
      }
      if (heroStunned) {
        // Atordoado pelo Pisão Sísmico: perde este golpe
        heroStunned = false
        t += TIMING.turn
      } else {
      // Grito de Guerra: a cada 15 s de luta
      if (has('warCry') && t >= nextCry) {
        const amount = Math.min(hero.maxHp - heroHp, Math.round(hero.maxHp * V.warCryHeal))
        heroHp += amount
        events.push({ at: t, kind: 'heroHeal', amount, heroHp, skill: 'warCry' })
        checkBerserk(t)
        buffHits = V.warCryBuffHits
        nextCry = t + (skillDef('warCry').cooldownMs ?? 15_000)
        t += 280
      }

      // Golpe do herói (corpo a corpo)
      attacks += 1
      let mult = 1
      let skill: SkillId | undefined
      let stun = false
      if (chargeHit) {
        mult *= V.chargeMult
        skill = 'charge'
        chargeHit = false
      } else {
        // Cada golpe normal recarrega um pouco a Investida
        hitsSinceCharge += 1
        if (has('quake') && attacks % (skillDef('quake').every ?? 4) === 0) {
          mult *= V.quakeMult
          skill = 'quake'
          stun = true
        }
      }
      if (buffHits > 0) {
        mult *= V.warCryBuff
        buffHits -= 1
      }
      let critChance = BASE_CRIT
      if (berserkOn) {
        mult *= V.berserkMult
        critChance += V.berserkCrit
      }
      const crit = random() < critChance
      if (crit) mult *= 1.8
      const damage = roll(hero.atk * mult, m.def, random)
      monsterHp = Math.max(0, monsterHp - damage)
      let heal: number | undefined
      if (has('bloodthirst')) {
        heal = Math.min(hero.maxHp - heroHp, Math.round(damage * V.bloodthirst))
        heroHp += heal
        if (heal === 0) heal = undefined
      }
      events.push({ at: t, kind: 'heroHit', damage, crit, skill, stun: stun || undefined, heal, monsterHp, heroHp })
      checkBerserk(t)
      checkRage(t)
      t += TIMING.turn
      if (monsterHp <= 0) break
      if (stun) stunned = true
      }

      // Turno do monstro
      if (stunned) {
        stunned = false
        continue
      }
      if (m.slow) t += TIMING.slowTurn - TIMING.turn
      let monsterMult = 1
      let bossSkill: BossSkillId | undefined
      let stunHero = false
      if (boss) {
        // Grito do Rei: a cada 12 s
        if (t >= nextBossCry) {
          const amount = Math.min(m.maxHp - monsterHp, Math.round(m.maxHp * B.cryHeal))
          monsterHp += amount
          events.push({ at: t, kind: 'bossSkill', skill: 'kingsCry' })
          events.push({ at: t, kind: 'bossHeal', amount, monsterHp })
          checkRage(t)
          bossBuff = B.cryBuffHits
          nextBossCry = t + B.cryEveryMs
          t += 320
        }
        bossAttacks += 1
        if (bossAttacks % B.stompEvery === 0) {
          monsterMult *= B.stompMult
          bossSkill = 'stomp'
          stunHero = true
          events.push({ at: t - 200, kind: 'bossSkill', skill: 'stomp' })
        }
        if (bossBuff > 0) {
          monsterMult *= B.cryBuff
          bossBuff -= 1
        }
        if (bossRage) monsterMult *= B.rageMult
      }
      const damage2 = takeHit(roll(m.atk * monsterMult, hero.def, random))
      events.push({
        at: t,
        kind: 'monsterHit',
        damage: damage2,
        heroHp,
        projectile: m.projectile,
        flight: m.projectile ? TIMING.closeFlight : 0,
        skill: bossSkill,
        stun: stunHero || undefined,
      })
      if (stunHero) heroStunned = true
      checkBerserk(t)
      t += TIMING.turn
    }
    if (bossRage) events.push({ at: t, kind: 'bossRage', on: false })

    // Se o herói caiu durante a aproximação, espera o último disparo chegar.
    const lastAt = Math.max(...events.map((e) => e.at))
    if (lastAt > t) t = lastAt + 100

    if (heroHp <= 0) {
      won = false
      events.push({ at: t, kind: 'heroDie' })
      t += TIMING.die
      break
    }

    const coins = Math.round(monsterGold(m.xp, m.boss) * boost.goldMult)
    const gainedXp = Math.round(m.xp * boost.xpMult)
    xp += gainedXp
    gold += coins
    events.push({ at: t, kind: 'monsterDie', xp: gainedXp, gold: coins })
    t += TIMING.die
  }

  if (berserkOn) events.push({ at: t, kind: 'berserk', on: false })
  // Ordem de tempo (os disparos da aproximação são anotados antes)
  events.sort((x, y) => x.at - y.at)

  const clearXp = won ? Math.round(clearBonusXp(stage.index) * boost.xpMult) : 0
  const clearGold = won ? Math.round(clearBonusGold(stage.index) * boost.goldMult) : 0
  xp += clearXp
  gold += clearGold
  events.push({ at: t, kind: 'end', won })

  let newLevel = progress.level
  let newXp = progress.xp + xp
  while (newXp >= xpToNext(newLevel)) {
    newXp -= xpToNext(newLevel)
    newLevel += 1
  }

  const unlocked =
    won && stage.index === progress.unlockedStage && stage.index < STAGE_COUNT ? stage.index + 1 : undefined

  return {
    stage: stage.index,
    won,
    events,
    heroMaxHp: hero.maxHp,
    waves: stage.monsters.length,
    xpGained: xp,
    clearXp,
    clearGold,
    goldGained: gold,
    levelsGained: newLevel - progress.level,
    unlocked,
    bossDefeatedNow: won && Boolean(stage.boss) && !progress.bossDefeated,
    duration: t,
  }
}

/** Aplica o resultado de uma ida ao progresso do herói. */
export function applyRun<T extends HeroProgress>(progress: T, result: RunResult): T {
  let level = progress.level
  let xp = progress.xp + result.xpGained
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level += 1
  }
  return {
    ...progress,
    level,
    xp,
    gold: progress.gold + result.goldGained,
    unlockedStage: result.unlocked ?? progress.unlockedStage,
    bossDefeated: progress.bossDefeated || result.bossDefeatedNow,
    runs: progress.runs + 1,
    wins: progress.wins + (result.won ? 1 : 0),
  }
}
