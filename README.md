# Pocards

**English** · [Português](README.pt-BR.md)

Free spaced-repetition flashcards right in your browser — plus an Adventure where your study sessions become energy for a warrior to battle through a dungeon.

**Try it now:** https://pocards.vercel.app

Works offline, installs on your phone or computer as an app (PWA) and keeps everything on your own device. Available in English, Portuguese and Spanish.

## Features

### Study
- Decks and cards scheduled by the FSRS spaced-repetition algorithm: rate each card Again / Hard / Good / Easy and see the next interval on every button.
- Rich card editor with bold, italics, lists, math formulas (KaTeX) and images.
- Study shortcuts: `space` reveals the answer, `1`–`4` rate it; `Ctrl + Enter` saves a card.
- Ready-made deck library: world capitals, Brazilian state capitals, the periodic table, English vocabulary and irregular verbs, basic Spanish and key dates in Brazilian history.
- Import from Anki (`.apkg`, including images and formatting), CSV/TXT and Quizlet.
- Stats with day streaks, reviews and performance.
- Daily reminder, light/dark theme, sound effects and a full JSON backup.

### Adventure
- Every answer earns energy (Again 0 · Hard 1 · Good 2 · Easy 4), which also refills over time (+2 every 15 min, up to 10). Each stage costs 4.
- 10 stages across 3 areas (Slime Cave, Dark Crypt and Goblin Den), ending with the boss: the Goblin King.
- The warrior fights on his own, with auto mode, 2× speed, a music theme for each area and battle sounds.
- 6 skills (3 active, 3 passive) and an upgrade tree bought with gold (Strength, Armor, Wisdom, Fortune).
- Worldwide podium: the first 3 players to defeat the boss earn gold, silver and bronze medals.

### Feedback
- An in-app screen to report bugs and suggest ideas, sent directly (Web3Forms) or by email.

## Running locally

Requirement: [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open the address shown in the terminal (usually http://localhost:5173).

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-checks and builds the production version into `dist/` |
| `npm run preview` | Serves the production build locally (to test the PWA/offline mode) |
| `npm run catalogo` | Rebuilds the catalog of ready-made decks |

Don't use `npm run dev -- --host` on public networks: the development server isn't meant to be exposed.

## Deployment

The site runs on [Vercel](https://vercel.com), connected to this repository: **every push to `main` goes live automatically** in about a minute. `vercel.json` handles routing and the security headers (Content Security Policy, clickjacking protection and more).

## Online services (optional)

Studying works 100% without a server. Only two features use the internet, configured in `src/config.ts`:

- **Boss podium — [Supabase](https://supabase.com) (free plan).** The medals table and function live in `supabase/medalhas.sql`: paste it into the SQL Editor and run it. The app signs in as an anonymous player, and only the **public** (publishable) key goes in the code. Claiming a medal is protected by a **CAPTCHA (Cloudflare Turnstile)**: the site key goes in `config.ts` and the secret key only in the Supabase dashboard (Authentication › Attack Protection).
- **Feedback — [Web3Forms](https://web3forms.com).** Its access key is public by design; the form includes a trap for bots.

Never put secret keys (such as Supabase's `service_role` key or the Turnstile secret) in the code: everything in `src/` ships to the user's browser.

To reset the podium (after testing, for example), run this in the Supabase SQL Editor:

```sql
delete from public.boss_medals;
```

## Tech stack

React 19 + TypeScript + Vite, Tailwind CSS v4, React Router, Dexie (IndexedDB), ts-fsrs, KaTeX, JSZip + sql.js (Anki import), vite-plugin-pwa and the Web Audio API (music and sounds generated on the fly, no audio files).

## Project structure

The code comments are in Portuguese; the interface is fully translated in `src/i18n/`.

```
src/
  main.tsx              entry point
  App.tsx               routes
  config.ts             feedback email, Web3Forms, Supabase and CAPTCHA
  index.css             theme (colors, fonts) and base classes
  components/           layout, tabs, rich text editor, card content, error screen
  pages/
    HomePage.tsx        home screen (cards due today)
    DecksPage.tsx       deck library
    ExplorePage.tsx     ready-made decks
    DeckPage.tsx        card editor for a deck
    StudyPage.tsx       study session
    StatsPage.tsx       stats and day streak
    ImportPage.tsx      Anki, CSV/TXT and Quizlet import
    HeroPage.tsx        Adventure (battle, upgrades, skills, monsters and podium)
    SettingsPage.tsx    settings and backup
    FeedbackPage.tsx    send feedback
  game/
    data.ts             monsters, stages, skills, upgrade tree and game numbers
    engine.ts           battle engine (rolls the whole stage at once)
    runner.ts           background stages, energy, rewards and music
    BattleScene.tsx     battle scene and animations
    medal.ts            keeps the medal in sync with the podium
  db/                   local database (Dexie) and types
  lib/
    srs.ts              FSRS scheduling and intervals
    import/             Anki, CSV/TXT and Quizlet readers
    markdown.ts         card formatting
    backup.ts           JSON export/import (with validation)
    online.ts           Supabase (podium) and CAPTCHA
    music.ts, sound.ts  music and sound effects with Web Audio
    settings.ts         preferences (theme, language, sounds, reminder)
  i18n/                 Portuguese, English and Spanish texts
public/
  biblioteca/           ready-made decks and their images
  theme.js              applies the theme before the page renders
scripts/
  gerar-catalogo.mjs    builds public/biblioteca/catalogo.json
supabase/
  medalhas.sql          podium table, rules and function
```

## Content licenses

Credits and licenses for the flags, maps and images in the ready-made decks are in `public/biblioteca/img/` (`CREDITOS.txt` and the `LICENSE` files).
