# Pocards

Flashcards gratuitos com repetição espaçada, direto no navegador — e uma Aventura em que o seu estudo vira energia para um guerreiro enfrentar a masmorra.

**Use agora:** https://pocards.vercel.app

Funciona offline, pode ser instalado no celular ou no PC como app (PWA) e guarda tudo no próprio aparelho. Disponível em português, inglês e espanhol.

## O que tem no app

### Estudo
- Baralhos e cards com repetição espaçada pelo algoritmo FSRS: avalie em Errei / Difícil / Bom / Fácil e veja o próximo intervalo em cada botão.
- Editor com formatação (negrito, itálico, listas), fórmulas matemáticas (KaTeX) e imagens.
- Atalhos no estudo: `espaço` mostra a resposta, `1` a `4` avaliam; `Ctrl + Enter` salva um card.
- Biblioteca com baralhos prontos: capitais do mundo e dos estados do Brasil, tabela periódica, inglês (vocabulário e verbos irregulares), espanhol básico e datas da história do Brasil.
- Importação de baralhos do Anki (`.apkg`, com imagens e formatação), CSV/TXT e Quizlet.
- Resumo com sequência de dias, revisões e desempenho.
- Lembrete diário, tema claro/escuro, sons e backup completo em JSON.

### Aventura
- Cada resposta dá energia (Errei 0 · Difícil 1 · Bom 2 · Fácil 4), que também recarrega sozinha (+2 a cada 15 min, até 10). Cada fase custa 4.
- 10 fases em 3 ambientes (Caverna dos Slimes, Cripta Sombria e Covil dos Goblins) e o chefe, o Rei Goblin.
- O guerreiro luta sozinho, com modo automático, velocidade ×2, músicas próprias para cada ambiente e sons de batalha.
- 6 habilidades (3 ativas, 3 passivas) e uma árvore de evolução comprada com ouro (Força, Armadura, Sabedoria, Fortuna).
- Pódio mundial: os 3 primeiros jogadores a derrotar o chefe ganham medalhas de ouro, prata e bronze.

### Feedback
- Tela para relatar erros e sugerir ideias, enviada direto pelo app (Web3Forms) ou por e-mail.

## Como rodar no computador

Pré-requisito: [Node.js](https://nodejs.org) 20 ou mais recente.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173).

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com recarga automática |
| `npm run build` | Confere os tipos e gera a versão final em `dist/` |
| `npm run preview` | Serve a versão final localmente (para testar o PWA/offline) |
| `npm run catalogo` | Gera de novo o catálogo dos baralhos prontos |

Não use `npm run dev -- --host` em redes públicas: o servidor de desenvolvimento não é feito para ficar exposto.

## Publicação

O site está na [Vercel](https://vercel.com), ligado a este repositório: **cada envio para a branch `main` publica sozinho** em cerca de 1 minuto. O arquivo `vercel.json` cuida das rotas e dos cabeçalhos de segurança (CSP, proteção contra clickjacking e outros).

## Serviços online (opcionais)

O estudo funciona 100% sem servidor. Só dois recursos usam a internet, configurados em `src/config.ts`:

- **Pódio do chefe — [Supabase](https://supabase.com) (plano grátis).** A tabela e a função das medalhas estão em `supabase/medalhas.sql`: cole no SQL Editor e rode. O app entra como jogador anônimo; no código fica só a chave **pública** (publishable). O registro da medalha é protegido por **CAPTCHA (Cloudflare Turnstile)**: a chave do site fica em `config.ts` e a chave secreta só no painel do Supabase (Authentication › Attack Protection).
- **Feedback — [Web3Forms](https://web3forms.com).** A chave de envio é pública por natureza; o formulário tem uma armadilha contra robôs.

Nunca coloque chaves secretas (como a `service_role` do Supabase ou a secret do Turnstile) no código: tudo em `src/` vai para o navegador de quem usa o app.

Para zerar o pódio (por exemplo, depois de testes), rode no SQL Editor do Supabase:

```sql
delete from public.boss_medals;
```

## Tecnologias

React 19 + TypeScript + Vite, Tailwind CSS v4, React Router, Dexie (IndexedDB), ts-fsrs, KaTeX, JSZip + sql.js (importação do Anki), vite-plugin-pwa e Web Audio API (músicas e sons gerados na hora, sem arquivos).

## Estrutura

```
src/
  main.tsx              ponto de entrada
  App.tsx               rotas
  config.ts             e-mail de feedback, Web3Forms, Supabase e CAPTCHA
  index.css             tema (cores, fontes) e classes base
  components/           layout, abas, editor com formatação, conteúdo dos cards, aviso de erro
  pages/
    HomePage.tsx        tela inicial (cards para hoje)
    DecksPage.tsx       biblioteca de baralhos
    ExplorePage.tsx     baralhos prontos
    DeckPage.tsx        editor de cards de um baralho
    StudyPage.tsx       sessão de estudo
    StatsPage.tsx       resumo e sequência de dias
    ImportPage.tsx      importar Anki, CSV/TXT e Quizlet
    HeroPage.tsx        Aventura (batalha, evolução, habilidades, monstros e pódio)
    SettingsPage.tsx    configurações e backup
    FeedbackPage.tsx    enviar feedback
  game/
    data.ts             monstros, fases, habilidades, árvore e números do jogo
    engine.ts           motor das lutas (sorteia a fase inteira de uma vez)
    runner.ts           fases em segundo plano, energia, recompensas, música
    BattleScene.tsx     cena da batalha e animações
    medal.ts            sincroniza a medalha com o pódio
  db/                   banco local (Dexie) e tipos
  lib/
    srs.ts              FSRS: agendamento e intervalos
    import/             leitores de Anki, CSV/TXT e Quizlet
    markdown.ts         formatação dos cards
    backup.ts           exportar/importar JSON (com validação)
    online.ts           Supabase (pódio) e CAPTCHA
    music.ts, sound.ts  músicas e efeitos com Web Audio
    settings.ts         preferências (tema, idioma, sons, lembrete)
  i18n/                 textos em português, inglês e espanhol
public/
  biblioteca/           baralhos prontos e suas imagens
  theme.js              aplica o tema antes de desenhar a tela
scripts/
  gerar-catalogo.mjs    monta public/biblioteca/catalogo.json
supabase/
  medalhas.sql          tabela, regras e função do pódio
```

## Licenças de conteúdo

As bandeiras, mapas e imagens dos baralhos prontos têm seus créditos e licenças em `public/biblioteca/img/` (`CREDITOS.txt` e arquivos `LICENSE`).
