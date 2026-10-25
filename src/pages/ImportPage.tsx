import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronLeftIcon } from '../components/icons'
import { useT } from '../i18n'
import { baseName, fileKind, parseAnkiFile } from '../lib/import'
import { importDecksWithMedia } from '../lib/import/media'
import { toPlainText } from '../lib/markdown'
import { parseTextDeck, SEPARATORS, type Separator } from '../lib/import/text'
import type { ParsedCard } from '../lib/import/types'
import { playSound } from '../lib/sound'

interface Draft {
  name: string
  include: boolean
  cards: ParsedCard[]
}

type Mode = 'file' | 'paste'

/** Maior arquivo de texto aceito (CSV, TSV, TXT). */
const MAX_TEXT_BYTES = 50 * 1024 * 1024

export default function ImportPage() {
  const t = useT()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>('file')
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pasted, setPasted] = useState('')
  // Para importações de texto: guarda o texto para poder trocar o separador
  const [textSource, setTextSource] = useState<string | null>(null)
  const [separator, setSeparator] = useState<Separator>('\t')
  // Imagens extraídas do pacote do Anki
  const [media, setMedia] = useState<Map<string, Blob> | undefined>(undefined)

  function reset() {
    setDrafts(null)
    setSkipped(0)
    setError(null)
    setTextSource(null)
    setMedia(undefined)
    if (fileInput.current) fileInput.current.value = ''
  }

  function loadText(text: string, name: string, sep?: Separator) {
    const result = parseTextDeck(text, name, sep)
    setTextSource(text)
    setSeparator(result.separator)
    setSkipped(result.skipped)
    setDrafts([{ name: result.deck.name, include: true, cards: result.deck.cards }])
    if (result.deck.cards.length === 0) setError(t.import.errors.noCards)
  }

  function changeSeparator(sep: Separator) {
    if (!textSource || !drafts) return
    setError(null)
    loadText(textSource, drafts[0]?.name ?? t.import.defaultDeckName, sep)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    reset()
    const kind = fileKind(file.name)
    if (!kind) {
      setError(t.import.errors.unsupported)
      return
    }
    // Texto gigante esgotaria a memória da aba (planilhas normais têm poucos MB)
    if (kind === 'text' && file.size > MAX_TEXT_BYTES) {
      setError(t.import.errors.tooBig)
      return
    }
    setLoading(true)
    try {
      if (kind === 'text') {
        loadText(await file.text(), baseName(file.name, t.import.defaultDeckName))
      } else {
        const preview = await parseAnkiFile(file, t.import.ankiDefaultDeck)
        setSkipped(preview.skipped)
        setMedia(preview.media)
        setDrafts(preview.decks.map((deck) => ({ name: deck.name, include: true, cards: deck.cards })))
        if (preview.decks.length === 0) setError(t.import.errors.ankiEmpty)
      }
    } catch (err) {
      console.error(err)
      const code = err instanceof Error ? err.message : ''
      setError(
        code === 'anki-invalid' ? t.import.errors.ankiInvalid : code === 'anki-too-big' ? t.import.errors.tooBig : t.import.errors.read,
      )
    } finally {
      setLoading(false)
    }
  }

  function handlePastePreview() {
    reset()
    if (!pasted.trim()) return
    loadText(pasted, t.import.pastedDeckName)
  }

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((current) => current && current.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  const selected = (drafts ?? []).filter((d) => d.include && d.cards.length > 0)
  const totalCards = selected.reduce((sum, d) => sum + d.cards.length, 0)

  async function handleImport() {
    if (selected.length === 0) return
    setImporting(true)
    try {
      const result = await importDecksWithMedia(
        selected.map((d) => ({ name: d.name.trim() || t.import.defaultDeckName, cards: d.cards })),
        media,
      )
      playSound('complete')
      alert(t.import.success(result.cards, result.decks))
      navigate('/biblioteca')
    } catch (err) {
      console.error(err)
      setError(t.import.errors.save)
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-3">
        <Link to="/biblioteca" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ChevronLeftIcon />
          {t.import.back}
        </Link>
        <h1 className="text-[26px] font-semibold tracking-tight">{t.import.title}</h1>
        <p className="text-[13px] leading-snug text-muted">{t.import.intro}</p>
      </section>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1">
        {(
          [
            ['file', t.import.modeFile],
            ['paste', t.import.modePaste],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value)
              reset()
            }}
            className={`min-h-10 rounded-lg text-sm font-medium transition-colors ${
              mode === value ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'file' ? (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files[0])
          }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${
            dragging ? 'border-fg bg-surface-2' : 'border-border-strong hover:bg-surface'
          }`}
        >
          <span className="font-medium">{loading ? t.import.reading : t.import.dropTitle}</span>
          <span className="font-mono text-xs text-muted">.apkg · .colpkg · .csv · .tsv · .txt</span>
          <input
            ref={fileInput}
            type="file"
            accept=".apkg,.colpkg,.csv,.tsv,.txt"
            className="sr-only"
            disabled={loading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="label block">{t.import.textLabel}</span>
            <textarea
              className="field min-h-40 resize-y font-mono text-[13px]"
              placeholder={t.import.pastePlaceholder}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          </label>
          <p className="text-[13px] leading-snug text-muted">{t.import.pasteHelp}</p>
          <button className="btn btn-ghost" onClick={handlePastePreview} disabled={!pasted.trim()}>
            {t.import.preview}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-again">
          {error}
        </p>
      )}

      {drafts && drafts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="label">{t.import.previewTitle}</p>
            {textSource !== null && (
              <label className="flex items-center gap-2 text-[13px] text-muted">
                {t.import.separator}
                <select
                  value={separator}
                  onChange={(e) => changeSeparator(e.target.value as Separator)}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-fg"
                >
                  {SEPARATORS.map((sep) => (
                    <option key={sep.label} value={sep.value}>
                      {t.import.separators[sep.label]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <ul className="space-y-3">
            {drafts.map((draft, i) => (
              <li
                key={i}
                className={`space-y-3 rounded-2xl border border-line bg-surface p-4 ${draft.include ? '' : 'opacity-50'}`}
              >
                <div className="flex items-center gap-3">
                  {drafts.length > 1 && (
                    <input
                      type="checkbox"
                      checked={draft.include}
                      onChange={(e) => updateDraft(i, { include: e.target.checked })}
                      aria-label={t.import.includeDeck(draft.name)}
                      className="h-5 w-5 shrink-0 accent-[var(--color-fg)]"
                    />
                  )}
                  <input
                    className="field h-10"
                    value={draft.name}
                    onChange={(e) => updateDraft(i, { name: e.target.value })}
                    aria-label={t.import.deckName}
                  />
                  <span className="shrink-0 font-mono text-xs text-muted">{t.common.nCards(draft.cards.length)}</span>
                </div>
                <ul className="divide-y divide-line border-t border-line text-sm">
                  {draft.cards.slice(0, 3).map((card, j) => (
                    <li key={j} className="grid grid-cols-2 gap-3 py-2">
                      <span className="truncate font-medium">{toPlainText(card.front, t.editor.imageLabel)}</span>
                      <span className="truncate text-muted">{toPlainText(card.back, t.editor.imageLabel)}</span>
                    </li>
                  ))}
                </ul>
                {draft.cards.length > 3 && (
                  <p className="font-mono text-xs text-muted">{t.import.moreCards(draft.cards.length - 3)}</p>
                )}
              </li>
            ))}
          </ul>

          {skipped > 0 && <p className="text-[13px] leading-snug text-muted">{t.import.skipped(skipped)}</p>}

          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={handleImport} disabled={importing || totalCards === 0}>
              {importing ? t.import.importing : t.import.importN(totalCards)}
            </button>
            <button className="btn btn-ghost" onClick={reset} disabled={importing}>
              {t.common.cancel}
            </button>
          </div>
        </section>
      )}

      <section>
        <p className="label mb-2">{t.import.howTitle}</p>
        <dl className="border-t border-line text-sm">
          <div className="border-b border-line py-3.5">
            <dt className="font-medium">Anki</dt>
            <dd className="mt-0.5 leading-snug text-muted">{t.import.howAnki}</dd>
          </div>
          <div className="border-b border-line py-3.5">
            <dt className="font-medium">Quizlet</dt>
            <dd className="mt-0.5 leading-snug text-muted">{t.import.howQuizlet}</dd>
          </div>
          <div className="border-b border-line py-3.5">
            <dt className="font-medium">{t.import.howSheetTitle}</dt>
            <dd className="mt-0.5 leading-snug text-muted">{t.import.howSheet}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
