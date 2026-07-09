// Persistência local (localStorage): perfil, histórico, conquistas e textos
// de estudo com progresso. Sem backend — tudo fica no navegador do usuário.

import {
  BookOpen,
  Flame,
  Gauge,
  Gem,
  GraduationCap,
  Medal,
  PartyPopper,
  Rocket,
  Sprout,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export interface SessionResult {
  date: string
  wpm: number
  accuracy: number
  consistency: number
  maxCombo: number
  words: number
  points: number
}

export interface Settings {
  theme: string
  lang: 'pt' | 'en'
  volume: number
  keySound: boolean
  // Aceita letras sem acento como corretas — em troca, reduz os pontos ganhos.
  relaxedAccents: boolean
}

export type PracticeMode = 'time' | 'words' | 'quote' | 'zen' | 'custom' | 'pdf'
export type GenerationMode = 'simple' | 'repeat' | 'shuffle' | 'random'
export type QuoteSize = 'short' | 'medium' | 'long' | 'giant'
export type WordDelimiter = 'space' | 'pipe'
export type TextSource = 'paste' | 'pdf' | 'generated' | 'quote' | 'remote-quote' | 'book' | 'script'

export interface PracticeConfig {
  mode: PracticeMode
  timeSeconds?: number
  wordLimit?: number
  quoteSize?: QuoteSize
  infinite?: boolean
  includePunctuation: boolean
  includeNumbers: boolean
  removeAccents: boolean
  delimiter: WordDelimiter
  generationMode: GenerationMode
  wordsPerPhase: number
  normalizeTypography: boolean
  removeInvisible: boolean
}

export interface Profile {
  points: number
  totalWords: number
  streak: { last: string; count: number }
  activeDays: string[]
  // Meses (YYYY-MM) cujo bônus de mês completo já foi pago.
  monthBonus: string[]
  achievements: string[]
  achievementDates: Record<string, string>
  history: SessionResult[]
  settings: Settings
  segmentSize: number
}

export interface SavedText {
  id: string
  title: string
  lines: string[]
  progress: number // índice da próxima linha a praticar
  addedAt: string
  // Palavras por fase: cada fase termina numa tela de resultado. Textos
  // antigos sem essa configuração usam o tamanho adaptativo em linhas.
  wordsPerPhase?: number
  source?: TextSource
  config?: PracticeConfig
}

const PROFILE_KEY = 'macacodigita:profile'
const TEXTS_KEY = 'macacodigita:texts'

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultProfile(): Profile {
  return {
    points: 0,
    totalWords: 0,
    streak: { last: '', count: 0 },
    activeDays: [],
    monthBonus: [],
    achievements: [],
    achievementDates: {},
    history: [],
    settings: { theme: 'noite', lang: 'pt', volume: 0.8, keySound: true, relaxedAccents: false },
    segmentSize: 8,
  }
}

// Mescla um perfil salvo (possivelmente de versão antiga) com os defaults,
// garantindo que campos novos existam sem apagar os dados do usuário.
function mergeProfile(parsed: Partial<Profile>): Profile {
  const base = defaultProfile()
  return {
    ...base,
    ...parsed,
    activeDays: parsed.activeDays ?? [],
    monthBonus: parsed.monthBonus ?? [],
    settings: { ...base.settings, ...(parsed.settings ?? {}) },
  }
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return defaultProfile()
    return mergeProfile(JSON.parse(raw) as Partial<Profile>)
  } catch {
    return defaultProfile()
  }
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
}

export function loadTexts(): SavedText[] {
  try {
    const raw = localStorage.getItem(TEXTS_KEY)
    return raw ? (JSON.parse(raw) as SavedText[]) : []
  } catch {
    return []
  }
}

export function saveTexts(texts: SavedText[]): void {
  localStorage.setItem(TEXTS_KEY, JSON.stringify(texts))
}

export interface SaveState {
  profile: Profile
  texts: SavedText[]
  exportedAt: string
  version: 1
}

export function exportSaveState(profile: Profile, texts: SavedText[]): SaveState {
  return { profile, texts, exportedAt: new Date().toISOString(), version: 1 }
}

export function importSaveState(raw: string): SaveState {
  const parsed = JSON.parse(raw) as Partial<SaveState>
  if (!parsed.profile || !Array.isArray(parsed.texts)) {
    throw new Error('Invalid save file')
  }
  return {
    version: 1,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    profile: mergeProfile(parsed.profile),
    texts: parsed.texts,
  }
}

// ---------------------------------------------------------------------------
// Conquistas

