import { Building2, ChevronDown, LoaderCircle, Search } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import './catalog-configuration.css'
import './catalog-matrix-areas.css'
import './configuration-area-filter.css'

type Unit = { code: string; name: string }
type Management = { id: string; name: string; unit_code: string; directory_group: string; active: boolean }
type GuidelineUnitArea = { unit_code: string; management_id: string }
type Props = { units?: Unit[]; canManage: boolean }
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

const fallbackUnits: Unit[] = [
  { code: 'CENTRAL', name: 'Central' },
  { code: 'HU', name: 'Habilitación Urbana' },
  { code: 'DEP', name: 'Departamentos' },
  { code: 'VS', name: 'Vivienda Social' },
  { code: 'HOT', name: 'Hoteles' },
]

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export default function GuidelineAreaCatalog({ units, canManage }: Props) {
  const unitOptions = units?.length ? units : fallbackUnits
  const defaultUnitCode = unitOptions.find(item => item.code === 'CENTRAL')?.code || unitOptions[0]?.code || 'CENTRAL'
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [targetUnitCode, setTargetUnitCode] = useState(defaultUnitCode)
  const [managements, setManagements] = useState<Management[]>([])
  const [links, setLinks] = useState<GuidelineUnitArea[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const unitByCode = useMemo(() => new Map(unitOptions.map(item => [item.code, item.name])), [unitOptions])

  const areaRows = useMemo(() => {
    const grouped = new Map<string, { representative: Management; origins: Set<string> }>()
    managements.filter(item => item.active).forEach(item => {
      const key = normalize(item.name)
      const current = grouped.get(key)
      if (!current) {
        grouped.set(key, { representative: item, origins: new Set([item.unit_code]) })
        return
      }
      current.origins.add(item.unit_code)
      if (item.unit_code === 'CENTRAL' && current.representative.unit_code !== 'CENTRAL') current.representative = item
    })

    const enabledNames = new Set(
      links
        .filter(item => item.unit_code === targetUnitCode)
        .map(item => managements.find(area => area.id === item.management_id)?.name || '')
        .filter(Boolean)
        .map(normalize),
    )

    const term = normalize(search)
    return [...grouped.values()]
      .map(item => ({
        area: item.representative,
        origins: [...item.origins].sort(),
        enabled: enabledNames.has(normalize(item.representative.name)),
      }))
      .filter(item => !term || normalize(item.area.name).includes(term) || item.origins.some(origin => normalize(unitByCode.get(origin) || origin).includes(term)))
      .filter(item => statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? item.enabled : !item.enabled))
      .sort((a, b) => a.area.name.localeCompare(b.area.name, 'es'))
  }, [managements, links, targetUnitCode, search, statusFilter, unitByCode])

  const enabledCount = useMemo(() => {
    const names = new Set<string>()
    links.filter(item => item.unit_code === targetUnitCode).forEach(item => {
      const area = managements.find(candidate => candidate.id === item.management_id)
      if (area) names.add(normalize(area.name))
    })
    return names.size
  }, [links, managements, targetUnitCode])

  useEffect(() => { void load() }, [])

  async function load() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const [areaResult, linkResult] = await Promise.all([
      supabase.from('managements_global').select('id,name,unit_code,directory_group,active').eq('active', true).order('name'),
      supabase.from('guideline_unit_area_catalog').select('unit_code,management_id').order('unit_code').order('created_at'),
    ])
    setLoading(false)
    if (areaResult.error || linkResult.error) {
      setError('No pudimos cargar la configuración de áreas para Lineamientos.')
      return
    }
    setManagements((areaResult.data || []) as Management[])
    setLinks((linkResult.data || []) as GuidelineUnitArea[])
  }

  async function toggleArea(area: Management, enabled: boolean) {
    if (!supabase || !canManage) return
    setSavingId(area.id)
    setError('')
    setNotice('')

    if (!enabled) {
      const result = await supabase.from('guideline_unit_area_catalog').insert({ unit_code: targetUnitCode, management_id: area.id })
      setSavingId('')
      if (result.error) {
        setError(`No pudimos activar “${area.name}” para Lineamientos.`)
        return
      }
      setNotice(`“${area.name}” ahora aparece en Lineamientos de ${unitByCode.get(targetUnitCode) || targetUnitCode}.`)
      await load()
      return
    }

    const equivalentIds = new Set(
      managements.filter(item => normalize(item.name) === normalize(area.name)).map(item => item.id),
    )
    const matchingIds = links
      .filter(item => item.unit_code === targetUnitCode && equivalentIds.has(item.management_id))
      .map(item => item.management_id)

    let deleteError: { message?: string } | null = null
    if (matchingIds.length) {
      const result = await supabase
        .from('guideline_unit_area_catalog')
        .delete()
        .eq('unit_code', targetUnitCode)
        .in('management_id', matchingIds)
      deleteError = result.error
    }
    setSavingId('')
    if (deleteError) {
      setError(`No pudimos quitar “${area.name}” de Lineamientos.`)
      return
    }
    setNotice(`“${area.name}” dejó de aparecer en Lineamientos de ${unitByCode.get(targetUnitCode) || targetUnitCode}.`)
    await load()
  }

  return <section className={`config-accordion catalog-config catalog-config--${targetUnitCode.toLowerCase()} ${open ? 'open' : ''}`}>
    <button type="button" className="config-accordion-head" onClick={() => setOpen(value => !value)}>
      <span className="config-accordion-icon"><Building2 size={20}/></span>
      <span>
        <small>Configuración de lineamientos</small>
        <h2>Áreas visibles en Lineamientos</h2>
        <p>Define qué áreas aparecerán en la tabla de Lineamientos de cada unidad. Se mantiene para todos los periodos.</p>
      </span>
      <ChevronDown size={19} className={open ? 'rotated' : ''}/>
    </button>

    {open && <div className="config-accordion-body matrix-area-config-body">
      {error && <div className="catalog-message catalog-message--error">{error}</div>}
      {notice && <div className="catalog-message catalog-message--success">{notice}</div>}

      <div className="catalog-unit-selector compact">
        {unitOptions.map(unit => <button key={unit.code} type="button" className={targetUnitCode === unit.code ? 'active' : ''} onClick={() => { setTargetUnitCode(unit.code); setSearch(''); setStatusFilter('ALL'); setError(''); setNotice('') }}>
          <span>{unit.code}</span><small>{unit.name}</small>
        </button>)}
      </div>

      <div className="matrix-area-config-info">
        <div><strong>Áreas para {unitByCode.get(targetUnitCode) || targetUnitCode}</strong><small>Puedes usar áreas provenientes de cualquier unidad. Esta selección solo afecta la tabla de Lineamientos y no modifica Bonistas ni Matrices.</small></div>
        <span>{enabledCount} áreas activas</span>
      </div>

      <div className="area-editor-toolbar">
        <label><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar entre todas las áreas..."/></label>
        <select className="matrix-area-status-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filtrar áreas de Lineamientos por estado">
          <option value="ALL">Todas</option>
          <option value="ACTIVE">Activas</option>
          <option value="INACTIVE">No activas</option>
        </select>
      </div>

      {loading ? <div className="catalog-loading"><LoaderCircle className="spin" size={18}/> Cargando áreas...</div> : <div className="matrix-area-source-grid">
        {areaRows.map(({ area, origins, enabled }) => <article key={`${normalize(area.name)}-${targetUnitCode}`} className={`matrix-area-source-card ${enabled ? 'visible' : ''}`}>
          <span className="matrix-area-source-icon"><Building2 size={16}/></span>
          <div><strong>{area.name}</strong><small>Origen: {origins.map(code => unitByCode.get(code) || code).join(' · ')}</small></div>
          <span className={`matrix-area-visibility ${enabled ? 'on' : 'off'}`}>{enabled ? 'Activa' : 'No visible'}</span>
          <button type="button" className={`matrix-area-toggle ${enabled ? 'remove' : 'add'}`} onClick={() => void toggleArea(area, enabled)} disabled={!canManage || savingId === area.id} aria-label={enabled ? `Quitar ${area.name} de Lineamientos` : `Añadir ${area.name} a Lineamientos`}>{savingId === area.id ? <LoaderCircle className="spin" size={13}/> : null}</button>
        </article>)}
        {!areaRows.length && <div className="catalog-empty">No hay áreas para este filtro.</div>}
      </div>}
    </div>}
  </section>
}
