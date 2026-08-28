import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Download,
  FileBarChart,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './dashboard.css'
import './planning.css'

type UnitAccess = {
  code: 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
  name: string
  unit_role: 'GERENTE_UNIDAD' | 'EQUIPO_UNIDAD' | 'GLOBAL'
}

type DashboardAccess = {
  user_id: string
  email: string
  full_name: string | null
  global_role: 'GESTION_ESTRATEGICA' | 'GERENTE_GENERAL' | null
  active: boolean
  global_access: boolean
  units: UnitAccess[]
}

type PlanningPeriod = {
  id: string
  year: number
  name: string
  status: 'DRAFT' | 'OPEN' | 'CLOSED'
}

type Guideline = {
  id: string
  title: string
  responsible_management: string | null
  responsible_manager: string | null
  status: string
  sort_order: number
  active: boolean
}

type Section = 'inicio' | 'planificacion' | 'configuracion' | 'reportes'
type PlanningStep = 'periods' | 'units' | 'guidelines'

const sectionLabels: Record<Section, string> = {
  inicio: 'Inicio',
  planificacion: 'Planificación',
  configuracion: 'Configuración',
  reportes: 'Reportes',
}

const unitOrder: UnitAccess['code'][] = ['CENTRAL', 'HU', 'DEP', 'VS', 'HOT']
const XLSX_MODULE_URL = 'https://unpkg.com/xlsx@0.18.5/xlsx.mjs'

