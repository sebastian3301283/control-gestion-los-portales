import { FileSpreadsheet, FileText, LoaderCircle, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import './guideline-document-import.css'
import './guideline-multi-import.css'

type Unit = { code: string; name: string }
type Management = { id: string; name: string; active: boolean }
type Manager = { id: string; name: string; cargo: string | null; active: boolean }
type DraftRow = {
  id: string
  enabled: boolean
  category: string
  code: string
  text: string
  managementId: string
  responsibleId: string
}
type Props = {
  unit: Unit
  periodId: string
  open: boolean
  onClose: () => void
  onImported: (count: number) => void
  defaultManagementId?: string | null
}
type XlsxApi = {
  read: (data: ArrayBuffer, options: Record<string, unknown>) => { SheetNames: string[]; Sheets: Record<string, unknown> }
  utils: { sheet_to_json: (sheet: unknown, options: Record<string, unknown>) => unknown[][] }
}
type PdfTextItem = { str?: string; transform?: number[] }
type PdfPage = {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>
  getViewport: (options: { scale: number }) => { width: number; height: number }
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> }
}
type PdfDocument = { numPages: number; getPage: (page: number) => Promise<PdfPage> }
type PdfApi = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (input: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> }
}
type ZipEntry = { async: (kind: 'string') => Promise<string> }
type ZipArchive = { files: Record<string, ZipEntry> }
type ZipApi = { loadAsync: (data: ArrayBuffer) => Promise<ZipArchive> }
type TesseractApi = {
  recognize: (
    image: File | HTMLCanvasElement,
    lang: string,
    options?: { logger?: (message: { status?: string; progress?: number }) => void },
  ) => Promise<{ data: { text: string } }>
}

const scriptPromises = new Map<string, Promise<void>>()
let xlsxPromise: Promise<XlsxApi> | null = null
let pdfPromise: Promise<PdfApi> | null = null
let zipPromise: Promise<ZipApi> | null = null
let tesseractPromise: Promise<TesseractApi> | null = null

function loadScript(key: string, src: string, ready: () => boolean) {
  if (ready()) return Promise.resolve()
  const existing = scriptPromises.get(key)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => ready() ? resolve() : reject(new Error(`No se pudo inicializar ${key}.`))
    script.onerror = () => reject(new Error(`No se pudo cargar ${key}. Verifica tu conexión.`))
    document.head.appendChild(script)
  }).catch(error => {
    scriptPromises.delete(key)
    throw error
  })
  scriptPromises.set(key, promise)
  return promise
}

async function loadXlsx(): Promise<XlsxApi> {
  const get = () => (window as Window & { XLSX?: XlsxApi }).XLSX
  if (get()) return get() as XlsxApi
  if (!xlsxPromise) {
    xlsxPromise = loadScript('Excel', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => Boolean(get()))
      .then(() => get() as XlsxApi)
      .catch(error => { xlsxPromise = null; throw error })
  }
  return xlsxPromise
}

