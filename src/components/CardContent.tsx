import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useImageUrl } from '../lib/images'
import { loadKatex } from '../lib/katex'
import { parseMarkdown, type Inline } from '../lib/markdown'

/** Fórmula desenhada com KaTeX (enquanto carrega, mostra o código da fórmula). */
function Formula({ tex, display }: { tex: string; display: boolean }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadKatex()
      .then((katex) => {
        // trust: false bloqueia \href, \url, \includegraphics e afins; maxSize e maxExpand
        // impedem fórmulas montadas para cobrir a tela ou travar o desenho.
        if (active) {
          setHtml(
            katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, maxSize: 20, maxExpand: 500, strict: 'ignore' }),
          )
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [tex, display])

  const Tag = display ? 'div' : 'span'
  if (!html) return <Tag className="font-mono text-[0.9em] text-muted">{tex}</Tag>
  // O KaTeX gera o HTML a partir da fórmula e escapa o texto, então é seguro inserir
  return <Tag className={display ? 'my-2 overflow-x-auto' : ''} dangerouslySetInnerHTML={{ __html: html }} />
}

function CardImage({ src, alt, compact }: { src: string; alt: string; compact: boolean }) {
  const storedId = src.startsWith('img:') ? src.slice(4) : null
  const storedUrl = useImageUrl(storedId)
  // img:ID = salva no aparelho · /biblioteca/... = imagem que vem com o app · https:// = internet
  const url = storedId ? storedUrl : /^https:\/\//i.test(src) || src.startsWith('/biblioteca/img/') ? src : null

  const size = compact ? 'max-h-20' : 'max-h-72'
  if (!url) return <span className={`inline-block ${compact ? 'h-12 w-16' : 'h-40 w-full'} rounded-lg bg-surface-2`} />
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={`inline-block ${size} max-w-full rounded-lg border border-line object-contain`}
    />
  )
}

function renderInline(nodes: Inline[], compact: boolean): ReactNode {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={i}>{node.value}</Fragment>
      case 'break':
        return <br key={i} />
      case 'bold':
        return (
          <strong key={i} className="font-semibold">
            {renderInline(node.children, compact)}
          </strong>
        )
      case 'italic':
        return <em key={i}>{renderInline(node.children, compact)}</em>
      case 'code':
        return (
          <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]">
            {node.value}
          </code>
        )
      case 'math':
        return <Formula key={i} tex={node.value} display={false} />
      case 'image':
        return <CardImage key={i} src={node.src} alt={node.alt} compact={compact} />
    }
  })
}

/**
 * Mostra o texto de um card com a formatação: negrito, itálico, listas, fórmulas e imagens.
 * `compact` = versão menor, para listas.
 */
export default function CardContent({
  text,
  className = '',
  compact = false,
}: {
  text: string
  className?: string
  compact?: boolean
}) {
  const blocks = useMemo(() => parseMarkdown(text), [text])

  return (
    <div className={`space-y-2 break-words ${className}`}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'paragraph':
            return <p key={i}>{renderInline(block.children, compact)}</p>
          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul'
            return (
              <ListTag
                key={i}
                start={block.ordered ? block.start : undefined}
                className={`inline-block space-y-0.5 pl-5 text-left ${block.ordered ? 'list-decimal' : 'list-disc'}`}
              >
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item, compact)}</li>
                ))}
              </ListTag>
            )
          }
          case 'math':
            return <Formula key={i} tex={block.value} display />
          case 'image':
            return (
              <div key={i}>
                <CardImage src={block.src} alt={block.alt} compact={compact} />
              </div>
            )
        }
      })}
    </div>
  )
}
