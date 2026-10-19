# Pocards

Flashcards gratuitos com repetição espaçada, direto no navegador. Funciona offline e pode ser instalado no celular como app (PWA).

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) 20 ou mais recente.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173).

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com recarga automática |
| `npm run build` | Confere os tipos e gera a versão final em `dist/` |
| `npm run preview` | Serve a versão final localmente (para testar o PWA/offline) |

## O que já funciona

- Criar, renomear e excluir baralhos
- Criar, editar e excluir cards (frente e verso); `Ctrl + Enter` salva
- Sessão de estudo com repetição espaçada (FSRS): mostrar resposta e avaliar em Errei / Difícil / Bom / Fácil, com o próximo intervalo em cada botão
- Atalhos no estudo: `espaço` mostra a resposta, `1` a `4` avaliam
- Contador de cards para hoje por baralho
- Exportar e importar backup em JSON
- Tudo salvo no aparelho (IndexedDB), funcionando offline

## Tecnologias

React + TypeScript + Vite, Tailwind CSS v4, Dexie (IndexedDB), ts-fsrs (algoritmo de revisão), vite-plugin-pwa e React Router.

## Estrutura

```
src/
  main.tsx            ponto de entrada
  App.tsx             rotas
  index.css           tema (cores, fontes) e classes base
  components/         Layout e Logo
  pages/
    DecksPage.tsx     lista de baralhos (tela inicial)
    DeckPage.tsx      editor de cards de um baralho
    StudyPage.tsx     sessão de estudo
  db/
    types.ts          formato de Baralho e Card
    db.ts             banco local e operações (criar, editar, excluir, revisar)
  lib/
    srs.ts            FSRS: agendamento e formatação de intervalos
    useLive.ts        hook que atualiza a tela quando o banco muda
    backup.ts         exportar/importar JSON
public/               ícones do app
```

## Publicar no GitHub

Crie um repositório vazio chamado `pocards` em https://github.com/new (sem README), depois, nesta pasta:

```bash
git init
git add .
git commit -m "Projeto base do Pocards"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/pocards.git
git push -u origin main
```

## Publicar na Vercel (Fase 2)

Em https://vercel.com, importe o repositório do GitHub. A Vercel detecta o Vite sozinha; o arquivo `vercel.json` já cuida das rotas.
