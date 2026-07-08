# MacacoDigita

MacacoDigita e um app de treino de digitacao para estudo, leitura ativa e pratica diaria. Ele combina uma experiencia inspirada em ferramentas como Monkeytype com um dashboard proprio de textos, conquistas, temas, streak, pontos e progresso salvo localmente.

O projeto roda 100% no navegador: PDFs, textos, configuracoes e save state ficam no computador do usuario via `localStorage`. Nao ha backend proprio.

## Principais recursos

- Treino rapido com modos de tempo, palavras, citacao e infinito.
- Textos salvos com progresso por fase.
- Upload de `.pdf` e `.txt`.
- Extracao de PDF no cliente usando `pdfjs-dist`.
- Busca de livros de dominio publico via Gutendex/Project Gutenberg.
- Busca de roteiros/textos publicos via Internet Archive.
- Citacoes aleatorias via APIs externas, com traducao para pt-BR quando o app esta em portugues.
- Acervo local com 50 textos coerentes para o modo palavras.
- Filtros de pontuacao e numeros.
- Configuracao de delimitador por espaco ou pipe.
- Temas desbloqueaveis por pontos.
- Streak, calendario de dias ativos, conquistas e desafios diarios.
- Exportacao e importacao de save em JSON.
- Sons sintetizados com Web Audio API para tecla, erro, combo e resultado.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS 4
- shadcn/ui
- lucide-react
- pdfjs-dist
- Web Audio API
- localStorage

## Requisitos

- Node.js 18 ou superior
- npm

No Windows, os comandos tambem podem ser rodados como `npm.cmd install`, `npm.cmd run dev` e `npm.cmd run build`.

## Como rodar

Instale as dependencias:

