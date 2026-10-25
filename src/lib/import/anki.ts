import { decompress } from 'fzstd'
import JSZip from 'jszip'
import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { clozeBack, clozeFront, hasCloze, htmlToText } from './html'
import { ankiMediaRefs } from './media'
import type { ImportPreview, ParsedDeck } from './types'

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd]

function isZstd(bytes: Uint8Array): boolean {
  return ZSTD_MAGIC.every((byte, i) => bytes[i] === byte)
}

/**
 * Limites contra arquivos-bomba: pacotes pequenos que viram gigabytes ao
 * descompactar e esgotam a memória do aparelho (a aba trava ou fecha).
 */
const MAX_PACKAGE_BYTES = 1024 * 1024 * 1024
const MAX_COLLECTION_BYTES = 512 * 1024 * 1024
const MAX_MEDIA_BYTES = 25 * 1024 * 1024

/** Tamanho descompactado que o .zip declara para um arquivo (sem descompactar). */
function declaredSize(entry: JSZip.JSZipObject): number {
  const data = (entry as unknown as { _data?: { uncompressedSize?: unknown } })._data
  return typeof data?.uncompressedSize === 'number' ? data.uncompressedSize : 0
}

/** Tamanho que um quadro zstd declara ter depois de descompactado (0 = não declara). */
function zstdDeclaredSize(bytes: Uint8Array): number {
  if (!isZstd(bytes) || bytes.length < 6) return 0
  const fhd = bytes[4]
  const fcsFlag = fhd >> 6
  const single = (fhd >> 5) & 1
  const pos = 5 + (single ? 0 : 1) + [0, 1, 2, 4][fhd & 3]
  const fcsSize = fcsFlag === 0 ? (single ? 1 : 0) : [0, 2, 4, 8][fcsFlag]
  if (fcsSize === 0 || pos + fcsSize > bytes.length) return 0
  let size = 0
  for (let i = 0; i < fcsSize; i++) size += bytes[pos + i] * 2 ** (8 * i)
  return fcsSize === 2 ? size + 256 : size
}

/**
 * Lê um pacote do Anki (.apkg ou .colpkg). Por dentro ele é um .zip com um
 * banco SQLite; nas versões novas do Anki esse banco vem compactado (zstd).
 * Cada nota vira um card: 1º campo = frente, 2º campo = verso.
 * As imagens usadas pelos cards também são extraídas.
 */
export async function parseAnkiPackage(file: Blob, defaultDeckName: string): Promise<ImportPreview> {
  if (file.size > MAX_PACKAGE_BYTES) throw new Error('anki-too-big')
  const zip = await JSZip.loadAsync(file)

  let bytes: Uint8Array | null = null
  const modern = zip.file('collection.anki21b')
  if (modern) {
    if (declaredSize(modern) > MAX_COLLECTION_BYTES) throw new Error('anki-too-big')
    const packed = await modern.async('uint8array')
    if (zstdDeclaredSize(packed) > MAX_COLLECTION_BYTES) throw new Error('anki-too-big')
    bytes = decompress(packed)
  } else {
    const legacy = zip.file('collection.anki21') ?? zip.file('collection.anki2')
    if (legacy) {
      if (declaredSize(legacy) > MAX_COLLECTION_BYTES) throw new Error('anki-too-big')
      bytes = await legacy.async('uint8array')
    }
  }
  if (!bytes) throw new Error('anki-invalid')

  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const db = new SQL.Database(bytes)

  let decks: ParsedDeck[]
  let skipped = 0
  try {
    const deckNames = readDeckNames(db)
    const result = db.exec(
      'SELECT n.flds, MIN(c.did) FROM notes n JOIN cards c ON c.nid = n.id GROUP BY n.id ORDER BY n.id',
    )
    const rows = result[0]?.values ?? []
    const byDeck = new Map<string, ParsedDeck>()
    const html = (value: string) => htmlToText(value, { ankiMedia: true })

    for (const [flds, did] of rows) {
      const fields = String(flds).split('\x1f')
      const first = fields[0] ?? ''
      const second = html(fields[1] ?? '')

      let front: string
      let back: string
      if (hasCloze(first)) {
        const text = html(first)
        front = clozeFront(text)
        back = clozeBack(text) + (second ? `\n\n${second}` : '')
      } else {
        front = html(first)
        back = second
      }

      if (!front || !back) {
        skipped += 1
        continue
      }

      const deckId = String(did)
      const deck = byDeck.get(deckId) ?? { name: deckNames.get(deckId) ?? defaultDeckName, cards: [] }
      deck.cards.push({ front, back })
      byDeck.set(deckId, deck)
    }
    decks = [...byDeck.values()]
  } finally {
    db.close()
  }

  const media = await extractMedia(zip, decks)
  return { decks, skipped, media }
}

