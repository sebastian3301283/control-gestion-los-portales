import { useMemo, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react'
import './dashboard.css'

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

type Section = 'inicio' | 'planificacion' | 'configuracion' | 'reportes'

const sectionLabels: Record<Section, string> = {
  inicio: 'Inicio',
  planificacion: 'Planificación',
  configuracion: 'Configuración',
  reportes: 'Reportes',
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

function initials(access: DashboardAccess) {
  const source = access.full_name?.trim() || access.email.split('@')[0]
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'CG'
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

  const displayName = access.full_name || access.email.split('@')[0]
  const units = access.units || []

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
          <span className="dashboard-nav__label">MENÚ PRINCIPAL</span>
          <button className={section === 'inicio' ? 'active' : ''} onClick={() => navigate('inicio')}><LayoutDashboard size={19}/><span>Inicio</span></button>
          <button className={section === 'planificacion' ? 'active' : ''} onClick={() => navigate('planificacion')}><ClipboardList size={19}/><span>Planificación</span></button>
          <button className={section === 'configuracion' ? 'active' : ''} onClick={() => navigate('configuracion')}><Settings size={19}/><span>Configuración</span></button>
          <button className={section === 'reportes' ? 'active' : ''} onClick={() => navigate('reportes')}><BarChart3 size={19}/><span>Reportes</span></button>
        </nav>

        <div className="dashboard-sidebar__bottom">
          <div className="sidebar-access"><ShieldCheck size={18}/><div><strong>{roleLabel(access)}</strong><small>{access.global_access ? 'Acceso global' : 'Acceso por unidad'}</small></div></div>
          <button className="sidebar-logout" onClick={onSignOut}><LogOut size={18}/> Cerrar sesión</button>
        </div>
      </aside>

      {menuOpen && <button className="dashboard-overlay" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={22}/></button>
            <div className="dashboard-search"><Search size={18}/><input aria-label="Buscar" placeholder="Buscar en Control de Gestión" /></div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notificaciones"><Bell size={19}/><span className="notification-dot" /></button>
            <button className="profile-chip"><span className="profile-avatar">{initials(access)}</span><span className="profile-copy"><strong>{displayName}</strong><small>{roleLabel(access)}</small></span><ChevronDown size={16}/></button>
          </div>
        </header>

        <main className="dashboard-content">
          <div className="page-heading">
            <div>
              <span className="page-kicker">{sectionLabels[section].toUpperCase()}</span>
              <h1>{section === 'inicio' ? `Hola, ${displayName}` : sectionLabels[section]}</h1>
              <p>{section === 'inicio' ? `Vista general de Control de Gestión · ${today}` : sectionDescription(section)}</p>
            </div>
            {section === 'inicio' && <button className="period-button"><CalendarDays size={17}/> Periodo 2026 <ChevronDown size={16}/></button>}
          </div>

          {section === 'inicio' && (
            <>
              <section className="summary-grid" aria-label="Resumen de acceso">
                <SummaryCard icon={<Building2/>} label="Unidades habilitadas" value={String(units.length)} detail={access.global_access ? 'Acceso a todas las unidades' : 'Según tus permisos'} />
                <SummaryCard icon={<ShieldCheck/>} label="Perfil actual" value={roleLabel(access)} detail="Permisos validados" compact />
                <SummaryCard icon={<CalendarDays/>} label="Periodo de trabajo" value="2026" detail="Periodo seleccionado" />
                <SummaryCard icon={<ClipboardList/>} label="Módulo principal" value="Planificación" detail="Listo para configurar" compact />
              </section>

              <section className="dashboard-section">
                <div className="section-title-row">
                  <div><span>UNIDADES DE NEGOCIO</span><h2>Selecciona una unidad</h2></div>
                  <button className="text-action" onClick={() => setSelectedUnit('TODAS')}>Ver todas <ArrowRight size={16}/></button>
                </div>
                <div className="unit-grid">
                  {units.map((unit, index) => (
                    <button key={unit.code} className={`unit-card ${selectedUnit === unit.code ? 'selected' : ''}`} onClick={() => setSelectedUnit(unit.code)}>
                      <div className="unit-card__top"><span className="unit-number">0{index + 1}</span><span className="unit-code">{unit.code}</span></div>
                      <div className="unit-icon"><Building2 size={24}/></div>
                      <h3>{unit.name}</h3>
                      <p>{unit.unit_role === 'GLOBAL' ? 'Acceso global de Gestión Estratégica' : unit.unit_role === 'GERENTE_UNIDAD' ? 'Gerente de Unidad' : 'Equipo encargado'}</p>
                      <span className="unit-link">Abrir unidad <ArrowRight size={16}/></span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="dashboard-lower-grid">
                <div className="panel-card quick-panel">
                  <div className="panel-heading"><div><span>ACCESOS RÁPIDOS</span><h2>Gestión del periodo</h2></div></div>
                  <div className="quick-actions">
                    <button onClick={() => navigate('planificacion')}><span className="quick-icon"><ClipboardList size={20}/></span><span><strong>Planificación</strong><small>Periodos, lineamientos y matrices</small></span><ArrowRight size={17}/></button>
                    <button onClick={() => navigate('configuracion')}><span className="quick-icon"><SlidersHorizontal size={20}/></span><span><strong>Configuración</strong><small>Usuarios, unidades y parámetros</small></span><ArrowRight size={17}/></button>
                    <button onClick={() => navigate('reportes')}><span className="quick-icon"><FileBarChart size={20}/></span><span><strong>Reportes</strong><small>Seguimiento y vista consolidada</small></span><ArrowRight size={17}/></button>
                  </div>
                </div>

                <div className="panel-card status-panel">
                  <div className="panel-heading"><div><span>ESTADO DEL SISTEMA</span><h2>Configuración inicial</h2></div></div>
                  <div className="status-list">
                    <div><span className="status-check">✓</span><p><strong>Autenticación OTP</strong><small>Configurada y operativa</small></p></div>
                    <div><span className="status-check">✓</span><p><strong>Roles y permisos</strong><small>Acceso multiunidad habilitado</small></p></div>
                    <div><span className="status-pending">3</span><p><strong>Estructura de planificación</strong><small>Siguiente etapa de configuración</small></p></div>
                  </div>
                </div>
              </section>
            </>
          )}

          {section === 'planificacion' && <PlanningView units={units} />}
          {section === 'configuracion' && <ConfigurationView />}
          {section === 'reportes' && <ReportsView />}
        </main>
      </div>
    </div>
  )
}

function sectionDescription(section: Section) {
  if (section === 'planificacion') return 'Administra periodos, unidades, lineamientos y matrices de gestión.'
  if (section === 'configuracion') return 'Configura usuarios, permisos y parámetros generales de la plataforma.'
  return 'Consulta información consolidada y prepara los reportes de gestión.'
}

function SummaryCard({ icon, label, value, detail, compact = false }: { icon: React.ReactNode; label: string; value: string; detail: string; compact?: boolean }) {
  return (
    <div className="summary-card">
      <div className="summary-icon">{icon}</div>
      <div className="summary-copy"><span>{label}</span><strong className={compact ? 'summary-value--compact' : ''}>{value}</strong><small>{detail}</small></div>
    </div>
  )
}

function PlanningView({ units }: { units: UnitAccess[] }) {
  const periods = ['2026', '2027', '2028', '2029']
  return (
    <div className="module-stack">
      <div className="panel-card module-card">
        <div className="panel-heading"><div><span>PERIODOS</span><h2>Planificación estratégica</h2></div><button className="primary-small">+ Nuevo periodo</button></div>
        <div className="period-grid">
          {periods.map((period, index) => <button className={`period-card ${index === 0 ? 'active' : ''}`} key={period}><CalendarDays size={22}/><strong>{period}</strong><small>{index === 0 ? 'Periodo actual' : 'Próximo periodo'}</small><ArrowRight size={17}/></button>)}
        </div>
      </div>
      <div className="panel-card module-card">
        <div className="panel-heading"><div><span>ESTRUCTURA</span><h2>Unidades disponibles</h2></div></div>
        <div className="simple-table">
          <div className="simple-table__head"><span>Unidad</span><span>Código</span><span>Estado</span><span></span></div>
          {units.map(unit => <div className="simple-table__row" key={unit.code}><span><Building2 size={17}/>{unit.name}</span><span>{unit.code}</span><span><i className="active-dot"/>Activa</span><button>Gestionar <ArrowRight size={15}/></button></div>)}
        </div>
      </div>
    </div>
  )
}

function ConfigurationView() {
  const items = [
    { icon: <Users/>, title: 'Usuarios y permisos', text: 'Autoriza usuarios, asigna roles y accesos por unidad.' },
    { icon: <Building2/>, title: 'Unidades de negocio', text: 'Administra las cinco unidades disponibles en la plataforma.' },
    { icon: <CalendarDays/>, title: 'Periodos', text: 'Crea y administra los periodos de planificación.' },
    { icon: <ClipboardList/>, title: 'Lineamientos', text: 'Define la estructura que utilizarán las matrices de gestión.' },
  ]
  return <div className="config-grid">{items.map(item => <button className="config-card" key={item.title}><span className="config-icon">{item.icon}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><ArrowRight size={18}/></button>)}</div>
}

function ReportsView() {
  return (
    <div className="module-stack">
      <div className="reports-hero panel-card"><div><span>REPORTES</span><h2>Vista consolidada</h2><p>Esta sección quedará conectada a la información real de planificación cuando construyamos las matrices.</p></div><FileBarChart size={56}/></div>
      <div className="report-grid">
        <button className="report-card"><BarChart3 size={24}/><h3>Avance por unidad</h3><p>Seguimiento comparativo entre unidades de negocio.</p><span>Preparar reporte <ArrowRight size={16}/></span></button>
        <button className="report-card"><ClipboardList size={24}/><h3>Estado de matrices</h3><p>Resumen de matrices pendientes, remitidas y aprobadas.</p><span>Preparar reporte <ArrowRight size={16}/></span></button>
        <button className="report-card"><FileBarChart size={24}/><h3>Resumen ejecutivo</h3><p>Información consolidada para la revisión de Gerencia General.</p><span>Preparar reporte <ArrowRight size={16}/></span></button>
      </div>
    </div>
  )
}
