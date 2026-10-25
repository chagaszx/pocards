import { useEffect, useState } from 'react'

/**
 * Hora atual que se atualiza sozinha a cada `everyMs`. Serve para as contagens
 * de "para hoje" mudarem com a tela aberta (ex.: o card do "Errei" volta em 5 min).
 */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(id)
  }, [everyMs])
  return now
}
