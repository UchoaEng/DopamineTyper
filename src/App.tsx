import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BookOpen,
  ChevronDown,
  Clock3,
  Download,
  FileUp,
  Film,
  Flame,
  Hash,
  Infinity,
  Keyboard,
  Loader2,
  Palette,
  Pill,
  Plus,
  Quote,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trophy,
  Type,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react'
import { AchievementGrid } from '@/components/ui/achievement-grid'
import { AchievementUnlocked } from '@/components/ui/achievement-unlocked'
import { PointsBadge } from '@/components/ui/points-badge'
import * as audio from './audio'
import {
  fetchArchiveScriptText,
  fetchPublicBookText,
  fetchRandomQuote,
  searchArchiveScripts,
  searchPublicBooks,
  type RemoteSearchResult,
} from './contentSources'
import { extractPdfText } from './pdf'
import { t, type Lang } from './i18n'
import { applyPracticeFilters, countWords, hashId, phaseInfo, phaseLineCount, quoteText, removeTextAccents, textToLines, timeModeLineCount } from './text'
import { buildWordPracticeText } from './wordCorpus'
import {
  ACHIEVEMENTS,
  THEMES,
  exportSaveState,
  importSaveState,
  loadProfile,
  loadTexts,
  saveProfile,
  saveTexts,
  todayStr,
  type Profile,
  type PracticeConfig,
  type PracticeMode,
  type QuoteSize,
  type SavedText,
  type SessionResult,
  type TextSource,
} from './storage'

const SAMPLE_PT = `A prática leva à perfeição, mas só quando é deliberada. Digitar todos os dias, mesmo que por poucos minutos, constrói memória muscular e transforma esforço consciente em fluidez automática.

O segredo não é a velocidade, e sim a constância. Cada linha correta é uma pequena vitória, e as pequenas vitórias, somadas, viram hábito. O hábito, por sua vez, vira identidade: você deixa de tentar digitar bem e passa a ser alguém que digita bem.

Errar faz parte. O erro é apenas informação: mostra onde a atenção falhou e onde o próximo esforço deve ir. Respire, corrija e continue. A melodia do progresso é feita de notas simples tocadas na ordem certa.`

type Screen = 'home' | 'typing' | 'results'

const DEFAULT_CONFIG: PracticeConfig = {
  mode: 'custom',
  timeSeconds: 60,
  wordLimit: 50,
  quoteSize: 'medium',
  infinite: false,
  includePunctuation: true,
  includeNumbers: true,
  removeAccents: false,
  delimiter: 'space',
  generationMode: 'simple',
  wordsPerPhase: 50,
  normalizeTypography: true,
  removeInvisible: true,
}

const THEME_PALETTES: Record<string, [string, string, string]> = {
  noite: ['#16181d', '#e2b714', '#d6d9df'],
  claro: ['#f6f5f1', '#b8860b', '#2b2b2b'],
  mint: ['#053b45', '#5eead4', '#d9fff7'],
  'serika-dark': ['#323437', '#e2b714', '#d1d0c5'],
  'red-dragon': ['#12090b', '#ff3b3b', '#f2d8cf'],
  retrocast: ['#102a43', '#f5e960', '#d9e2ec'],
  'rose-pine': ['#191724', '#c4a7e7', '#e0def4'],
  sweden: ['#d6ccbc', '#8a5a44', '#ffb703'],
  terminal: ['#0b0f0b', '#7fbf00', '#d7f5cf'],
  vscode: ['#1e1e1e', '#007acc', '#d4d4d4'],
  watermelon: ['#173f35', '#ef6f6c', '#f7fff7'],
  'witch-girl': ['#25162f', '#f0a6ca', '#f4d7ff'],
  banana: ['#fff8dc', '#e6a817', '#4a3f10'],
  matrix: ['#050805', '#a6ff70', '#4ee44e'],
  oceano: ['#0b1e2d', '#38bdf8', '#cfe8f5'],
  dracula: ['#282a36', '#bd93f9', '#f8f8f2'],
  'solarized-dark': ['#002b36', '#b58900', '#93a1a1'],
  taro: ['#130f1f', '#b8a1ff', '#f3e8ff'],
  vaporwave: ['#2b1640', '#ff71ce', '#f8f8ff'],
  laserwave: ['#27212e', '#eb64b9', '#f7f1ff'],
}

function configWith(overrides: Partial<PracticeConfig> = {}): PracticeConfig {
  return { ...DEFAULT_CONFIG, ...overrides }
}

// Uma amostra por segundo da sessão — alimenta o gráfico de eficiência.
export interface ChartSample {
  wpm: number // média acumulada
  raw: number // inclui teclas erradas
  burst: number // velocidade instantânea no último segundo
  errors: number // erros neste segundo
}

interface SessionStats {
  wpm: number
  accuracy: number
  consistency: number
  maxCombo: number
  words: number
  points: number
  samples: ChartSample[]
  newAchievements: string[]
  challengeDone: boolean
  challengeBonus: number
  challengeLabels: string[]
  streakBonus: number
  monthBonusPts: number
  textFinished: boolean
}

const DAILY_CHALLENGES = [
  { id: 'accuracy', label: 'Precisão afiada', desc: 'Complete uma fase com 95% de precisão', bonus: 50 },
  { id: 'combo', label: 'Combo quente', desc: 'Alcance combo 50 em uma sessão', bonus: 35 },
  { id: 'volume', label: 'Aquecimento longo', desc: 'Digite pelo menos 50 palavras', bonus: 25 },
] as const

