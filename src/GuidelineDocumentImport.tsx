import { FileImage, FileText, LoaderCircle, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import './guideline-document-import.css'

type Unit = { code: string; name: string }
type Management = { id: string; name: string; active: boolean }
type Manager = { id: string; name: string; cargo: string | null; active: boolean }
type DraftRow = {
  id: string
  enabled: boolean
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
}

const dynamicImport = new Function('url', 'return import(url)') as (url: string) => Promise<any>

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function looksLikeHeader(value: string) {
  const text = normalize(value)
  return !text || /^(n°|nº|no\.?|cant\.?|lineamientos? estrategicos?|gerencia responsable|gerente responsable|acciones?)$/.test(text) || text.includes('lineamientos estrategicos gerencia responsable')
}

function findRightmostCandidate(source: string, candidates: Array<{ id: string; name: string }>) {
  const normalizedSource = normalize(source)
  let best: { id: string; name: string; index: number } | null = null
  for (const candidate of candidates) {
    const needle = normalize(candidate.name)
    if (!needle || needle.length < 3) continue
    const index = normalizedSource.lastIndexOf(needle)
    if (index < Math.max(0, Math.floor(normalizedSource.length * .35))) continue
    if (!best || index > best.index) best = { ...candidate, index }
  }
  return best
}

function parseDraftRows(rawText: string, managements: Management[], managers: Manager[]) {
  const lines = rawText.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const chunks: Array<{ code: string; body: string }> = []
  let current: { code: string; body: string } | null = null

  for (const line of lines) {
    if (looksLikeHeader(line)) continue
    const numbered = line.match(/^\s*(?:L\s*)?(\d{1,3})\s*(?:[:.)-]|\s)\s*(.+)$/i)
    const explicit = line.match(/^\s*(L\d{1,3})\s*:\s*(.+)$/i)
    if (explicit || numbered) {
      if (current?.body.trim()) chunks.push(current)
      const code = explicit ? explicit[1].toUpperCase() : `L${numbered![1]}`
      const body = explicit ? explicit[2] : numbered![2]
      current = { code, body }
      continue
    }
    if (current) current.body += ` ${line}`
  }
  if (current?.body.trim()) chunks.push(current)

  if (!chunks.length) {
    lines.filter(line => !looksLikeHeader(line) && line.length > 18).forEach((line, index) => chunks.push({ code: `L${index + 1}`, body: line }))
  }

  const areaCandidates = managements.filter(item => item.active).map(item => ({ id: item.id, name: item.name }))
  const managerCandidates = managers.filter(item => item.active).map(item => ({ id: item.id, name: item.name }))

  return chunks.map((chunk, index): DraftRow => {
    const managerMatch = findRightmostCandidate(chunk.body, managerCandidates)
    const areaMatch = findRightmostCandidate(chunk.body, areaCandidates)
    const cutIndexes = [managerMatch?.index, areaMatch?.index].filter((value): value is number => typeof value === 'number')
    const cutAt = cutIndexes.length ? Math.min(...cutIndexes) : -1
    const cleanedText = (cutAt >= 12 ? normalizeSpacingByLength(chunk.body, cutAt) : chunk.body).replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, '')
    return {
      id: `${Date.now()}-${index}`,
      enabled: true,
      code: chunk.code,
      text: cleanedText || chunk.body,
      managementId: areaMatch?.id || '',
      responsibleId: managerMatch?.id || '',
    }
  })
}

function normalizeSpacingByLength(original: string, normalizedIndex: number) {
  const normalizedTarget = normalize(original).slice(0, normalizedIndex)
  if (!normalizedTarget) return original
  let normalizedCount = 0
  let previousSpace = false
  for (let index = 0; index < original.length; index += 1) {
    const char = original[index]
    const isSpace = /\s/.test(char)
    if (isSpace) {
      if (!previousSpace) normalizedCount += 1
      previousSpace = true
    } else {
      normalizedCount += normalize(char).length || 1
      previousSpace = false
    }
    if (normalizedCount >= normalizedTarget.length) return original.slice(0, index + 1)
  }
  return original
}

