/** Capa pequena de baralho (bandeira etc.). Só aceita imagens que vêm com o app. */
export default function DeckCover({ src, size = 'sm' }: { src?: string; size?: 'sm' | 'lg' }) {
  if (!src || !src.startsWith('/biblioteca/img/')) return null
  const box = size === 'lg' ? 'h-12 w-16' : 'h-7 w-[38px]'
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={`${box} shrink-0 rounded-md border border-line object-cover`}
    />
  )
}