async function loadPdf(): Promise<PdfApi> {
  const get = () => (window as Window & { pdfjsLib?: PdfApi }).pdfjsLib
  if (get()) return get() as PdfApi
  if (!pdfPromise) {
    pdfPromise = loadScript('lector PDF', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', () => Boolean(get()))
      .then(() => {
        const api = get() as PdfApi
        api.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        return api
      })
      .catch(error => { pdfPromise = null; throw error })
  }
  return pdfPromise
}

async function loadZip(): Promise<ZipApi> {
  const get = () => (window as Window & { JSZip?: ZipApi }).JSZip
  if (get()) return get() as ZipApi
  if (!zipPromise) {
    zipPromise = loadScript('lector PowerPoint', 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', () => Boolean(get()))
      .then(() => get() as ZipApi)
      .catch(error => { zipPromise = null; throw error })
  }
  return zipPromise
}

async function loadTesseract(): Promise<TesseractApi> {
  const get = () => (window as Window & { Tesseract?: TesseractApi }).Tesseract
  if (get()) return get() as TesseractApi
  if (!tesseractPromise) {
    tesseractPromise = loadScript('lector de imágenes', 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', () => Boolean(get()))
      .then(() => get() as TesseractApi)
      .catch(error => { tesseractPromise = null; throw error })
  }
  return tesseractPromise
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
function asText(value: unknown) { return value == null ? '' : String(value).replace(/\s+/g, ' ').trim() }
function findHeaderIndex(row: unknown[], patterns: RegExp[]) {
  return row.findIndex(cell => patterns.some(pattern => pattern.test(normalize(asText(cell)))))
}
function matchCatalog(value: string, candidates: Array<{ id: string; name: string }>) {
  const source = normalize(value)
  if (!source) return ''
  const exact = candidates.find(item => normalize(item.name) === source)
  if (exact) return exact.id
  return candidates
    .filter(item => {
      const name = normalize(item.name)
      return name.length >= 3 && (source.includes(name) || name.includes(source))
    })
    .sort((a, b) => b.name.length - a.name.length)[0]?.id || ''
}

function newDraft(index: number, patch: Partial<DraftRow> = {}): DraftRow {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    enabled: true,
    category: '',
    code: '',
    text: '',
    managementId: '',
    responsibleId: '',
    ...patch,
  }
}

function parseCentralWorkbook(matrix: unknown[][], defaultManagementId?: string | null) {
  if (!matrix.length) return [] as DraftRow[]
  const headerRow = matrix.findIndex(row => row.some(cell => /lineamiento/.test(normalize(asText(cell)))))
  if (headerRow >= 0) {
    const header = matrix[headerRow] || []
    const categoryIndex = findHeaderIndex(header, [/^categoria$/, /^categoría$/])
    let numberIndex = findHeaderIndex(header, [/^n[°ºo]?\.?$/, /^numero$/, /^nro\.?$/])
    let guidelineIndex = findHeaderIndex(header, [/lineamiento/])
    if (guidelineIndex < 0) guidelineIndex = Math.max(0, header.length - 1)
    if (numberIndex < 0) numberIndex = Math.max(0, guidelineIndex - 1)

    return matrix.slice(headerRow + 1).flatMap((row, index) => {
      const category = categoryIndex >= 0 ? asText(row[categoryIndex]) : ''
      const rawNumber = numberIndex >= 0 ? asText(row[numberIndex]) : ''
      const text = guidelineIndex >= 0 ? asText(row[guidelineIndex]) : ''
      if (![category, rawNumber, text].some(Boolean)) return []
      if (/^lineamientos?(?: estrategicos?)?$/i.test(text)) return []
      return [newDraft(index, {
        category,
        code: rawNumber.match(/\d{1,3}/)?.[0] || rawNumber,
        text,
        managementId: defaultManagementId || '',
        responsibleId: '',
      })]
    })
  }

  return matrix.flatMap((row, index) => {
    const cells = row.map(asText).filter(Boolean)
    if (!cells.length) return []
    const numberPosition = cells.findIndex(cell => /^\d{1,3}$/.test(cell))
    const number = numberPosition >= 0 ? cells[numberPosition] : ''
    const textCandidates = cells.filter((_, cellIndex) => cellIndex !== numberPosition && !/^categoria$/i.test(cells[cellIndex]))
    const text = [...textCandidates].sort((a, b) => b.length - a.length)[0] || ''
    const category = textCandidates.filter(value => value !== text)[0] || ''
    if (![category, number, text].some(Boolean)) return []
    return [newDraft(index, { category, code: number, text, managementId: defaultManagementId || '' })]
  })
}

function parseWorkbookRows(
  matrix: unknown[][],
  managements: Management[],
  managers: Manager[],
  unitCode: string,
  defaultManagementId?: string | null,
) {
  if (unitCode === 'CENTRAL') return parseCentralWorkbook(matrix, defaultManagementId)
  if (!matrix.length) return [] as DraftRow[]

  let headerRow = matrix.findIndex(row => row.some(cell => /lineamiento/.test(normalize(asText(cell)))))
  if (headerRow < 0) headerRow = 0
  const header = matrix[headerRow] || []
  let numberIndex = findHeaderIndex(header, [/^n[°ºo]?\.?$/, /^numero$/, /^nro\.?$/])
  let guidelineIndex = findHeaderIndex(header, [/lineamiento/])
  let managementIndex = findHeaderIndex(header, [/gerencia responsable/, /^gerencia$/, /^area$/, /^área$/])
  let managerIndex = findHeaderIndex(header, [/gerente responsable/, /^responsable$/, /responsable principal/])
  if (guidelineIndex < 0) guidelineIndex = header.length >= 2 ? 1 : 0
  if (numberIndex < 0 && guidelineIndex > 0) numberIndex = guidelineIndex - 1
  if (managementIndex < 0) managementIndex = guidelineIndex + 1
  if (managerIndex < 0) managerIndex = managementIndex + 1

  const areaCandidates = managements.filter(item => item.active).map(item => ({ id: item.id, name: item.name }))
  const managerCandidates = managers.filter(item => item.active).map(item => ({ id: item.id, name: item.name }))

  return matrix.slice(headerRow + 1).flatMap((row, index) => {
    const rawNumber = numberIndex >= 0 ? asText(row[numberIndex]) : ''
    const text = guidelineIndex >= 0 ? asText(row[guidelineIndex]) : ''
    const managementText = managementIndex >= 0 ? asText(row[managementIndex]) : ''
    const managerText = managerIndex >= 0 ? asText(row[managerIndex]) : ''
    if (![rawNumber, text, managementText, managerText].some(Boolean)) return []
    if (/^lineamientos?(?: estrategicos?)?$/i.test(text)) return []
    const numeric = rawNumber.match(/\d{1,3}/)?.[0]
    const code = /^L\d+/i.test(rawNumber) ? rawNumber.toUpperCase().replace(/\s+/g, '') : numeric ? `L${numeric}` : rawNumber
    return [newDraft(index, {
      code,
      text: text.replace(/^\s*L\d+\s*:\s*/i, '').trim(),
      managementId: matchCatalog(managementText, areaCandidates) || defaultManagementId || '',
      responsibleId: matchCatalog(managerText, managerCandidates),
    })]
  })
}

function cleanExtractedLines(text: string) {
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/[\t\u00a0]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[|¦]+|[|¦]+$/g, '').trim())
    .filter(Boolean)
}

function shouldIgnoreExtractedLine(line: string) {
  const value = normalize(line)
  return /^(?:n|n°|nº|numero|categoria|lineamiento|lineamientos|lineamientos estrategicos|gerencia responsable|gerente responsable|estado|acciones)$/.test(value)
}

function finalizeCentralRows(rows: DraftRow[], defaultManagementId?: string | null) {
  const compact: DraftRow[] = []
  const seen = new Set<string>()
  rows.forEach(row => {
    const text = row.text.replace(/\s+/g, ' ').trim()
    const category = row.category.replace(/\s+/g, ' ').trim()
    const code = row.code.match(/\d{1,3}/)?.[0] || row.code.trim()
    if (![category, code, text].some(Boolean)) return
    const key = normalize(`${code}|${text}`)
    if (key && seen.has(key)) return
    if (key) seen.add(key)
    compact.push({ ...row, category, code, text, managementId: defaultManagementId || row.managementId || '', responsibleId: '' })
  })

  const alignedAnchors = compact.reduce((count, row, index) => {
    const numeric = Number(row.code)
    return Number.isFinite(numeric) && numeric === index + 1 ? count + 1 : count
  }, 0)
  if (alignedAnchors >= 2 || compact.every(row => !row.code || /^\d{1,3}$/.test(row.code))) {
    const used = new Set(compact.map(row => Number(row.code)).filter(value => Number.isFinite(value) && value > 0))
    compact.forEach((row, index) => {
      if (row.code) return
      const expected = index + 1
      if (!used.has(expected)) {
        row.code = String(expected)
        used.add(expected)
      }
    })
  }
  return compact
}

function parseCentralExtractedText(text: string, defaultManagementId?: string | null) {
  const lines = cleanExtractedLines(text)
  const rows: DraftRow[] = []
  let current: DraftRow | null = null
  let pendingCode = ''
  let category = ''

  const push = () => {
    if (current && (current.category.trim() || current.code.trim() || current.text.trim())) rows.push(current)
    current = null
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/^[•·▪■►]+\s*/, '').trim()
    if (!line || shouldIgnoreExtractedLine(line)) return

    const categoryMatch = line.match(/^(?:categoria|categoría)\s*[:.-]\s*(.+)$/i)
    if (categoryMatch) {
      category = categoryMatch[1].trim()
      return
    }

    const onlyNumber = line.match(/^[\s_\-|]*(\d{1,3})[\s_\-|.:)]*$/)
    if (onlyNumber) {
      push()
      pendingCode = onlyNumber[1]
      return
    }

    const numbered = line.match(/^[\s_\-|]*(\d{1,3})[\s_\-|.:)]{0,5}\s+(.{3,})$/)
    if (numbered) {
      push()
      current = newDraft(index, {
        category,
        code: numbered[1],
        text: numbered[2].trim(),
        managementId: defaultManagementId || '',
      })
      pendingCode = ''
      return
    }

    if (pendingCode) {
      current = newDraft(index, { category, code: pendingCode, text: line, managementId: defaultManagementId || '' })
      pendingCode = ''
      return
    }

    if (/^(?:periodo|unidad|area|área|responsable|central)\b/i.test(line)) return
    if (line.length < 12) return

    if (!current) {
      current = newDraft(index, { category, text: line, managementId: defaultManagementId || '' })
      return
    }

    const beginsLowercase = /^[a-záéíóúñ]/.test(line)
    const currentLooksFinished = /[.!?;:]$/.test(current.text.trim())
    if (beginsLowercase || !currentLooksFinished) {
      current.text = `${current.text} ${line}`.replace(/\s+/g, ' ').trim()
    } else {
      push()
      current = newDraft(index, { category, text: line, managementId: defaultManagementId || '' })
    }
  })
  push()
  return finalizeCentralRows(rows, defaultManagementId)
}

