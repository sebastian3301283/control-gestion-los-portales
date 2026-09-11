import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import Dashboard from './Dashboard'
import './dashboard-restricted.css'

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

type RuntimeBoundaryState = {
  error: Error | null
}

class DashboardRuntimeBoundary extends Component<{ children: ReactNode }, RuntimeBoundaryState> {
  state: RuntimeBoundaryState = { error: null }

  static getDerivedStateFromError(cause: unknown): RuntimeBoundaryState {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DashboardRuntimeBoundary]', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#eef4f8', boxSizing: 'border-box' }}>
        <section role="alert" style={{ width: 'min(760px, 100%)', padding: 28, border: '1px solid #d9e4ec', borderRadius: 18, background: '#fff', boxShadow: '0 18px 50px rgba(24, 55, 78, .12)' }}>
          <span style={{ display: 'block', marginBottom: 6, color: '#a04444', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Error del módulo</span>
          <h1 style={{ margin: 0, color: '#17364e', fontSize: 24 }}>Control de Gestión encontró un error</h1>
          <p style={{ margin: '10px 0 16px', color: '#647b8d', lineHeight: 1.5 }}>La aplicación ya no ocultará la excepción. Copia o envía una captura del mensaje técnico de abajo para identificar exactamente qué está fallando.</p>
          <pre style={{ margin: 0, padding: 14, overflow: 'auto', borderRadius: 10, background: '#f5f7f9', color: '#9b3232', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error.message}</pre>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 18, minHeight: 42, padding: '0 18px', border: 0, borderRadius: 10, background: '#176fb3', color: '#fff', font: 'inherit', fontWeight: 800, cursor: 'pointer' }}>Recargar pantalla</button>
        </section>
      </main>
    )
  }
}

export default function DashboardRestricted({ access, onSignOut }: { access: DashboardAccess; onSignOut: () => void | Promise<void> }) {
  const canConfigure = access.global_role === 'GESTION_ESTRATEGICA'

  useEffect(() => {
    document.body.classList.toggle('cg-hide-configuration', !canConfigure)
    return () => document.body.classList.remove('cg-hide-configuration')
  }, [canConfigure])

  return <DashboardRuntimeBoundary><Dashboard access={access} onSignOut={onSignOut} /></DashboardRuntimeBoundary>
}