async function loadSpreadsheetLibrary() {
  return import(/* @vite-ignore */ XLSX_MODULE_URL)
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function BrandMark() {
  return (
    <div className="dashboard-brand" aria-label="Los Portales">
      <div className="dashboard-brand__symbol" aria-hidden="true"><span /><span /></div>
      <div>
        <strong>Los Portales</strong>
        <small>Control de Gestión</small>
      </div>
    </div>
  )
}

function roleLabel(access: DashboardAccess) {
  if (access.global_role === 'GESTION_ESTRATEGICA') return 'Gestión Estratégica'
  if (access.global_role === 'GERENTE_GENERAL') return 'Gerente General'
  if (access.units.some(unit => unit.unit_role === 'GERENTE_UNIDAD')) return 'Gerente de Unidad'
  return 'Equipo de Unidad'
}

function friendlyName(access: DashboardAccess) {
  if (access.full_name?.trim()) return access.full_name.trim().split(' ')[0]
  const local = access.email.split('@')[0]
  const clean = local.replace(/[._-]+/g, ' ').replace(/\d+$/g, '').trim() || local
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

function initials(access: DashboardAccess) {
  const source = access.full_name?.trim() || access.email.split('@')[0]
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'CG'
}

function sortUnits(units: UnitAccess[]) {
  return [...units].sort((a, b) => unitOrder.indexOf(a.code) - unitOrder.indexOf(b.code))
}

export default function Dashboard({ access, onSignOut }: { access: DashboardAccess; onSignOut: () => void | Promise<void> }) {
  const [section, setSection] = useState<Section>('inicio')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<string>('TODAS')

  const today = useMemo(() => new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date()), [])

  const displayName = friendlyName(access)
  const units = sortUnits(access.units || [])

  const navigate = (next: Section) => {
    setSection(next)
    setMenuOpen(false)
  }

  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-sidebar ${menuOpen ? 'dashboard-sidebar--open' : ''}`}>
        <div className="dashboard-sidebar__head">
          <BrandMark />
          <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={20}/></button>
        </div>

        <nav className="dashboard-nav" aria-label="Navegación principal">
          <span className="dashboard-nav__label">Menú</span>
          <button className={section === 'inicio' ? 'active' : ''} onClick={() => navigate('inicio')}><LayoutDashboard size={19}/><span>Inicio</span></button>
          <button className={section === 'planificacion' ? 'active' : ''} onClick={() => navigate('planificacion')}><ClipboardList size={19}/><span>Planificación</span></button>
          <button className={section === 'configuracion' ? 'active' : ''} onClick={() => navigate('configuracion')}><Settings size={19}/><span>Configuración</span></button>
          <button className={section === 'reportes' ? 'active' : ''} onClick={() => navigate('reportes')}><BarChart3 size={19}/><span>Reportes</span></button>
        </nav>

        <div className="dashboard-sidebar__bottom">
          <div className="sidebar-access"><ShieldCheck size={18}/><div><strong>{roleLabel(access)}</strong><small>{access.global_access ? 'Acceso a todas las unidades' : 'Acceso por unidad'}</small></div></div>
          <button className="sidebar-logout" onClick={onSignOut}><LogOut size={18}/> Cerrar sesión</button>
        </div>
      </aside>

      {menuOpen && <button className="dashboard-overlay" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={22}/></button>
            <div className="dashboard-search"><Search size={18}/><input aria-label="Buscar" placeholder="Buscar" /></div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notificaciones"><Bell size={19}/><span className="notification-dot" /></button>
            <button className="profile-chip"><span className="profile-avatar">{initials(access)}</span><span className="profile-copy"><strong>{displayName}</strong><small>{roleLabel(access)}</small></span><ChevronDown size={16}/></button>
          </div>
        </header>

        <main className="dashboard-content">
          {section === 'inicio' ? (
            <HomeView
              access={access}
              displayName={displayName}
              today={today}
              units={units}
              selectedUnit={selectedUnit}
              setSelectedUnit={setSelectedUnit}
              navigate={navigate}
            />
          ) : (
            <>
              <div className="page-heading compact-heading">
                <div>
                  <span className="page-kicker">{sectionLabels[section]}</span>
                  <h1>{sectionLabels[section]}</h1>
                  <p>{sectionDescription(section)}</p>
                </div>
              </div>
              {section === 'planificacion' && <PlanningView access={access} units={units} />}
              {section === 'configuracion' && <ConfigurationView />}
              {section === 'reportes' && <ReportsView />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function HomeView({ access, displayName, today, units, selectedUnit, setSelectedUnit, navigate }: {
  access: DashboardAccess
  displayName: string
  today: string
  units: UnitAccess[]
  selectedUnit: string
  setSelectedUnit: (unit: string) => void
  navigate: (section: Section) => void
}) {
  return (
    <>
      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="welcome-kicker"><Sparkles size={15}/> Todo listo</span>
          <h1>Hola, {displayName} 👋</h1>
          <p>Elige una opción y empieza a trabajar.</p>
          <div className="welcome-meta">
            <span><CalendarDays size={16}/> {today}</span>
            <span><ShieldCheck size={16}/> {roleLabel(access)}</span>
          </div>
        </div>
        <div className="welcome-period">
          <span>Periodo</span>
          <strong>2026</strong>
          <button><CalendarDays size={16}/> Cambiar <ChevronDown size={15}/></button>
        </div>
      </section>

      <section className="dashboard-section action-section">
        <div className="section-title-row">
          <div><span>Accesos rápidos</span><h2>¿Qué quieres hacer?</h2></div>
        </div>
        <div className="friendly-actions">
          <button className="friendly-action friendly-action--planning" onClick={() => navigate('planificacion')}>
            <span className="friendly-action__icon"><ClipboardList size={25}/></span>
            <span className="friendly-action__copy"><strong>Planificar</strong><small>Periodos y matrices</small></span>
            <ArrowRight size={19}/>
          </button>
          <button className="friendly-action friendly-action--settings" onClick={() => navigate('configuracion')}>
            <span className="friendly-action__icon"><SlidersHorizontal size={25}/></span>
            <span className="friendly-action__copy"><strong>Configurar</strong><small>Usuarios y accesos</small></span>
            <ArrowRight size={19}/>
          </button>
          <button className="friendly-action friendly-action--reports" onClick={() => navigate('reportes')}>
            <span className="friendly-action__icon"><FileBarChart size={25}/></span>
            <span className="friendly-action__copy"><strong>Ver reportes</strong><small>Avance y resultados</small></span>
            <ArrowRight size={19}/>
          </button>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-title-row">
          <div><span>Unidades</span><h2>¿Dónde quieres entrar?</h2></div>
          {selectedUnit !== 'TODAS' && <button className="text-action" onClick={() => setSelectedUnit('TODAS')}>Ver todas <ArrowRight size={16}/></button>}
        </div>
        <div className="unit-grid friendly-unit-grid">
          {units.map(unit => (
            <button key={unit.code} className={`unit-card unit-card--${unit.code.toLowerCase()} ${selectedUnit === unit.code ? 'selected' : ''}`} onClick={() => setSelectedUnit(unit.code)}>
              <div className="unit-card__top"><span className="unit-code">{unit.code}</span></div>
              <div className="unit-icon"><Building2 size={26}/></div>
              <h3>{unit.name}</h3>
              <p>{unit.unit_role === 'GLOBAL' ? 'Acceso completo' : unit.unit_role === 'GERENTE_UNIDAD' ? 'Gerente de Unidad' : 'Equipo encargado'}</p>
              <span className="unit-link">Entrar <ArrowRight size={16}/></span>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}

function sectionDescription(section: Section) {
  if (section === 'planificacion') return 'Periodo → unidad → lineamientos.'
  if (section === 'configuracion') return 'Configura usuarios, permisos y parámetros.'
  return 'Consulta el avance y los resultados de gestión.'
}

function PlanningView({ access, units }: { access: DashboardAccess; units: UnitAccess[] }) {
  const [step, setStep] = useState<PlanningStep>('periods')
  const [periods, setPeriods] = useState<PlanningPeriod[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<PlanningPeriod | null>(null)
  const [selectedPlanningUnit, setSelectedPlanningUnit] = useState<UnitAccess | null>(null)
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [loading, setLoading] = useState(true)
  const [guidelinesLoading, setGuidelinesLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [newYear, setNewYear] = useState('')
  const [showGuidelineForm, setShowGuidelineForm] = useState(false)
  const [guidelineTitle, setGuidelineTitle] = useState('')
  const [responsibleManagement, setResponsibleManagement] = useState('')
  const [responsibleManager, setResponsibleManager] = useState('')
  const [guidelineStatus, setGuidelineStatus] = useState('pendiente')
  const [saving, setSaving] = useState(false)
  const [excelBusy, setExcelBusy] = useState(false)

  const canManage = access.global_role === 'GESTION_ESTRATEGICA'

  useEffect(() => {
    void loadPeriods()
  }, [])

  useEffect(() => {
    if (step === 'guidelines' && selectedPeriod && selectedPlanningUnit) {
      void loadGuidelines(selectedPeriod.id, selectedPlanningUnit.code)
    }
  }, [step, selectedPeriod, selectedPlanningUnit])

  async function loadPeriods() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('planning_periods')
      .select('id, year, name, status')
      .order('year', { ascending: true })
    setLoading(false)
    if (queryError) {
      setError('No pudimos cargar los periodos.')
      return
    }
    setPeriods((data || []) as PlanningPeriod[])
  }

  async function loadGuidelines(periodId: string, unitCode: UnitAccess['code']) {
    if (!supabase) return
    setGuidelinesLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('guidelines')
      .select('id, title, responsible_management, responsible_manager, status, sort_order, active')
      .eq('period_id', periodId)
      .eq('unit_code', unitCode)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setGuidelinesLoading(false)
    if (queryError) {
      setError('No pudimos cargar los lineamientos.')
      return
    }
    setGuidelines((data || []) as Guideline[])
  }

  async function createPeriod(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage) return
    const year = Number(newYear)
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      setError('Ingresa un año válido.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    const { error: insertError } = await supabase.from('planning_periods').insert({
      year,
      name: `Periodo ${year}`,
      status: 'DRAFT',
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.code === '23505' ? 'Ese periodo ya existe.' : 'No pudimos crear el periodo.')
      return
    }
    setNewYear('')
    setShowPeriodForm(false)
    await loadPeriods()
  }

  async function createGuideline(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage || !selectedPeriod || !selectedPlanningUnit) return
    const title = guidelineTitle.trim()
    if (!title) {
      setError('Escribe el lineamiento estratégico.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    const { error: insertError } = await supabase.from('guidelines').insert({
      period_id: selectedPeriod.id,
      unit_code: selectedPlanningUnit.code,
      title,
      responsible_management: responsibleManagement.trim() || null,
      responsible_manager: responsibleManager.trim() || null,
      status: guidelineStatus.trim() || 'pendiente',
      sort_order: guidelines.length,
    })
    setSaving(false)
    if (insertError) {
      setError('No pudimos guardar el lineamiento.')
      return
    }
    setGuidelineTitle('')
    setResponsibleManagement('')
    setResponsibleManager('')
    setGuidelineStatus('pendiente')
    setShowGuidelineForm(false)
    setNotice('Lineamiento guardado correctamente.')
    await loadGuidelines(selectedPeriod.id, selectedPlanningUnit.code)
  }

  async function importGuidelinesFromExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !supabase || !canManage || !selectedPeriod || !selectedPlanningUnit) return

    if (guidelines.length > 0 && !window.confirm('Ya existen lineamientos en esta unidad. Los registros del Excel se agregarán a los actuales. ¿Deseas continuar?')) return

    setExcelBusy(true)
    setError('')
    setNotice('')

    try {
      const XLSX = await loadSpreadsheetLibrary()
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]

      const headerRowIndex = matrix.findIndex(row => row.some(cell => {
        const header = normalizeHeader(cell)
        return header === 'lineamientosestrategicos' || header === 'lineamientoestrategico' || header === 'lineamientos'
      }))

      if (headerRowIndex < 0) throw new Error('HEADER_NOT_FOUND')

      const headers = matrix[headerRowIndex].map(normalizeHeader)
      const findColumn = (...aliases: string[]) => headers.findIndex(header => aliases.includes(header))
      const lineamientoIndex = findColumn('lineamientosestrategicos', 'lineamientoestrategico', 'lineamientos', 'lineamiento')
      const gerenciaIndex = findColumn('gerenciaresponsable', 'arearesponsable')
      const gerenteIndex = findColumn('gerenteresponsable', 'responsable')
      const statusIndex = findColumn('estatus', 'estado', 'status')

      if (lineamientoIndex < 0) throw new Error('HEADER_NOT_FOUND')

      const parsedRows = matrix
        .slice(headerRowIndex + 1)
        .map(row => ({
          title: String(row[lineamientoIndex] ?? '').trim(),
          responsible_management: gerenciaIndex >= 0 ? String(row[gerenciaIndex] ?? '').trim() || null : null,
          responsible_manager: gerenteIndex >= 0 ? String(row[gerenteIndex] ?? '').trim() || null : null,
          status: statusIndex >= 0 ? String(row[statusIndex] ?? '').trim().toLowerCase() || 'pendiente' : 'pendiente',
        }))
        .filter(row => row.title)
        .slice(0, 500)

      if (parsedRows.length === 0) throw new Error('NO_ROWS')

      const payload = parsedRows.map((row, index) => ({
        period_id: selectedPeriod.id,
        unit_code: selectedPlanningUnit.code,
        title: row.title,
        responsible_management: row.responsible_management,
        responsible_manager: row.responsible_manager,
        status: row.status,
        sort_order: guidelines.length + index,
      }))

      const { error: insertError } = await supabase.from('guidelines').insert(payload)
      if (insertError) throw insertError

      await loadGuidelines(selectedPeriod.id, selectedPlanningUnit.code)
      setNotice(`${payload.length} lineamiento${payload.length === 1 ? '' : 's'} importado${payload.length === 1 ? '' : 's'} desde Excel.`)
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : ''
      if (message === 'HEADER_NOT_FOUND') {
        setError('No encontramos la columna “Lineamientos Estratégicos”. Usa las columnas: N°, Lineamientos Estratégicos, Gerencia Responsable, Gerente Responsable y Estatus.')
      } else if (message === 'NO_ROWS') {
        setError('El Excel no contiene lineamientos para importar.')
      } else {
        setError('No pudimos importar el Excel. Verifica el formato e inténtalo nuevamente.')
      }
    } finally {
      setExcelBusy(false)
    }
  }

  async function exportGuidelinesToExcel() {
    if (!selectedPeriod || !selectedPlanningUnit) return
    setExcelBusy(true)
    setError('')
    setNotice('')
    try {
      const XLSX = await loadSpreadsheetLibrary()
      const rows = guidelines.map((guideline, index) => ({
        'N°': index + 1,
        'Lineamientos Estratégicos': guideline.title,
        'Gerencia Responsable': guideline.responsible_management || '',
        'Gerente Responsable': guideline.responsible_manager || '',
        'Estatus': guideline.status || 'pendiente',
      }))
      const headers = ['N°', 'Lineamientos Estratégicos', 'Gerencia Responsable', 'Gerente Responsable', 'Estatus']
      const worksheet = rows.length > 0
        ? XLSX.utils.json_to_sheet(rows, { header: headers })
        : XLSX.utils.aoa_to_sheet([headers])
      worksheet['!cols'] = [{ wch: 6 }, { wch: 70 }, { wch: 28 }, { wch: 28 }, { wch: 16 }]
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Lineamientos')
      XLSX.writeFile(workbook, `Lineamientos_${selectedPlanningUnit.code}_${selectedPeriod.year}.xlsx`)
      setNotice('Excel generado correctamente.')
    } catch {
      setError('No pudimos generar el Excel.')
    } finally {
      setExcelBusy(false)
    }
  }

  function selectPeriod(period: PlanningPeriod) {
    setSelectedPeriod(period)
    setSelectedPlanningUnit(null)
    setStep('units')
    setError('')
    setNotice('')
  }

  function selectUnit(unit: UnitAccess) {
    setSelectedPlanningUnit(unit)
    setStep('guidelines')
    setError('')
    setNotice('')
  }

  function goBack() {
    setError('')
    setNotice('')
    if (step === 'guidelines') {
      setStep('units')
      setSelectedPlanningUnit(null)
      return
    }
    if (step === 'units') {
      setStep('periods')
      setSelectedPeriod(null)
    }
  }

  return (
    <div className="planning-flow">
      <div className="planning-breadcrumbs">
        <button className={step === 'periods' ? 'current' : ''} onClick={() => { setStep('periods'); setSelectedPeriod(null); setSelectedPlanningUnit(null) }}>1. Periodo</button>
        <span>→</span>
        <button className={step === 'units' ? 'current' : ''} disabled={!selectedPeriod} onClick={() => selectedPeriod && setStep('units')}>2. Unidad</button>
        <span>→</span>
        <button className={step === 'guidelines' ? 'current' : ''} disabled={!selectedPeriod || !selectedPlanningUnit}>3. Lineamientos</button>
      </div>

      {step !== 'periods' && <button className="planning-back" onClick={goBack}><ArrowLeft size={17}/> Volver</button>}
      {error && <div className="planning-message">{error}</div>}
      {notice && <div className="planning-message planning-message--success">{notice}</div>}

      {step === 'periods' && (
        <section className="planning-panel">
          <div className="planning-title-row">
            <div><span>Paso 1</span><h2>Elige el periodo</h2><p>Selecciona el año que quieres gestionar.</p></div>
            {canManage && <button className="planning-primary" onClick={() => setShowPeriodForm(value => !value)}><Plus size={17}/> Nuevo periodo</button>}
          </div>

          {showPeriodForm && (
            <form className="planning-inline-form" onSubmit={createPeriod}>
              <label>Año<input inputMode="numeric" maxLength={4} value={newYear} onChange={event => setNewYear(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="2030" /></label>
              <button className="planning-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17}/> : <Plus size={17}/>} Crear</button>
              <button type="button" className="planning-secondary" onClick={() => setShowPeriodForm(false)}>Cancelar</button>
            </form>
          )}

          {loading ? (
            <div className="planning-loading"><LoaderCircle className="spin" size={24}/> Cargando periodos...</div>
          ) : (
            <div className="planning-period-grid">
              {periods.map(period => (
                <button className={`planning-period-card ${period.status === 'OPEN' ? 'open' : ''}`} key={period.id} onClick={() => selectPeriod(period)}>
                  <span className="planning-period-icon"><CalendarDays size={24}/></span>
                  <div><small>{period.status === 'OPEN' ? 'Periodo actual' : period.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}</small><strong>{period.year}</strong></div>
                  <ArrowRight size={19}/>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 'units' && selectedPeriod && (
        <section className="planning-panel">
          <div className="planning-title-row">
            <div><span>Paso 2 · {selectedPeriod.year}</span><h2>Elige una unidad</h2><p>Entrarás a los lineamientos de la unidad seleccionada.</p></div>
          </div>
          <div className="planning-unit-grid">
            {units.map(unit => (
              <button key={unit.code} className={`planning-unit-card planning-unit-card--${unit.code.toLowerCase()}`} onClick={() => selectUnit(unit)}>
                <span className="planning-unit-icon"><Building2 size={27}/></span>
                <div><small>{unit.code}</small><strong>{unit.name}</strong></div>
                <ArrowRight size={19}/>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'guidelines' && selectedPeriod && selectedPlanningUnit && (
        <section className="planning-panel planning-panel--wide">
          <div className="planning-title-row">
            <div>
              <span>Paso 3 · {selectedPeriod.year} · {selectedPlanningUnit.code}</span>
              <h2>Lineamientos de {selectedPlanningUnit.name}</h2>
              <p>Formato: lineamiento estratégico, gerencia responsable, gerente responsable y estatus.</p>
            </div>
            <div className="guideline-actions">
              <button className="planning-secondary" type="button" onClick={() => void exportGuidelinesToExcel()} disabled={excelBusy}>
                {excelBusy ? <LoaderCircle className="spin" size={17}/> : <Download size={17}/>} Exportar Excel
              </button>
              {canManage && (
                <label className={`planning-secondary planning-file-button ${excelBusy ? 'disabled' : ''}`}>
                  <Upload size={17}/> Subir Excel
                  <input type="file" accept=".xlsx,.xls" onChange={importGuidelinesFromExcel} disabled={excelBusy} />
                </label>
              )}
              {canManage && <button className="planning-primary" onClick={() => setShowGuidelineForm(value => !value)}><Plus size={17}/> Nuevo lineamiento</button>}
            </div>
          </div>

          {showGuidelineForm && (
            <form className="guideline-form guideline-form--table" onSubmit={createGuideline}>
              <label className="guideline-form__wide">Lineamiento estratégico<textarea rows={3} value={guidelineTitle} onChange={event => setGuidelineTitle(event.target.value)} placeholder="Escribe el lineamiento estratégico" /></label>
              <label>Gerencia Responsable<input value={responsibleManagement} onChange={event => setResponsibleManagement(event.target.value)} placeholder="Ej. Comercial / MKT" /></label>
              <label>Gerente Responsable<input value={responsibleManager} onChange={event => setResponsibleManager(event.target.value)} placeholder="Ej. Jorge M. / Lorena A." /></label>
              <label>Estatus<select value={guidelineStatus} onChange={event => setGuidelineStatus(event.target.value)}><option value="pendiente">Pendiente</option><option value="enviado">Enviado</option><option value="observado">Observado</option><option value="aprobado">Aprobado</option></select></label>
              <div className="guideline-form__actions"><button className="planning-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17}/> : <Plus size={17}/>} Guardar lineamiento</button><button type="button" className="planning-secondary" onClick={() => setShowGuidelineForm(false)}>Cancelar</button></div>
            </form>
          )}

          {guidelinesLoading ? (
            <div className="planning-loading"><LoaderCircle className="spin" size={24}/> Cargando lineamientos...</div>
          ) : guidelines.length === 0 ? (
            <div className="planning-empty">
              <span><ClipboardList size={30}/></span>
              <h3>Aún no hay lineamientos</h3>
              <p>{canManage ? 'Puedes crear el primero manualmente o subir tu Excel actual.' : 'Gestión Estratégica todavía no ha registrado lineamientos.'}</p>
              {canManage && <div className="planning-empty__actions"><button className="planning-primary" onClick={() => setShowGuidelineForm(true)}><Plus size={17}/> Crear lineamiento</button><label className="planning-secondary planning-file-button"><Upload size={17}/> Subir Excel<input type="file" accept=".xlsx,.xls" onChange={importGuidelinesFromExcel} /></label></div>}
            </div>
          ) : (
            <div className="guideline-table-wrap">
              <table className="guideline-table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Lineamientos Estratégicos</th>
                    <th>Gerencia Responsable</th>
                    <th>Gerente Responsable</th>
                    <th>Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {guidelines.map((guideline, index) => (
                    <tr key={guideline.id}>
                      <td className="guideline-table__number">{index + 1}</td>
                      <td className="guideline-table__title">{guideline.title}</td>
                      <td>{guideline.responsible_management || '—'}</td>
                      <td>{guideline.responsible_manager || '—'}</td>
                      <td><span className={`guideline-status guideline-status--${normalizeHeader(guideline.status)}`}>{guideline.status || 'pendiente'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function ConfigurationView() {
  const items = [
    { icon: <Users/>, title: 'Usuarios y permisos', text: 'Autoriza usuarios y asigna accesos.' },
    { icon: <Building2/>, title: 'Unidades de negocio', text: 'Administra las unidades disponibles.' },
    { icon: <CalendarDays/>, title: 'Periodos', text: 'Crea y administra periodos.' },
    { icon: <ClipboardList/>, title: 'Lineamientos', text: 'Define la estructura de las matrices.' },
  ]
  return <div className="config-grid">{items.map(item => <button className="config-card" key={item.title}><span className="config-icon">{item.icon}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><ArrowRight size={18}/></button>)}</div>
}

function ReportsView() {
  return (
    <div className="module-stack">
      <div className="reports-hero panel-card"><div><span>Reportes</span><h2>Vista consolidada</h2><p>Aquí podrás revisar el avance de todas las unidades.</p></div><FileBarChart size={56}/></div>
      <div className="report-grid">
        <button className="report-card"><BarChart3 size={24}/><h3>Avance por unidad</h3><p>Compara el avance entre unidades.</p><span>Ver reporte <ArrowRight size={16}/></span></button>
        <button className="report-card"><ClipboardList size={24}/><h3>Estado de matrices</h3><p>Revisa matrices pendientes y aprobadas.</p><span>Ver reporte <ArrowRight size={16}/></span></button>
        <button className="report-card"><FileBarChart size={24}/><h3>Resumen ejecutivo</h3><p>Consulta la información consolidada.</p><span>Ver reporte <ArrowRight size={16}/></span></button>
      </div>
    </div>
  )
}
