import { db, getGameState } from '../db/db'
import type { GameState } from '../db/types'
import { fetchBossPodium, onlineConfigured, onlineUserId, type PodiumEntry } from '../lib/online'

/**
 * Confere a medalha deste aparelho com o pódio mundial. Quem manda é o servidor:
 * - o pódio tem este jogador → a medalha daqui fica igual à de lá;
 * - não tem mais (ex.: o pódio foi zerado) → a medalha daqui some e, se ele já
 *   venceu o chefe, pode registrar a vitória de novo;
 * - venceu o chefe, ficou sem medalha e abriu vaga no pódio → pode registrar.
 */
export async function syncMedal(podium: PodiumEntry[]): Promise<void> {
  const me = onlineUserId()
  const mine = me ? podium.find((entry) => entry.user_id === me) : undefined
  await db.transaction('rw', db.game, async () => {
    if (!(await db.game.get('main'))) return
    const state = await getGameState()
    let patch: Partial<GameState> | null = null
    if (mine) {
      if (state.medal !== mine.rank || state.medalPending || state.medalName !== mine.nickname) {
        patch = { medal: mine.rank, medalPending: false, medalName: mine.nickname }
      }
    } else if (state.medal > 0) {
      // Só dá para ter certeza se este aparelho é o mesmo jogador que registrou
      if (me) patch = { medal: 0, medalPending: state.bossDefeated || state.bossKills > 0 }
    } else if (!state.medalPending && state.bossDefeated && podium.length < 3) {
      patch = { medalPending: true }
    }
    if (patch) await db.game.put({ ...state, ...patch })
  })
}

/** Ao abrir o app: confere a medalha de quem já registrou neste aparelho alguma vez. */
export async function syncMedalFromServer(): Promise<void> {
  if (!onlineConfigured() || !onlineUserId()) return
  await syncMedal(await fetchBossPodium())
}