/** Nomes dos baralhos. Subbaralhos ("Inglês::Verbos") viram "Inglês › Verbos". */
function readDeckNames(db: Database): Map<string, string> {
  const names = new Map<string, string>()
  const hasDecksTable = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'decks'")

  if (hasDecksTable[0]?.values.length) {
    // Formato novo: tabela "decks", hierarquia separada por \x1f
    for (const [id, name] of db.exec('SELECT id, name FROM decks')[0]?.values ?? []) {
      names.set(String(id), String(name).split('\x1f').join(' › '))
    }
  } else {
    // Formato antigo: JSON dentro da tabela "col"
    const raw = db.exec('SELECT decks FROM col')[0]?.values[0]?.[0]
    if (raw) {
      const parsed = JSON.parse(String(raw)) as Record<string, { name: string }>
      for (const [id, deck] of Object.entries(parsed)) {
        names.set(String(id), deck.name.split('::').join(' › '))
      }
    }
  }
  return names
}

// ---------- Imagens (mídia) do pacote ----------

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
}

/**
 * Extrai do .apkg só as imagens que os cards usam.
 * Devolve um mapa: nome do arquivo (como aparece no card, codificado) → imagem.
 */
async function extractMedia(zip: JSZip, decks: ParsedDeck[]): Promise<Map<string, Blob>> {
  const media = new Map<string, Blob>()
  const wanted = new Set<string>()
  for (const deck of decks) for (const card of deck.cards) for (const ref of ankiMediaRefs(`${card.front}\n${card.back}`)) wanted.add(ref)
  if (wanted.size === 0) return media

  let names: Map<string, string>
  try {
    names = await readMediaIndex(zip)
  } catch (err) {
    console.warn('Não consegui ler a lista de mídia do Anki', err)
    return media
  }

  for (const encoded of wanted) {
    // O card pode citar o arquivo como está ("foto 1.png") ou codificado ("foto%201.png")
    const src = safeDecode(encoded)
    const fileName = [src, safeDecode(src)].find((name) => names.has(name)) ?? src
    const entry = names.get(fileName)
    const zipFile = entry !== undefined ? zip.file(entry) : null
    if (!zipFile || declaredSize(zipFile) > MAX_MEDIA_BYTES) continue
    const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
    const type = MIME[ext]
    if (!type) continue
    try {
      let data = await zipFile.async('uint8array')
      if (isZstd(data)) {
        if (zstdDeclaredSize(data) > MAX_MEDIA_BYTES) continue
        data = decompress(data)
      }
      media.set(encoded, new Blob([new Uint8Array(data)], { type }))
    } catch (err) {
      console.warn('Imagem do Anki ignorada:', fileName, err)
    }
  }
  return media
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Lista de mídia do pacote: nome do arquivo → nome da entrada dentro do .zip ("0", "1", …).
 * Formato antigo: JSON {"0": "foto.jpg"}. Formato novo: protobuf compactado com zstd.
 */
async function readMediaIndex(zip: JSZip): Promise<Map<string, string>> {
  const file = zip.file('media')
  if (!file) return new Map()
  const bytes = await file.async('uint8array')

  if (!isZstd(bytes)) {
    try {
      const json = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, string>
      return new Map(Object.entries(json).map(([entry, name]) => [name, entry]))
    } catch {
      // não é JSON: tenta como protobuf sem compactação
    }
  }
  const raw = isZstd(bytes) ? decompress(bytes) : bytes
  return new Map(parseMediaEntries(raw).map((name, i) => [name, String(i)]))
}

// Leitor mínimo de protobuf para a lista de mídia do Anki:
// MediaEntries { repeated MediaEntry entries = 1 }  MediaEntry { string name = 1; ... }

function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let result = 0
  let shift = 0
  let byte: number
  do {
    if (pos >= buf.length) throw new Error('protobuf truncado')
    byte = buf[pos++]
    result += (byte & 0x7f) * 2 ** shift
    shift += 7
  } while (byte & 0x80)
  return [result, pos]
}

function eachField(buf: Uint8Array, onBytes: (field: number, chunk: Uint8Array) => void) {
  let pos = 0
  while (pos < buf.length) {
    const [tag, afterTag] = readVarint(buf, pos)
    pos = afterTag
    const field = Math.floor(tag / 8)
    const wire = tag % 8
    if (wire === 2) {
      const [len, afterLen] = readVarint(buf, pos)
      pos = afterLen
      onBytes(field, buf.subarray(pos, pos + len))
      pos += len
    } else if (wire === 0) {
      pos = readVarint(buf, pos)[1]
    } else if (wire === 5) {
      pos += 4
    } else if (wire === 1) {
      pos += 8
    } else {
      throw new Error('protobuf inválido')
    }
  }
}

function parseMediaEntries(buf: Uint8Array): string[] {
  const names: string[] = []
  const decoder = new TextDecoder()
  eachField(buf, (field, entry) => {
    if (field !== 1) return
    let name = ''
    eachField(entry, (inner, chunk) => {
      if (inner === 1) name = decoder.decode(chunk)
    })
    names.push(name)
  })
  return names
}
