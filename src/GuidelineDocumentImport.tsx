import { FileSpreadsheet, LoaderCircle, Trash2, X } from 'lucide-react'
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

type XlsxApi = {
  read: (data: ArrayBuffer, options: Record<string, unknown>) => { SheetNames: string[]; Sheets: Record<string, unknown> }
  utils: {
    sheet_to_json: (sheet: unknown, options: Record<string, unknown>) => unknown[][]
  }
}

let xlsxPromise: Promise<XlsxApi> | null = null

function loadXlsx(): Promise<XlsxApi> {
  const existing = (window as Window & { XLSX?: XlsxApi }).XLSX
  if (existing) return Promise.resolve(existing)
  if (xlsxPromise) return xlsxPromise

  xlsxPromise = new Promise<XlsxApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    script.async = true
    script.onload = () => {
      const api = (window as Window & { XLSX?: XlsxApi }).XLSX
      if (api) resolve(api)
      else reject(new Error('No se pudo inicializar el lector de Excel.'))
    }
    script.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Verifica tu conexión e inténtalo nuevamente.'))
    document.head.appendChild(script)
  }).catch(error => {
    xlsxPromise = null
    throw error
  })

  return xlsxPromise
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function asText(value: unknown) {
  if (value == null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function findHeaderIndex(row: unknown[], patterns: RegExp[]) {
  return row.findIndex(cell => patterns.some(pattern => pattern.test(normalize(asText(cell)))))
}

function matchCatalog(value: string, candidates: Array<{ id: string; name: string }>) {
  const source = normalize(value)
  if (!source) return ''
  const exact = candidates.find(item => normalize(item.name) === source)
  if (exact) return exact.id
  const contained = candidates
    .filter(item => {
      const name = normalize(item.name)
      return name.length >= 3 && (source.includes(name) || name.includes(source))
    })
    .sort((a, b) => b.name.length - a.name.length)[0]
  return contained?.id || ''
}

function parseWorkbookRows(matrix: unknown[][], managements: Management[], managers: Manager[]) {
  if (!matrix.length) return [] as DraftRow[]

  let headerRow = matrix.findIndex(row => row.some(cell => /lineamiento/.test(normalize(asText(cell)))))
  if (headerRow < 0) headerRow = 0
  const header = matrix[headerRow] || []

  let numberIndex = findHeaderIndex(header, [/^n[°ºo]?\.?$/, /^numero$/, /^nro\.?$/])
  let guidelineIndex = findHeaderIndex(header, [/lineamiento/])
  let managementIndex = findHeaderIndex(header, [/gerencia responsable/, /^gerencia$/, /^area$/, /área/])
  let managerIndex = findHeaderIndex(header, [/gerente responsable/, /^responsable$/, /responsable principal/])

  if (guidelineIndex < 0) guidelineIndex = header.length >= 4 ? 1 : 0
  if (numberIndex < 0 && guidelineIndex > 0) numberIndex = guidelineIndex - 1
  if (managementIndex < 0) managementIndex = guidelineIndex + 1
  if (managerIndex < 0) managerIndex = managementIndex + 1

  const areaCandidates = managements.filter(item => item.active).map(item => ({ id: item.id, name: item.name }))
  const managerCandidates = managers.filter(item => item.active).map(item => ({ id: item.id, name: item.name }))

  return matrix.slice(headerRow + 1).flatMap((row, index) => {
    const text = asText(row[guidelineIndex])
    if (!text || /^lineamientos? estrategicos?$/i.test(text)) return []

    const rawNumber = numberIndex >= 0 ? asText(row[numberIndex]) : ''
    const numeric = rawNumber.match(/\d{1,3}/)?.[0]
    const code = /^L\d+/i.test(rawNumber) ? rawNumber.toUpperCase().replace(/\s+/g, '') : numeric ? `L${numeric}` : ''
    const managementText = managementIndex >= 0 ? asText(row[managementIndex]) : ''
    const managerText = managerIndex >= 0 ? asText(row[managerIndex]) : ''

    return [{
      id: `${Date.now()}-${index}`,
      enabled: true,
      code,
      text: text.replace(/^\s*L\d+\s*:\s*/i, '').trim(),
      managementId: matchCatalog(managementText, areaCandidates),
      responsibleId: matchCatalog(managerText, managerCandidates),
    }]
  })
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
    setProgress('Leyendo Excel...')
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('Solo se permiten archivos Excel .xlsx o .xls.')
      if (file.size > 18 * 1024 * 1024) throw new Error('El archivo supera 18 MB. Usa una versión más liviana.')

      const XLSX = await loadXlsx()
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const firstSheet = workbook.SheetNames?.[0]
      if (!firstSheet) throw new Error('El Excel no contiene hojas.')
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '', raw: false }) as unknown[][]
      const parsed = parseWorkbookRows(matrix, managements, managers)
      if (!parsed.length) throw new Error('No pudimos identificar lineamientos en el Excel. Verifica que exista una columna de Lineamientos Estratégicos.')
      setRows(parsed)
      setProgress(`${parsed.length} lineamiento${parsed.length === 1 ? '' : 's'} detectado${parsed.length === 1 ? '' : 's'}. Revisa la tabla antes de guardar.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos leer el Excel.')
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
    const missingArea = activeRows.find(row => !row.managementId)
    if (missingArea) {
      setError('Asigna una Gerencia Responsable a todas las filas que vas a importar.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const { data: existing, error: existingError } = await supabase
        .from('planning_guidelines')
        .select('guideline_text,code')
        .eq('period_id', periodId)
        .eq('unit_code', unit.code)
      if (existingError) throw existingError

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

      if (!payload.length) throw new Error('Todos los lineamientos del Excel ya existen en esta unidad y periodo.')
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

  return <div className="guideline-import-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !loading && !saving) onClose() }}>
    <section className="guideline-import-dialog" role="dialog" aria-modal="true">
      <button className="guideline-import-close" type="button" onClick={onClose} disabled={loading || saving}><X size={19}/></button>
      <header className="guideline-import-header">
        <div className="guideline-import-icon"><FileSpreadsheet size={22}/></div>
        <div><span>Carga desde Excel</span><h3>Importar lineamientos</h3><p>Selecciona un Excel, revisa las filas detectadas y confirma antes de guardarlas.</p></div>
      </header>

      <div className="guideline-import-context"><strong>{unit.code} · {unit.name}</strong><span>Periodo activo</span></div>

      <input ref={inputRef} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void processFile(file); event.currentTarget.value = '' }} />
      <button className="guideline-import-picker" type="button" onClick={() => inputRef.current?.click()} disabled={loading || saving}>
        <span><FileSpreadsheet size={26}/></span>
        <div><strong>{fileName || 'Seleccionar archivo Excel'}</strong><small>XLSX o XLS · máximo 18 MB</small></div>
        <b>{loading ? <LoaderCircle className="spin" size={18}/> : 'Elegir Excel'}</b>
      </button>

      {progress && <div className="guideline-import-progress">{loading && <LoaderCircle className="spin" size={15}/>} {progress}</div>}
      {error && <div className="guideline-import-error">{error}</div>}

      {rows.length > 0 && <div className="guideline-import-preview">
        <div className="guideline-import-preview-head"><div><strong>Vista previa</strong><small>{activeRows.length} seleccionados para importar</small></div><span>Puedes corregir lo detectado antes de guardar.</span></div>
        <div className="guideline-import-table-wrap"><table>
          <thead><tr><th>Usar</th><th>Código</th><th>Lineamiento estratégico</th><th>Gerencia responsable</th><th>Gerente responsable</th><th></th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id} className={!row.enabled ? 'disabled' : ''}>
            <td><input type="checkbox" checked={row.enabled} onChange={event => patchRow(row.id, { enabled: event.target.checked })}/></td>
            <td><input className="code" value={row.code} onChange={event => patchRow(row.id, { code: event.target.value })}/></td>
            <td><textarea value={row.text} onChange={event => patchRow(row.id, { text: event.target.value })}/></td>
            <td><select value={row.managementId} onChange={event => patchRow(row.id, { managementId: event.target.value })}><option value="">Seleccionar...</option>{managements.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
            <td><select value={row.responsibleId} onChange={event => patchRow(row.id, { responsibleId: event.target.value })}><option value="">Sin asignar</option>{managers.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}{item.cargo ? ` · ${item.cargo}` : ''}</option>)}</select></td>
            <td><button type="button" className="remove" onClick={() => setRows(current => current.filter(item => item.id !== row.id))}><Trash2 size={15}/></button></td>
          </tr>)}</tbody>
        </table></div>
      </div>}

      <div className="guideline-import-actions">
        <button type="button" className="secondary" onClick={onClose} disabled={loading || saving}>Cancelar</button>
        <button type="button" className="primary" onClick={() => void importRows()} disabled={loading || saving || !activeRows.length}>{saving && <LoaderCircle className="spin" size={15}/>} Importar {activeRows.length || ''}</button>
      </div>
    </section>
  </div>
}
