/**
 * O KaTeX (que desenha as fórmulas) é carregado só quando algum card
 * tem fórmula, para não deixar o app mais lento para quem não usa.
 */
type Katex = typeof import('katex').default

let loading: Promise<Katex> | null = null

export function loadKatex(): Promise<Katex> {
  loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([mod]) => mod.default)
  loading.catch(() => (loading = null))
  return loading
}
