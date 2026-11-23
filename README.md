# DopamineTyper

A typing trainer for studying, active reading and daily practice. It blends a Monkeytype-inspired typing experience with its own dashboard of texts, achievements, themes, streaks, points and locally saved progress.

It runs 100% in the browser: PDFs, texts, settings and save state stay on your computer in `localStorage`. There's no backend.

[🇧🇷 Leia em português](#-português)

## Features

- Quick practice with time, words, quote and infinite modes.
- Saved texts with progress per stage.
- `.pdf` and `.txt` upload, with client-side PDF extraction via `pdfjs-dist`.
- Public-domain book search via Gutendex / Project Gutenberg, with smart removal of front matter (table of contents, notes and editorial material) before the first real chapter.
- Public scripts and archived texts via the Internet Archive.
- Random quotes from external APIs, translated to Brazilian Portuguese when the app is in Portuguese; the author is shown as the text title.
- Local collection of 50 coherent texts for words mode.
- Punctuation and number filters, and space or pipe as delimiter.
- Themes unlocked with points.
- Streak, active-days calendar, achievements and daily challenges.
- Save export and import as JSON.
- Synthesized Web Audio sounds for keys, errors, combos and results.
- Interface in Portuguese and English.

## Stack

React 18 · TypeScript · Vite 6 · Tailwind CSS 4 · shadcn/ui · lucide-react · pdfjs-dist · Web Audio API · localStorage

## Getting started

Requirements: Node.js 18+ and npm (on Windows you can also use `npm.cmd`).

```bash
npm install
npm run dev       # usually http://localhost:5173
npm run build     # tsc -b + production build in dist/
npm run preview   # serves dist/ locally
```

## Practice modes

| Mode | How it works |
| --- | --- |
| **Time** | Fixed duration: 10, 30, 60, 120 seconds or a custom value. Text is limited to a few lines for comfortable reading. |
| **Words** | Fixed word count: 10, 25, 50, 100 or custom. Uses the 50 Portuguese texts in `src/wordCorpus.ts`, so you never type shuffled nonsense. |
| **Quote** | Fetches quotes from external APIs (short, medium, long, huge), translated to pt-BR when needed, with a local fallback in `src/text.ts`. |
| **Infinite** | No automatic end; finish manually with `Shift + Enter`. |
| **Custom/PDF** | Paste text, open `.txt` or `.pdf`, search a public book, search an archived script, or generate text from settings. |

## External sources

All integrations live in `src/contentSources.ts`.

- **Quotes:** DummyJSON Quotes, falling back to Quotable; translation via MyMemory; final fallback in `src/text.ts`.
- **Public books:** Gutendex search and Project Gutenberg content, with Jina Reader as a reading/CORS fallback and a small local classics list. Before handing the text to practice, the app finds where the real prose begins: it skips the table of contents and short heading-only sections, and keeps the whole book when no reliable start is found instead of cutting valid content.
- **Scripts and archived texts:** Internet Archive Advanced Search plus the item's text files, with Jina Reader as a fallback. Only public/archived material, no scraping of protected sites.

## Dashboard and gamification

The home screen has a status bar (points, words typed, streak), an active-days calendar, language/volume/sound settings with save export and import, a quick-practice bar, daily challenges, saved texts (3 per page) and an achievements panel.

The profile tracks total points, words typed, session history, unlocked achievements, consecutive-day streak, active days in the month, active-day and full-month bonuses, and themes unlocked with points. Everything is saved in the browser.

## Save state

Settings let you export a `.json` file with profile, settings, history, achievements, saved texts and text progress, and import it back later.

## Project structure

```text
src/
  App.tsx              Main screens and app flow
  audio.ts             Web Audio synthesized sounds
  contentSources.ts    Quote, book and script APIs
  i18n.ts              pt/en interface strings
  main.tsx             React bootstrap
  pdf.ts               PDF text extraction
  storage.ts           Types, themes, profile and localStorage
  styles.css           Main app styles
  text.ts              Normalization, filters and line breaking
  wordCorpus.ts        Local corpus for words mode
  components/ui/       UI components and achievements
```

## Privacy

PDF and TXT files are processed locally. Texts imported from APIs depend on external requests. Your save stays in the browser; there's no account, login or backend. Clearing site data erases progress, so export your save before switching machines.

## Troubleshooting

- **Build fails with a permission error in Vite:** some sandboxed environments block esbuild from reading `vite.config.ts` ("access denied"). Run `npm run build` from a regular terminal.
- **Book, script or quote API failed:** external APIs can be slow, rate-limited or blocked by CORS. The main flows have fallbacks, but availability depends on the providers.
- **PDF doesn't extract text:** scanned PDFs may contain only images; they'd need OCR.
- **Reset progress:** clear the site data in the browser or import an older save.

## Build and deploy

`npm run build` outputs to `dist/`, which can be hosted on any static host that supports SPAs (Netlify, Vercel, GitHub Pages or your own server).

---

## 🇧🇷 Português

# DopamineTyper

App de treino de digitação para estudo, leitura ativa e prática diária. Combina uma experiência inspirada no Monkeytype com um dashboard próprio de textos, conquistas, temas, streak, pontos e progresso salvo localmente.

Roda 100% no navegador: PDFs, textos, configurações e save state ficam no seu computador via `localStorage`. Não há backend.

### Principais recursos

- Treino rápido com modos de tempo, palavras, citação e infinito.
- Textos salvos com progresso por fase.
- Upload de `.pdf` e `.txt`, com extração de PDF no próprio navegador via `pdfjs-dist`.
- Busca de livros de domínio público via Gutendex / Project Gutenberg, removendo sumário, notas e material editorial antes do primeiro capítulo de verdade.
- Roteiros e textos públicos via Internet Archive.
- Citações aleatórias de APIs externas, traduzidas para pt-BR quando o app está em português; o autor aparece como título do texto.
- Acervo local com 50 textos coerentes para o modo palavras.
- Filtros de pontuação e números, e delimitador por espaço ou pipe.
- Temas desbloqueáveis por pontos.
- Streak, calendário de dias ativos, conquistas e desafios diários.
- Exportação e importação do save em JSON.
- Sons sintetizados com Web Audio API para tecla, erro, combo e resultado.
- Interface em português e inglês.

### Stack

React 18, TypeScript, Vite 6, Tailwind CSS 4, shadcn/ui, lucide-react, pdfjs-dist, Web Audio API e localStorage.

### Como rodar

Requisitos: Node.js 18+ e npm (no Windows também funciona com `npm.cmd`).

```bash
npm install
npm run dev       # normalmente http://localhost:5173
npm run build     # tsc -b + build de produção em dist/
npm run preview   # serve o dist/ localmente
```

### Modos de treino

- **Tempo:** duração definida de 10, 30, 60, 120 segundos ou valor manual; o texto fica limitado a poucas linhas.
- **Palavras:** 10, 25, 50, 100 palavras ou valor manual, usando os 50 textos em português de `src/wordCorpus.ts`, para nunca digitar palavras embaralhadas sem sentido.
- **Citação:** busca citações em APIs externas (curta, média, longa ou gigante), traduz para pt-BR quando necessário e usa o fallback local de `src/text.ts`.
- **Infinito:** sem fim automático; encerre com `Shift + Enter`.
- **Custom/PDF:** colar texto, abrir `.txt` ou `.pdf`, buscar livro público, buscar roteiro arquivado ou gerar texto pelas configurações.

### Fontes externas

As integrações ficam em `src/contentSources.ts`.

- **Citações:** DummyJSON Quotes, com fallback no Quotable; tradução pelo MyMemory; fallback final em `src/text.ts`.
- **Livros públicos:** busca no Gutendex e conteúdo do Project Gutenberg, com Jina Reader como fallback de leitura/CORS e uma pequena biblioteca local de clássicos. Antes do treino, o app encontra onde a prosa começa de verdade: pula o sumário e seções só com títulos e, se não achar um início confiável, preserva o livro inteiro em vez de cortar conteúdo válido.
- **Roteiros e textos arquivados:** Internet Archive Advanced Search e os arquivos de texto do item, com Jina Reader de fallback. Só material público/arquivado, sem scraping de sites protegidos.

### Dashboard e gamificação

A home tem barra de status (pontos, palavras digitadas e streak), calendário de dias ativos, configurações de idioma, volume, som e exportar/importar save, barra de treino rápido, desafios do dia, textos salvos (3 por página) e painel de conquistas.

O perfil guarda pontos totais, palavras digitadas, histórico de sessões, conquistas, streak de dias seguidos, dias ativos no mês, bônus de dia ativo e de mês completo, e temas desbloqueados por pontos. Tudo fica salvo no navegador.

### Save state

As configurações permitem exportar um `.json` com perfil, configurações, histórico, conquistas, textos salvos e progresso, e importar esse arquivo depois.

### Estrutura do projeto

A estrutura de `src/` está na versão em inglês acima: `App.tsx` (telas e fluxo), `audio.ts` (sons), `contentSources.ts` (APIs), `i18n.ts` (textos pt/en), `pdf.ts` (extração de PDF), `storage.ts` (perfil e localStorage), `text.ts` (normalização e filtros), `wordCorpus.ts` (acervo local) e `components/ui/` (componentes e conquistas).

### Privacidade

PDFs e TXT são processados localmente. Textos importados por API dependem de requisições externas. O save fica no navegador; não há conta, login ou backend. Limpar os dados do site apaga o progresso, então exporte o save antes de trocar de máquina.

### Solução de problemas

- **O build falha com erro de permissão no Vite:** alguns ambientes sandboxados impedem o esbuild de ler o `vite.config.ts` ("Acesso negado"). Rode `npm run build` num terminal normal.
- **API de livro, roteiro ou citação falhou:** APIs externas podem ficar lentas, limitar requisições ou falhar por CORS. Os fluxos principais têm fallback, mas a disponibilidade depende dos provedores.
- **O PDF não extrai texto:** PDFs escaneados podem ter só imagem e precisariam de OCR.
- **Resetar o progresso:** limpe os dados do site no navegador ou importe um save antigo.

### Build e deploy

`npm run build` gera a pasta `dist/`, que pode ser publicada em qualquer host estático compatível com SPA (Netlify, Vercel, GitHub Pages ou servidor próprio).
