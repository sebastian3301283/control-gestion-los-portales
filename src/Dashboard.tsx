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
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import GuidelineGrid from './GuidelineGrid'
import CatalogConfiguration from './CatalogConfiguration'
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

type Guideline = {
  id: string
  title: string
  responsible_management: string | null
  responsible_manager: string | null
  status: string
  sort_order: number
  active: boolean
}

type Management = { id: string; name: string; active: boolean }
type Manager = { id: string; name: string; email: string | null; active: boolean }
type ManagerManagement = { manager_id: string; management_id: string }
type UnitCatalog = { managements: Management[]; managers: Manager[]; links: ManagerManagement[] }

type Section = 'inicio' | 'planificacion' | 'configuracion' | 'reportes'
type PlanningStep = 'periods' | 'units' | 'guidelines'

type PlanningEntry = {
  year: number
  unitCode: UnitAccess['code']
  token: number
} | null

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmText: string
  cancelText?: string
  busy?: boolean
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

const sectionLabels: Record<Section, string> = {
  inicio: 'Inicio',
  planificacion: 'Planificación',
  configuracion: 'Configuración',
  reportes: 'Reportes',
}

const unitOrder: UnitAccess['code'][] = ['CENTRAL', 'HU', 'DEP', 'VS', 'HOT']
const XLSX_MODULE_URL = 'https://unpkg.com/xlsx@0.18.5/xlsx.mjs'
const richFonts = ['Arial', 'Calibri', 'Verdana', 'Georgia', 'Times New Roman']
const validStatuses = new Set(['pendiente', 'enviado', 'observado', 'aprobado'])

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

function normalizeCatalogName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function splitChoiceValues(value: string | null | undefined) {
  return String(value || '')
    .split(/\s*(?:\/|;|\||\n)\s*/g)
    .map(item => item.trim())
    .filter(Boolean)
}

function levenshtein(a: string, b: string) {
  const rows = b.length + 1
  const cols = a.length + 1
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0))
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1], matrix[i][j - 1], matrix[i - 1][j]) + 1
    }
  }
  return matrix[rows - 1][cols - 1]
}

function closestOption(value: string, options: string[]) {
  if (!options.length) return ''
  const target = normalizeCatalogName(value)
  const ranked = options.map(option => ({ option, distance: levenshtein(target, normalizeCatalogName(option)) })).sort((a, b) => a.distance - b.distance)
  const best = ranked[0]
  return best && best.distance <= Math.max(2, Math.floor(target.length * .3)) ? best.option : ''
}

function safeImportedSpanStyle(element: HTMLElement) {
  const styles: string[] = []
  const weight = element.style.fontWeight.toLowerCase()
  if (weight === 'bold' || Number(weight) >= 600) styles.push('font-weight:700')
  if (element.style.fontStyle.toLowerCase() === 'italic') styles.push('font-style:italic')
  if (element.style.textDecoration.toLowerCase().includes('underline')) styles.push('text-decoration:underline')
  const family = element.style.fontFamily.replace(/["']/g, '').trim()
  if (richFonts.includes(family)) styles.push(`font-family:${family}`)
  return styles.join(';')
}

function cleanImportedRichHtml(html: string | null | undefined) {
  if (!html) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'FONT', 'SPAN', 'BR', 'DIV', 'P'])

  Array.from(doc.body.querySelectorAll('*')).forEach(element => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      return
    }

    const spanStyle = element.tagName === 'SPAN' ? safeImportedSpanStyle(element as HTMLElement) : ''
    const fontFace = element.tagName === 'FONT' ? (element.getAttribute('face') || '').replace(/["']/g, '').trim() : ''
    Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name))
    if (element.tagName === 'SPAN' && spanStyle) element.setAttribute('style', spanStyle)
    if (element.tagName === 'FONT' && richFonts.includes(fontFace)) element.setAttribute('face', fontFace)
  })

  const formatted = doc.body.querySelector('b,strong,i,em,u,font,span[style]')
  return formatted ? doc.body.innerHTML : null
}

