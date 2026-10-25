import { ONLINE } from '../config'

/**
 * Ligação com o servidor online (Supabase), sem bibliotecas extras: só fetch.
 * Cada aparelho entra como um jogador anônimo (não pede e-mail nem senha).
 */

export interface PodiumEntry {
  rank: 1 | 2 | 3
  nickname: string
  created_at: string
  /** Jogador anônimo dono da medalha. */
  user_id?: string
}

interface Session {
  access_token: string
  refresh_token: string
  /** Quando o token vence (ms). */
  expires_at: number
}

const SESSION_KEY = 'pocards-online-session'

export function onlineConfigured(): boolean {
  return Boolean(ONLINE.supabaseUrl && ONLINE.supabaseKey)
}

const base = () => ONLINE.supabaseUrl.replace(/\/+$/, '')

function publicHeaders(): Record<string, string> {
  return {
    apikey: ONLINE.supabaseKey,
    Authorization: `Bearer ${ONLINE.supabaseKey}`,
    'Content-Type': 'application/json',
  }
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function saveSession(data: { access_token: string; refresh_token: string; expires_in?: number }): Session {
  const session: Session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // sem armazenamento: vale só nesta visita
  }
  return session
}

/**
 * Nome do pódio sem caracteres invisíveis ou de controle (ex.: o que inverte o
 * texto na tela, usado para enganar quem lê) e sem espaços sobrando.
 */
export function cleanNickname(name: string): string {
  return name
    .replace(/[\u0000-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁤﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
}

/** Id do jogador anônimo deste aparelho (se já entrou alguma vez), lido do token salvo. */
export function onlineUserId(): string | null {
  const token = loadSession()?.access_token
  if (!token) return null
  try {
    const part = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(part)) as { sub?: unknown }
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

/** Entra como jogador anônimo (ou renova a entrada já existente). */
async function getSession(): Promise<Session> {
  const current = loadSession()
  if (current && current.expires_at - 60_000 > Date.now()) return current

  if (current?.refresh_token) {
    const res = await fetch(`${base()}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: publicHeaders(),
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    })
    if (res.ok) return saveSession(await res.json())
  }

  const res = await fetch(`${base()}/auth/v1/signup`, {
    method: 'POST',
    headers: publicHeaders(),
    body: JSON.stringify({ data: {} }),
  })
  if (!res.ok) throw new Error('online-auth')
  return saveSession(await res.json())
}

/**
 * Registra a vitória contra o chefe no ranking mundial.
 * Devolve 1 (ouro), 2 (prata), 3 (bronze) ou 0 se as três já têm dono.
 */
export async function claimBossMedal(nickname: string): Promise<number> {
  if (!onlineConfigured()) throw new Error('online-off')
  const session = await getSession()
  const res = await fetch(`${base()}/rest/v1/rpc/claim_boss_medal`, {
    method: 'POST',
    headers: { ...publicHeaders(), Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ p_nickname: cleanNickname(nickname) }),
  })
  if (!res.ok) throw new Error('online-claim')
  return Number(await res.json())
}

/** Pódio mundial do chefe (até 3 jogadores). */
export async function fetchBossPodium(): Promise<PodiumEntry[]> {
  if (!onlineConfigured()) return []
  const res = await fetch(`${base()}/rest/v1/boss_medals?select=rank,nickname,created_at,user_id&order=rank.asc`, {
    headers: publicHeaders(),
  })
  if (!res.ok) throw new Error('online-podium')
  return (await res.json()) as PodiumEntry[]
}