```bash
npm install
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Abra o endereco exibido pelo Vite, normalmente:

```text
http://localhost:5173
```

Gere o build de producao:

```bash
npm run build
```

Teste o build localmente:

```bash
npm run preview
```

## Scripts

```bash
npm run dev
```

Inicia o Vite em modo desenvolvimento.

```bash
npm run build
```

Executa `tsc -b` e depois gera o build em `dist/`.

```bash
npm run preview
```

Serve o conteudo gerado em `dist/` para conferencia local.

## Modos de treino

### Tempo

Treino com duracao definida. Presets atuais:

- 10 segundos
- 30 segundos
- 60 segundos
- 120 segundos
- valor manual

O texto e limitado a poucas linhas para manter leitura confortavel.

### Palavras

Treino por quantidade de palavras. Presets atuais:

- 10 palavras
- 25 palavras
- 50 palavras
- 100 palavras
- valor manual

Esse modo usa o acervo local em `src/wordCorpus.ts`, com 50 textos em portugues. O objetivo e evitar textos sem sentido gerados por embaralhamento de palavras soltas.

### Citacao

Busca citacoes em APIs externas e monta o treino. Quando o idioma esta em portugues, o conteudo e traduzido para pt-BR. Se a API ou a traducao falhar, o app usa fallback local em `src/text.ts`.

Tamanhos:

- curta
- media
- longa
- gigante

### Infinito

Modo sem fim automatico. O usuario encerra manualmente com `Shift + Enter`.

### Custom/PDF

Permite colar texto, abrir `.txt`, abrir `.pdf`, buscar livro publico, buscar roteiro/texto arquivado ou gerar texto a partir de configuracoes.

## Fontes externas

As integracoes vivem em `src/contentSources.ts`.

### Citacoes

- Fonte principal: DummyJSON Quotes
- Fallback: Quotable
- Traducao: MyMemory Translated
- Fallback final: banco local em `src/text.ts`

### Livros publicos

- Busca: Gutendex
- Conteudo: Project Gutenberg
- Fallback de leitura/CORS: Jina Reader
- Fallback de lista: pequena biblioteca local de classicos em `src/contentSources.ts`

Antes de entregar o texto ao treino, o app tenta remover tudo que vem antes do conteudo principal, como sumario, notas iniciais e material editorial. A limpeza procura marcadores como `Chapter`, `Capitulo`, `Part`, `Book`, `Letter`, `Act` e `Scene`, mas evita cortar em entradas de sumario muito curtas.

### Roteiros e textos arquivados

- Busca: Internet Archive Advanced Search
- Conteudo: arquivos de texto disponiveis no item arquivado
- Fallback de leitura/CORS: Jina Reader

O objetivo e usar material publico/arquivado sem scraping de sites protegidos.

## Dashboard

A home possui:

- barra de status com pontos, palavras digitadas e streak;
- calendario de dias ativos no menu de streak;
- configuracoes de idioma, volume, som e exportar/importar save;
- barra de treino rapido;
- desafios do dia;
- lista de textos salvos;
- painel de conquistas.

A paginacao de `Meus textos` mostra 3 textos por pagina.

## Gamificacao

O perfil do usuario inclui:

- pontos totais;
- palavras digitadas;
- historico de sessoes;
- conquistas desbloqueadas;
- streak de dias consecutivos;
- dias ativos no mes;
- bonus de dia ativo;
- bonus de mes completo;
- temas desbloqueaveis por pontos.

Tudo fica salvo no navegador.

## Save state

O menu de configuracoes permite exportar um arquivo `.json` com:

- perfil;
- configuracoes;
- historico;
- conquistas;
- textos salvos;
- progresso dos textos.

O mesmo menu permite importar esse save novamente.

## Estrutura do projeto

```text
src/
  App.tsx                         Telas principais e fluxo do app
  audio.ts                        Sons sintetizados com Web Audio API
  contentSources.ts               APIs de citacoes, livros e roteiros
  i18n.ts                         Textos de interface pt/en
  index.css                       Entrada CSS/Tailwind
  main.tsx                        Bootstrap React
  pdf.ts                          Extracao de texto de PDF
  storage.ts                      Tipos, temas, perfil e localStorage
  styles.css                      Estilo principal do app
  text.ts                         Normalizacao, filtros e quebra em linhas
  wordCorpus.ts                   Acervo local do modo palavras
  components/ui/                  Componentes de UI e conquistas
```

Arquivos de configuracao:

```text
components.json
index.html
package.json
package-lock.json
tsconfig.json
vite.config.ts
```

## Persistencia local

O app usa `localStorage` com chaves proprias para perfil e textos. Limpar dados do navegador pode apagar progresso, conquistas e configuracoes. Use a opcao de exportar save antes de limpar o navegador ou trocar de maquina.

## Privacidade

- PDFs e TXT sao processados localmente no navegador.
- Textos importados por API dependem de requisicoes externas.
- O save do usuario fica local, salvo no navegador.
- Nao ha conta, login ou backend proprio.

## Troubleshooting

### O build falha com erro de permissao no Vite

Em alguns ambientes sandboxados, o Vite/esbuild pode falhar ao resolver `vite.config.ts` com erro parecido com `Acesso negado`. Rode o build no terminal normal do projeto:

```bash
npm run build
```

### API de livro, roteiro ou citacao falhou

As APIs externas podem ficar lentas, limitar requisicoes ou falhar por CORS. O app tem fallbacks para os principais fluxos, mas a disponibilidade final depende dos provedores externos.

### PDF nao extrai texto

PDFs escaneados podem conter apenas imagem. Nesse caso, o app nao consegue extrair o texto sem OCR.

### Quero resetar o progresso

Use as opcoes do navegador para limpar dados do site ou importe um save antigo pelo menu de configuracoes.

## Build e deploy

Depois de rodar:

```bash
npm run build
```

O conteudo final fica em:

```text
dist/
```

Esse diretorio pode ser publicado em qualquer host estatico compativel com apps SPA, como Netlify, Vercel, GitHub Pages ou servidor proprio.
