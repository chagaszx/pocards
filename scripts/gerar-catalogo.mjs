// Gera public/biblioteca/catalogo.json a partir dos baralhos da pasta.
// Rode com: npm run catalogo   (sempre que adicionar ou editar um baralho)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const publicDir = join(import.meta.dirname, '..', 'public')
const dir = join(publicDir, 'biblioteca')
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'catalogo.json')

/** Confere se uma imagem local (/biblioteca/img/...) existe de verdade. */
function checkImage(file, where, src) {
  if (src.startsWith('/biblioteca/') && !existsSync(join(publicDir, src))) {
    throw new Error(`${file}: ${where} usa uma imagem que não existe: ${src}`)
  }
}

const catalog = files
  .map((file) => {
    const deck = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    const expectedId = file.replace(/\.json$/, '')
    if (deck.id !== expectedId) throw new Error(`${file}: o "id" precisa ser "${expectedId}"`)
    if (!Array.isArray(deck.cards) || deck.cards.length === 0) throw new Error(`${file}: sem cards`)
    deck.cards.forEach((card, i) => {
      if (!Array.isArray(card) || card.length !== 2 || !card[0]?.trim() || !card[1]?.trim()) {
        throw new Error(`${file}: card ${i + 1} precisa ser ["frente", "verso"]`)
      }
      for (const text of card) {
        for (const m of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) checkImage(file, `card ${i + 1}`, m[1])
      }
    })
    if (deck.cover) checkImage(file, 'a capa', deck.cover)
    return {
      id: deck.id,
      name: deck.name,
      category: deck.category,
      description: deck.description,
      count: deck.cards.length,
      ...(deck.cover ? { cover: deck.cover } : {}),
    }
  })
  .sort((a, b) => a.category.localeCompare(b.category, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR'))

writeFileSync(join(dir, 'catalogo.json'), JSON.stringify(catalog, null, 2) + '\n')
console.log(`Catálogo gerado: ${catalog.length} baralhos, ${catalog.reduce((s, d) => s + d.count, 0)} cards.`)