function parseExtractedText(text: string, unitCode: string, defaultManagementId?: string | null) {
  if (unitCode === 'CENTRAL') return parseCentralExtractedText(text, defaultManagementId)

  const lines = cleanExtractedLines(text)
  const rows: DraftRow[] = []
  let current: DraftRow | null = null
  let pendingCode = ''
  const push = () => {
    if (current && (current.code.trim() || current.text.trim())) rows.push(current)
    current = null
  }

  lines.forEach((line, index) => {
    if (shouldIgnoreExtractedLine(line)) return
    const onlyNumber = line.match(/^(?:L\s*)?(\d{1,3})\s*[:.)-]?$/i)
    if (onlyNumber) {
      push()
      pendingCode = `L${onlyNumber[1]}`
      return
    }
    const numbered = line.match(/^(?:L\s*)?(\d{1,3})\s*(?:[:.)-]\s*)?(.{3,})$/i)
    if (numbered) {
      push()
      current = newDraft(index, { code: `L${numbered[1]}`, text: numbered[2].trim(), managementId: defaultManagementId || '' })
      pendingCode = ''
      return
    }
    if (pendingCode) {
      current = newDraft(index, { code: pendingCode, text: line, managementId: defaultManagementId || '' })
      pendingCode = ''
      return
    }
    if (current) {
      current.text = `${current.text} ${line}`.replace(/\s+/g, ' ').trim()
    } else if (line.length >= 18 && !/^(?:periodo|unidad|area|área|responsable)/i.test(line)) {
      current = newDraft(index, { text: line, managementId: defaultManagementId || '' })
    }
  })
  push()
  return rows
}

