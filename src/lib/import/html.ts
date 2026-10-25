export interface HtmlOptions {
  /** Imagens locais do Anki viram ![](anki:arquivo) para depois serem trocadas pelas imagens salvas. */
  ankiMedia?: boolean
}

/**
 * Converte o HTML dos campos (o Anki salva negrito, listas, imagens etc. como HTML)
 * na formatação do Pocards: **negrito**, *itálico*, listas, $fórmulas$ e imagens.
 */
export function htmlToText(html: string, options: HtmlOptions = {}): string {
  const cleaned = html.replace(/\[sound:[^\]]*\]/g, '')
  if (!/[<&]/.test(cleaned)) return finish(cleaned)
  const doc = new DOMParser().parseFromString(cleaned, 'text/html')
  return finish(walk(doc.body, options))
}

function walk(node: Node, options: HtmlOptions): string {
  let out = ''
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += (child.textContent ?? '').replace(/ /g, ' ')
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const el = child as Element
    const tag = el.tagName.toLowerCase()

    switch (tag) {
      case 'br':
        out += '\n'
        break
      case 'b':
      case 'strong': {
        const inner = walk(el, options).trim()
        if (inner) out += `**${inner}**`
        break
      }
      case 'i':
      case 'em': {
        const inner = walk(el, options).trim()
        if (inner) out += `*${inner}*`
        break
      }
      case 'img': {
        const src = el.getAttribute('src') ?? ''
        const alt = (el.getAttribute('alt') ?? '').replace(/[[\]\n]/g, '')
        if (/^https:\/\//i.test(src)) out += `\n![${alt}](${src.replace(/[\s)]/g, encodeURIComponent)})\n`
        else if (options.ankiMedia && src && !/^data:/i.test(src)) out += `\n![${alt}](anki:${encodeURIComponent(src)})\n`
        break
      }
      case 'ul':
      case 'ol': {
        let n = 1
        out += '\n'
        el.querySelectorAll(':scope > li').forEach((li) => {
          const marker = tag === 'ol' ? `${n++}. ` : '- '
          out += marker + walk(li, options).trim().replace(/\n+/g, ' ') + '\n'
        })
        break
      }
      case 'div':
      case 'p':
      case 'li':
      case 'tr':
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        out += `\n${walk(el, options)}\n`
        break
      case 'script':
      case 'style':
        break
      default:
        out += walk(el, options)
    }
  })
  return out
}

/** Fórmulas no formato do Anki (MathJax: \( \) e \[ \]) viram $ $ e $$ $$; limpa espaços. */
function finish(text: string): string {
  return text
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, tex: string) => `$${tex.trim()}$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, tex: string) => `\n$$${tex.trim()}$$\n`)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const CLOZE = /\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g

export function hasCloze(text: string): boolean {
  return /\{\{c\d+::/.test(text)
}

/** Frente do cloze: "A capital é {{c1::Brasília}}" → "A capital é [...]" */
export function clozeFront(text: string): string {
  return text.replace(CLOZE, (_match, _answer: string, hint?: string) => (hint ? `[${hint}]` : '[...]'))
}

/** Verso do cloze: "A capital é {{c1::Brasília}}" → "A capital é Brasília" */
export function clozeBack(text: string): string {
  return text.replace(CLOZE, (_match, answer: string) => answer)
}