export default function App() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile())
  const [texts, setTexts] = useState<SavedText[]>(() => loadTexts())
  const [screen, setScreen] = useState<Screen>('home')
  const [activeTextId, setActiveTextId] = useState<string | null>(null)
  // Treinos gerados (tempo/palavras/citação/zen) são descartáveis: vivem só
  // nesta sessão e não entram na lista "meus textos".
  const [ephemeral, setEphemeral] = useState<SavedText | null>(null)
  const [lastResult, setLastResult] = useState<SessionStats | null>(null)

  const lang = profile.settings.lang

  useEffect(() => {
    document.documentElement.dataset.theme = profile.settings.theme
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'
  }, [profile.settings.theme, lang])

  const updateProfile = useCallback((p: Profile) => {
    setProfile(p)
    saveProfile(p)
  }, [])

  const updateTexts = useCallback((ts: SavedText[]) => {
    setTexts(ts)
    saveTexts(ts)
  }, [])

  const addText = useCallback(
    (title: string, raw: string, config?: PracticeConfig, source: TextSource = 'paste') => {
      const effective = configWith(config)
      let lines = textToLines(applyPracticeFilters(raw, effective))
      if (effective.mode === 'time') {
        lines = lines.slice(0, timeModeLineCount(effective.timeSeconds))
      }
      if (lines.length === 0) return
      const persist = ['paste', 'pdf', 'book', 'script', 'remote-quote'].includes(source)
      const id = persist
        ? hashId(`${title}:${effective.mode}:${lines.join('\n')}`)
        : hashId(`run:${Date.now()}:${lines.join('\n')}`)
      const entry: SavedText = {
        id,
        title,
        lines,
        progress: 0,
        addedAt: todayStr(),
        wordsPerPhase: effective.wordsPerPhase,
        source,
        config: effective,
      }
      if (persist) {
        const existing = texts.find((x) => x.id === id)
        if (!existing) {
          updateTexts([entry, ...texts])
        } else if (existing.progress >= existing.lines.length) {
          // Texto já concluído: reabre do começo em vez de abrir uma fase vazia.
          updateTexts(texts.map((x) => (x.id === id ? { ...x, progress: 0 } : x)))
        }
      } else {
        setEphemeral(entry)
      }
      setActiveTextId(id)
      setScreen('typing')
    },
    [texts, updateTexts],
  )

  const activeText =
    (ephemeral && ephemeral.id === activeTextId ? ephemeral : null) ??
    texts.find((x) => x.id === activeTextId) ??
    null

  const finishSegment = useCallback(
    (result: SessionResult, linesDone: number, samples: ChartSample[]) => {
      if (!activeText) return
      const newProgress = Math.min(activeText.progress + linesDone, activeText.lines.length)
      const textFinished = newProgress >= activeText.lines.length
      if (ephemeral && activeText.id === ephemeral.id) {
        setEphemeral({ ...ephemeral, progress: newProgress })
      } else {
        updateTexts(texts.map((x) => (x.id === activeText.id ? { ...x, progress: newProgress } : x)))
      }

      const p: Profile = { ...profile, streak: { ...profile.streak } }

      // Streak: dias consecutivos de estudo.
      const today = todayStr()
      if (p.streak.last !== today) {
        const yesterday = new Date(Date.now() - 86400000)
        const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
        p.streak = { last: today, count: p.streak.last === yStr ? p.streak.count + 1 : 1 }
      }

      // Bônus de streak: +10 na primeira sessão de cada dia; se o dia fechar
      // o mês inteiro de atividade, +100 (pago uma única vez por mês).
      const firstSessionToday = !(p.activeDays ?? []).includes(today)
      const streakBonus = firstSessionToday ? 10 : 0
      p.activeDays = Array.from(new Set([...(p.activeDays ?? []), today])).sort()

      let monthBonusPts = 0
      const monthKey = today.slice(0, 7)
      const now = new Date()
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const activeThisMonth = p.activeDays.filter((d) => d.startsWith(monthKey)).length
      if (activeThisMonth >= daysInMonth && !(p.monthBonus ?? []).includes(monthKey)) {
        monthBonusPts = 100
        p.monthBonus = [...(p.monthBonus ?? []), monthKey]
      }

      const completedChallenges = DAILY_CHALLENGES.filter((challenge) => {
        if (challenge.id === 'accuracy') return result.accuracy >= 95
        if (challenge.id === 'combo') return result.maxCombo >= 50
        return result.words >= 50
      })
      const challengeDone = completedChallenges.length > 0
      const challengeBonus = completedChallenges.reduce((sum, challenge) => sum + challenge.bonus, 0)
      const points = result.points + challengeBonus + streakBonus + monthBonusPts

      p.points += points
      p.totalWords += result.words
      p.history = [...p.history, { ...result, points }].slice(-200)

      // Dificuldade adaptativa só para textos antigos sem palavras-por-fase.
      if (!activeText.wordsPerPhase) {
        if (result.accuracy >= 96) p.segmentSize = Math.min(16, p.segmentSize + 2)
        else if (result.accuracy < 88) p.segmentSize = Math.max(4, p.segmentSize - 2)
      }

      const newAchievements: string[] = []
      for (const a of ACHIEVEMENTS) {
        if (!p.achievements.includes(a.id) && a.check(p, result, textFinished)) {
          p.achievements = [...p.achievements, a.id]
          p.achievementDates = { ...p.achievementDates, [a.id]: new Date().toISOString() }
          newAchievements.push(a.id)
        }
      }

      updateProfile(p)
      setLastResult({
        ...result,
        points,
        samples,
        newAchievements,
        challengeDone,
        challengeBonus,
        challengeLabels: completedChallenges.map((challenge) => challenge.label),
        streakBonus,
        monthBonusPts,
        textFinished,
      })
      setScreen('results')
      audio.playFanfare(p.settings.volume)
    },
    [activeText, ephemeral, profile, texts, updateProfile, updateTexts],
  )

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen
          profile={profile}
          texts={texts}
          onAddText={addText}
          onOpenText={(id) => {
            setActiveTextId(id)
            setScreen('typing')
          }}
          onUpdateTexts={updateTexts}
          onUpdateProfile={updateProfile}
        />
      )}
      {screen === 'typing' && activeText && (
        <TypingScreen
          key={activeText.id + ':' + activeText.progress}
          text={activeText}
          segmentSize={profile.segmentSize}
          settings={profile.settings}
          lang={lang}
          onQuit={() => setScreen('home')}
          onFinish={finishSegment}
        />
      )}
      {screen === 'results' && lastResult && (
        <ResultsScreen
          result={lastResult}
          lang={lang}
          hasMore={!!activeText && activeText.progress < activeText.lines.length}
          onNext={() => setScreen('typing')}
          onHome={() => setScreen('home')}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Launcher de treino estilo Monkeytype

function PracticeLauncher({
  lang,
  onStart,
}: {
  lang: Lang
  onStart: (title: string, raw: string, config?: PracticeConfig, source?: TextSource) => void
}) {
  const [config, setConfig] = useState<PracticeConfig>(() => configWith({ mode: 'time', timeSeconds: 60 }))
  const [customLimit, setCustomLimit] = useState(120)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')

  const modeItems: { id: PracticeMode; label: string; icon: LucideIcon }[] = [
    { id: 'time', label: 'tempo', icon: Clock3 },
    { id: 'words', label: 'palavras', icon: Type },
    { id: 'quote', label: 'citação', icon: Quote },
    { id: 'zen', label: 'infinito', icon: Infinity },
  ]

  async function start() {
    const effective = configWith(config)
    setLaunchError('')
    setLaunching(true)
    if (effective.mode === 'quote') {
      try {
        const quote = await fetchRandomQuote(effective.quoteSize ?? 'medium', lang)
        onStart(quote.title, quote.text, effective, 'quote')
      } catch {
        setLaunchError(lang === 'pt' ? 'API indisponivel; usando citacao local.' : 'API unavailable; using local quote.')
        onStart(
          `Citacao ${effective.quoteSize ?? 'medium'}`,
          quoteText(effective.quoteSize ?? 'medium'),
          effective,
          'quote',
        )
      } finally {
        setLaunching(false)
      }
      return
    }

    onStart(
      effective.mode === 'time'
        ? `Treino ${effective.timeSeconds}s`
        : effective.mode === 'words'
          ? `Treino ${effective.wordLimit} palavras`
          : 'Treino infinito',
      effective.mode === 'words'
        ? buildWordPracticeText(effective.wordLimit ?? 50, effective.delimiter)
        : effective.mode === 'time'
          ? buildWordPracticeText(timeModeWordTarget(effective.timeSeconds), effective.delimiter)
        : effective.mode === 'zen'
          ? SAMPLE_PT.repeat(6)
          : SAMPLE_PT,
      effective.mode === 'words' || effective.mode === 'time' ? { ...effective, generationMode: 'simple' } : effective,
      'generated',
    )
    setLaunching(false)
  }

  return (
    <section className="practice-launcher" aria-label="modos de treino">
      <div className="practice-line">
        <button
          className={'filter-chip' + (config.includePunctuation ? ' on' : '')}
          onClick={() => setConfig({ ...config, includePunctuation: !config.includePunctuation })}
          aria-pressed={config.includePunctuation}
        >
          @ pontuação
        </button>
        <button
          className={'filter-chip' + (config.includeNumbers ? ' on' : '')}
          onClick={() => setConfig({ ...config, includeNumbers: !config.includeNumbers })}
          aria-pressed={config.includeNumbers}
        >
          <Hash size={14} aria-hidden="true" /> números
        </button>
        <button
          className={'filter-chip' + (config.removeAccents ? ' on' : '')}
          onClick={() => setConfig({ ...config, removeAccents: !config.removeAccents })}
          aria-pressed={config.removeAccents}
        >
          sem acentos
        </button>

        <span className="launcher-divider" aria-hidden="true" />

        {modeItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={'mode-chip' + (config.mode === item.id ? ' on' : '')}
              onClick={() =>
                setConfig({
                  ...config,
                  mode: item.id,
                  infinite: item.id === 'zen',
                  timeSeconds: item.id === 'time' ? (config.timeSeconds ?? 60) : config.timeSeconds,
                  wordLimit: item.id === 'words' ? (config.wordLimit ?? 50) : config.wordLimit,
                })
              }
              aria-pressed={config.mode === item.id}
            >
              <Icon size={14} aria-hidden="true" />
              {item.label}
            </button>
          )
        })}

        <span className="launcher-divider" aria-hidden="true" />

        {config.mode === 'time' &&
          [10, 30, 60, 120].map((n) => (
            <button
              key={n}
              className={'preset-chip' + (config.timeSeconds === n ? ' on' : '')}
              onClick={() => setConfig({ ...config, timeSeconds: n })}
            >
              {n}
            </button>
          ))}
        {config.mode === 'words' &&
          [10, 25, 50, 100].map((n) => (
            <button
              key={n}
              className={'preset-chip' + (config.wordLimit === n ? ' on' : '')}
              onClick={() => setConfig({ ...config, wordLimit: n })}
            >
              {n}
            </button>
          ))}
        {config.mode === 'quote' &&
          (['short', 'medium', 'long', 'giant'] as QuoteSize[]).map((size) => (
            <button
              key={size}
              className={'preset-chip' + (config.quoteSize === size ? ' on' : '')}
              onClick={() => setConfig({ ...config, quoteSize: size })}
            >
              {size === 'short' ? 'curta' : size === 'medium' ? 'média' : size === 'long' ? 'longa' : 'gigante'}
            </button>
          ))}
        {(config.mode === 'time' || config.mode === 'words') && (
          <label className="custom-limit">
            manual
            <input
              type="number"
              min={1}
              max={config.mode === 'time' ? 7200 : 2000}
              value={customLimit}
              onChange={(e) => setCustomLimit(Number(e.target.value) || 1)}
              onBlur={() =>
                setConfig(
                  config.mode === 'words'
                    ? { ...config, wordLimit: customLimit }
                    : { ...config, timeSeconds: customLimit },
                )
              }
            />
          </label>
        )}
        <button className="primary start-test" onClick={() => void start()} disabled={launching}>
          {launching && <Loader2 size={14} className="spin" aria-hidden="true" />}
          {lang === 'pt' ? 'iniciar' : 'start'}
        </button>
        {launchError && <span className="launcher-status">{launchError}</span>}
      </div>
    </section>
  )
}