async function extractPdf(file: File, setProgress: (value: string) => void) {
  setProgress('Leyendo texto del PDF...')
  const pdfjs = await dynamicImport('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs')
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const lines: string[] = []
  for (let pageNo = 1; pageNo <= document.numPages; pageNo += 1) {
    setProgress(`Leyendo PDF · página ${pageNo} de ${document.numPages}`)
    const page = await document.getPage(pageNo)
    const content = await page.getTextContent()
    const positioned = (content.items || []).filter((item: any) => typeof item?.str === 'string' && item.str.trim()).map((item: any) => ({ text: item.str.trim(), x: Number(item.transform?.[4] || 0), y: Number(item.transform?.[5] || 0) }))
    positioned.sort((a: any, b: any) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x)
    const groups: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = []
    for (const item of positioned) {
      let group = groups.find(entry => Math.abs(entry.y - item.y) <= 3)
      if (!group) { group = { y: item.y, parts: [] }; groups.push(group) }
      group.parts.push({ x: item.x, text: item.text })
    }
    groups.sort((a, b) => b.y - a.y).forEach(group => lines.push(group.parts.sort((a, b) => a.x - b.x).map(item => item.text).join(' ')))
  }
  return lines.join('\n')
}

async function extractImage(file: File, setProgress: (value: string) => void) {
  setProgress('Preparando reconocimiento de imagen...')
  const tesseract = await dynamicImport('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm')
  const recognize = tesseract.recognize || tesseract.default?.recognize
  if (!recognize) throw new Error('No se pudo iniciar el lector de imágenes.')
  const result = await recognize(file, 'spa', {
    logger: (message: any) => {
      if (message?.status === 'recognizing text') setProgress(`Leyendo imagen · ${Math.round((message.progress || 0) * 100)}%`)
      else if (message?.status) setProgress('Procesando imagen...')
    },
  })
  return String(result?.data?.text || '')
}