function preprocessCanvas(source: HTMLCanvasElement) {
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const sourceContext = source.getContext('2d')
  const targetContext = out.getContext('2d')
  if (!sourceContext || !targetContext) return source
  const image = sourceContext.getImageData(0, 0, source.width, source.height)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const alpha = data[i + 3]
    const greenGrid = g > 120 && g > r * 1.12 && g > b * 1.08
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const value = alpha < 20 || greenGrid || gray > 178 ? 255 : 0
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  targetContext.putImageData(image, 0, 0)
  return out
}

async function fileToPreparedCanvas(file: File) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(2.4, Math.max(1.7, 2800 / Math.max(bitmap.width, 1)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No pudimos preparar la imagen para lectura.')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return preprocessCanvas(canvas)
}

async function extractPdfText(file: File, setProgress: (message: string) => void) {
  const api = await loadPdf()
  const doc = await api.getDocument({ data: await file.arrayBuffer() }).promise
  const pageTexts: string[] = []
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    setProgress(`Leyendo PDF · página ${pageNo} de ${doc.numPages}...`)
    const page = await doc.getPage(pageNo)
    const content = await page.getTextContent()
    const grouped = new Map<number, Array<{ x: number; text: string }>>()
    content.items.forEach(item => {
      const value = item.str?.trim()
      if (!value) return
      const y = Math.round(item.transform?.[5] || 0)
      const x = item.transform?.[4] || 0
      const bucket = [...grouped.keys()].find(key => Math.abs(key - y) <= 2) ?? y
      const values = grouped.get(bucket) || []
      values.push({ x, text: value })
      grouped.set(bucket, values)
    })
    const lines = [...grouped.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, values]) => values.sort((a, b) => a.x - b.x).map(item => item.text).join(' '))
    pageTexts.push(lines.join('\n'))
  }

  const plain = pageTexts.join('\n')
  if (plain.replace(/\s+/g, '').length >= 30) return plain

  const ocr = await loadTesseract()
  const scanned: string[] = []
  const pages = Math.min(doc.numPages, 10)
  for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
    setProgress(`PDF escaneado: reconociendo página ${pageNo} de ${pages}...`)
    const page = await doc.getPage(pageNo)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) continue
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport }).promise
    const prepared = preprocessCanvas(canvas)
    const result = await ocr.recognize(prepared, 'spa', {
      logger: message => {
        if (message.status === 'recognizing text' && typeof message.progress === 'number') {
          setProgress(`PDF escaneado · página ${pageNo}/${pages} · ${Math.round(message.progress * 100)}%`)
        }
      },
    })
    scanned.push(result.data.text)
  }
  return scanned.join('\n')
}

