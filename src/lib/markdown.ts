/**
 * Formatação dos cards (um "markdown" bem pequeno):
 *   **negrito**   *itálico*   `código`
 *   - item de lista      1. item numerado
 *   $fórmula$ na linha   $$fórmula em destaque$$
 *   ![](img:ID) imagem salva no aparelho   ![](https://…) imagem da internet
 * Transforma o texto numa árvore simples; quem desenha é o componente CardContent.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'break' }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'math'; value: string }
  | { type: 'image'; src: string; alt: string }

export type Block =
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Inline[][] }
  | { type: 'math'; value: string }
  | { type: 'image'; src: string; alt: string }

interface InlineRule {
  re: RegExp
  make: (m: RegExpExecArray) => Inline
}

const IMAGE = /!\[([^\]\n]*)\]\(([^)\s]+)\)/

const INLINE_RULES: InlineRule[] = [
  { re: /`([^`\n]+)`/, make: (m) => ({ type: 'code', value: m[1] }) },
  // $x$ — sem espaço logo depois do primeiro $ nem antes do último (assim "R$ 10 e R$ 20" não vira fórmula)
  { re: /\$(?=\S)([^$\n]*?\S)\$/, make: (m) => ({ type: 'math', value: m[1] }) },
  { re: IMAGE, make: (m) => ({ type: 'image', alt: m[1], src: m[2] }) },
  { re: /\*\*(?=\S)([\s\S]*?\S)\*\*/, make: (m) => ({ type: 'bold', children: parseInline(m[1]) }) },
  { re: /(?<![\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\w*])/, make: (m) => ({ type: 'italic', children: parseInline(m[1]) }) },
  { re: /(?<![\w_])_(?=[^\s_])([^_\n]*?[^\s_])_(?![\w_])/, make: (m) => ({ type: 'italic', children: parseInline(m[1]) }) },
]

function pushText(out: Inline[], text: string) {
  const parts = text.split('\n')
  parts.forEach((part, i) => {
    if (i > 0) out.push({ type: 'break' })
    if (part) out.push({ type: 'text', value: part })
  })
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let rest = text
  while (rest) {
    let best: { index: number; match: RegExpExecArray; rule: InlineRule } | null = null
    for (const rule of INLINE_RULES) {
      const match = rule.re.exec(rest)
      if (match && (!best || match.index < best.index)) best = { index: match.index, match, rule }
    }
    if (!best) {
      pushText(out, rest)
      break
    }
    pushText(out, rest.slice(0, best.index))
    out.push(best.rule.make(best.match))
    rest = rest.slice(best.index + best.match[0].length)
  }
  return out
}

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/

/**
 * Até quantos caracteres a formatação é lida. Um card montado de propósito com
 * milhares de trechos formatados travaria a tela; acima disso, o resto aparece
 * como texto simples (cards normais têm bem menos que isso).
 */
const MAX_FORMATTED = 10_000

export function parseMarkdown(input: string): Block[] {
  // Um valor que não é texto (ex.: backup corrompido) não pode derrubar a tela
  const source = typeof input === 'string' ? input : String(input ?? '')
  if (source.length > MAX_FORMATTED) {
    const lineEnd = source.lastIndexOf('\n', MAX_FORMATTED)
    const cut = lineEnd > MAX_FORMATTED / 2 ? lineEnd : MAX_FORMATTED
    const tail: Inline[] = []
    pushText(tail, source.slice(cut).replace(/^\n/, ''))
    return [...parseMarkdown(source.slice(0, cut)), { type: 'paragraph', children: tail }]
  }
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let paragraph: string[] = []
  let inList = false

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) })
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Fórmula em destaque: $$...$$ numa linha ou em várias
    if (trimmed.startsWith('$$')) {
      flush()
      inList = false
      if (trimmed.length > 4 && trimmed.endsWith('$$')) {
        blocks.push({ type: 'math', value: trimmed.slice(2, -2).trim() })
        continue
      }
      const body = [trimmed.slice(2)]
      i += 1
      while (i < lines.length && !lines[i].trim().endsWith('$$')) {
        body.push(lines[i])
        i += 1
      }
      if (i < lines.length) body.push(lines[i].trim().slice(0, -2))
      blocks.push({ type: 'math', value: body.join('\n').trim() })
      continue
    }

    // Imagem sozinha na linha: vira bloco (centralizada)
    const image = trimmed.match(new RegExp(`^${IMAGE.source}$`))
    if (image) {
      flush()
      inList = false
      blocks.push({ type: 'image', alt: image[1], src: image[2] })
      continue
    }

    const bullet = line.match(BULLET)
    const numbered = line.match(NUMBERED)
    if (bullet || numbered) {
      flush()
      const ordered = Boolean(numbered)
      const content = parseInline(bullet ? bullet[1] : numbered![2])
      const last = blocks[blocks.length - 1]
      if (inList && last?.type === 'list' && last.ordered === ordered) last.items.push(content)
      else blocks.push({ type: 'list', ordered, start: numbered ? Number(numbered[1]) : 1, items: [content] })
      inList = true
      continue
    }

    inList = false
    if (trimmed === '') {
      flush()
      continue
    }
    paragraph.push(line)
  }
  flush()
  return blocks
}

/** O texto tem alguma formatação? (para decidir se mostra a pré-visualização) */
export function hasFormatting(text: string): boolean {
  return /\*|_|`|\$|!\[|^\s*([-•]|\d+[.)])\s/m.test(text)
}

function inlineToText(nodes: Inline[], imageLabel: string): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.value
        case 'break':
          return '\n'
        case 'bold':
        case 'italic':
          return inlineToText(node.children, imageLabel)
        case 'code':
        case 'math':
          return node.value
        case 'image':
          return node.alt || imageLabel
      }
    })
    .join('')
}

/** Versão sem formatação, para prévias de uma linha e leitores de tela. */
export function toPlainText(source: string, imageLabel = ''): string {
  return parseMarkdown(source)
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
          return inlineToText(block.children, imageLabel)
        case 'list':
          return block.items.map((item) => inlineToText(item, imageLabel)).join(' · ')
        case 'math':
          return block.value
        case 'image':
          return block.alt || imageLabel
      }
    })
    .filter(Boolean)
    .join(' ')
    .trim()
}

/** Ids das imagens salvas no aparelho que o texto usa. */
export function imageIdsIn(text: string): string[] {
  return [...text.matchAll(/\]\(img:([\w-]+)\)/g)].map((m) => m[1])
}
