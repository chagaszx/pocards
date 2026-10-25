import { useEffect, useState } from 'react'
import { db } from '../db/db'

/** Tamanho máximo aceito antes de comprimir. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
/** Maior lado da imagem depois de reduzida (em pixels). */
const MAX_SIDE = 1600

/**
 * Reduz e comprime a imagem para não pesar no aparelho
 * (uma foto de 5 MB costuma virar algo entre 150 e 400 KB).
 * GIFs pequenos ficam como estão, para não perder a animação.
 */
export async function compressImage(file: Blob): Promise<Blob> {
  if (file.type === 'image/gif' && file.size < 2 * 1024 * 1024) return file
  if (file.type === 'image/svg+xml') return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))
  const result = (await toBlob('image/webp')) ?? (await toBlob('image/jpeg'))
  // Se a "compressão" ficou maior que o original, mantém o original
  return result && result.size < file.size ? result : file
}

/** Imagens que o navegador desenha sem nunca rodar código. */
const RASTER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'])

/**
 * Endereço temporário para exibir uma imagem salva no aparelho.
 *
 * Segurança: um endereço blob: tem a mesma origem do app. Se uma "imagem" for na
 * verdade HTML ou SVG com script (vinda de um backup ou pacote do Anki malicioso)
 * e a pessoa usar "abrir imagem em nova guia", o script rodaria com acesso aos
 * dados do Pocards. Por isso: fotos comuns usam blob:, SVG vira data: (que abre
 * isolado, sem acesso aos dados) e qualquer outro tipo não é mostrado.
 */
export function useImageUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    setUrl(null)
    if (!id) return
    let active = true
    let objectUrl: string | null = null
    db.images.get(id).then(async (record) => {
      if (!active || !record?.blob) return
      const type = (record.blob.type || record.type || '').toLowerCase()
      if (RASTER_TYPES.has(type)) {
        objectUrl = URL.createObjectURL(record.blob)
        setUrl(objectUrl)
      } else if (type === 'image/svg+xml') {
        const dataUrl = await blobToDataUrl(new Blob([record.blob], { type: 'image/svg+xml' }))
        if (active) setUrl(dataUrl)
      }
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  return url
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const type = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}