async function extractPptxText(file: File, setProgress: (message: string) => void) {
  const JSZip = await loadZip()
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const slideNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1] || 0) - Number(b.match(/slide(\d+)/i)?.[1] || 0))
  const slides: string[] = []
  for (let index = 0; index < slideNames.length; index += 1) {
    setProgress(`Leyendo PowerPoint · diapositiva ${index + 1} de ${slideNames.length}...`)
    const xml = await zip.files[slideNames[index]].async('string')
    const documentXml = new DOMParser().parseFromString(xml, 'application/xml')
    const paragraphs = Array.from(documentXml.getElementsByTagName('a:p'))
    const lines = paragraphs
      .map(paragraph => Array.from(paragraph.getElementsByTagName('a:t')).map(node => node.textContent || '').join('').trim())
      .filter(Boolean)
    slides.push(lines.join('\n'))
  }
  return slides.join('\n')
}

function extractLegacyPptText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const fragments: string[] = []
  let ascii = ''
  for (const byte of bytes) {
    if ((byte >= 32 && byte <= 126) || byte >= 160) ascii += String.fromCharCode(byte)
    else {
      if (ascii.trim().length >= 8) fragments.push(ascii.trim())
      ascii = ''
    }
  }
  if (ascii.trim().length >= 8) fragments.push(ascii.trim())
  let utf = ''
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const low = bytes[i]
    const high = bytes[i + 1]
    if (high === 0 && low >= 32 && low <= 126) utf += String.fromCharCode(low)
    else {
      if (utf.trim().length >= 8) fragments.push(utf.trim())
      utf = ''
    }
  }
  if (utf.trim().length >= 8) fragments.push(utf.trim())
  return [...new Set(fragments)].join('\n')
}

