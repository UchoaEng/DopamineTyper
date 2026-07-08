import type { QuoteSize } from './storage'

const QUOTABLE_API = 'https://api.quotable.io'
const DUMMY_QUOTES_API = 'https://dummyjson.com'
const GUTENDEX_API = 'https://gutendex.com'
const ARCHIVE_API = 'https://archive.org'
const JINA_READER_API = 'https://r.jina.ai'
const MYMEMORY_API = 'https://api.mymemory.translated.net'
type ContentLang = 'pt' | 'en'

export interface RemoteQuote {
  title: string
  text: string
  author?: string
}

export interface PublicBookResult {
  kind: 'book'
  id: number
  title: string
  author: string
  languages: string[]
  downloads: number
  formats: Record<string, string>
}

export interface ArchiveScriptResult {
  kind: 'script'
  identifier: string
  title: string
  creator: string
  description: string
}

export type RemoteSearchResult = PublicBookResult | ArchiveScriptResult

const FALLBACK_BOOKS: PublicBookResult[] = [
  {
    kind: 'book',
    id: 11,
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    languages: ['en'],
    downloads: 0,
    formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/11/11-0.txt' },
  },
  {
    kind: 'book',
    id: 1342,
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    languages: ['en'],
    downloads: 0,
    formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/1342/1342-0.txt' },
  },
  {
    kind: 'book',
    id: 84,
    title: 'Frankenstein',
    author: 'Mary Wollstonecraft Shelley',
    languages: ['en'],
    downloads: 0,
    formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/84/84-0.txt' },
  },
  {
    kind: 'book',
    id: 2701,
    title: 'Moby Dick',
    author: 'Herman Melville',
    languages: ['en'],
    downloads: 0,
    formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/2701/2701-0.txt' },
  },
  {
    kind: 'book',
    id: 1661,
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    languages: ['en'],
    downloads: 0,
    formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/1661/1661-0.txt' },
  },
]

interface GutendexBook {
  id: number
  title: string
  authors?: { name: string }[]
  languages?: string[]
  download_count?: number
  formats?: Record<string, string>
}

interface ArchiveDoc {
  identifier?: string
  title?: string
  creator?: string | string[]
  description?: string | string[]
}

interface ArchiveFile {
  name?: string
  format?: string
  size?: string
}

interface QuotableQuote {
  content?: string
  author?: string
}

interface DummyQuote {
  quote?: string
  author?: string
}

interface DummyQuotesResponse {
  quotes?: DummyQuote[]
}

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string
  }
  responseStatus?: number
}

function withTimeout(ms = 15000): AbortSignal {
  const controller = new AbortController()
  window.setTimeout(() => controller.abort(), ms)
  return controller.signal
}

async function getJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const response = await fetch(url, { signal: withTimeout(timeoutMs) })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return (await response.json()) as T
}

