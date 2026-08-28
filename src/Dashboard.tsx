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
  Sparkles,
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
              {section === 'planificacion' && <PlanningView units={units} />}
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
  if (section === 'planificacion') return 'Administra periodos, unidades, lineamientos y matrices.'
  if (section === 'configuracion') return 'Configura usuarios, permisos y parámetros.'
  return 'Consulta el avance y los resultados de gestión.'
}

function PlanningView({ units }: { units: UnitAccess[] }) {
  const periods = ['2026', '2027', '2028', '2029']
  return (
    <div className="module-stack">
      <div className="panel-card module-card">
        <div className="panel-heading"><div><span>Periodos</span><h2>Planificación estratégica</h2></div><button className="primary-small">+ Nuevo periodo</button></div>
        <div className="period-grid">
          {periods.map((period, index) => <button className={`period-card ${index === 0 ? 'active' : ''}`} key={period}><CalendarDays size={22}/><strong>{period}</strong><small>{index === 0 ? 'Periodo actual' : 'Próximo periodo'}</small><ArrowRight size={17}/></button>)}
        </div>
      </div>
      <div className="panel-card module-card">
        <div className="panel-heading"><div><span>Unidades</span><h2>Unidades disponibles</h2></div></div>
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
