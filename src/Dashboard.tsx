import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpenText,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import CatalogConfiguration from './CatalogConfiguration'
import MatrixWorkspace from './MatrixWorkspace'
import PlanningGuidelines from './PlanningGuidelines'
import './dashboard.css'
import './planning.css'
import './interaction-fixes.css'

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

type Section = 'inicio' | 'planificacion' | 'configuracion' | 'reportes'
type PlanningStep = 'units' | 'modules' | 'guidelines' | 'matrices'

type PlanningEntry = {
  year: number
  unitCode: UnitAccess['code']
  token: number
} | null

const sectionLabels: Record<Section, string> = {
  inicio: 'Inicio',
  planificacion: 'Planificación',
  configuracion: 'Configuración',
  reportes: 'Reportes',
}

const unitOrder: UnitAccess['code'][] = ['CENTRAL', 'HU', 'DEP', 'VS', 'HOT']

function BrandMark() {
  return (
    <div className="dashboard-brand" aria-label="Los Portales">
      <div className="dashboard-brand__symbol" aria-hidden="true"><span /><span /></div>
      <div><strong>Los Portales</strong><small>Control de Gestión</small></div>
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

function ConfirmDialog({ open, title, message, confirmText, busy, onCancel, onConfirm }: {
  open: boolean
  title: string
  message: string
  confirmText: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  if (!open) return null
  return (
    <div className="cg-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !busy) onCancel() }}>
      <div className="cg-confirm-dialog" role="dialog" aria-modal="true">
        <button className="cg-modal-close" type="button" onClick={onCancel} disabled={busy}><X size={18}/></button>
        <div className="cg-confirm-icon"><LogOut size={23}/></div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="cg-modal-actions">
          <button type="button" className="cg-modal-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button type="button" className="cg-modal-primary" onClick={() => void onConfirm()} disabled={busy}>{busy && <LoaderCircle className="spin" size={16}/>} {confirmText}</button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ access, onSignOut }: { access: DashboardAccess; onSignOut: () => void | Promise<void> }) {
  const [section, setSection] = useState<Section>('inicio')
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<string>('TODAS')
  const [periods, setPeriods] = useState<PlanningPeriod[]>([])
  const [selectedHomeYear, setSelectedHomeYear] = useState(2026)
  const [planningEntry, setPlanningEntry] = useState<PlanningEntry>(null)

  const today = useMemo(() => new Intl.DateTimeFormat('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date()), [])
  const displayName = friendlyName(access)
  const units = sortUnits(access.units || [])
  const selectedHomeUnit = units.find(unit => unit.code === selectedUnit) || null

  useEffect(() => { void loadDashboardPeriods() }, [])

  async function loadDashboardPeriods() {
    if (!supabase) return
    const { data } = await supabase.from('planning_periods').select('id, year, name, status').order('year', { ascending: true })
    const next = (data || []) as PlanningPeriod[]
    setPeriods(next)
    if (next.length && !next.some(period => period.year === selectedHomeYear)) {
      const preferred = next.find(period => period.status === 'OPEN') || next[0]
      setSelectedHomeYear(preferred.year)
    }
  }

  function navigate(next: Section) {
    if (next === 'planificacion') setPlanningEntry(null)
    setSection(next)
    setMenuOpen(false)
    setProfileOpen(false)
  }

  function openMatrices(unitCode: UnitAccess['code']) {
    setPlanningEntry({ year: selectedHomeYear, unitCode, token: Date.now() })
    setSection('planificacion')
    setSelectedUnit(unitCode)
  }

  async function confirmSignOut() {
    setLogoutBusy(true)
    try { await onSignOut() }
    finally { setLogoutBusy(false); setLogoutConfirmOpen(false) }
  }

  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-sidebar ${menuOpen ? 'dashboard-sidebar--open' : ''}`}>
        <div className="dashboard-sidebar__head"><BrandMark /><button className="sidebar-close" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
        <nav className="dashboard-nav" aria-label="Navegación principal">
          <span className="dashboard-nav__label">Menú</span>
          <button className={section === 'inicio' ? 'active' : ''} onClick={() => navigate('inicio')}><LayoutDashboard size={19}/><span>Inicio</span></button>
          <button className={section === 'planificacion' ? 'active' : ''} onClick={() => navigate('planificacion')}><ClipboardList size={19}/><span>Planificación</span></button>
          <button className={section === 'configuracion' ? 'active' : ''} onClick={() => navigate('configuracion')}><Settings size={19}/><span>Configuración</span></button>
          <button className={section === 'reportes' ? 'active' : ''} onClick={() => navigate('reportes')}><BarChart3 size={19}/><span>Reportes</span></button>
        </nav>
        <div className="dashboard-sidebar__bottom">
          <div className="sidebar-access"><ShieldCheck size={18}/><div><strong>{roleLabel(access)}</strong><small>{access.global_access ? 'Acceso a todas las unidades' : 'Acceso por unidad'}</small></div></div>
          <button className="sidebar-logout" onClick={() => setLogoutConfirmOpen(true)}><LogOut size={18}/> Cerrar sesión</button>
        </div>
      </aside>

      {menuOpen && <button className="dashboard-overlay" onClick={() => setMenuOpen(false)} />}

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left"><button className="mobile-menu" onClick={() => setMenuOpen(true)}><Menu size={22}/></button><div className="dashboard-search"><Search size={18}/><input placeholder="Buscar" /></div></div>
          <div className="topbar-actions profile-menu-wrap">
            <button className="icon-button"><Bell size={19}/><span className="notification-dot" /></button>
            <button className={`profile-chip ${profileOpen ? 'profile-chip--open' : ''}`} onClick={() => setProfileOpen(value => !value)}><span className="profile-avatar">{initials(access)}</span><span className="profile-copy"><strong>{displayName}</strong><small>{roleLabel(access)}</small></span><ChevronDown className={profileOpen ? 'chevron-open' : ''} size={16}/></button>
            {profileOpen && <div className="profile-dropdown"><div><strong>{displayName}</strong><small>{access.email}</small></div><span>{roleLabel(access)}</span><button onClick={() => { setProfileOpen(false); setLogoutConfirmOpen(true) }}><LogOut size={16}/> Cerrar sesión</button></div>}
          </div>
        </header>

        <main className="dashboard-content">
          {section === 'inicio' ? <HomeView access={access} displayName={displayName} today={today} units={units} selectedUnit={selectedUnit} selectedHomeUnit={selectedHomeUnit} setSelectedUnit={setSelectedUnit} navigate={navigate} periods={periods} selectedYear={selectedHomeYear} setSelectedYear={setSelectedHomeYear} openMatrices={openMatrices} /> : <>
            <div className="page-heading compact-heading"><div><span className="page-kicker">{sectionLabels[section]}</span><h1>{sectionLabels[section]}</h1><p>{sectionDescription(section)}</p></div></div>
            {section === 'planificacion' && <PlanningView key={planningEntry ? `${planningEntry.year}-${planningEntry.unitCode}-${planningEntry.token}` : 'planning-default'} access={access} units={units} initialYear={planningEntry?.year} initialUnitCode={planningEntry?.unitCode} />}
            {section === 'configuracion' && <CatalogConfiguration units={units.map(unit => ({ code: unit.code, name: unit.name }))} canManage={access.global_role === 'GESTION_ESTRATEGICA'} />}
            {section === 'reportes' && <ReportsView />}
          </>}
        </main>
      </div>

      <ConfirmDialog open={logoutConfirmOpen} title="¿Cerrar sesión?" message="Tu sesión actual se cerrará y tendrás que volver a ingresar para continuar." confirmText="Sí, cerrar sesión" busy={logoutBusy} onCancel={() => setLogoutConfirmOpen(false)} onConfirm={confirmSignOut} />
    </div>
  )
}

function HomeView({ access, displayName, today, units, selectedUnit, selectedHomeUnit, setSelectedUnit, navigate, periods, selectedYear, setSelectedYear, openMatrices }: {
  access: DashboardAccess
  displayName: string
  today: string
  units: UnitAccess[]
  selectedUnit: string
  selectedHomeUnit: UnitAccess | null
  setSelectedUnit: (unit: string) => void
  navigate: (section: Section) => void
  periods: PlanningPeriod[]
  selectedYear: number
  setSelectedYear: (year: number) => void
  openMatrices: (unit: UnitAccess['code']) => void
}) {
  return <>
    <section className="welcome-card">
      <div className="welcome-copy"><span className="welcome-kicker"><Sparkles size={15}/> Todo listo</span><h1>Hola, {displayName} 👋</h1><p>Elige una opción y empieza a trabajar.</p><div className="welcome-meta"><span><CalendarDays size={16}/> {today}</span><span><ShieldCheck size={16}/> {roleLabel(access)}</span></div></div>
      <div className="welcome-period"><span>Periodo</span><strong>{selectedYear}</strong><label className="period-select-control"><CalendarDays size={16}/><select value={selectedYear} onChange={event => setSelectedYear(Number(event.target.value))}>{periods.map(period => <option key={period.id} value={period.year}>{period.year} · {period.status === 'OPEN' ? 'Actual' : period.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}</option>)}</select><ChevronDown size={15}/></label></div>
    </section>

    <section className="dashboard-section action-section">
      <div className="section-title-row"><div><span>Accesos rápidos</span><h2>¿Qué quieres hacer?</h2></div></div>
      <div className="friendly-actions">
        <button className="friendly-action friendly-action--planning" onClick={() => navigate('planificacion')}><span className="friendly-action__icon"><ClipboardList size={25}/></span><span className="friendly-action__copy"><strong>Planificar</strong><small>Lineamientos, áreas y matrices</small></span><ArrowRight size={19}/></button>
        <button className="friendly-action friendly-action--settings" onClick={() => navigate('configuracion')}><span className="friendly-action__icon"><SlidersHorizontal size={25}/></span><span className="friendly-action__copy"><strong>Configurar</strong><small>Periodos, áreas, bonistas y permisos</small></span><ArrowRight size={19}/></button>
        <button className="friendly-action friendly-action--reports" onClick={() => navigate('reportes')}><span className="friendly-action__icon"><FileBarChart size={25}/></span><span className="friendly-action__copy"><strong>Ver reportes</strong><small>Avance y resultados</small></span><ArrowRight size={19}/></button>
      </div>
    </section>

    <section className="dashboard-section">
      <div className="section-title-row"><div><span>Unidades</span><h2>¿Dónde quieres entrar?</h2></div>{selectedUnit !== 'TODAS' && <button className="text-action" onClick={() => setSelectedUnit('TODAS')}>Ver todas <ArrowRight size={16}/></button>}</div>
      <div className="unit-grid friendly-unit-grid">{units.map(unit => <button key={unit.code} className={`unit-card unit-card--${unit.code.toLowerCase()} ${selectedUnit === unit.code ? 'selected' : ''}`} onClick={() => setSelectedUnit(unit.code)}><div className="unit-card__top"><span className="unit-code">{unit.code}</span></div><div className="unit-icon"><Building2 size={26}/></div><h3>{unit.name}</h3><p>{unit.unit_role === 'GLOBAL' ? 'Acceso completo' : unit.unit_role === 'GERENTE_UNIDAD' ? 'Gerente de Unidad' : 'Equipo encargado'}</p><span className="unit-link">Entrar <ArrowRight size={16}/></span></button>)}</div>
    </section>

    {selectedHomeUnit && <section className="dashboard-section unit-module-section"><div className="section-title-row"><div><span>{selectedHomeUnit.name}</span><h2>¿Qué quieres revisar?</h2></div></div><div className="unit-module-grid"><button className={`unit-module-card unit-module-card--${selectedHomeUnit.code.toLowerCase()}`} onClick={() => openMatrices(selectedHomeUnit.code)}><span className="unit-module-icon"><ClipboardList size={28}/></span><div><small>Periodo {selectedYear}</small><strong>Matrices</strong><p>Entrar por área y matriz de gestión.</p></div><ArrowRight size={20}/></button></div></section>}
  </>
}

function sectionDescription(section: Section) {
  if (section === 'planificacion') return 'Unidad → lineamientos o matrices.'
  if (section === 'configuracion') return 'Administra periodos, áreas, bonistas y permisos de acceso.'
  return 'Consulta el avance y los resultados de gestión.'
}

function PlanningView({ access, units, initialYear, initialUnitCode }: {
  access: DashboardAccess
  units: UnitAccess[]
  initialYear?: number
  initialUnitCode?: UnitAccess['code']
}) {
  const [step, setStep] = useState<PlanningStep>('units')
  const [selectedPeriod, setSelectedPeriod] = useState<PlanningPeriod | null>(null)
  const [selectedPlanningUnit, setSelectedPlanningUnit] = useState<UnitAccess | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const canManage = access.global_role === 'GESTION_ESTRATEGICA'

  useEffect(() => { void loadPeriodContext() }, [initialYear])

  useEffect(() => {
    if (!selectedPeriod || !initialUnitCode) return
    const unit = units.find(item => item.code === initialUnitCode)
    if (!unit) return
    setSelectedPlanningUnit(unit)
    setStep('matrices')
  }, [selectedPeriod, initialUnitCode, units])

  async function loadPeriodContext() {
    if (!supabase) return
    setLoading(true); setError('')
    const { data, error: queryError } = await supabase.from('planning_periods').select('id, year, name, status').order('year', { ascending: true })
    setLoading(false)
    if (queryError) { setError('No pudimos cargar el periodo configurado.'); return }
    const available = (data || []) as PlanningPeriod[]
    const preferred = (initialYear ? available.find(item => item.year === initialYear) : null) || available.find(item => item.status === 'OPEN') || available[0] || null
    if (!preferred) { setError('No hay un periodo configurado. Créalo desde Configuración → Periodos.'); return }
    setSelectedPeriod(preferred)
    if (!initialUnitCode) { setSelectedPlanningUnit(null); setStep('units') }
  }

  function selectUnit(unit: UnitAccess) {
    setSelectedPlanningUnit(unit)
    setStep('modules')
    setError('')
    setNotice('')
  }

  function goBack() {
    setError('')
    setNotice('')
    if (step === 'guidelines' || step === 'matrices') {
      setStep('modules')
      return
    }
    if (step === 'modules') {
      setStep('units')
      setSelectedPlanningUnit(null)
    }
  }

  const secondStepLabel = step === 'guidelines' ? '2. Lineamientos' : step === 'matrices' ? '2. Matrices' : '2. Planificación'

  return <div className="planning-flow">
    <div className="planning-breadcrumbs"><button className={step === 'units' ? 'current' : ''} onClick={() => { setStep('units'); setSelectedPlanningUnit(null) }}>1. Unidad</button><span>→</span><button className={step !== 'units' ? 'current' : ''} disabled={!selectedPeriod || !selectedPlanningUnit} onClick={() => selectedPlanningUnit && setStep('modules')}>{secondStepLabel}</button></div>
    {step !== 'units' && <button className="planning-back" onClick={goBack}><ArrowLeft size={17}/> Volver</button>}
    {error && <div className="planning-message">{error}</div>}
    {notice && <div className="planning-message planning-message--success">{notice}</div>}

    {loading ? <div className="planning-loading"><LoaderCircle className="spin" size={24}/> Cargando planificación...</div> : step === 'units' && selectedPeriod ? <section className="planning-panel"><div className="planning-title-row"><div><span>Paso 1 · Periodo {selectedPeriod.year}</span><h2>Elige una unidad</h2><p>Selecciona la unidad y luego decide si quieres trabajar sus lineamientos o sus matrices.</p></div></div><div className="planning-unit-grid">{units.map(unit => <button key={unit.code} className={`planning-unit-card planning-unit-card--${unit.code.toLowerCase()}`} onClick={() => selectUnit(unit)}><span className="planning-unit-icon"><Building2 size={27}/></span><div><small>{unit.code}</small><strong>{unit.name}</strong></div><ArrowRight size={19}/></button>)}</div></section> : null}

    {step === 'modules' && selectedPeriod && selectedPlanningUnit && <section className="planning-panel"><div className="planning-title-row"><div><span>{selectedPlanningUnit.code} · Periodo {selectedPeriod.year}</span><h2>{selectedPlanningUnit.name}</h2><p>Elige qué quieres trabajar dentro de esta unidad.</p></div></div><div className="planning-module-choice-grid"><button className="planning-module-choice planning-module-choice--guidelines" onClick={() => { setStep('guidelines'); setError(''); setNotice('') }}><span className="planning-module-choice__icon"><BookOpenText size={25}/></span><span className="planning-module-choice__copy"><small>Planificación estratégica</small><strong>Lineamientos</strong><p>Consulta y administra los lineamientos que alimentan las matrices.</p></span><ArrowRight size={20}/></button><button className="planning-module-choice planning-module-choice--matrices" onClick={() => { setStep('matrices'); setError(''); setNotice('') }}><span className="planning-module-choice__icon"><ClipboardList size={25}/></span><span className="planning-module-choice__copy"><small>Plan de acción</small><strong>Matrices</strong><p>Entra por área y trabaja la matriz de gestión.</p></span><ArrowRight size={20}/></button></div></section>}

    {step === 'guidelines' && selectedPeriod && selectedPlanningUnit && <section className="planning-panel planning-panel--wide"><PlanningGuidelines unit={{ code: selectedPlanningUnit.code, name: selectedPlanningUnit.name }} periodId={selectedPeriod.id} canManage={canManage} /></section>}

    {step === 'matrices' && selectedPeriod && selectedPlanningUnit && <section className="planning-panel planning-panel--wide"><MatrixWorkspace periodId={selectedPeriod.id} year={selectedPeriod.year} unitCode={selectedPlanningUnit.code} unitName={selectedPlanningUnit.name} canManage={canManage} onError={setError} onNotice={setNotice} onViewGuidelines={() => { setStep('guidelines'); setError(''); setNotice('') }} /></section>}
  </div>
}

function ReportsView() {
  return <div className="module-stack"><div className="reports-hero panel-card"><div><span>Reportes</span><h2>Vista consolidada</h2><p>Aquí podrás revisar el avance de todas las unidades.</p></div><FileBarChart size={56}/></div><div className="report-grid"><button className="report-card"><BarChart3 size={24}/><h3>Avance por unidad</h3><p>Compara el avance entre unidades.</p><span>Ver reporte <ArrowRight size={16}/></span></button><button className="report-card"><ClipboardList size={24}/><h3>Estado de matrices</h3><p>Revisa matrices pendientes y aprobadas.</p><span>Ver reporte <ArrowRight size={16}/></span></button><button className="report-card"><FileBarChart size={24}/><h3>Resumen ejecutivo</h3><p>Consulta la información consolidada.</p><span>Ver reporte <ArrowRight size={16}/></span></button></div></div>
}
