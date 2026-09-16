import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { supabase } from './lib/supabase'
import './guideline-responsible-configuration.css'

type Unit = { code: string; name: string }
type Period = { id: string; year: number; name: string; status: 'DRAFT' | 'OPEN' | 'CLOSED' }
type Guideline = {
  id: string
  period_id: string
  unit_code: string
  code: string | null
  category: string | null
  guideline_text: string
  active: boolean
  sort_order: number
}
type ResponsibleLabel = { guideline_id: string; label: string; sort_order: number }
type Props = { units?: Unit[]; canManage: boolean }

const fallbackUnits: Unit[] = [
  { code: 'HU', name: 'Habilitación Urbana' },
  { code: 'DEP', name: 'Departamentos' },
  { code: 'VS', name: 'Vivienda Social' },
  { code: 'HOT', name: 'Hoteles' },
]

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function splitLabels(value: string) {
  const unique = new Map<string, string>()
  value.split(/[\n;,]+/).map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean).forEach(label => {
    const key = normalize(label)
    if (!unique.has(key)) unique.set(key, label)
  })
  return [...unique.values()]
}

export default function GuidelineResponsibleConfiguration({ units, canManage }: Props) {
  const unitOptions = useMemo(() => {
    const source = units?.length ? units : fallbackUnits
    return source.filter(unit => unit.code !== 'CENTRAL')
  }, [units])
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [selectedUnitCode, setSelectedUnitCode] = useState(unitOptions[0]?.code || 'HU')
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [labels, setLabels] = useState<ResponsibleLabel[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingGuidelineId, setSavingGuidelineId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const labelsByGuideline = useMemo(() => {
    const grouped = new Map<string, string[]>()
    labels.forEach(item => grouped.set(item.guideline_id, [...(grouped.get(item.guideline_id) || []), item.label]))
    return grouped
  }, [labels])

  useEffect(() => {
    if (!unitOptions.some(unit => unit.code === selectedUnitCode)) setSelectedUnitCode(unitOptions[0]?.code || 'HU')
  }, [unitOptions, selectedUnitCode])

  useEffect(() => { void loadPeriods() }, [])
  useEffect(() => {
    if (!selectedPeriodId || !selectedUnitCode) return
    void loadGuidelines()
  }, [selectedPeriodId, selectedUnitCode])

  async function loadPeriods() {
    if (!supabase) { setLoading(false); return }
    setLoading(true); setError('')
    const { data, error: loadError } = await supabase.from('planning_periods').select('id,year,name,status').order('year', { ascending: false })
    if (loadError) {
      setLoading(false)
      setError('No pudimos cargar los periodos para configurar responsables.')
      return
    }
    const next = (data || []) as Period[]
    setPeriods(next)
    const currentYear = new Date().getFullYear()
    const preferred = next.find(item => item.year === currentYear) || next.find(item => item.status === 'OPEN') || next[0]
    setSelectedPeriodId(preferred?.id || '')
    setLoading(false)
  }

  async function loadGuidelines() {
    if (!supabase || !selectedPeriodId || !selectedUnitCode) return
    setLoading(true); setError(''); setNotice('')
    const guidelineResult = await supabase.from('planning_guidelines')
      .select('id,period_id,unit_code,code,category,guideline_text,active,sort_order')
      .eq('period_id', selectedPeriodId)
      .eq('unit_code', selectedUnitCode)
      .eq('active', true)
      .order('sort_order')
    if (guidelineResult.error) {
      setLoading(false)
      setError('No pudimos cargar los lineamientos de esta unidad.')
      return
    }
    const nextGuidelines = (guidelineResult.data || []) as Guideline[]
    setGuidelines(nextGuidelines)
    const ids = nextGuidelines.map(item => item.id)
    if (!ids.length) {
      setLabels([])
      setLoading(false)
      return
    }
    const labelResult = await supabase.from('planning_guideline_principal_responsible_labels')
      .select('guideline_id,label,sort_order')
      .in('guideline_id', ids)
      .order('sort_order')
    setLoading(false)
    if (labelResult.error) {
      setLabels([])
      setError('No pudimos cargar los Gerentes Responsables configurados.')
      return
    }
    setLabels((labelResult.data || []) as ResponsibleLabel[])
  }

  async function addResponsible(guidelineId: string) {
    if (!supabase || !canManage || savingGuidelineId) return
    const current = labelsByGuideline.get(guidelineId) || []
    const additions = splitLabels(drafts[guidelineId] || '').filter(label => !current.some(item => normalize(item) === normalize(label)))
    if (!additions.length) {
      setDrafts(value => ({ ...value, [guidelineId]: '' }))
      return
    }
    setSavingGuidelineId(guidelineId); setError(''); setNotice('')
    const payload = additions.map((label, index) => ({ guideline_id: guidelineId, label, sort_order: current.length + index }))
    const { error: saveError } = await supabase.from('planning_guideline_principal_responsible_labels').insert(payload)
    setSavingGuidelineId('')
    if (saveError) {
      setError('No pudimos agregar el Gerente Responsable.')
      return
    }
    setLabels(value => [...value, ...payload])
    setDrafts(value => ({ ...value, [guidelineId]: '' }))
    setNotice(additions.length === 1 ? 'Gerente Responsable agregado.' : 'Gerentes Responsables agregados.')
  }

  async function removeResponsible(guidelineId: string, label: string) {
    if (!supabase || !canManage || savingGuidelineId) return
    setSavingGuidelineId(guidelineId); setError(''); setNotice('')
    const { error: deleteError } = await supabase.from('planning_guideline_principal_responsible_labels').delete().eq('guideline_id', guidelineId).eq('label', label)
    setSavingGuidelineId('')
    if (deleteError) {
      setError('No pudimos quitar el Gerente Responsable.')
      return
    }
    setLabels(value => value.filter(item => !(item.guideline_id === guidelineId && item.label === label)))
    setNotice('Gerente Responsable actualizado.')
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLInputElement>, guidelineId: string) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void addResponsible(guidelineId)
  }

  return <section className="guideline-responsible-config">
    <div className="guideline-responsible-config-head">
      <div><span>Plan de Acción</span><h2>Gerentes responsables por lineamiento</h2><p>Configura uno o varios nombres para cada lineamiento de HU, VS, Departamentos y Hoteles.</p></div>
    </div>

    <div className="guideline-responsible-config-filters">
      <label><span>Periodo</span><select value={selectedPeriodId} onChange={event => setSelectedPeriodId(event.target.value)}>{periods.map(period => <option key={period.id} value={period.id}>{period.year} · {period.name}</option>)}</select></label>
      <label><span>Unidad</span><select value={selectedUnitCode} onChange={event => setSelectedUnitCode(event.target.value)}>{unitOptions.map(unit => <option key={unit.code} value={unit.code}>{unit.name}</option>)}</select></label>
    </div>

    {error && <div className="guideline-responsible-config-message error">{error}</div>}
    {notice && <div className="guideline-responsible-config-message success">{notice}</div>}

    {loading ? <div className="guideline-responsible-config-empty">Cargando lineamientos...</div> : guidelines.length ? <div className="guideline-responsible-config-list">
      {guidelines.map((guideline, index) => {
        const current = labelsByGuideline.get(guideline.id) || []
        const code = String(guideline.code || `L${index + 1}`).trim()
        const busy = savingGuidelineId === guideline.id
        return <article key={guideline.id} className="guideline-responsible-config-row">
          <div className="guideline-responsible-config-guideline">
            <div className="guideline-responsible-config-code">{code}</div>
            <div><strong>{guideline.category || 'Sin categoría'}</strong><p>{guideline.guideline_text}</p></div>
          </div>
          <div className="guideline-responsible-config-values">
            <span className="guideline-responsible-config-label">Gerente Responsable</span>
            <div className="guideline-responsible-config-chips">{current.length ? current.map(label => <span key={normalize(label)}>{label}{canManage && <button type="button" disabled={busy} aria-label={`Quitar ${label}`} onClick={() => void removeResponsible(guideline.id, label)}>×</button>}</span>) : <small>Sin asignar</small>}</div>
            {canManage && <div className="guideline-responsible-config-entry"><input value={drafts[guideline.id] || ''} disabled={busy} onChange={event => setDrafts(value => ({ ...value, [guideline.id]: event.target.value }))} onKeyDown={event => onDraftKeyDown(event, guideline.id)} placeholder="Escribe uno o varios responsables"/><button type="button" disabled={busy || !(drafts[guideline.id] || '').trim()} onClick={() => void addResponsible(guideline.id)}>Agregar responsable</button></div>}
          </div>
        </article>
      })}
    </div> : <div className="guideline-responsible-config-empty">No hay lineamientos activos para esta unidad y periodo.</div>}
  </section>
}
