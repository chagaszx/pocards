import type { ImportPreview } from './types'

export type FileKind = 'anki' | 'text'

export function fileKind(fileName: string): FileKind | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (ext === 'apkg' || ext === 'colpkg') return 'anki'
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return 'text'
  return null
}

/** Nome do arquivo sem extensão: "Verbos irregulares.csv" → "Verbos irregulares". */
export function baseName(fileName: string, fallback: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim() || fallback
}

/** Carrega o leitor do Anki só quando precisa (ele é pesado). */
export async function parseAnkiFile(file: File, defaultDeckName: string): Promise<ImportPreview> {
  const { parseAnkiPackage } = await import('./anki')
  return parseAnkiPackage(file, defaultDeckName)
}