function timeModeWordTarget(seconds?: number): number {
  if (!seconds || seconds <= 10) return 60
  if (seconds <= 30) return 110
  if (seconds <= 60) return 170
  if (seconds <= 120) return 260
  return Math.min(600, Math.max(260, Math.ceil(seconds * 2.2)))
}

// ---------------------------------------------------------------------------
// Menu flutuante reutilizável (popover não-modal): abre abaixo do gatilho,
// fecha ao clicar fora ou apertar Esc. O usuário escolhe no próprio menu.

function FloatingMenu(props: {
  triggerContent: React.ReactNode
  triggerClassName?: string
  triggerLabel?: string
  align?: 'left' | 'right'
  panelClassName?: string
  children: (close: () => void) => React.ReactNode
}) {
  const { triggerContent, triggerClassName, triggerLabel, align = 'right', panelClassName = '', children } = props
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  // Posiciona o menu abaixo do gatilho, alinhado à borda pedida, mas sempre
  // limitado ao viewport — evita que o menu escape da tela (mobile, wrap).
  const place = useCallback(() => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return
    const t = trigger.getBoundingClientRect()
    const margin = 8
    const width = panel.offsetWidth
    let left = align === 'right' ? t.right - width : t.left
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
    // Nunca passa das bordas da tela: o painel encolhe e o conteúdo
    // (ex.: lista de temas) rola internamente. Se faltar espaço embaixo,
    // o menu abre para cima do gatilho.
    const spaceBelow = window.innerHeight - (t.bottom + 8) - margin
    const spaceAbove = t.top - 8 - margin
    let top: number
    let maxHeight: number
    if (spaceBelow < 220 && spaceAbove > spaceBelow) {
      maxHeight = Math.min(spaceAbove, 480)
      top = Math.max(margin, t.top - 8 - Math.min(panel.offsetHeight, maxHeight))
    } else {
      top = Math.max(margin, t.bottom + 8)
      maxHeight = Math.min(Math.max(spaceBelow, 160), 480)
    }
    setPos({ top, left, maxHeight })
  }, [align])

  useLayoutEffect(() => {
    if (open) place()
    else setPos(null)
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      const inAnchor = anchorRef.current?.contains(target)
      const inPanel = panelRef.current?.contains(target)
      if (!inAnchor && !inPanel) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onReflow = () => place()
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    // Reposiciona quando o painel assume o tamanho final (conteúdo assíncrono).
    const ro = new ResizeObserver(() => place())
    if (panelRef.current) ro.observe(panelRef.current)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
      ro.disconnect()
    }
  }, [open, place])

  return (
    <div className="menu-anchor" ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {triggerContent}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={`floating-menu ${panelClassName}`}
            role="menu"
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              maxHeight: pos?.maxHeight,
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </div>
  )
}

// Grade de dias ativos do mês corrente (conteúdo do menu de streak).
function StreakCalendar({ activeDays, count, lang }: { activeDays: string[]; count: number; lang: Lang }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const active = new Set(activeDays)
  const activeThisMonth = activeDays.filter((day) => day.startsWith(monthKey)).length
  const monthName = now.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en', { month: 'long', year: 'numeric' })
  const weekdays = lang === 'pt' ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="streak-menu">
      <div className="streak-menu-head">
        <strong>
          <Flame size={15} aria-hidden="true" /> {count} {lang === 'pt' ? 'dias seguidos' : 'day streak'}
        </strong>
        <span className="muted">
          {activeThisMonth}/{totalDays}
        </span>
      </div>
      <span className="muted streak-month">{monthName}</span>
      <div className="streak-grid" aria-label={lang === 'pt' ? 'calendário de streak' : 'streak calendar'}>
        {weekdays.map((w, i) => (
          <span key={'wd' + i} className="streak-weekday" aria-hidden="true">
            {w}
          </span>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={'pad' + i} className="streak-pad" aria-hidden="true" />
        ))}
        {Array.from({ length: totalDays }, (_, i) => {
          const day = i + 1
          const date = `${monthKey}-${String(day).padStart(2, '0')}`
          return (
            <span key={date} className={'streak-day' + (active.has(date) ? ' on' : '')} title={date}>
              {day}
            </span>
          )
        })}
      </div>
      <span className="muted streak-bonus-hint">{t('streakHint', lang)}</span>
    </div>
  )
}

// Menu flutuante de configurações: idioma, som, volume e exportar/importar
// (o tema é escolhido separadamente, no cabeçalho de "meus textos").
function SettingsMenu(props: {
  profile: Profile
  lang: Lang
  onUpdateProfile: (p: Profile) => void
  onExport: () => void
  onImport: (file: File) => void
  saveStatus: string
}) {
  const { profile, lang, onUpdateProfile, onExport, onImport, saveStatus } = props
  const importRef = useRef<HTMLInputElement>(null)
  return (
    <div className="settings-menu">
      <label className="menu-row">
        <span>{t('language', lang)}</span>
        <select
          value={lang}
          onChange={(e) =>
            onUpdateProfile({ ...profile, settings: { ...profile.settings, lang: e.target.value as Lang } })
          }
        >
          <option value="pt">Português</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="menu-row checkbox">
        <span>{t('keySound', lang)}</span>
        <input
          type="checkbox"
          checked={profile.settings.keySound}
          onChange={(e) =>
            onUpdateProfile({ ...profile, settings: { ...profile.settings, keySound: e.target.checked } })
          }
        />
      </label>
      <label className="menu-row checkbox">
        <span>
          {t('relaxedAccents', lang)}
          <small className="menu-hint">{t('relaxedAccentsHint', lang)}</small>
        </span>
        <input
          type="checkbox"
          checked={profile.settings.relaxedAccents}
          onChange={(e) =>
            onUpdateProfile({ ...profile, settings: { ...profile.settings, relaxedAccents: e.target.checked } })
          }
        />
      </label>
      <label className="menu-row">
        <span>{t('volume', lang)}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={profile.settings.volume}
          onChange={(e) =>
            onUpdateProfile({ ...profile, settings: { ...profile.settings, volume: Number(e.target.value) } })
          }
        />
      </label>
      <div className="menu-divider" />
      <button type="button" className="menu-item" onClick={onExport}>
        <Download size={15} aria-hidden="true" /> {lang === 'pt' ? 'Exportar save' : 'Export save'}
      </button>
      <button type="button" className="menu-item" onClick={() => importRef.current?.click()}>
        <Upload size={15} aria-hidden="true" /> {lang === 'pt' ? 'Importar save' : 'Import save'}
      </button>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImport(file)
          e.target.value = ''
        }}
      />
      {saveStatus && <span className="save-status">{saveStatus}</span>}
    </div>
  )
}

