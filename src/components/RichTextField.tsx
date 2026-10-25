import {
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'
import { saveImage } from '../db/db'
import { useT } from '../i18n'
import { compressImage, MAX_IMAGE_BYTES } from '../lib/images'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  inputRef?: RefObject<HTMLTextAreaElement | null>
}

const BULLET_LINE = /^\s*[-*•]\s+/
const NUMBERED_LINE = /^\s*\d+[.)]\s+/

/** Posição fora de uma fórmula $...$ da linha (uma imagem não pode cair dentro dela). */
function outsideFormula(text: string, pos: number): number {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1
  const dollars = (text.slice(lineStart, pos).match(/\$/g) ?? []).length
  if (dollars % 2 === 0) return pos
  const close = text.indexOf('$', pos)
  return close === -1 ? pos : close + 1
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()} // mantém a seleção do texto
      onClick={onClick}
      className="flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  )
}

const iconStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Campo de texto do card com barra de formatação, imagens (botão ou colar) e atalhos. */
export default function RichTextField({ label, value, onChange, onKeyDown, inputRef }: Props) {
  const t = useT()
  const localRef = useRef<HTMLTextAreaElement>(null)
  const ref = inputRef ?? localRef
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Texto mais recente (a imagem demora a ficar pronta e a pessoa pode continuar digitando). */
  const latest = useRef(value)
  latest.current = value

  /** Troca o trecho [start, end) de `base` por `insert` e seleciona [selStart, selEnd) depois. */
  function replace(start: number, end: number, insert: string, selStart: number, selEnd: number, base = value) {
    onChange(base.slice(0, start) + insert + base.slice(end))
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(selStart, selEnd)
    })
  }

  function wrap(before: string, after: string, placeholder: string) {
    const el = ref.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const selected = value.slice(s, e) || placeholder
    replace(s, e, before + selected + after, s + before.length, s + before.length + selected.length)
  }

  function toggleList(kind: 'bullet' | 'number') {
    const el = ref.current
    if (!el) return
    const start = value.lastIndexOf('\n', el.selectionStart - 1) + 1
    let end = value.indexOf('\n', el.selectionEnd)
    if (end === -1) end = value.length
    const lines = value.slice(start, end).split('\n')
    const pattern = kind === 'bullet' ? BULLET_LINE : NUMBERED_LINE
    const already = lines.every((line) => pattern.test(line))
    const next = lines
      .map((line, i) => {
        if (already) return line.replace(pattern, '')
        const clean = line.replace(BULLET_LINE, '').replace(NUMBERED_LINE, '')
        return (kind === 'bullet' ? '- ' : `${i + 1}. `) + clean
      })
      .join('\n')
    replace(start, end, next, start, start + next.length)
  }

  function formula() {
    const el = ref.current
    if (!el) return
    const selected = value.slice(el.selectionStart, el.selectionEnd)
    if (selected.includes('\n')) wrap('$$\n', '\n$$', selected)
    else wrap('$', '$', t.editor.formulaPlaceholder)
  }

  async function addImage(file: File | Blob | undefined) {
    if (!file) return
    setError(null)
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t.editor.imageTooBig)
      return
    }
    setBusy(true)
    try {
      const id = await saveImage(await compressImage(file))
      // Usa o texto e o cursor de agora (não os de quando o botão foi tocado) e
      // insere sem apagar o que estiver selecionado, nunca dentro de uma fórmula.
      const text = latest.current
      const caret = outsideFormula(text, Math.min(ref.current?.selectionEnd ?? text.length, text.length))
      const before = caret > 0 && text[caret - 1] !== '\n' ? '\n' : ''
      const after = caret < text.length && text[caret] !== '\n' ? '\n' : ''
      const snippet = `${before}![](img:${id})${after}`
      replace(caret, caret, snippet, caret + snippet.length, caret + snippet.length, text)
    } catch (err) {
      console.error(err)
      setError(t.editor.imageError)
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const item = [...event.clipboardData.items].find((i) => i.type.startsWith('image/'))
    if (!item) return
    event.preventDefault()
    void addImage(item.getAsFile() ?? undefined)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
      const key = event.key.toLowerCase()
      if (key === 'b') {
        event.preventDefault()
        wrap('**', '**', t.editor.textPlaceholder)
        return
      }
      if (key === 'i') {
        event.preventDefault()
        wrap('*', '*', t.editor.textPlaceholder)
        return
      }
    }
    onKeyDown?.(event)
  }

  return (
    <div className="block space-y-1.5">
      <span className="label block">{label}</span>
      <div className="overflow-hidden rounded-[0.625rem] border border-border bg-bg focus-within:border-border-strong">
        <div role="toolbar" aria-label={t.editor.toolbar} className="flex flex-wrap items-center gap-0.5 border-b border-line px-1 py-1">
          <ToolButton label={t.editor.bold} onClick={() => wrap('**', '**', t.editor.textPlaceholder)}>
            <span className="text-[15px] font-bold">B</span>
          </ToolButton>
          <ToolButton label={t.editor.italic} onClick={() => wrap('*', '*', t.editor.textPlaceholder)}>
            <span className="font-serif text-[16px] italic">I</span>
          </ToolButton>
          <ToolButton label={t.editor.bulletList} onClick={() => toggleList('bullet')}>
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
              <path d="M9 6h11M9 12h11M9 18h11" {...iconStroke} />
              <circle cx="4.5" cy="6" r="1.2" fill="currentColor" />
              <circle cx="4.5" cy="12" r="1.2" fill="currentColor" />
              <circle cx="4.5" cy="18" r="1.2" fill="currentColor" />
            </svg>
          </ToolButton>
          <ToolButton label={t.editor.numberedList} onClick={() => toggleList('number')}>
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
              <path d="M10 6h10M10 12h10M10 18h10" {...iconStroke} />
              <path d="M4 4.5h1.2V8M4 8h2.4M3.8 11h2.2l-2.2 3h2.4M3.8 16.5h2.4l-1.2 1.2c.9 0 1.3.5 1.3 1s-.5 1-1.3 1H3.8" {...iconStroke} strokeWidth={1.2} />
            </svg>
          </ToolButton>
          <ToolButton label={t.editor.formula} onClick={formula}>
            <span className="font-serif text-[16px]">∑</span>
          </ToolButton>
          <ToolButton label={t.editor.image} onClick={() => fileInput.current?.click()}>
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="14" rx="2.5" {...iconStroke} />
              <circle cx="9" cy="10" r="1.6" {...iconStroke} />
              <path d="M4 17l5-4.5 3.5 3 3-2.5L20 17" {...iconStroke} />
            </svg>
          </ToolButton>
          {busy && <span className="ml-1 text-xs text-muted">{t.editor.addingImage}</span>}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => addImage(e.target.files?.[0])}
          />
        </div>
        <textarea
          ref={ref as Ref<HTMLTextAreaElement>}
          aria-label={label}
          className="block min-h-20 w-full resize-y bg-transparent px-3 py-2.5 text-fg outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
      </div>
      {error && <p className="text-[13px] text-again">{error}</p>}
    </div>
  )
}
