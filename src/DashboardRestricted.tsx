import { useEffect } from 'react'
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

export default function DashboardRestricted({ access, onSignOut }: { access: DashboardAccess; onSignOut: () => void | Promise<void> }) {
  const canConfigure = access.global_role === 'GESTION_ESTRATEGICA'

  useEffect(() => {
    document.body.classList.toggle('cg-hide-configuration', !canConfigure)
    return () => document.body.classList.remove('cg-hide-configuration')
  }, [canConfigure])

  return <Dashboard access={access} onSignOut={onSignOut} />
}
