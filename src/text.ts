import type { GenerationMode, PracticeConfig, QuoteSize } from './storage'

const LINE_WIDTH = 60

const QUOTES: Record<QuoteSize, string[]> = {
  short: [
    'A pressa tropeça no próprio passo.',
    'Clareza vem de prática, não de sorte.',
    'Cada erro aponta o próximo ajuste.',
  ],
  medium: [
    'A atenção é uma habilidade treinável. Quando você digita com calma, cada palavra vira um pequeno ensaio de precisão.',
    'Velocidade não nasce de força. Ela aparece quando o movimento fica simples o bastante para a mente parar de interferir.',
    'Um bom treino não precisa ser longo. Precisa ser honesto, repetível e ligeiramente mais difícil do que ontem.',
  ],
  long: [
    'Existe um instante curioso no aprendizado em que a mão entende antes da cabeça. Você deixa de procurar cada tecla e começa a sentir o caminho. Esse instante não chega por milagre; ele chega por repetição paciente, por correções pequenas e por uma relação menos dramática com o erro.',
    'Digitar bem é uma forma de escutar o próprio pensamento. Quando a mecânica deixa de ocupar toda a atenção, sobra espaço para perceber ritmo, escolha de palavras e intenção. A técnica some no fundo e o texto aparece na frente.',
  ],
  giant: [
    'Toda habilidade cotidiana tem uma beleza discreta. A digitação, por exemplo, parece banal até o momento em que você precisa transformar pensamento em texto sem perder o fio da ideia. Então cada hesitação pesa, cada tecla errada interrompe a frase, cada correção rouba um pouco de fôlego. Treinar é reduzir esse atrito. Não é perseguir uma velocidade vazia, mas construir uma ponte mais direta entre o que você pensa e o que aparece na tela. A ponte fica mais firme com sessões pequenas, feedback claro e uma dose de paciência que não vira complacência.',
  ],
}

export function normalizeText(
  raw: string,
  opts?: { normalizeTypography?: boolean; removeInvisible?: boolean },
): string {
  let norm = raw.replace(/\r/g, '').replace(/ /g, ' ').replace(/\t/g, ' ')
  if (opts?.normalizeTypography ?? true) {
    norm = norm
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
  }
  if (opts?.removeInvisible ?? true) {
    norm = norm.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').replace(/[​-‏﻿]/g, '')
  }
  return norm
}

export function removeTextAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function applyGenerationMode(raw: string, mode: GenerationMode): string {
  if (mode === 'simple') return raw
  const words = raw.split(/\s+/).filter(Boolean)
  if (words.length === 0) return raw
  if (mode === 'repeat') return [...words, ...words].join(' ')
  if (mode === 'shuffle') {
    const shuffled = [...words]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.join(' ')
  }
  return Array.from({ length: words.length }, () => words[Math.floor(Math.random() * words.length)]).join(' ')
}

export function applyPracticeFilters(raw: string, config: PracticeConfig): string {
  let text = normalizeText(raw, config)
  if (config.delimiter === 'pipe') text = text.replace(/\s*\|\s*/g, ' ')
  if (config.removeAccents) text = removeTextAccents(text)
  if (!config.includePunctuation) text = text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '')
  if (!config.includeNumbers) text = text.replace(/\d+/g, '')
  text = applyGenerationMode(text, config.generationMode)
  if (config.mode === 'words' && config.wordLimit) {
    text = text.split(/\s+/).filter(Boolean).slice(0, config.wordLimit).join(' ')
  }
  return text.replace(/ {2,}/g, ' ').trim()
}

export function quoteText(size: QuoteSize): string {
  const bank = QUOTES[size]
  return bank[Math.floor(Math.random() * bank.length)]
}

export function textToLines(raw: string): string[] {
  const norm = normalizeText(raw)
  const paragraphs = norm
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').replace(/ {2,}/g, ' ').trim())
    .filter((p) => p.length > 0)

  const lines: string[] = []
  for (const p of paragraphs) lines.push(...wrap(p, LINE_WIDTH))
  return lines
}

export function timeModeLineCount(seconds?: number): number {
  if (!seconds || seconds <= 10) return 5
  if (seconds <= 30) return 6
  return 7
}

function wrap(text: string, width: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if (!cur) cur = w
    else if (cur.length + 1 + w.length <= width) cur += ' ' + w
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

export function countWords(lines: string[]): number {
  return lines.reduce((n, l) => n + l.split(' ').filter(Boolean).length, 0)
}

export function phaseLineCount(lines: string[], start: number, wordsPerPhase: number): number {
  let words = 0
  let i = start
  while (i < lines.length && words < wordsPerPhase) {
    words += lines[i].split(' ').filter(Boolean).length
    i++
  }
  return i - start
}

export function phaseInfo(
  lines: string[],
  progress: number,
  wordsPerPhase: number,
): { current: number; total: number } {
  let i = 0
  let phase = 0
  let current = 1
  while (i < lines.length) {
    phase++
    if (progress >= i) current = phase
    i += phaseLineCount(lines, i, wordsPerPhase)
  }
  return { current, total: Math.max(phase, 1) }
}

export function hashId(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return 'txt-' + Math.abs(h).toString(36) + '-' + s.length
}