export interface Achievement {
  id: string
  icon: LucideIcon
  pt: string
  en: string
  descPt: string
  descEn: string
  check: (p: Profile, r: SessionResult, textFinished: boolean) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-session', icon: PartyPopper,
    pt: 'Primeiro passo', en: 'First step',
    descPt: 'Complete sua primeira sessão', descEn: 'Complete your first session',
    check: (p) => p.history.length >= 1,
  },
  {
    id: 'combo-50', icon: Flame,
    pt: 'Em chamas', en: 'On fire',
    descPt: 'Alcance um combo de 50', descEn: 'Reach a 50 combo',
    check: (_p, r) => r.maxCombo >= 50,
  },
  {
    id: 'combo-150', icon: Zap,
    pt: 'Imparável', en: 'Unstoppable',
    descPt: 'Alcance um combo de 150', descEn: 'Reach a 150 combo',
    check: (_p, r) => r.maxCombo >= 150,
  },
  {
    id: 'acc-95', icon: Target,
    pt: 'Na mosca', en: 'Bullseye',
    descPt: 'Termine com 95% de precisão', descEn: 'Finish with 95% accuracy',
    check: (_p, r) => r.accuracy >= 95,
  },
  {
    id: 'acc-100', icon: Gem,
    pt: 'Perfeição', en: 'Flawless',
    descPt: 'Termine com 100% de precisão', descEn: 'Finish with 100% accuracy',
    check: (_p, r) => r.accuracy >= 100,
  },
  {
    id: 'wpm-40', icon: Gauge,
    pt: 'Pegando ritmo', en: 'Picking up pace',
    descPt: 'Atinja 40 WPM', descEn: 'Reach 40 WPM',
    check: (_p, r) => r.wpm >= 40,
  },
  {
    id: 'wpm-80', icon: Rocket,
    pt: 'Velocista', en: 'Speedster',
    descPt: 'Atinja 80 WPM', descEn: 'Reach 80 WPM',
    check: (_p, r) => r.wpm >= 80,
  },
  {
    id: 'words-1000', icon: BookOpen,
    pt: 'Estudioso', en: 'Scholar',
    descPt: 'Digite 1.000 palavras no total', descEn: 'Type 1,000 words in total',
    check: (p) => p.totalWords >= 1000,
  },
  {
    id: 'streak-3', icon: Sprout,
    pt: 'Criando hábito', en: 'Building habit',
    descPt: 'Estude 3 dias seguidos', descEn: 'Study 3 days in a row',
    check: (p) => p.streak.count >= 3,
  },
  {
    id: 'streak-7', icon: Medal,
    pt: 'Semana completa', en: 'Full week',
    descPt: 'Estude 7 dias seguidos', descEn: 'Study 7 days in a row',
    check: (p) => p.streak.count >= 7,
  },
  {
    id: 'text-complete', icon: GraduationCap,
    pt: 'Macaco letrado', en: 'Learned monkey',
    descPt: 'Termine um texto inteiro', descEn: 'Finish an entire text',
    check: (_p, _r, textFinished) => textFinished,
  },
]

// Temas desbloqueáveis por pontos — recompensa cosmética da gamificação.
export const THEMES: { id: string; pt: string; en: string; unlockAt: number }[] = [
  { id: 'noite', pt: 'Noite', en: 'Night', unlockAt: 0 },
  { id: 'claro', pt: 'Claro', en: 'Light', unlockAt: 0 },
  { id: 'mint', pt: 'Mint', en: 'Mint', unlockAt: 0 },
  { id: 'red-dragon', pt: 'Redragon', en: 'Redragon', unlockAt: 0 },
  { id: 'retrocast', pt: 'Retro Quest', en: 'Retro Quest', unlockAt: 0 },
  { id: 'serika-dark', pt: 'Serika dark', en: 'Serika dark', unlockAt: 250 },
  { id: 'rose-pine', pt: 'Rose pine', en: 'Rose pine', unlockAt: 450 },
  { id: 'sweden', pt: 'Sweden', en: 'Sweden', unlockAt: 650 },
  { id: 'terminal', pt: 'Terminal', en: 'Terminal', unlockAt: 850 },
  { id: 'vscode', pt: 'VS Code', en: 'VS Code', unlockAt: 1050 },
  { id: 'watermelon', pt: 'Watermelon', en: 'Watermelon', unlockAt: 1250 },
  { id: 'witch-girl', pt: 'Witch girl', en: 'Witch girl', unlockAt: 1450 },
  { id: 'banana', pt: 'Banana', en: 'Banana', unlockAt: 1700 },
  { id: 'matrix', pt: 'Matrix', en: 'Matrix', unlockAt: 2100 },
  { id: 'oceano', pt: 'Oceano', en: 'Ocean', unlockAt: 2500 },
  { id: 'dracula', pt: 'Dracula', en: 'Dracula', unlockAt: 3000 },
  { id: 'solarized-dark', pt: 'Solarized dark', en: 'Solarized dark', unlockAt: 3500 },
  { id: 'taro', pt: 'Taro', en: 'Taro', unlockAt: 4200 },
  { id: 'vaporwave', pt: 'Vaporwave', en: 'Vaporwave', unlockAt: 5000 },
  { id: 'laserwave', pt: 'Laserwave', en: 'Laserwave', unlockAt: 6500 },
]