function ConfirmDialog({ open, title, message, confirmText, cancelText = 'Cancelar', busy = false, danger = false, onCancel, onConfirm }: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="cg-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !busy) onCancel() }}>
      <div className="cg-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="cg-confirm-title">
        <button className="cg-modal-close" type="button" onClick={onCancel} disabled={busy} aria-label="Cerrar"><X size={18}/></button>
        <div className="cg-confirm-icon">{danger ? <Trash2 size={23}/> : <LogOut size={23}/>}</div>
        <h3 id="cg-confirm-title">{title}</h3>
        <p>{message}</p>
        <div className="cg-modal-actions">
          <button type="button" className="cg-modal-secondary" onClick={onCancel} disabled={busy}>{cancelText}</button>
          <button type="button" className={`cg-modal-primary ${danger ? 'cg-modal-danger' : ''}`} onClick={() => void onConfirm()} disabled={busy}>{busy && <LoaderCircle className="spin" size={16}/>} {confirmText}</button>
        </div>
      </div>
    </div>
  )
}

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

  function openLineamientos(unitCode: UnitAccess['code']) {
    setPlanningEntry({ year: selectedHomeYear, unitCode, token: Date.now() })
    setSection('planificacion')
    setSelectedUnit(unitCode)
  }

  function requestSignOut() {
    setProfileOpen(false)
    setLogoutConfirmOpen(true)
  }

  async function confirmSignOut() {
    setLogoutBusy(true)
    try { await onSignOut() }
    finally {
      setLogoutBusy(false)
      setLogoutConfirmOpen(false)
    }
  }

  const selectedHomeUnit = units.find(unit => unit.code === selectedUnit) || null

  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-sidebar ${menuOpen ? 'dashboard-sidebar--open' : ''}`}>
        <div className="dashboard-sidebar__head"><BrandMark /><button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
        <nav className="dashboard-nav" aria-label="Navegación principal">
          <span className="dashboard-nav__label">Menú</span>
          <button className={section === 'inicio' ? 'active' : ''} onClick={() => navigate('inicio')}><LayoutDashboard size={19}/><span>Inicio</span></button>
          <button className={section === 'planificacion' ? 'active' : ''} onClick={() => navigate('planificacion')}><ClipboardList size={19}/><span>Planificación</span></button>
          <button className={section === 'configuracion' ? 'active' : ''} onClick={() => navigate('configuracion')}><Settings size={19}/><span>Configuración</span></button>
          <button className={section === 'reportes' ? 'active' : ''} onClick={() => navigate('reportes')}><BarChart3 size={19}/><span>Reportes</span></button>
        </nav>
        <div className="dashboard-sidebar__bottom">
          <div className="sidebar-access"><ShieldCheck size={18}/><div><strong>{roleLabel(access)}</strong><small>{access.global_access ? 'Acceso a todas las unidades' : 'Acceso por unidad'}</small></div></div>
          <button className="sidebar-logout" onClick={requestSignOut}><LogOut size={18}/> Cerrar sesión</button>
        </div>
      </aside>

      {menuOpen && <button className="dashboard-overlay" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={22}/></button><div className="dashboard-search"><Search size={18}/><input aria-label="Buscar" placeholder="Buscar" /></div></div>
          <div className="topbar-actions profile-menu-wrap">
            <button className="icon-button" aria-label="Notificaciones"><Bell size={19}/><span className="notification-dot" /></button>
            <button className={`profile-chip ${profileOpen ? 'profile-chip--open' : ''}`} onClick={() => setProfileOpen(value => !value)}><span className="profile-avatar">{initials(access)}</span><span className="profile-copy"><strong>{displayName}</strong><small>{roleLabel(access)}</small></span><ChevronDown className={profileOpen ? 'chevron-open' : ''} size={16}/></button>
            {profileOpen && <div className="profile-dropdown"><div><strong>{displayName}</strong><small>{access.email}</small></div><span>{roleLabel(access)}</span><button onClick={requestSignOut}><LogOut size={16}/> Cerrar sesión</button></div>}
          </div>
        </header>

        <main className="dashboard-content">
          {section === 'inicio' ? (
            <HomeView access={access} displayName={displayName} today={today} units={units} selectedUnit={selectedUnit} selectedHomeUnit={selectedHomeUnit} setSelectedUnit={setSelectedUnit} navigate={navigate} periods={periods} selectedYear={selectedHomeYear} setSelectedYear={setSelectedHomeYear} openLineamientos={openLineamientos} />
          ) : (
            <>
              <div className="page-heading compact-heading"><div><span className="page-kicker">{sectionLabels[section]}</span><h1>{sectionLabels[section]}</h1><p>{sectionDescription(section)}</p></div></div>
              {section === 'planificacion' && <PlanningView key={planningEntry ? `${planningEntry.year}-${planningEntry.unitCode}-${planningEntry.token}` : 'planning-default'} access={access} units={units} initialYear={planningEntry?.year} initialUnitCode={planningEntry?.unitCode} onPeriodsChanged={loadDashboardPeriods} />}
              {section === 'configuracion' && <ConfigurationView access={access} units={units} />}
              {section === 'reportes' && <ReportsView />}
            </>
          )}
        </main>
      </div>

      <ConfirmDialog open={logoutConfirmOpen} title="¿Cerrar sesión?" message="Tu sesión actual se cerrará y tendrás que volver a ingresar para continuar." confirmText="Sí, cerrar sesión" busy={logoutBusy} onCancel={() => setLogoutConfirmOpen(false)} onConfirm={confirmSignOut} />
    </div>
  )
}

function HomeView({ access, displayName, today, units, selectedUnit, selectedHomeUnit, setSelectedUnit, navigate, periods, selectedYear, setSelectedYear, openLineamientos }: {
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
  openLineamientos: (unit: UnitAccess['code']) => void
}) {
  return (
    <>
      <section className="welcome-card">
        <div className="welcome-copy"><span className="welcome-kicker"><Sparkles size={15}/> Todo listo</span><h1>Hola, {displayName} 👋</h1><p>Elige una opción y empieza a trabajar.</p><div className="welcome-meta"><span><CalendarDays size={16}/> {today}</span><span><ShieldCheck size={16}/> {roleLabel(access)}</span></div></div>
        <div className="welcome-period"><span>Periodo</span><strong>{selectedYear}</strong><label className="period-select-control"><CalendarDays size={16}/><select value={selectedYear} onChange={event => setSelectedYear(Number(event.target.value))} aria-label="Cambiar periodo">{periods.map(period => <option key={period.id} value={period.year}>{period.year} · {period.status === 'OPEN' ? 'Actual' : period.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}</option>)}</select><ChevronDown size={15}/></label></div>
      </section>

      <section className="dashboard-section action-section">
        <div className="section-title-row"><div><span>Accesos rápidos</span><h2>¿Qué quieres hacer?</h2></div></div>
        <div className="friendly-actions">
          <button className="friendly-action friendly-action--planning" onClick={() => navigate('planificacion')}><span className="friendly-action__icon"><ClipboardList size={25}/></span><span className="friendly-action__copy"><strong>Planificar</strong><small>Periodos y lineamientos</small></span><ArrowRight size={19}/></button>
          <button className="friendly-action friendly-action--settings" onClick={() => navigate('configuracion')}><span className="friendly-action__icon"><SlidersHorizontal size={25}/></span><span className="friendly-action__copy"><strong>Configurar</strong><small>Gerencias y responsables</small></span><ArrowRight size={19}/></button>
          <button className="friendly-action friendly-action--reports" onClick={() => navigate('reportes')}><span className="friendly-action__icon"><FileBarChart size={25}/></span><span className="friendly-action__copy"><strong>Ver reportes</strong><small>Avance y resultados</small></span><ArrowRight size={19}/></button>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-title-row"><div><span>Unidades</span><h2>¿Dónde quieres entrar?</h2></div>{selectedUnit !== 'TODAS' && <button className="text-action" onClick={() => setSelectedUnit('TODAS')}>Ver todas <ArrowRight size={16}/></button>}</div>
        <div className="unit-grid friendly-unit-grid">
          {units.map(unit => <button key={unit.code} className={`unit-card unit-card--${unit.code.toLowerCase()} ${selectedUnit === unit.code ? 'selected' : ''}`} onClick={() => setSelectedUnit(unit.code)}><div className="unit-card__top"><span className="unit-code">{unit.code}</span></div><div className="unit-icon"><Building2 size={26}/></div><h3>{unit.name}</h3><p>{unit.unit_role === 'GLOBAL' ? 'Acceso completo' : unit.unit_role === 'GERENTE_UNIDAD' ? 'Gerente de Unidad' : 'Equipo encargado'}</p><span className="unit-link">Entrar <ArrowRight size={16}/></span></button>)}
        </div>
      </section>

      {selectedHomeUnit && <section className="dashboard-section unit-module-section"><div className="section-title-row"><div><span>{selectedHomeUnit.name}</span><h2>¿Qué quieres revisar?</h2></div></div><div className="unit-module-grid"><button className={`unit-module-card unit-module-card--${selectedHomeUnit.code.toLowerCase()}`} onClick={() => openLineamientos(selectedHomeUnit.code)}><span className="unit-module-icon"><ClipboardList size={28}/></span><div><small>Periodo {selectedYear}</small><strong>Lineamientos</strong><p>Ver los lineamientos escritos o importados desde Excel.</p></div><ArrowRight size={20}/></button></div></section>}
    </>
  )
}

function sectionDescription(section: Section) {
  if (section === 'planificacion') return 'Periodo → unidad → lineamientos.'
  if (section === 'configuracion') return 'Administra los catálogos que alimentan la planificación.'
  return 'Consulta el avance y los resultados de gestión.'
}

function PlanningView({ access, units, initialYear, initialUnitCode, onPeriodsChanged }: {
  access: DashboardAccess
  units: UnitAccess[]
  initialYear?: number
  initialUnitCode?: UnitAccess['code']
  onPeriodsChanged: () => void | Promise<void>
}) {
  const [step, setStep] = useState<PlanningStep>('periods')
  const [periods, setPeriods] = useState<PlanningPeriod[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<PlanningPeriod | null>(null)
  const [selectedPlanningUnit, setSelectedPlanningUnit] = useState<UnitAccess | null>(null)
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [catalog, setCatalog] = useState<UnitCatalog>({ managements: [], managers: [], links: [] })
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
  const [editingPeriod, setEditingPeriod] = useState<PlanningPeriod | null>(null)
  const [editPeriodYear, setEditPeriodYear] = useState('')
  const [editPeriodStatus, setEditPeriodStatus] = useState<PlanningPeriod['status']>('DRAFT')
  const [saving, setSaving] = useState(false)
  const [excelBusy, setExcelBusy] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)

  const canManage = access.global_role === 'GESTION_ESTRATEGICA'
  const selectedManagement = catalog.managements.find(item => item.name === responsibleManagement)
  const managerOptions = useMemo(() => {
    if (!selectedManagement) return []
    const ids = new Set(catalog.links.filter(link => link.management_id === selectedManagement.id).map(link => link.manager_id))
    return catalog.managers.filter(manager => manager.active && ids.has(manager.id))
  }, [catalog, selectedManagement])

  useEffect(() => { void loadPeriods() }, [])

  useEffect(() => {
    if (!initialYear || !initialUnitCode || periods.length === 0) return
    const period = periods.find(item => item.year === initialYear)
    const unit = units.find(item => item.code === initialUnitCode)
    if (!period || !unit) return
    setSelectedPeriod(period)
    setSelectedPlanningUnit(unit)
    setStep('guidelines')
  }, [periods, initialYear, initialUnitCode, units])

  useEffect(() => {
    if (step === 'guidelines' && selectedPeriod && selectedPlanningUnit) {
      void loadGuidelines(selectedPeriod.id, selectedPlanningUnit.code)
      void loadUnitCatalog(selectedPlanningUnit.code).then(setCatalog)
    }
  }, [step, selectedPeriod, selectedPlanningUnit])

  async function loadPeriods() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase.from('planning_periods').select('id, year, name, status').order('year', { ascending: true })
    setLoading(false)
    if (queryError) { setError('No pudimos cargar los periodos.'); return }
    setPeriods((data || []) as PlanningPeriod[])
  }

  async function loadGuidelines(periodId: string, unitCode: UnitAccess['code']) {
    if (!supabase) return
    setGuidelinesLoading(true)
    setError('')
    const { data, error: queryError } = await supabase.from('guidelines').select('id, title, responsible_management, responsible_manager, status, sort_order, active').eq('period_id', periodId).eq('unit_code', unitCode).eq('active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    setGuidelinesLoading(false)
    if (queryError) { setError('No pudimos cargar los lineamientos.'); return }
    setGuidelines((data || []) as Guideline[])
  }

  async function loadUnitCatalog(unitCode: UnitAccess['code']): Promise<UnitCatalog> {
    if (!supabase) return { managements: [], managers: [], links: [] }
    const [managementResult, managerResult, linkResult] = await Promise.all([
      supabase.from('managements').select('id, name, active').eq('unit_code', unitCode).eq('active', true).order('name'),
      supabase.from('managers').select('id, name, email, active').eq('active', true).order('name'),
      supabase.from('manager_managements').select('manager_id, management_id'),
    ])
    if (managementResult.error || managerResult.error || linkResult.error) throw new Error('CATALOG_LOAD')
    return {
      managements: (managementResult.data || []) as Management[],
      managers: (managerResult.data || []) as Manager[],
      links: (linkResult.data || []) as ManagerManagement[],
    }
  }

  async function createPeriod(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage) return
    const year = Number(newYear)
    if (!Number.isInteger(year) || year < 2020 || year > 2100) { setError('Ingresa un año válido.'); return }
    setSaving(true); setError(''); setNotice('')
    const { error: insertError } = await supabase.from('planning_periods').insert({ year, name: `Periodo ${year}`, status: 'DRAFT' })
    setSaving(false)
    if (insertError) { setError(insertError.code === '23505' ? 'Ese periodo ya existe.' : 'No pudimos crear el periodo.'); return }
    setNewYear(''); setShowPeriodForm(false); await loadPeriods(); await onPeriodsChanged()
  }

  function startEditPeriod(period: PlanningPeriod) {
    setEditingPeriod(period)
    setEditPeriodYear(String(period.year))
    setEditPeriodStatus(period.status)
    setError('')
    setNotice('')
  }

  async function updatePeriod(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage || !editingPeriod) return
    const year = Number(editPeriodYear)
    if (!Number.isInteger(year) || year < 2020 || year > 2100) { setError('Ingresa un año válido.'); return }
    setSaving(true); setError(''); setNotice('')
    if (editPeriodStatus === 'OPEN') {
      const { error: resetError } = await supabase.from('planning_periods').update({ status: 'DRAFT' }).neq('id', editingPeriod.id).eq('status', 'OPEN')
      if (resetError) { setSaving(false); setError('No pudimos actualizar el periodo actual.'); return }
    }
    const { error: updateError } = await supabase.from('planning_periods').update({ year, name: `Periodo ${year}`, status: editPeriodStatus }).eq('id', editingPeriod.id)
    setSaving(false)
    if (updateError) { setError(updateError.code === '23505' ? 'Ese año ya existe.' : 'No pudimos actualizar el periodo.'); return }
    setEditingPeriod(null); setNotice(`Periodo ${year} actualizado.`); await loadPeriods(); await onPeriodsChanged()
  }

  async function createGuideline(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !canManage || !selectedPeriod || !selectedPlanningUnit) return
    const title = guidelineTitle.trim()
    if (!title) { setError('Escribe el lineamiento estratégico.'); return }
    if (responsibleManager && !responsibleManagement) { setError('Selecciona primero una gerencia responsable.'); return }
    setSaving(true); setError(''); setNotice('')
    const { error: insertError } = await supabase.from('guidelines').insert({ period_id: selectedPeriod.id, unit_code: selectedPlanningUnit.code, title, responsible_management: responsibleManagement || null, responsible_manager: responsibleManager || null, status: guidelineStatus, sort_order: guidelines.length })
    setSaving(false)
    if (insertError) {
      setError(insertError.message.includes('CONFIGURATION_VALIDATION') ? insertError.message : 'No pudimos guardar el lineamiento. Revisa la configuración de gerencias y responsables.')
      return
    }
    setGuidelineTitle(''); setResponsibleManagement(''); setResponsibleManager(''); setGuidelineStatus('pendiente'); setShowGuidelineForm(false); setNotice('Lineamiento guardado correctamente.'); await loadGuidelines(selectedPeriod.id, selectedPlanningUnit.code)
  }

  function validateImportedRows(rows: Array<{ rowNumber: number; responsible_management: string | null; responsible_manager: string | null; status: string }>, unitCatalog: UnitCatalog) {
    const errors: string[] = []
    const managementMap = new Map(unitCatalog.managements.map(item => [normalizeCatalogName(item.name), item]))
    const managerMap = new Map(unitCatalog.managers.map(item => [normalizeCatalogName(item.name), item]))
    const managementNames = unitCatalog.managements.map(item => item.name)
    const managerNames = unitCatalog.managers.map(item => item.name)

    rows.forEach(row => {
      const selectedManagementIds: string[] = []
      splitChoiceValues(row.responsible_management).forEach(name => {
        const match = managementMap.get(normalizeCatalogName(name))
        if (!match) {
          const suggestion = closestOption(name, managementNames)
          errors.push(`Fila ${row.rowNumber}: gerencia “${name}” no registrada${suggestion ? ` (¿quisiste decir “${suggestion}”?)` : ''}.`)
        } else selectedManagementIds.push(match.id)
      })

      splitChoiceValues(row.responsible_manager).forEach(name => {
        const match = managerMap.get(normalizeCatalogName(name))
        if (!match) {
          const suggestion = closestOption(name, managerNames)
          errors.push(`Fila ${row.rowNumber}: responsable “${name}” no registrado${suggestion ? ` (¿quisiste decir “${suggestion}”?)` : ''}.`)
          return
        }
        if (!selectedManagementIds.length) {
          errors.push(`Fila ${row.rowNumber}: “${name}” necesita una gerencia responsable.`)
          return
        }
        const related = unitCatalog.links.some(link => link.manager_id === match.id && selectedManagementIds.includes(link.management_id))
        if (!related) errors.push(`Fila ${row.rowNumber}: “${name}” no pertenece a la gerencia indicada.`)
      })

      if (!validStatuses.has(row.status)) errors.push(`Fila ${row.rowNumber}: estatus “${row.status}” no válido.`)
    })
    return errors
  }

  async function importGuidelinesFromExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !supabase || !canManage || !selectedPeriod || !selectedPlanningUnit) return
    setExcelBusy(true); setError(''); setNotice('')
    try {
      const XLSX = await loadSpreadsheetLibrary()
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellHTML: true, cellStyles: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]
      const headerRowIndex = matrix.findIndex(row => row.some(cell => ['lineamientosestrategicos', 'lineamientoestrategico', 'lineamientos'].includes(normalizeHeader(cell))))
      if (headerRowIndex < 0) throw new Error('HEADER_NOT_FOUND')
      const headers = matrix[headerRowIndex].map(normalizeHeader)
      const findColumn = (...aliases: string[]) => headers.findIndex(header => aliases.includes(header))
      const lineamientoIndex = findColumn('lineamientosestrategicos', 'lineamientoestrategico', 'lineamientos', 'lineamiento')
      const gerenciaIndex = findColumn('gerenciaresponsable', 'arearesponsable')
      const gerenteIndex = findColumn('gerenteresponsable', 'responsable')
      const statusIndex = findColumn('estatus', 'estado', 'status')
      if (lineamientoIndex < 0) throw new Error('HEADER_NOT_FOUND')

      const parsedRows = matrix.slice(headerRowIndex + 1).map((row, rowOffset) => {
        const title = String(row[lineamientoIndex] ?? '').trim()
        const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex + 1 + rowOffset, c: lineamientoIndex })
        const sourceCell = sheet[cellAddress] as { h?: string } | undefined
        return {
          rowNumber: headerRowIndex + 2 + rowOffset,
          title,
          title_html: cleanImportedRichHtml(sourceCell?.h),
          responsible_management: gerenciaIndex >= 0 ? String(row[gerenciaIndex] ?? '').trim() || null : null,
          responsible_manager: gerenteIndex >= 0 ? String(row[gerenteIndex] ?? '').trim() || null : null,
          status: statusIndex >= 0 ? String(row[statusIndex] ?? '').trim().toLowerCase() || 'pendiente' : 'pendiente',
        }
      }).filter(row => row.title).slice(0, 500)

      if (parsedRows.length === 0) throw new Error('NO_ROWS')
      const freshCatalog = await loadUnitCatalog(selectedPlanningUnit.code)
      const validationErrors = validateImportedRows(parsedRows, freshCatalog)
      if (validationErrors.length) {
        setError(`Excel no importado. Corrige primero: ${validationErrors.slice(0, 6).join(' · ')}${validationErrors.length > 6 ? ` · y ${validationErrors.length - 6} error(es) más.` : ''}`)
        return
      }

      if (guidelines.length > 0 && !window.confirm('Ya existen lineamientos en esta unidad. Los registros validados del Excel se agregarán a los actuales. ¿Deseas continuar?')) return

      const payload = parsedRows.map((row, index) => ({ period_id: selectedPeriod.id, unit_code: selectedPlanningUnit.code, title: row.title, title_html: row.title_html, responsible_management: row.responsible_management, responsible_manager: row.responsible_manager, status: row.status, sort_order: guidelines.length + index }))
      const { error: insertError } = await supabase.from('guidelines').insert(payload)
      if (insertError) throw insertError
      await loadGuidelines(selectedPeriod.id, selectedPlanningUnit.code)
      const formattedCount = payload.filter(row => row.title_html).length
      setNotice(`${payload.length} lineamiento${payload.length === 1 ? '' : 's'} importado${payload.length === 1 ? '' : 's'} y validado${payload.length === 1 ? '' : 's'} correctamente${formattedCount ? `; formato conservado en ${formattedCount}` : ''}.`)
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : ''
      if (message === 'HEADER_NOT_FOUND') setError('No encontramos la columna “Lineamientos Estratégicos”.')
      else if (message === 'NO_ROWS') setError('El Excel no contiene lineamientos para importar.')
      else if (message === 'CATALOG_LOAD') setError('No pudimos cargar el catálogo para validar el Excel.')
      else setError(`No pudimos importar el Excel${message ? `: ${message}` : '.'}`)
    } finally { setExcelBusy(false) }
  }

  async function exportGuidelinesToExcel() {
    if (!selectedPeriod || !selectedPlanningUnit) return
    setExcelBusy(true); setError(''); setNotice('')
    try {
      const XLSX = await loadSpreadsheetLibrary()
      const rows = guidelines.map((guideline, index) => ({ 'N°': index + 1, 'Lineamientos Estratégicos': guideline.title, 'Gerencia Responsable': guideline.responsible_management || '', 'Gerente Responsable': guideline.responsible_manager || '', 'Estatus': guideline.status || 'pendiente' }))
      const headers = ['N°', 'Lineamientos Estratégicos', 'Gerencia Responsable', 'Gerente Responsable', 'Estatus']
      const worksheet = rows.length ? XLSX.utils.json_to_sheet(rows, { header: headers }) : XLSX.utils.aoa_to_sheet([headers])
      worksheet['!cols'] = [{ wch: 6 }, { wch: 70 }, { wch: 28 }, { wch: 28 }, { wch: 16 }]
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Lineamientos'); XLSX.writeFile(workbook, `Lineamientos_${selectedPlanningUnit.code}_${selectedPeriod.year}.xlsx`); setNotice('Excel generado correctamente.')
    } catch { setError('No pudimos generar el Excel.') }
    finally { setExcelBusy(false) }
  }

  async function clearGuidelines() {
    if (!supabase || !selectedPeriod || !selectedPlanningUnit || !canManage) return
    setClearBusy(true)
    setError('')
    const { error: deleteError } = await supabase.from('guidelines').delete().eq('period_id', selectedPeriod.id).eq('unit_code', selectedPlanningUnit.code)
    setClearBusy(false)
    setClearConfirmOpen(false)
    if (deleteError) { setError('No pudimos eliminar los lineamientos.'); return }
    setNotice('Todos los lineamientos de esta unidad y periodo fueron eliminados.')
    await loadGuidelines(selectedPeriod.id, selectedPlanningUnit.code)
  }

  function selectPeriod(period: PlanningPeriod) { setSelectedPeriod(period); setSelectedPlanningUnit(null); setStep('units'); setError(''); setNotice('') }
  function selectUnit(unit: UnitAccess) { setSelectedPlanningUnit(unit); setStep('guidelines'); setError(''); setNotice('') }
  function goBack() { setError(''); setNotice(''); if (step === 'guidelines') { setStep('units'); setSelectedPlanningUnit(null); return } if (step === 'units') { setStep('periods'); setSelectedPeriod(null) } }

  return (
    <>
      <div className="planning-flow">
        <div className="planning-breadcrumbs"><button className={step === 'periods' ? 'current' : ''} onClick={() => { setStep('periods'); setSelectedPeriod(null); setSelectedPlanningUnit(null) }}>1. Periodo</button><span>→</span><button className={step === 'units' ? 'current' : ''} disabled={!selectedPeriod} onClick={() => selectedPeriod && setStep('units')}>2. Unidad</button><span>→</span><button className={step === 'guidelines' ? 'current' : ''} disabled={!selectedPeriod || !selectedPlanningUnit}>3. Lineamientos</button></div>
        {step !== 'periods' && <button className="planning-back" onClick={goBack}><ArrowLeft size={17}/> Volver</button>}
        {error && <div className="planning-message">{error}</div>}
        {notice && <div className="planning-message planning-message--success">{notice}</div>}

        {step === 'periods' && <section className="planning-panel">
          <div className="planning-title-row"><div><span>Paso 1</span><h2>Elige el periodo</h2><p>Selecciona el año que quieres gestionar.</p></div>{canManage && <button className="planning-primary" onClick={() => setShowPeriodForm(value => !value)}><Plus size={17}/> Nuevo periodo</button>}</div>
          {showPeriodForm && <form className="planning-inline-form" onSubmit={createPeriod}><label>Año<input inputMode="numeric" maxLength={4} value={newYear} onChange={event => setNewYear(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="2030" /></label><button className="planning-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17}/> : <Plus size={17}/>} Crear</button><button type="button" className="planning-secondary" onClick={() => setShowPeriodForm(false)}>Cancelar</button></form>}
          {loading ? <div className="planning-loading"><LoaderCircle className="spin" size={24}/> Cargando periodos...</div> : <div className="planning-period-grid">{periods.map(period => <div className={`planning-period-card-shell ${period.status === 'OPEN' ? 'open' : ''}`} key={period.id}><button className="planning-period-card planning-period-card--inside" onClick={() => selectPeriod(period)}><span className="planning-period-icon"><CalendarDays size={24}/></span><div><small>{period.status === 'OPEN' ? 'Periodo actual' : period.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}</small><strong>{period.year}</strong></div><ArrowRight size={19}/></button>{canManage && <button className="period-edit" title={`Editar ${period.year}`} onClick={() => startEditPeriod(period)}><Pencil size={14}/><span>Editar</span></button>}</div>)}</div>}
        </section>}

        {step === 'units' && selectedPeriod && <section className="planning-panel"><div className="planning-title-row"><div><span>Paso 2 · {selectedPeriod.year}</span><h2>Elige una unidad</h2><p>Selecciona una unidad para revisar sus lineamientos.</p></div></div><div className="planning-unit-grid">{units.map(unit => <button key={unit.code} className={`planning-unit-card planning-unit-card--${unit.code.toLowerCase()}`} onClick={() => selectUnit(unit)}><span className="planning-unit-icon"><Building2 size={27}/></span><div><small>{unit.code}</small><strong>{unit.name}</strong></div><ArrowRight size={19}/></button>)}</div></section>}

        {step === 'guidelines' && selectedPeriod && selectedPlanningUnit && <section className="planning-panel planning-panel--wide">
          <div className="planning-title-row">
            <div><span>Paso 3 · {selectedPeriod.year} · {selectedPlanningUnit.code}</span><h2>Lineamientos de {selectedPlanningUnit.name}</h2><p>Gerencias y responsables se seleccionan desde Configuración. Los Excel se validan antes de importarse.</p></div>
            <div className="guideline-actions">
              <button className="planning-secondary" type="button" onClick={() => void exportGuidelinesToExcel()} disabled={excelBusy}>{excelBusy ? <LoaderCircle className="spin" size={17}/> : <Download size={17}/>} Exportar Excel</button>
              {canManage && <label className={`planning-secondary planning-file-button ${excelBusy ? 'disabled' : ''}`}><Upload size={17}/> Subir Excel<input type="file" accept=".xlsx,.xls" onChange={importGuidelinesFromExcel} disabled={excelBusy} /></label>}
              {canManage && guidelines.length > 0 && <button className="planning-danger" type="button" onClick={() => setClearConfirmOpen(true)}><Trash2 size={16}/> Eliminar todos</button>}
              {canManage && <button className="planning-primary" onClick={() => setShowGuidelineForm(value => !value)}><Plus size={17}/> Nuevo lineamiento</button>}
            </div>
          </div>

          {showGuidelineForm && <form className="guideline-form guideline-form--table" onSubmit={createGuideline}>
            <label className="guideline-form__wide">Lineamiento estratégico<textarea rows={3} value={guidelineTitle} onChange={event => setGuidelineTitle(event.target.value)} placeholder="Escribe el lineamiento estratégico" /></label>
            <label>Gerencia Responsable<select value={responsibleManagement} onChange={event => { setResponsibleManagement(event.target.value); setResponsibleManager('') }}><option value="">Seleccionar gerencia</option>{catalog.managements.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
            <label>Gerente Responsable<select value={responsibleManager} disabled={!responsibleManagement} onChange={event => setResponsibleManager(event.target.value)}><option value="">Seleccionar responsable</option>{managerOptions.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
            <label>Estatus<select value={guidelineStatus} onChange={event => setGuidelineStatus(event.target.value)}><option value="pendiente">Pendiente</option><option value="enviado">Enviado</option><option value="observado">Observado</option><option value="aprobado">Aprobado</option></select></label>
            {catalog.managements.length === 0 && <div className="guideline-catalog-warning">Primero registra las gerencias y responsables en Configuración.</div>}
            <div className="guideline-form__actions"><button className="planning-primary" disabled={saving || !guidelineTitle.trim()}>{saving ? <LoaderCircle className="spin" size={17}/> : <Plus size={17}/>} Guardar lineamiento</button><button type="button" className="planning-secondary" onClick={() => setShowGuidelineForm(false)}>Cancelar</button></div>
          </form>}

          {guidelinesLoading ? <div className="planning-loading"><LoaderCircle className="spin" size={24}/> Cargando lineamientos...</div> : guidelines.length === 0 ? <div className="planning-empty"><span><ClipboardList size={30}/></span><h3>Aún no hay lineamientos</h3><p>{canManage ? 'Puedes crear el primero manualmente o subir un Excel validado contra Configuración.' : 'Gestión Estratégica todavía no ha registrado lineamientos.'}</p>{canManage && <div className="planning-empty__actions"><button className="planning-primary" onClick={() => setShowGuidelineForm(true)}><Plus size={17}/> Crear lineamiento</button><label className="planning-secondary planning-file-button"><Upload size={17}/> Subir Excel<input type="file" accept=".xlsx,.xls" onChange={importGuidelinesFromExcel} /></label></div>}</div> : <GuidelineGrid guidelines={guidelines} unitCode={selectedPlanningUnit.code} canManage={canManage} onChanged={() => loadGuidelines(selectedPeriod.id, selectedPlanningUnit.code)} onError={setError} onNotice={setNotice} />}
        </section>}
      </div>

      {editingPeriod && <div className="cg-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !saving) setEditingPeriod(null) }}><div className="cg-edit-dialog cg-period-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-period-title"><button className="cg-modal-close" type="button" onClick={() => setEditingPeriod(null)} disabled={saving} aria-label="Cerrar"><X size={18}/></button><div className="cg-edit-heading"><span><Pencil size={18}/></span><div><small>Editar periodo</small><h3 id="edit-period-title">Periodo {editingPeriod.year}</h3></div></div><form className="cg-edit-form" onSubmit={updatePeriod}><label>Año<input inputMode="numeric" maxLength={4} value={editPeriodYear} onChange={event => setEditPeriodYear(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label><label>Estado<select value={editPeriodStatus} onChange={event => setEditPeriodStatus(event.target.value as PlanningPeriod['status'])}><option value="DRAFT">Borrador</option><option value="OPEN">Periodo actual</option><option value="CLOSED">Cerrado</option></select></label><div className="cg-modal-actions"><button type="button" className="cg-modal-secondary" onClick={() => setEditingPeriod(null)} disabled={saving}>Cancelar</button><button type="submit" className="cg-modal-primary" disabled={saving || editPeriodYear.length !== 4}>{saving && <LoaderCircle className="spin" size={16}/>} Guardar cambios</button></div></form></div></div>}

      <ConfirmDialog open={clearConfirmOpen} title="¿Eliminar todos los lineamientos?" message={`Se eliminarán los ${guidelines.length} lineamientos de ${selectedPlanningUnit?.name || 'esta unidad'} del periodo ${selectedPeriod?.year || ''}. Las demás unidades y periodos no se modificarán.`} confirmText="Sí, eliminar todos" danger busy={clearBusy} onCancel={() => setClearConfirmOpen(false)} onConfirm={clearGuidelines} />
    </>
  )
}

function ConfigurationView({ access, units }: { access: DashboardAccess; units: UnitAccess[] }) {
  return <CatalogConfiguration units={units.map(unit => ({ code: unit.code, name: unit.name }))} canManage={access.global_role === 'GESTION_ESTRATEGICA'} />
}

function ReportsView() {
  return <div className="module-stack"><div className="reports-hero panel-card"><div><span>Reportes</span><h2>Vista consolidada</h2><p>Aquí podrás revisar el avance de todas las unidades.</p></div><FileBarChart size={56}/></div><div className="report-grid"><button className="report-card"><BarChart3 size={24}/><h3>Avance por unidad</h3><p>Compara el avance entre unidades.</p><span>Ver reporte <ArrowRight size={16}/></span></button><button className="report-card"><ClipboardList size={24}/><h3>Estado de matrices</h3><p>Revisa matrices pendientes y aprobadas.</p><span>Ver reporte <ArrowRight size={16}/></span></button><button className="report-card"><FileBarChart size={24}/><h3>Resumen ejecutivo</h3><p>Consulta la información consolidada.</p><span>Ver reporte <ArrowRight size={16}/></span></button></div></div>
}