async function extractImageText(file: File, setProgress: (message: string) => void) {
  const api = await loadTesseract()
  setProgress('Preparando imagen para mejorar la lectura de la tabla...')
  const prepared = await fileToPreparedCanvas(file)
  const result = await api.recognize(prepared, 'spa', {
    logger: message => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        setProgress(`Leyendo imagen · ${Math.round(message.progress * 100)}%`)
      } else if (message.status) {
        setProgress('Preparando reconocimiento de imagen...')
      }
    },
  })
  return result.data.text
}

export default function GuidelineMultiImport({ unit, periodId, open, onClose, onImported, defaultManagementId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [managements, setManagements] = useState<Management[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [rows, setRows] = useState<DraftRow[]>([])
  const isCentral = unit.code === 'CENTRAL'
  const activeRows = useMemo(
    () => rows.filter(row => row.enabled && (row.category.trim() || row.code.trim() || row.text.trim())),
    [rows],
  )

  useEffect(() => {
    if (!open || !supabase) return
    void (async () => {
      const [areasResult, managersResult] = await Promise.all([
        supabase.from('managements_global').select('id,name,active').eq('active', true).order('name'),
        supabase.from('managers').select('id,name,cargo,active').eq('active', true).order('name'),
      ])
      if (!areasResult.error) setManagements((areasResult.data || []) as Management[])
      if (!managersResult.error) setManagers((managersResult.data || []) as Manager[])
    })()
  }, [open])

  useEffect(() => {
    if (!open) {
      setRows([])
      setFileName('')
      setError('')
      setProgress('')
      setLoading(false)
      setSaving(false)
    }
  }, [open])

  async function processFile(file: File) {
    setError('')
    setRows([])
    setFileName(file.name)
    setLoading(true)
    setProgress('Analizando archivo...')
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('El archivo supera 50 MB.')
      if (isCentral && !defaultManagementId) throw new Error('Selecciona primero el área de Central donde guardarás estos lineamientos.')

      const lower = file.name.toLowerCase()
      let parsed: DraftRow[] = []
      if (/\.(xlsx|xls)$/.test(lower)) {
        setProgress('Leyendo Excel...')
        const XLSX = await loadXlsx()
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const firstSheet = workbook.SheetNames?.[0]
        if (!firstSheet) throw new Error('El Excel no contiene hojas.')
        const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '', raw: false }) as unknown[][]
        parsed = parseWorkbookRows(matrix, managements, managers, unit.code, defaultManagementId)
      } else if (/\.pdf$/.test(lower)) {
        parsed = parseExtractedText(await extractPdfText(file, setProgress), unit.code, defaultManagementId)
      } else if (/\.pptx$/.test(lower)) {
        parsed = parseExtractedText(await extractPptxText(file, setProgress), unit.code, defaultManagementId)
      } else if (/\.ppt$/.test(lower)) {
        setProgress('Leyendo PowerPoint antiguo...')
        parsed = parseExtractedText(extractLegacyPptText(await file.arrayBuffer()), unit.code, defaultManagementId)
      } else if (/\.(png|jpe?g|webp)$/.test(lower)) {
        parsed = parseExtractedText(await extractImageText(file, setProgress), unit.code, defaultManagementId)
      } else {
        throw new Error('Formato no compatible. Usa Excel, PDF, PowerPoint o una imagen PNG/JPG/WEBP.')
      }

      if (isCentral) parsed = finalizeCentralRows(parsed, defaultManagementId)
      if (!parsed.length) throw new Error('No pudimos detectar lineamientos automáticamente. Revisa que el archivo contenga números y textos legibles.')
      setRows(parsed)
      setProgress(`${parsed.length} lineamiento${parsed.length === 1 ? '' : 's'} detectado${parsed.length === 1 ? '' : 's'}. Revisa y corrige la tabla antes de guardar.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos leer el archivo.')
      setProgress('')
    } finally {
      setLoading(false)
    }
  }

  function patchRow(id: string, patch: Partial<DraftRow>) {
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row))
  }

  async function importRows() {
    if (!supabase || !periodId || !activeRows.length) return
    if (isCentral && !defaultManagementId) {
      setError('Selecciona un área de Central antes de guardar.')
      return
    }
    const normalizedRows = isCentral
      ? activeRows.map(row => ({ ...row, managementId: defaultManagementId || '', responsibleId: '' }))
      : activeRows
    const missingArea = normalizedRows.find(row => !row.managementId)
    if (missingArea) {
      setError('Asigna un área a todas las filas que vas a importar.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const { data: existing, error: existingError } = await supabase
        .from('planning_guidelines')
        .select('management_id,guideline_text,code,category')
        .eq('period_id', periodId)
        .eq('unit_code', unit.code)
      if (existingError) throw existingError

      const existingKeys = new Set((existing || []).map(item => normalize(
        `${item.management_id || ''}|${item.category || ''}|${item.code || ''}|${item.guideline_text || ''}`,
      )))
      const baseOrder = (existing || []).length

      const payload = normalizedRows.map((row, index) => {
        const category = row.category.trim() || null
        if (isCentral) {
          const code = row.code.trim() || null
          const guidelineText = row.text.trim()
          const key = normalize(`${row.managementId}|${category || ''}|${code || ''}|${guidelineText}`)
          return {
            period_id: periodId,
            unit_code: unit.code,
            management_id: row.managementId,
            category,
            code,
            guideline_text: guidelineText,
            responsible_manager_id: null,
            active: true,
            sort_order: baseOrder + index,
            _key: key,
          }
        }

        const code = row.code.trim().toUpperCase() || `L${baseOrder + index + 1}`
        const text = row.text.trim().replace(/\s+/g, ' ')
        const fullText = text ? `${code}: ${text}` : code
        const key = normalize(`${row.managementId}|${category || ''}|${code}|${fullText}`)
        return {
          period_id: periodId,
          unit_code: unit.code,
          management_id: row.managementId,
          category,
          code,
          guideline_text: fullText,
          responsible_manager_id: row.responsibleId || null,
          active: true,
          sort_order: baseOrder + index,
          _key: key,
        }
      }).filter(item => !existingKeys.has(item._key))

      if (!payload.length) throw new Error('Todos los lineamientos detectados ya existen en esta área y periodo.')
      const insertPayload = payload.map(({ _key, ...item }) => item)
      const { error: insertError } = await supabase.from('planning_guidelines').insert(insertPayload)
      if (insertError) throw insertError
      onImported(insertPayload.length)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos importar los lineamientos.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return <div className="guideline-import-backdrop" role="presentation" onMouseDown={event => {
    if (event.currentTarget === event.target && !loading && !saving) onClose()
  }}>
    <section className={`guideline-import-dialog ${isCentral ? 'guideline-import-dialog--central' : ''}`} role="dialog" aria-modal="true">
      <button className="guideline-import-close" type="button" onClick={onClose} disabled={loading || saving}><X size={19}/></button>
      <header className="guideline-import-header">
        <div className="guideline-import-icon"><FileText size={22}/></div>
        <div>
          <span>Importación inteligente</span>
          <h3>Importar lineamientos</h3>
          <p>{isCentral
            ? 'En Central se importan únicamente Categoría, N° y Lineamiento. El área se toma del selector de la pantalla.'
            : 'Extrae lineamientos desde Excel, PDF, PowerPoint o imágenes. Siempre podrás revisar y corregir lo detectado antes de guardar.'}</p>
        </div>
      </header>

      <div className="guideline-import-context">
        <strong>{unit.code} · {unit.name}</strong>
        <span>{isCentral ? 'Se guardarán en el área seleccionada y únicamente en el periodo actual.' : 'Se guardarán únicamente en el periodo actual.'}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
        hidden
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) void processFile(file)
          event.currentTarget.value = ''
        }}
      />

      <button className="guideline-import-picker" type="button" onClick={() => inputRef.current?.click()} disabled={loading || saving}>
        <span><FileSpreadsheet size={26}/></span>
        <div>
          <strong>{fileName || 'Seleccionar archivo'}</strong>
          <small>Excel · PDF · PowerPoint · PNG/JPG/WEBP · máximo 50 MB</small>
        </div>
        <b>{loading ? <LoaderCircle className="spin" size={18}/> : 'Elegir archivo'}</b>
      </button>

      {progress && <div className="guideline-import-progress">{loading && <LoaderCircle className="spin" size={15}/>} {progress}</div>}
      {error && <div className="guideline-import-error">{error}</div>}

      {rows.length > 0 && <div className={`guideline-import-preview ${isCentral ? 'guideline-import-preview--central' : ''}`}>
        <div className="guideline-import-preview-head">
          <div><strong>Vista previa antes de guardar</strong><small>{activeRows.length} seleccionados</small></div>
          <span>{isCentral ? 'Corrige solo Categoría, N° o Lineamiento si la lectura no fue exacta.' : 'Corrige cualquier lectura antes de confirmar.'}</span>
        </div>
        <div className="guideline-import-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usar</th>
                {isCentral && <th>Categoría</th>}
                <th>N°</th>
                <th>Lineamiento</th>
                {!isCentral && <><th>Área</th><th>Responsable</th></>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => <tr key={row.id} className={!row.enabled ? 'disabled' : ''}>
                <td><input type="checkbox" checked={row.enabled} onChange={event => patchRow(row.id, { enabled: event.target.checked })}/></td>
                {isCentral && <td><input value={row.category} placeholder="Opcional" onChange={event => patchRow(row.id, { category: event.target.value })}/></td>}
                <td><input className="code" value={row.code} placeholder="N°" onChange={event => patchRow(row.id, { code: event.target.value })}/></td>
                <td><textarea value={row.text} placeholder="Lineamiento" onChange={event => patchRow(row.id, { text: event.target.value })}/></td>
                {!isCentral && <>
                  <td><select value={row.managementId} onChange={event => patchRow(row.id, { managementId: event.target.value })}>
                    <option value="">Seleccionar...</option>
                    {managements.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select></td>
                  <td><select value={row.responsibleId} onChange={event => patchRow(row.id, { responsibleId: event.target.value })}>
                    <option value="">Sin asignar</option>
                    {managers.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}{item.cargo ? ` · ${item.cargo}` : ''}</option>)}
                  </select></td>
                </>}
                <td><button type="button" className="remove" onClick={() => setRows(current => current.filter(item => item.id !== row.id))}><Trash2 size={15}/></button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>}

      <div className="guideline-import-actions">
        <button type="button" className="secondary" onClick={onClose} disabled={loading || saving}>Cancelar</button>
        <button type="button" className="primary" onClick={() => void importRows()} disabled={loading || saving || activeRows.length === 0}>
          {saving ? <LoaderCircle className="spin" size={16}/> : null} Guardar {activeRows.length || ''} lineamiento{activeRows.length === 1 ? '' : 's'}
        </button>
      </div>
    </section>
  </div>
}