async function getText(url: string): Promise<string> {
  const response = await fetch(url.replace(/^http:\/\//, 'https://'), { signal: withTimeout(12000) })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.text()
}

async function getReadableText(url: string): Promise<string> {
  const normalized = url.replace(/^http:\/\//, 'https://')
  try {
    return await getText(normalized)
  } catch {
    const readerUrl = `${JINA_READER_API}/${normalized}`
    return getText(readerUrl)
  }
}

function oneLine(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function quoteParams(size: QuoteSize): { minLength?: number; maxLength?: number; limit: number } {
  if (size === 'short') return { maxLength: 120, limit: 1 }
  if (size === 'medium') return { minLength: 120, maxLength: 220, limit: 1 }
  if (size === 'long') return { minLength: 220, maxLength: 420, limit: 1 }
  return { minLength: 180, maxLength: 420, limit: 3 }
}

export async function fetchRandomQuote(size: QuoteSize, targetLang: ContentLang = 'en'): Promise<RemoteQuote> {
  try {
    return await fetchDummyQuote(size, targetLang)
  } catch {
    return fetchQuotableQuote(size, targetLang)
  }
}

async function fetchDummyQuote(size: QuoteSize, targetLang: ContentLang): Promise<RemoteQuote> {
  const data = await getJson<DummyQuotesResponse>(`${DUMMY_QUOTES_API}/quotes?limit=0`)
  const quotes = (data.quotes ?? []).filter((quote) => quote.quote?.trim())
  const selected = pickQuotesForSize(quotes, size)
  if (selected.length === 0) throw new Error('No quote returned')
  const parts = await Promise.all(
    selected.map(async (quote) => formatRemoteQuote(quote.quote ?? '', quote.author, targetLang)),
  )
  const text = parts.join('\n\n')
  const author = selected.map((quote) => quote.author).filter(Boolean).join(', ')
  return {
    title: author ? `Citacao - ${author}` : 'Citacao aleatoria',
    text,
    author,
  }
}

async function fetchQuotableQuote(size: QuoteSize, targetLang: ContentLang): Promise<RemoteQuote> {
  const params = new URLSearchParams()
  const limits = quoteParams(size)
  params.set('limit', String(limits.limit))
  if (limits.minLength) params.set('minLength', String(limits.minLength))
  if (limits.maxLength) params.set('maxLength', String(limits.maxLength))

  const data = await getJson<QuotableQuote[] | QuotableQuote>(`${QUOTABLE_API}/quotes/random?${params}`)
  const quotes = Array.isArray(data) ? data : [data]
  const usable = quotes.filter((quote) => quote.content?.trim())
  if (usable.length === 0) throw new Error('No quote returned')

  const parts = await Promise.all(
    usable.map(async (quote) => formatRemoteQuote(quote.content ?? '', quote.author, targetLang)),
  )
  const text = parts.join('\n\n')
  const author = usable.map((quote) => quote.author).filter(Boolean).join(', ')
  return {
    title: author ? `Citacao - ${author}` : 'Citacao aleatoria',
    text,
    author,
  }
}

async function formatRemoteQuote(content: string, author: string | undefined, targetLang: ContentLang): Promise<string> {
  const quote = targetLang === 'pt' ? await translateToPortuguese(content) : content.trim()
  return `${quote}${author ? ` - ${author}` : ''}`
}

async function translateToPortuguese(text: string): Promise<string> {
  const clean = text.trim()
  if (!clean) return clean
  const params = new URLSearchParams()
  params.set('q', clean)
  params.set('langpair', 'en|pt-BR')
  const data = await getJson<MyMemoryResponse>(`${MYMEMORY_API}/get?${params}`, 12000)
  const translated = data.responseData?.translatedText?.trim()
  if (!translated || data.responseStatus !== 200) throw new Error('Translation failed')
  return translated
}

function pickQuotesForSize(quotes: DummyQuote[], size: QuoteSize): DummyQuote[] {
  const ranges: Record<QuoteSize, { min: number; max: number; count: number }> = {
    short: { min: 0, max: 120, count: 1 },
    medium: { min: 90, max: 190, count: 1 },
    long: { min: 130, max: 280, count: 2 },
    giant: { min: 90, max: 280, count: 4 },
  }
  const range = ranges[size]
  const pool = quotes.filter((quote) => {
    const length = quote.quote?.length ?? 0
    return length >= range.min && length <= range.max
  })
  const source = pool.length >= range.count ? pool : quotes
  return shuffle(source).slice(0, range.count)
}

export async function searchPublicBooks(query: string, languages = 'pt,en'): Promise<PublicBookResult[]> {
  const params = new URLSearchParams()
  params.set('copyright', 'false')
  params.set('mime_type', 'text/')
  params.set('languages', languages)
  params.set('sort', query.trim() ? 'popular' : 'popular')
  if (query.trim()) params.set('search', query.trim())

  try {
    const data = await getJson<{ results?: GutendexBook[] }>(`${GUTENDEX_API}/books/?${params}`, 35000)
    const results = (data.results ?? [])
      .filter((book) => pickPlainTextFormat(book.formats ?? null))
      .slice(0, 12)
      .map((book) => ({
        kind: 'book' as const,
        id: book.id,
        title: book.title,
        author: (book.authors ?? []).map((author) => author.name).join(', ') || 'Autor desconhecido',
        languages: book.languages ?? [],
        downloads: book.download_count ?? 0,
        formats: book.formats ?? {},
      }))
    return results.length > 0 ? results : fallbackPublicBooks(query, languages)
  } catch {
    return fallbackPublicBooks(query, languages)
  }
}

export async function fetchPublicBookText(book: PublicBookResult): Promise<string> {
  const url = pickPlainTextFormat(book.formats)
  if (!url) throw new Error('Book has no plain text format')
  return trimLongText(stripBeforeMainContent(stripGutenbergBoilerplate(await getReadableText(url))))
}

export async function searchArchiveScripts(query: string): Promise<ArchiveScriptResult[]> {
  const params = new URLSearchParams()
  const userQuery = query.trim()
  const search = userQuery
    ? `mediatype:texts AND (${userQuery}) AND (screenplay OR script OR roteiro)`
    : 'mediatype:texts AND (screenplay OR script OR roteiro)'
  params.set('q', search)
  params.append('fl[]', 'identifier')
  params.append('fl[]', 'title')
  params.append('fl[]', 'creator')
  params.append('fl[]', 'description')
  params.set('rows', '12')
  params.set('page', '1')
  params.set('output', 'json')
  params.append('sort[]', 'downloads desc')

  const data = await getJson<{ response?: { docs?: ArchiveDoc[] } }>(
    `${ARCHIVE_API}/advancedsearch.php?${params}`,
    25000,
  )
  return (data.response?.docs ?? [])
    .filter((doc) => doc.identifier)
    .map((doc) => ({
      kind: 'script',
      identifier: doc.identifier!,
      title: oneLine(doc.title) || doc.identifier!,
      creator: oneLine(doc.creator) || 'Internet Archive',
      description: oneLine(doc.description),
    }))
}

export async function fetchArchiveScriptText(item: ArchiveScriptResult): Promise<string> {
  const metadata = await getJson<{ files?: ArchiveFile[] }>(`${ARCHIVE_API}/metadata/${item.identifier}`)
  const file = pickArchiveTextFile(metadata.files ?? [])
  if (!file?.name) throw new Error('Archive item has no readable text file')
  const encodedName = file.name.split('/').map(encodeURIComponent).join('/')
  const text = await getReadableText(`${ARCHIVE_API}/download/${encodeURIComponent(item.identifier)}/${encodedName}`)
  return trimLongText(stripBeforeMainContent(stripArchiveNoise(text)))
}

function pickPlainTextFormat(formats: Record<string, string> | null): string | null {
  if (!formats) return null
  const entries = Object.entries(formats)
  const preferred = entries.find(([mime]) => mime.toLowerCase().includes('text/plain; charset=utf-8'))
  const plain = entries.find(([mime]) => mime.toLowerCase().startsWith('text/plain'))
  return preferred?.[1] ?? plain?.[1] ?? null
}

function pickArchiveTextFile(files: ArchiveFile[]): ArchiveFile | null {
  const readable = files.filter((file) => {
    const name = file.name?.toLowerCase() ?? ''
    const format = file.format?.toLowerCase() ?? ''
    return (
      (name.endsWith('_djvu.txt') || name.endsWith('.txt') || format.includes('text')) &&
      !name.includes('meta') &&
      !name.includes('files.xml')
    )
  })
  return (
    readable.find((file) => file.name?.toLowerCase().endsWith('_djvu.txt')) ??
    readable.find((file) => file.name?.toLowerCase().endsWith('.txt')) ??
    readable[0] ??
    null
  )
}

function stripGutenbergBoilerplate(raw: string): string {
  let text = raw.replace(/\r/g, '')
  const start = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i.exec(text)
  if (start?.index !== undefined) {
    text = text.slice(start.index + start[0].length)
  }
  const end = text.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i)
  if (end >= 0) text = text.slice(0, end)
  return text
}

function stripArchiveNoise(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .replace(/This is a digital copy[\s\S]{0,1200}?Internet Archive/gi, '')
    .replace(/\n{4,}/g, '\n\n')
}

function stripBeforeMainContent(raw: string): string {
  const text = raw.replace(/\r/g, '').trim()
  const headings = findMainContentHeadings(text)
  if (headings.length === 0) return text

  for (let i = 0; i < headings.length; i++) {
    const current = headings[i]
    const next = headings[i + 1]?.index ?? text.length
    const section = text.slice(current.index, next)
    const sectionWords = section.split(/\s+/).filter(Boolean).length

    // Sumarios costumam ter varios titulos de capitulo muito proximos. Um
    // capitulo real tem corpo suficiente antes do proximo marcador.
    if (sectionWords >= 180 || next - current.index >= 1400) {
      return text.slice(current.index).trim()
    }
  }

  const last = headings[headings.length - 1]
  const tail = text.slice(last.index)
  return tail.split(/\s+/).filter(Boolean).length >= 80 ? tail.trim() : text
}

function findMainContentHeadings(text: string): { index: number }[] {
  const patterns = [
    /^\s*(chapter|capitulo|capitulo|capitulo|capítulo)\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*$/gim,
    /^\s*(letter|carta)\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*$/gim,
    /^\s*(part|parte|book|livro)\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*$/gim,
    /^\s*(act|ato)\s+([ivxlcdm]+|\d+|one|two|three|four|five)\b.*$/gim,
    /^\s*(scene|cena)\s+([ivxlcdm]+|\d+|one|two|three|four|five)\b.*$/gim,
    /^\s*(fade in:|int\.|ext\.)\s*.*$/gim,
  ]
  return patterns
    .flatMap((pattern) => Array.from(text.matchAll(pattern), (match) => ({ index: match.index ?? 0 })))
    .filter((heading) => heading.index >= 0)
    .sort((a, b) => a.index - b.index)
}

function trimLongText(raw: string): string {
  return raw
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
    .slice(0, 60000)
}

function fallbackPublicBooks(query: string, languages: string): PublicBookResult[] {
  const needles = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const allowedLanguages = new Set(languages.split(',').map((lang) => lang.trim()).filter(Boolean))
  return FALLBACK_BOOKS.filter((book) => {
    const languageOk = book.languages.some((lang) => allowedLanguages.has(lang)) || allowedLanguages.size === 0
    if (!languageOk) return false
    if (needles.length === 0) return true
    const haystack = `${book.title} ${book.author}`.toLowerCase()
    return needles.some((needle) => haystack.includes(needle))
  })
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