export default function GuidelineDocumentImport({ unit, periodId, open, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [managements, setManagements] = useState<Management[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [rows, setRows] = useState<DraftRow[]>([])

  const activeRows = useMemo(() => rows.filter(row => row.enabled && row.text.trim()), [rows])

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
      setRows([]); setFileName(''); setError(''); setProgress(''); setLoading(false); setSaving(false)
    }
  }, [open])

  async function processFile(file: File) {
    setError(''); setRows([]); setFileName(file.name); setLoading(true)
    try {
      const mime = file.type.toLowerCase()
      const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const isImage = mime.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name)
      if (!isPdf && !isImage) throw new Error('Solo se permiten archivos PDF, PNG, JPG o JPEG.')
      if (file.size > 18 * 1024 * 1024) throw new Error('El archivo supera 18 MB. Usa una versión más liviana.')
      const text = isPdf ? await extractPdf(file, setProgress) : await extractImage(file, setProgress)
      const parsed = parseDraftRows(text, managements, managers)
      if (!parsed.length) throw new Error('No pudimos identificar filas de lineamientos. Usa una imagen nítida o un PDF con la tabla visible.')
      setRows(parsed)
      setProgress(`${parsed.length} fila${parsed.length === 1 ? '' : 's'} detectada${parsed.length === 1 ? '' : 's'}. Revisa antes de importar.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos leer el archivo.')
      setProgress('')
    } finally { setLoading(false) }
  }

  function patchRow(id: string, patch: Partial<DraftRow>) {
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row))
  }

  async function importRows() {
    if (!supabase || !periodId || !activeRows.length) return
    const missingArea = activeRows.find(row => !row.managementId)
    if (missingArea) { setError('Asigna una Gerencia Responsable a todas las filas que vas a importar.'); return }
    setSaving(true); setError('')
    try {
      const { data: existing } = await supabase.from('planning_guidelines').select('guideline_text,code').eq('period_id', periodId).eq('unit_code', unit.code)
      const existingKeys = new Set((existing || []).map(item => normalize(`${item.code || ''}|${item.guideline_text || ''}`)))
      const baseOrder = (existing || []).length
      const payload = activeRows.map((row, index) => {
        const code = row.code.trim().toUpperCase() || `L${baseOrder + index + 1}`
        const text = row.text.trim().replace(/\s+/g, ' ')
        const fullText = `${code}: ${text}`
        return {
          period_id: periodId,
          unit_code: unit.code,
          management_id: row.managementId,
          code,
          guideline_text: fullText,
          responsible_manager_id: row.responsibleId || null,
          active: true,
          sort_order: baseOrder + index,
          _key: normalize(`${code}|${fullText}`),
        }
      }).filter(item => !existingKeys.has(item._key))
      if (!payload.length) throw new Error('Todos los lineamientos detectados ya existen en esta unidad y periodo.')
      const insertPayload = payload.map(({ _key, ...item }) => item)
      const { error: insertError } = await supabase.from('planning_guidelines').insert(insertPayload)
      if (insertError) throw insertError
      onImported(insertPayload.length)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos importar los lineamientos.')
    } finally { setSaving(false) }
  }

  if (!open) return null

  return <div className="guideline-import-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !loading && !saving) onClose() }}>
    <section className="guideline-import-dialog" role="dialog" aria-modal="true">
      <button className="guideline-import-close" type="button" onClick={onClose} disabled={loading || saving}><X size={19}/></button>
      <header className="guideline-import-header">
        <div className="guideline-import-icon"><Upload size={22}/></div>
        <div><span>Carga asistida</span><h3>Importar lineamientos desde PDF o imagen</h3><p>El sistema leerá la tabla, detectará los lineamientos y te permitirá revisar cada fila antes de guardarla.</p></div>
      </header>

      <div className="guideline-import-context"><strong>{unit.code} · {unit.name}</strong><span>Periodo activo</span></div>

      <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void processFile(file); event.currentTarget.value = '' }} />
      <button className="guideline-import-picker" type="button" onClick={() => inputRef.current?.click()} disabled={loading || saving}>
        <span>{fileName.toLowerCase().endsWith('.pdf') ? <FileText size={26}/> : <FileImage size={26}/>}</span>
        <div><strong>{fileName || 'Seleccionar PDF o imagen'}</strong><small>PDF, PNG, JPG o JPEG · máximo 18 MB</small></div>
        <b>{loading ? <LoaderCircle className="spin" size={18}/> : 'Elegir archivo'}</b>
      </button>

      {progress && <div className="guideline-import-progress">{loading && <LoaderCircle className="spin" size={15}/>} {progress}</div>}
      {error && <div className="guideline-import-error">{error}</div>}

      {rows.length > 0 && <div className="guideline-import-preview">
        <div className="guideline-import-preview-head"><div><strong>Vista previa</strong><small>{activeRows.length} seleccionados para importar</small></div><span>Corrige lo necesario antes de guardar.</span></div>
        <div className="guideline-import-table-wrap"><table>
          <thead><tr><th>Usar</th><th>Código</th><th>Lineamiento estratégico</th><th>Gerencia responsable</th><th>Gerente responsable</th><th></th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id} className={!row.enabled ? 'disabled' : ''}>
            <td><input type="checkbox" checked={row.enabled} onChange={event => patchRow(row.id, { enabled: event.target.checked })}/></td>
            <td><input className="code" value={row.code} onChange={event => patchRow(row.id, { code: event.target.value })}/></td>
            <td><textarea value={row.text} onChange={event => patchRow(row.id, { text: event.target.value })}/></td>
            <td><select value={row.managementId} onChange={event => patchRow(row.id, { managementId: event.target.value })}><option value="">Seleccionar gerencia</option>{managements.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
            <td><select value={row.responsibleId} onChange={event => patchRow(row.id, { responsibleId: event.target.value })}><option value="">Sin asignar</option>{managers.map(item => <option key={item.id} value={item.id}>{item.name}{item.cargo ? ` · ${item.cargo}` : ''}</option>)}</select></td>
            <td><button className="remove" type="button" title="Quitar fila" onClick={() => setRows(current => current.filter(item => item.id !== row.id))}><Trash2 size={15}/></button></td>
          </tr>)}</tbody>
        </table></div>
      </div>}

      <footer className="guideline-import-actions">
        <button type="button" className="secondary" onClick={onClose} disabled={loading || saving}>Cancelar</button>
        <button type="button" className="primary" onClick={() => void importRows()} disabled={loading || saving || !activeRows.length}>{saving && <LoaderCircle className="spin" size={16}/>} Importar {activeRows.length || ''} a la tabla</button>
      </footer>
    </section>
  </div>
}
