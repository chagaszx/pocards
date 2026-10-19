import { liveQuery } from 'dexie'
import { useEffect, useState, type DependencyList } from 'react'

/**
 * Executa uma consulta no banco local e re-renderiza sozinho quando os dados mudam.
 * Devolve `undefined` enquanto carrega.
 */
export function useLive<T>(query: () => T | Promise<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined)

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (result) => setValue(() => result),
      error: (err) => console.error('Erro ao ler o banco local:', err),
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return value
}
