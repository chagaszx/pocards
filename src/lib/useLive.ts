import { liveQuery } from 'dexie'
import { useEffect, useState, type DependencyList } from 'react'

/** Uma consulta que não responde nesse tempo vira um aviso, em vez de "Carregando…" para sempre. */
const STUCK_MS = 20_000

/**
 * Executa uma consulta no banco local e re-renderiza sozinho quando os dados mudam.
 * Devolve `undefined` enquanto carrega. Se a consulta falhar (ou travar), o erro
 * sobe para o aviso de erro da tela, que mostra o motivo e deixa tentar de novo.
 */
export function useLive<T>(query: () => T | Promise<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let answered = false
    const stuck = window.setTimeout(() => {
      if (!answered) setError(Object.assign(new Error('O banco local não respondeu'), { name: 'LoadTimeout' }))
    }, STUCK_MS)
    const subscription = liveQuery(query).subscribe({
      next: (result) => {
        answered = true
        window.clearTimeout(stuck)
        setValue(() => result)
      },
      error: (err) => {
        answered = true
        window.clearTimeout(stuck)
        console.error('Erro ao ler o banco local:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
      },
    })
    return () => {
      window.clearTimeout(stuck)
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  if (error) throw error
  return value
}