// Seletor de tema como conteúdo de menu flutuante (não mais modal).
function ThemePicker(props: {
  lang: Lang
  points: number
  active: string
  onSelect: (theme: string) => void
}) {
  const { lang, points, active, onSelect } = props
  const [query, setQuery] = useState('')
  const visible = THEMES.filter((theme) =>
    `${theme.pt} ${theme.en} ${theme.id}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="theme-picker">
      <label className="theme-search">
        <Search size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang === 'pt' ? 'Buscar tema…' : 'Theme…'}
          autoFocus
        />
      </label>
      <div className="theme-list">
        {visible.map((theme) => {
          const locked = points < theme.unlockAt
          const palette = THEME_PALETTES[theme.id] ?? THEME_PALETTES.noite
          return (
            <button
              key={theme.id}
              type="button"
              className={'theme-option' + (active === theme.id ? ' on' : '')}
              disabled={locked}
              onClick={() => onSelect(theme.id)}
            >
              <span className="theme-name">{lang === 'pt' ? theme.pt : theme.en}</span>
              <span className="theme-meta">
                <span className="theme-swatches" aria-hidden="true">
                  {palette.map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
                <small>{locked ? `${theme.unlockAt} pts` : theme.unlockAt > 0 ? '✓' : t('freeTheme', lang)}</small>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal de texto personalizado (estilo Monkeytype)

function CustomTextModal(props: {
  lang: Lang
  onClose: () => void
  onSubmit: (title: string, raw: string, config: PracticeConfig, source: TextSource) => void
}) {
  const { lang, onClose, onSubmit } = props
  type ContentTab = 'paste' | 'file' | 'generated' | 'book' | 'script' | 'quote'
  const [value, setValue] = useState('')
  const [title, setTitle] = useState('')
  const [config, setConfig] = useState<PracticeConfig>(() => configWith({ mode: 'custom' }))
  const [wordsPerPhase, setWordsPerPhase] = useState(50)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<TextSource>('paste')
  const [tab, setTab] = useState<ContentTab>('paste')
  const [remoteQuery, setRemoteQuery] = useState('')
  const [remoteResults, setRemoteResults] = useState<RemoteSearchResult[]>([])
  const [bookLanguages, setBookLanguages] = useState(lang === 'pt' ? 'pt,en' : 'en,pt')
  const [generatedWordCount, setGeneratedWordCount] = useState(120)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = oldOverflow
    }
  }, [])

  function switchTab(next: ContentTab) {
    setTab(next)
    setError('')
    setRemoteResults([])
    if (next === 'paste') setSource('paste')
    if (next === 'generated') {
      setSource('generated')
      setConfig((current) => ({ ...current, mode: 'custom' }))
      if (!value.trim()) {
        setTitle(lang === 'pt' ? 'Texto gerado' : 'Generated text')
        setValue(buildGeneratedText(SAMPLE_PT, config.generationMode, generatedWordCount, config.delimiter))
      }
    }
    if (next === 'quote') {
      setSource('remote-quote')
      setConfig((current) => ({ ...current, mode: 'quote' }))
      if (!value.trim()) void loadQuote()
    }
  }

  async function handleFile(file: File) {
    setBusy(true)
    setError('')
    try {
      const raw = file.name.toLowerCase().endsWith('.pdf')
        ? await extractPdfText(await file.arrayBuffer())
        : await file.text()
      if (!raw.trim()) {
        setError(t('pdfError', lang))
      } else {
        setValue(raw)
        setSource(file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'paste')
        setTab('file')
        if (!title) setTitle(file.name.replace(/\.(pdf|txt)$/i, ''))
      }
    } catch {
      setError(t('pdfError', lang))
    } finally {
      setBusy(false)
    }
  }

  const modes: { id: PracticeConfig['generationMode']; label: string }[] = [
    { id: 'simple', label: t('modeSimple', lang) },
    { id: 'repeat', label: t('modeRepeat', lang) },
    { id: 'shuffle', label: t('modeShuffle', lang) },
    { id: 'random', label: t('modeRandom', lang) },
  ]
  const modeDescriptions: Record<PracticeConfig['generationMode'], string> = {
    simple: 'Mantém o texto na ordem original.',
    repeat: 'Repete a lista de palavras para treinar o mesmo material por mais tempo.',
    shuffle: 'Embaralha as palavras uma vez antes de criar a fase.',
    random: 'Sorteia palavras do texto com repetição.',
  }

  async function searchRemote(kind: 'book' | 'script') {
    setBusy(true)
    setError('')
    setRemoteResults([])
    try {
      const results =
        kind === 'book'
          ? await searchPublicBooks(remoteQuery, bookLanguages)
          : await searchArchiveScripts(remoteQuery)
      setRemoteResults(results)
      if (results.length === 0) {
        setError(lang === 'pt' ? 'Nada encontrado para essa busca.' : 'No results for this search.')
      }
    } catch {
      setError(lang === 'pt' ? 'Nao consegui buscar essa fonte agora.' : 'Could not search this source now.')
    } finally {
      setBusy(false)
    }
  }

  async function useRemoteResult(item: RemoteSearchResult) {
    setBusy(true)
    setError('')
    try {
      const raw = item.kind === 'book' ? await fetchPublicBookText(item) : await fetchArchiveScriptText(item)
      setValue(raw)
      setTitle(item.title)
      setSource(item.kind)
      setConfig((current) => ({ ...current, mode: 'custom' }))
      setTab(item.kind)
    } catch {
      setError(lang === 'pt' ? 'Nao consegui abrir o texto escolhido.' : 'Could not open the selected text.')
    } finally {
      setBusy(false)
    }
  }

  async function loadQuote() {
    setBusy(true)
    setError('')
    try {
      const quote = await fetchRandomQuote(config.quoteSize ?? 'medium', lang)
      setValue(quote.text)
      setTitle(quote.title)
      setSource('remote-quote')
      setConfig((current) => ({ ...current, mode: 'quote' }))
    } catch {
      setValue(quoteText(config.quoteSize ?? 'medium'))
      setTitle(lang === 'pt' ? 'Citacao local' : 'Local quote')
      setSource('remote-quote')
      setError(lang === 'pt' ? 'API indisponivel; usei uma citacao local.' : 'API unavailable; using local quote.')
    } finally {
      setBusy(false)
    }
  }

  function regenerateText() {
    setSource('generated')
    setTitle(lang === 'pt' ? 'Texto gerado' : 'Generated text')
    setValue(buildGeneratedText(SAMPLE_PT, config.generationMode, generatedWordCount, config.delimiter))
  }

  const tabs: { id: ContentTab; label: string; icon: LucideIcon }[] = [
    { id: 'paste', label: lang === 'pt' ? 'colar' : 'paste', icon: Type },
    { id: 'file', label: 'PDF/TXT', icon: FileUp },
    { id: 'generated', label: lang === 'pt' ? 'gerado' : 'generated', icon: Sparkles },
    { id: 'book', label: lang === 'pt' ? 'livros' : 'books', icon: BookOpen },
    { id: 'script', label: lang === 'pt' ? 'roteiros' : 'scripts', icon: Film },
    { id: 'quote', label: lang === 'pt' ? 'citacoes' : 'quotes', icon: Quote },
  ]

  const modal = (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('customTitle', lang)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{t('customTitle', lang)}</h2>
          <button className="ghost" aria-label={t('cancel', lang)} onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="source-tabs" role="tablist" aria-label={lang === 'pt' ? 'fontes de texto' : 'text sources'}>
          {tabs.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={'source-tab' + (tab === item.id ? ' on' : '')}
                aria-selected={tab === item.id}
                onClick={() => switchTab(item.id)}
              >
                <Icon size={14} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="modal-body">
          <div className="modal-editor">
            <input
              type="text"
              className="title-input"
              value={title}
              placeholder={t('titlePlaceholder', lang)}
              onChange={(e) => setTitle(e.target.value)}
            />
            {tab === 'file' && (
              <div className="source-panel">
                <p className="opt-hint">Abra um PDF ou TXT; depois ajuste as palavras por fase e os filtros.</p>
                <button disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? t('extracting', lang) : t('openFile', lang)}
                </button>
              </div>
            )}
            {tab === 'generated' && (
              <div className="source-panel">
                <p className="opt-hint">Gera um texto novo usando o modo escolhido nas opcoes: simples, repetir, embaralhar ou aleatorio.</p>
                <div className="generator-row">
                  <label>
                    palavras
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      step={10}
                      value={generatedWordCount}
                      onChange={(e) => setGeneratedWordCount(Math.max(10, Number(e.target.value) || 120))}
                    />
                  </label>
                  <button type="button" onClick={regenerateText}>
                    <RefreshCw size={14} aria-hidden="true" /> gerar
                  </button>
                </div>
              </div>
            )}
            {(tab === 'book' || tab === 'script') && (
              <div className="source-panel">
                <div className="remote-search">
                  <input
                    value={remoteQuery}
                    onChange={(e) => setRemoteQuery(e.target.value)}
                    placeholder={tab === 'book' ? 'Machado, Alice, Shakespeare...' : 'screenplay, roteiro, title...'}
                  />
                  {tab === 'book' && (
                    <select value={bookLanguages} onChange={(e) => setBookLanguages(e.target.value)}>
                      <option value="pt,en">pt + en</option>
                      <option value="pt">pt</option>
                      <option value="en">en</option>
                      <option value="es,en">es + en</option>
                    </select>
                  )}
                  <button disabled={busy} onClick={() => void searchRemote(tab)}>
                    {busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <Search size={14} aria-hidden="true" />}
                    buscar
                  </button>
                </div>
                {remoteResults.length > 0 && (
                  <div className="remote-results">
                    {remoteResults.map((item) => (
                      <button
                        key={item.kind === 'book' ? `book-${item.id}` : `script-${item.identifier}`}
                        type="button"
                        className="remote-result"
                        onClick={() => void useRemoteResult(item)}
                      >
                        <strong>{item.title}</strong>
                        <span>
                          {item.kind === 'book'
                            ? `${item.author} · ${item.languages.join(', ')} · ${item.downloads} downloads`
                            : `${item.creator}${item.description ? ` · ${item.description.slice(0, 110)}` : ''}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === 'quote' && (
              <div className="source-panel">
                <p className="opt-hint">As citacoes vem da API. Se a rede falhar, o app usa um fallback local.</p>
                <button disabled={busy} onClick={() => void loadQuote()}>
                  {busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <Quote size={14} aria-hidden="true" />}
                  nova citacao
                </button>
              </div>
            )}
            <textarea
              value={value}
              placeholder={t('pastePlaceholder', lang)}
              onChange={(e) => setValue(e.target.value)}
              spellCheck={false}
            />
          </div>

          <aside className="modal-options">
            <div className="opt-group opt-file-first">
              <span className="opt-title">
                <FileUp size={13} aria-hidden="true" /> fonte
              </span>
              <p className="opt-hint">Arquivo, texto colado, gerado, livro publico, roteiro arquivado ou citacao.</p>
              <button disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? t('extracting', lang) : t('openFile', lang)}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                  e.target.value = ''
                }}
              />
              {error && (
                <p className="error-msg" role="alert">
                  {error}
                </p>
              )}
            </div>

            {tab === 'quote' && (
              <div className="opt-group">
                <span className="opt-title">
                  <Quote size={13} aria-hidden="true" /> tamanho
                </span>
                <div className="chips">
                  {(['short', 'medium', 'long', 'giant'] as QuoteSize[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={'chip' + (config.quoteSize === size ? ' on' : '')}
                      onClick={() => setConfig({ ...config, quoteSize: size })}
                    >
                      {size === 'short' ? 'curta' : size === 'medium' ? 'media' : size === 'long' ? 'longa' : 'gigante'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="opt-group">
              <span className="opt-title">
                <Settings2 size={13} aria-hidden="true" /> {t('modeLabel', lang)}
              </span>
              <p className="opt-hint">{modeDescriptions[config.generationMode]}</p>
              <div className="chips">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={'chip' + (config.generationMode === m.id ? ' on' : '')}
                    aria-pressed={config.generationMode === m.id}
                    onClick={() => setConfig({ ...config, generationMode: m.id })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="opt-group">
              <span className="opt-title">
                <Target size={13} aria-hidden="true" /> {t('phaseLabel', lang)}
              </span>
              <p className="opt-hint">{t('phaseHint', lang)}</p>
              <input
                type="number"
                min={10}
                max={1000}
                step={10}
                value={wordsPerPhase}
                onChange={(e) => setWordsPerPhase(Math.max(10, Number(e.target.value) || 50))}
                aria-label={t('phaseLabel', lang)}
              />
            </div>

            <div className="opt-group">
              <span className="opt-title">
                <Hash size={13} aria-hidden="true" /> filtros
              </span>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={config.includePunctuation}
                  onChange={(e) => setConfig({ ...config, includePunctuation: e.target.checked })}
                />
                pontuação
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={config.includeNumbers}
                  onChange={(e) => setConfig({ ...config, includeNumbers: e.target.checked })}
                />
                números
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={config.removeAccents}
                  onChange={(e) => setConfig({ ...config, removeAccents: e.target.checked })}
                />
                remover acentos
              </label>
              <p className="opt-hint">Espaço separa palavras normalmente. Pipe usa o caractere | para dividir grupos e depois reorganizar como palavras.</p>
              <div className="chips">
                <button
                  type="button"
                  className={'chip' + (config.delimiter === 'space' ? ' on' : '')}
                  onClick={() => setConfig({ ...config, delimiter: 'space' })}
                >
                  espaço
                </button>
                <button
                  type="button"
                  className={'chip' + (config.delimiter === 'pipe' ? ' on' : '')}
                  onClick={() => setConfig({ ...config, delimiter: 'pipe' })}
                >
                  pipe
                </button>
              </div>
            </div>
          </aside>
        </div>

        <button
          className="primary modal-ok"
          disabled={!value.trim() || busy}
          onClick={() => {
            onSubmit(
              title.trim() || t('untitled', lang) + ' ' + todayStr(),
              value,
              {
                ...config,
                wordsPerPhase,
                mode: source === 'pdf' ? 'pdf' : source === 'remote-quote' ? 'quote' : 'custom',
                generationMode: source === 'generated' ? 'simple' : config.generationMode,
              },
              source,
            )
          }}
        >
          {t('ok', lang)}
        </button>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

function buildGeneratedText(
  raw: string,
  mode: PracticeConfig['generationMode'],
  count: number,
  delimiter: PracticeConfig['delimiter'],
): string {
  const bank = raw
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
  if (bank.length === 0) return raw

  let words: string[]
  if (mode === 'repeat') {
    words = Array.from({ length: count }, (_, i) => bank[i % bank.length])
  } else if (mode === 'shuffle') {
    const shuffled = shuffleWords(bank)
    words = Array.from({ length: count }, (_, i) => shuffled[i % shuffled.length])
  } else if (mode === 'random') {
    words = Array.from({ length: count }, () => bank[Math.floor(Math.random() * bank.length)])
  } else {
    words = Array.from({ length: count }, (_, i) => bank[i % bank.length])
  }

  return words.join(delimiter === 'pipe' ? ' | ' : ' ')
}

function shuffleWords(words: string[]): string[] {
  const copy = [...words]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ---------------------------------------------------------------------------
// Tela inicial

function HomeScreen(props: {
  profile: Profile
  texts: SavedText[]
  onAddText: (title: string, raw: string, config?: PracticeConfig, source?: TextSource) => void
  onOpenText: (id: string) => void
  onUpdateTexts: (ts: SavedText[]) => void
  onUpdateProfile: (p: Profile) => void
}) {
  const { profile, texts, onAddText, onOpenText, onUpdateTexts, onUpdateProfile } = props
  const lang = profile.settings.lang
  const [modalOpen, setModalOpen] = useState(false)
  const [viewAchievement, setViewAchievement] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const activeTheme = THEMES.find((th) => th.id === profile.settings.theme)
  const activePalette = THEME_PALETTES[profile.settings.theme] ?? THEME_PALETTES.noite

  // Busca por nome (sem diferenciar acentos) + paginação de 5 em 5.
  const PAGE_SIZE = 3
  const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const filtered = query.trim()
    ? texts.filter((x) => fold(x.title).includes(fold(query.trim())))
    : texts
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visibleTexts = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const showControls = texts.length > PAGE_SIZE

  function exportSave() {
    const payload = JSON.stringify(exportSaveState(profile, texts), null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dopaminetyper-save-${todayStr()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revogar de imediato pode cancelar o download em alguns navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    setSaveStatus(t('saveExported', lang))
  }

  async function importSave(file: File) {
    try {
      const save = importSaveState(await file.text())
      onUpdateProfile(save.profile)
      onUpdateTexts(save.texts)
      setSaveStatus(t('saveImported', lang))
    } catch {
      setSaveStatus(t('saveInvalid', lang))
    }
  }

  return (
    <main className="home">
      <header className="topbar">
        <div className="brand">
          <Pill className="brand-icon" aria-hidden="true" />
          <div>
            <h1>
              Dopamine<span>Typer</span>
            </h1>
            <p className="tagline">{t('tagline', lang)}</p>
          </div>
        </div>
        <div className="topstats" aria-label={t('points', lang)}>
          <PointsBadge size="sm" name={t('points', lang)} total={profile.points} />
          <PointsBadge size="sm" name={t('wordsTyped', lang)} total={profile.totalWords} icon={Keyboard} />
          <FloatingMenu
            align="right"
            triggerClassName="topbar-btn streak-btn"
            triggerLabel={lang === 'pt' ? 'ver calendário de streak' : 'view streak calendar'}
            triggerContent={
              <>
                <Flame size={16} aria-hidden="true" />
                <strong>{profile.streak.count}</strong>
                <span>{lang === 'pt' ? 'dias' : 'days'}</span>
                <ChevronDown className="chev" size={14} aria-hidden="true" />
              </>
            }
          >
            {() => (
              <StreakCalendar activeDays={profile.activeDays ?? []} count={profile.streak.count} lang={lang} />
            )}
          </FloatingMenu>
          <FloatingMenu
            align="right"
            triggerClassName="topbar-btn icon-btn"
            triggerLabel={t('settings', lang)}
            triggerContent={<Settings2 size={17} aria-hidden="true" />}
          >
            {() => (
              <SettingsMenu
                profile={profile}
                lang={lang}
                onUpdateProfile={onUpdateProfile}
                onExport={exportSave}
                onImport={importSave}
                saveStatus={saveStatus}
              />
            )}
          </FloatingMenu>
        </div>
      </header>

      <PracticeLauncher lang={lang} onStart={onAddText} />

      <div className="layout">
        <div className="main-col">
          <section className="card challenge-board">
            <div className="card-head">
              <h2>
                <Target size={13} aria-hidden="true" /> desafios do dia
              </h2>
            </div>
            <div className="challenge-list">
              {DAILY_CHALLENGES.map((challenge) => (
                <article key={challenge.id} className="challenge-item">
                  <Target className="challenge-icon" aria-hidden="true" />
                  <div>
                    <strong>{challenge.label}</strong>
                    <p>{challenge.desc}</p>
                  </div>
                  <span>+{challenge.bonus}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="card texts-card">
            <div className="card-head">
              <h2>{t('myTexts', lang)}</h2>
              <div className="card-actions">
                <button className="primary" onClick={() => setModalOpen(true)}>
                  <Plus size={15} aria-hidden="true" />
                  {t('newText', lang)}
                </button>
                <FloatingMenu
                  align="right"
                  triggerClassName="theme-current"
                  triggerLabel={t('theme', lang)}
                  panelClassName="theme-panel"
                  triggerContent={
                    <>
                      <Palette size={14} aria-hidden="true" />
                      <span>
                        {activeTheme ? (lang === 'pt' ? activeTheme.pt : activeTheme.en) : profile.settings.theme}
                      </span>
                      <span className="theme-swatches" aria-hidden="true">
                        {activePalette.map((color) => (
                          <i key={color} style={{ background: color }} />
                        ))}
                      </span>
                      <ChevronDown className="chev" size={13} aria-hidden="true" />
                    </>
                  }
                >
                  {(close) => (
                    <ThemePicker
                      lang={lang}
                      points={profile.points}
                      active={profile.settings.theme}
                      onSelect={(theme) => {
                        onUpdateProfile({ ...profile, settings: { ...profile.settings, theme } })
                        close()
                      }}
                    />
                  )}
                </FloatingMenu>
              </div>
            </div>
            {showControls && (
              <label className="texts-search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  placeholder={t('searchTexts', lang)}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(0)
                  }}
                />
                {query && (
                  <button
                    type="button"
                    className="ghost"
                    aria-label={t('cancel', lang)}
                    onClick={() => {
                      setQuery('')
                      setPage(0)
                    }}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </label>
            )}
            {texts.length === 0 && <p className="muted">{t('noTexts', lang)}</p>}
            {texts.length > 0 && filtered.length === 0 && <p className="muted">{t('noResults', lang)}</p>}
            <ul className="texts-list">
              {visibleTexts.map((x) => {
                const pct = Math.round((x.progress / x.lines.length) * 100)
                const phases = x.wordsPerPhase
                  ? phaseInfo(x.lines, x.progress, x.wordsPerPhase)
                  : null
                return (
                  <li key={x.id} className="text-card">
                    <div className="text-info">
                      <strong>{x.title}</strong>
                      <div className="progress-track" aria-hidden="true">
                        <div className="progress-fill" style={{ width: pct + '%' }} />
                      </div>
                      <span className="muted">
                        {pct}% {t('completed', lang)} · {countWords(x.lines)}{' '}
                        {t('wordsTyped', lang).split(' ')[0]}
                        {phases ? ` · ${phases.total} ${t('phases', lang)}` : ''}
                      </span>
                    </div>
                    <div className="text-actions">
                      {pct < 100 ? (
                        <button className="primary" onClick={() => onOpenText(x.id)}>
                          {t('continue', lang)}
                          {phases ? ` · ${t('phase', lang).toLowerCase()} ${phases.current}` : ''}
                        </button>
                      ) : (
                        <button
                          className="primary"
                          onClick={() => {
                            onUpdateTexts(
                              texts.map((y) => (y.id === x.id ? { ...y, progress: 0 } : y)),
                            )
                            onOpenText(x.id)
                          }}
                        >
                          {t('restart', lang)}
                        </button>
                      )}
                      <button
                        className="ghost"
                        aria-label={t('remove', lang) + ' ' + x.title}
                        onClick={() => onUpdateTexts(texts.filter((y) => y.id !== x.id))}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
            {showControls && pageCount > 1 && (
              <nav className="texts-pagination" aria-label={t('myTexts', lang)}>
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  ← {t('prevPage', lang)}
                </button>
                <span className="muted">
                  {safePage + 1} {t('pageOf', lang)} {pageCount}
                </span>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                >
                  {t('nextPage', lang)} →
                </button>
              </nav>
            )}
          </section>

        </div>

        <aside className="side-col">
          <section className="card">
            <div className="card-head">
              <h2>
                <Trophy size={13} aria-hidden="true" /> {t('achievements', lang)}
              </h2>
            </div>
            <AchievementGrid
              badgeSize="sm"
              columns={3}
              gap="sm"
              achievements={ACHIEVEMENTS.map((a) => ({
                id: a.id,
                name: lang === 'pt' ? a.pt : a.en,
                trigger: 'api' as const,
                icon: a.icon,
                achievedAt: profile.achievements.includes(a.id)
                  ? profile.achievementDates[a.id] ?? new Date().toISOString()
                  : null,
              }))}
              onAchievementClick={(a) => setViewAchievement(a.id)}
            />
          </section>

        </aside>
      </div>

      {modalOpen && (
        <CustomTextModal
          lang={lang}
          onClose={() => setModalOpen(false)}
          onSubmit={(title, raw, config, source) => {
            setModalOpen(false)
            onAddText(title, raw, config, source)
          }}
        />
      )}

      {viewAchievement &&
        (() => {
          const a = ACHIEVEMENTS.find((x) => x.id === viewAchievement)!
          const unlocked = profile.achievements.includes(a.id)
          return (
            <AchievementUnlocked
              achievement={{
                id: a.id,
                name: lang === 'pt' ? a.pt : a.en,
                description: lang === 'pt' ? a.descPt : a.descEn,
                icon: a.icon,
                unlockedAt: profile.achievementDates[a.id],
              }}
              open
              onOpenChange={(open) => {
                if (!open) setViewAchievement(null)
              }}
              primaryActionLabel={lang === 'pt' ? 'Fechar' : 'Close'}
              earnedDateLabel={
                unlocked
                  ? lang === 'pt'
                    ? `Conquistada em ${new Date(profile.achievementDates[a.id] ?? Date.now()).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : undefined
                  : lang === 'pt'
                    ? 'Ainda bloqueada'
                    : 'Still locked'
              }
            />
          )
        })()}
    </main>
  )
}

// ---------------------------------------------------------------------------
// Tela de digitação

// Quantos caracteres além do fim da linha o usuário pode digitar — evita que
// digitação "fora do escopo" cresça sem limite e desestabilize a linha.
const OVERFLOW_CAP = 8
const DEAD_KEYS = new Set(['"', "'", '`', '^', '~'])

// Remove apenas os diacríticos, preservando a caixa: "á" → "a", "Á" → "A".
function stripDiacritics(ch: string): string {
  return removeTextAccents(ch)
}

// Com acentos relaxados ("á" aceita "a") o usuário ganha menos pontos.
function charMatches(typed: string, expected: string, relaxed: boolean): boolean {
  if (typed === expected) return true
  return relaxed && stripDiacritics(typed) === stripDiacritics(expected)
}

function textMatches(typed: string, expected: string, relaxed: boolean): boolean {
  if (typed.length !== expected.length) return false
  for (let i = 0; i < expected.length; i++) {
    if (!charMatches(typed[i], expected[i], relaxed)) return false
  }
  return true
}

// Dead key aguardando composição: o usuário digitou o acento (´ ~ ^ etc.) e o
// próximo caractere esperado é acentuado — não conta como erro ainda.
function isPendingDeadKey(val: string, expected: string, counted: number): boolean {
  if (val.length !== counted + 1) return false
  const i = val.length - 1
  return i < expected.length && DEAD_KEYS.has(val[i]) && stripDiacritics(expected[i]) !== expected[i]
}

function TypingScreen(props: {
  text: SavedText
  segmentSize: number
  settings: Profile['settings']
  lang: Lang
  onQuit: () => void
  onFinish: (result: SessionResult, linesDone: number, samples: ChartSample[]) => void
}) {
  const { text, segmentSize, settings, lang, onQuit, onFinish } = props
  const config = configWith(text.config ?? { wordsPerPhase: text.wordsPerPhase ?? 50 })
  const isZen = config.mode === 'zen' || config.infinite
  const relaxed = settings.relaxedAccents

  // Fase: fatia de linhas somando ~wordsPerPhase palavras. Textos antigos sem
  // configuração usam o tamanho adaptativo em linhas.
  const lines = useMemo(() => {
    if (isZen || config.mode === 'time' || config.mode === 'words' || config.mode === 'quote') {
      return text.lines.slice(text.progress)
    }
    if (text.wordsPerPhase) {
      const n = phaseLineCount(text.lines, text.progress, config.wordsPerPhase)
      return text.lines.slice(text.progress, text.progress + n)
    }
    return text.lines.slice(text.progress, text.progress + segmentSize)
  }, [config.mode, config.wordsPerPhase, isZen, segmentSize, text])

  const phase = text.wordsPerPhase && !isZen && !['time', 'words', 'quote'].includes(config.mode)
    ? phaseInfo(text.lines, text.progress, config.wordsPerPhase)
    : null

  const [lineIdx, setLineIdx] = useState(0)
  const [typed, setTyped] = useState('')
  const [tick, setTick] = useState(0) // força re-render do WPM ao vivo

  const inputRef = useRef<HTMLInputElement>(null)
  const currentLineRef = useRef<HTMLDivElement>(null)
  // Prefixo do valor atual já contabilizado nas estatísticas — imune a
  // eventos duplicados, edições no meio e composição de acentos.
  const countedRef = useRef(0)
  const completedRef = useRef(false)

  const stats = useRef({
    start: 0,
    correct: 0,
    keystrokes: 0,
    errors: 0,
    combo: 0,
    maxCombo: 0,
    lastCorrect: 0,
    lastErrors: 0,
    samples: [] as ChartSample[],
  })

  const line = lines[lineIdx] ?? ''

  const liveWpm = useCallback(() => {
    const s = stats.current
    if (!s.start) return 0
    const min = (performance.now() - s.start) / 60000
    return min > 0 ? Math.round(s.correct / 5 / min) : 0
  }, [])

  const elapsedSeconds = stats.current.start ? Math.floor((performance.now() - stats.current.start) / 1000) : 0
  const timeLeft =
    config.mode === 'time' && config.timeSeconds
      ? Math.max(0, config.timeSeconds - elapsedSeconds)
      : null

  // Uma amostra por segundo: wpm médio, bruto (com erros), rajada (velocidade
  // instantânea) e erros — alimenta o gráfico de eficiência e a consistência.
  useEffect(() => {
    const id = setInterval(() => {
      const s = stats.current
      if (!s.start) return
      const min = (performance.now() - s.start) / 60000
      s.samples.push({
        wpm: Math.round(s.correct / 5 / min),
        raw: Math.round(s.keystrokes / 5 / min),
        burst: Math.round(((s.correct - s.lastCorrect) / 5) * 60),
        errors: s.errors - s.lastErrors,
      })
      s.lastCorrect = s.correct
      s.lastErrors = s.errors
      setTick((n) => n + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (config.mode !== 'time' || !config.timeSeconds || !stats.current.start) return
    if (elapsedSeconds >= config.timeSeconds) completeSegment()
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [lineIdx])

  useEffect(() => {
    currentLineRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [lineIdx])

  function completeSegment(linesDoneOverride?: number) {
    if (completedRef.current) return
    completedRef.current = true
    const s = stats.current
    const minutes = Math.max((performance.now() - s.start) / 60000, 1 / 60)
    const wpm = Math.round(s.correct / 5 / minutes)
    const accuracy = s.keystrokes > 0 ? Math.round((s.correct / s.keystrokes) * 1000) / 10 : 100
    // Consistência: variação da velocidade instantânea (rajada), como no Monkeytype.
    const bursts = s.samples.map((x) => x.burst).filter((x) => x > 0)
    let consistency = 100
    if (bursts.length >= 2) {
      const mean = bursts.reduce((a, b) => a + b, 0) / bursts.length
      const sd = Math.sqrt(bursts.reduce((a, b) => a + (b - mean) ** 2, 0) / bursts.length)
      consistency = Math.max(0, Math.round(100 - (sd / mean) * 100))
    }
    const words = config.mode === 'time' ? Math.max(0, Math.round(s.correct / 5)) : countWords(lines)
    // Pontuação: volume digitado × precisão², com bônus de velocidade e combo.
    // Digitar com acentos relaxados vale 30% menos.
    const base = words * (accuracy / 100) ** 2 * (1 + wpm / 100) + s.maxCombo / 2
    const points = Math.round(relaxed ? base * 0.7 : base)
    onFinish(
      { date: todayStr(), wpm, accuracy, consistency, maxCombo: s.maxCombo, words, points },
      linesDoneOverride ?? lines.length,
      s.samples,
    )
  }

  // Contabiliza os caracteres novos de `val` (do prefixo já contado em diante).
  function countNew(val: string) {
    const s = stats.current
    if (!s.start) s.start = performance.now()
    const advancingWithSpace = isAdvanceSpace(val)
    for (let i = countedRef.current; i < val.length; i++) {
      if (i >= line.length && advancingWithSpace) continue
      s.keystrokes++
      if (i < line.length && charMatches(val[i], line[i], relaxed)) {
        s.correct++
        s.combo++
        if (s.combo > s.maxCombo) s.maxCombo = s.combo
        if (settings.keySound) audio.playKeyTick(settings.volume, s.combo >= 50 && s.combo % 10 === 0 ? s.combo : 0)
      } else {
        s.errors++
        s.combo = 0
        audio.playError(settings.volume)
      }
    }
    countedRef.current = Math.max(countedRef.current, val.length)
  }

  // Linha correta: toca a próxima nota da melodia progressiva e avança.
  function advanceIfDone(val: string): boolean {
    if (!isAdvanceSpace(val)) return false
    audio.playLineNote(lineIdx, settings.volume)
    countedRef.current = 0
    setTyped('')
    if (lineIdx + 1 >= lines.length) {
      if (isZen) setLineIdx(0)
      else completeSegment()
    }
    else setLineIdx(lineIdx + 1)
    return true
  }

  function isAdvanceSpace(val: string): boolean {
    return val.length === line.length + 1 && val.endsWith(' ') && textMatches(val.slice(0, -1), line, relaxed)
  }

  function processValue(rawVal: string, isComposing: boolean) {
    audio.unlock()
    // Trava o excesso além do fim da linha — evita "fugir do escopo".
    const val =
      rawVal.length > line.length + OVERFLOW_CAP
        ? rawVal.slice(0, line.length + OVERFLOW_CAP)
        : rawVal
    if (val.length < countedRef.current) countedRef.current = val.length
    if (isPendingDeadKey(val, line, countedRef.current)) {
      setTyped(val)
      return
    }
    // Durante composição (acentos/dead keys) só exibe; conta ao concluir.
    if (!isComposing) countNew(val)
    if (!advanceIfDone(val)) setTyped(val)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const native = e.nativeEvent as InputEvent
    processValue(e.target.value, Boolean(native.isComposing))
  }

  const s = stats.current
  void tick

  return (
    <main
      className="typing"
      onClick={() => inputRef.current?.focus()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onQuit()
        if (isZen && e.key === 'Enter' && e.shiftKey) completeSegment(0)
      }}
    >
      <div className="typing-head">
        <span className="muted">
          {phase
            ? `${t('phase', lang)} ${phase.current} ${t('of', lang)} ${phase.total} · ${text.title}`
            : `${text.title} · ${t('line', lang)} ${text.progress + lineIdx + 1} ${t('of', lang)} ${text.lines.length}`}
        </span>
        <span className="muted esc-hint">{isZen ? 'Shift + Enter para finalizar · Esc para sair' : t('escHint', lang)}</span>
        {isZen && (
          <button
            className="ghost finish-zen"
            onClick={(e) => {
              e.stopPropagation()
              completeSegment(0)
            }}
          >
            finalizar
          </button>
        )}
      </div>

      <div className="live-stats" aria-live="off">
        {timeLeft !== null && (
          <div>
            <strong>{timeLeft}</strong> s
          </div>
        )}
        <div>
          <strong>{liveWpm()}</strong> {t('wpm', lang)}
        </div>
        <div>
          <strong>{s.keystrokes > 0 ? Math.round((s.correct / s.keystrokes) * 100) : 100}%</strong>{' '}
          {t('accuracy', lang)}
        </div>
        <div className={s.combo >= 150 ? 'combo inferno' : s.combo >= 100 ? 'combo fire' : s.combo >= 50 ? 'combo hot' : 'combo'}>
          <strong>{s.combo}</strong> {t('combo', lang)}
        </div>
      </div>

      <div className="lines" role="region" aria-label="typing area">
        {lines.map((l, i) => {
          if (i < lineIdx)
            return (
              <div key={i} className="line done">
                {l}
              </div>
            )
          if (i > lineIdx)
            return (
              <div key={i} className="line future">
                {l}
              </div>
            )
          return (
            <div key={i} className="line current" ref={currentLineRef}>
              {l.split('').map((ch, j) => {
                let cls = 'pending'
                if (j < typed.length) cls = charMatches(typed[j], ch, relaxed) ? 'ok' : 'bad'
                if (j === typed.length) cls += ' caret'
                return (
                  <span key={j} className={cls}>
                    {ch === ' ' && cls.startsWith('bad') ? '·' : ch}
                  </span>
                )
              })}
              {typed.length > line.length && (
                <span className="bad">{typed.slice(line.length).replace(/ /g, '·')}</span>
              )}
              {typed.length >= line.length && <span className="pending caret"> </span>}
            </div>
          )
        })}
      </div>

      <input
        ref={inputRef}
        className="ghost-input"
        value={typed}
        onChange={handleInput}
        onCompositionEnd={(e) => processValue(e.currentTarget.value, false)}
        onPaste={(e) => e.preventDefault()}
        onBlur={() => {
          // Mantém o foco na digitação — clicar fora não deve travar a sessão.
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="typing input"
      />
    </main>
  )
}

// ---------------------------------------------------------------------------
// Tela de resultados

function ResultsScreen(props: {
  result: SessionStats
  lang: Lang
  hasMore: boolean
  onNext: () => void
  onHome: () => void
}) {
  const { result, lang, hasMore, onNext, onHome } = props
  // Celebra cada conquista nova em sequência com o diálogo do Trophy UI.
  const [celebrateIdx, setCelebrateIdx] = useState(0)
  const [celebrateOpen, setCelebrateOpen] = useState(result.newAchievements.length > 0)
  const celebrating = ACHIEVEMENTS.find((x) => x.id === result.newAchievements[celebrateIdx])

  return (
    <main className="results">
      <h2>{result.textFinished ? t('textDone', lang) : t('segmentDone', lang)}</h2>

      {celebrating && (
        <AchievementUnlocked
          achievement={{
            id: celebrating.id,
            name: lang === 'pt' ? celebrating.pt : celebrating.en,
            description: lang === 'pt' ? celebrating.descPt : celebrating.descEn,
            icon: celebrating.icon,
            unlockedAt: new Date().toISOString(),
          }}
          open={celebrateOpen}
          onOpenChange={(open) => {
            if (!open) {
              if (celebrateIdx + 1 < result.newAchievements.length) {
                setCelebrateIdx(celebrateIdx + 1)
              } else {
                setCelebrateOpen(false)
              }
            }
          }}
          primaryActionLabel={lang === 'pt' ? 'Aê!' : 'Awesome!'}
          earnedDateLabel={lang === 'pt' ? 'Conquistada agora' : 'Earned just now'}
        />
      )}

      <div className="result-grid">
        <div className="result-card">
          <strong>{result.wpm}</strong>
          <span>{t('wpm', lang)}</span>
        </div>
        <div className="result-card">
          <strong>{result.accuracy}%</strong>
          <span>{t('accuracy', lang)}</span>
        </div>
        <div className="result-card">
          <strong>{result.consistency}%</strong>
          <span>{t('consistency', lang)}</span>
        </div>
        <div className="result-card">
          <strong>{result.maxCombo}</strong>
          <span>{t('maxCombo', lang)}</span>
        </div>
        <div className="result-card highlight">
          <strong>+{result.points}</strong>
          <span>{t('pointsEarned', lang)}</span>
        </div>
      </div>

      {(result.challengeDone || result.streakBonus > 0 || result.monthBonusPts > 0) && (
        <div className="bonus-row">
          {result.challengeDone && (
            <p className="challenge-done">
              <Target size={15} aria-hidden="true" /> {result.challengeLabels.join(', ')} +{result.challengeBonus}
            </p>
          )}
          {result.streakBonus > 0 && (
            <p className="challenge-done">
              <Flame size={15} aria-hidden="true" /> {t('dailyBonus', lang)} +{result.streakBonus}
            </p>
          )}
          {result.monthBonusPts > 0 && (
            <p className="challenge-done">
              <Trophy size={15} aria-hidden="true" /> {t('monthBonus', lang)} +{result.monthBonusPts}
            </p>
          )}
        </div>
      )}

      {result.samples.length >= 2 && <SessionChart samples={result.samples} lang={lang} />}

      {result.newAchievements.length > 0 && (
        <section className="new-achievements">
          <h3>{t('newAchievements', lang)}</h3>
          <ul>
            {result.newAchievements.map((id) => {
              const a = ACHIEVEMENTS.find((x) => x.id === id)!
              return (
                <li key={id}>
                  <a.icon size={15} aria-hidden="true" /> {lang === 'pt' ? a.pt : a.en}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="row center">
        {hasMore && (
          <button className="primary" onClick={onNext} autoFocus>
            {t('nextSegment', lang)} →
          </button>
        )}
        <button onClick={onHome} autoFocus={!hasMore}>
          {t('backHome', lang)}
        </button>
      </div>
    </main>
  )
}

// Gráfico de eficiência estilo Monkeytype: WPM médio, bruto e rajada por
// segundo, erros marcados no eixo secundário, filtros por série e tooltip.
function SessionChart({ samples, lang }: { samples: ChartSample[]; lang: Lang }) {
  const [show, setShow] = useState({ raw: true, burst: true, errors: true })
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const W = 640
  const H = 220
  const padL = 40
  const padR = 34
  const padT = 14
  const padB = 26
  const n = samples.length

  const maxY =
    Math.ceil(
      Math.max(
        10,
        ...samples.map((s) => Math.max(s.wpm, show.raw ? s.raw : 0, show.burst ? s.burst : 0)),
      ) / 20,
    ) * 20
  const maxE = Math.max(4, ...samples.map((s) => s.errors))

  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB)
  const yE = (e: number) => padT + (1 - e / maxE) * (H - padT - padB)
  const path = (get: (s: ChartSample) => number) =>
    samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(get(s))}`).join(' ')

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => Math.round(maxY * k))
  const xStep = Math.max(1, Math.ceil(n / 8))

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((px - padL) / (W - padL - padR)) * (n - 1))
    setHover(i >= 0 && i < n ? i : null)
  }

  const legends: { key: keyof typeof show; label: string }[] = [
    { key: 'raw', label: t('raw', lang) },
    { key: 'burst', label: t('burst', lang) },
    { key: 'errors', label: t('errors', lang) },
  ]

  const h = hover !== null ? samples[hover] : null
  const tipW = 108
  const tipX = hover !== null ? Math.min(x(hover) + 10, W - padR - tipW) : 0

  return (
    <figure className="chart">
      <figcaption className="muted">{t('wpmOverTime', lang)}</figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('wpmOverTime', lang)}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} className="grid-line" />
            <text x={padL - 6} y={y(v) + 3} className="axis-label" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {samples.map((_, i) =>
          i % xStep === 0 ? (
            <text key={i} x={x(i)} y={H - 8} className="axis-label" textAnchor="middle">
              {i + 1}
            </text>
          ) : null,
        )}
        <text x={W - padR + 6} y={yE(maxE) + 3} className="axis-label">
          {maxE}
        </text>
        <text x={W - padR + 6} y={yE(0) + 3} className="axis-label">
          0
        </text>

        {show.burst && <path d={path((s) => s.burst)} className="series-burst" />}
        {show.raw && <path d={path((s) => s.raw)} className="series-raw" />}
        <path d={path((s) => s.wpm)} className="series-wpm" />
        {show.errors &&
          samples.map((s, i) =>
            s.errors > 0 ? (
              <g key={i} className="series-error" transform={`translate(${x(i)},${yE(s.errors)})`}>
                <line x1={-3.5} y1={-3.5} x2={3.5} y2={3.5} />
                <line x1={-3.5} y1={3.5} x2={3.5} y2={-3.5} />
              </g>
            ) : null,
          )}

        {hover !== null && h && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={H - padB} className="hover-line" />
            <circle cx={x(hover)} cy={y(h.wpm)} r={3.5} className="hover-dot" />
            <g transform={`translate(${tipX},${padT + 4})`}>
              <rect
                width={tipW}
                height={show.raw || show.burst || show.errors ? 74 : 34}
                rx={6}
                className="tip-box"
              />
              <text x={8} y={15} className="tip-title">
                {hover + 1}s
              </text>
              <text x={8} y={30} className="tip-line tip-wpm">
                wpm: {h.wpm}
              </text>
              {show.raw && (
                <text x={8} y={44} className="tip-line">
                  {t('raw', lang)}: {h.raw}
                </text>
              )}
              {show.burst && (
                <text x={8} y={58} className="tip-line">
                  {t('burst', lang)}: {h.burst}
                </text>
              )}
              {show.errors && (
                <text x={8} y={72} className="tip-line tip-err">
                  {t('errors', lang)}: {h.errors}
                </text>
              )}
            </g>
          </g>
        )}
      </svg>
      <div className="chart-legend" role="group" aria-label="filters">
        <span className="legend-item static">
          <span className="swatch swatch-wpm" /> wpm
        </span>
        {legends.map((l) => (
          <button
            key={l.key}
            type="button"
            className={'legend-item' + (show[l.key] ? ' on' : '')}
            aria-pressed={show[l.key]}
            onClick={() => setShow({ ...show, [l.key]: !show[l.key] })}
          >
            <span className={'swatch swatch-' + l.key} /> {l.label}
          </button>
        ))}
      </div>
    </figure>
  )
}
