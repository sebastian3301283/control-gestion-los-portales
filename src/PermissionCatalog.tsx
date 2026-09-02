import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, LoaderCircle, LockKeyhole, Search, ShieldCheck } from 'lucide-react'
import { supabase } from './lib/supabase'
import './permission-catalog.css'

type Unit = { code: string; name: string }
type PermissionUser = { id: string; email: string; full_name: string | null; global_role: string | null; active: boolean }
type Area = { id: string; name: string; unit_code: string }
type MatrixArea = { unit_code: string; management_id: string }
type Permission = { id: string; authorized_user_id: string; unit_code: string; management_id: string; can_view: boolean; can_edit: boolean }
type Props = { units?: Unit[]; canManage: boolean }

const fallbackUnits: Unit[] = [
  { code: 'CENTRAL', name: 'Central' },
  { code: 'HU', name: 'Habilitación Urbana' },
  { code: 'DEP', name: 'Departamentos' },
  { code: 'VS', name: 'Vivienda Social' },
  { code: 'HOT', name: 'Hoteles' },
]

export default function PermissionCatalog({ units, canManage }: Props) {
  const unitOptions = units?.length ? units : fallbackUnits
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<PermissionUser[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [matrixAreas, setMatrixAreas] = useState<MatrixArea[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [userId, setUserId] = useState('')
  const [unitCode, setUnitCode] = useState(unitOptions[0]?.code || 'CENTRAL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectedUser = users.find(item => item.id === userId) || null
  const areaById = useMemo(() => new Map(areas.map(item => [item.id, item])), [areas])
  const availableAreas = useMemo(() => {
    const term = search.trim().toLowerCase()
    return matrixAreas
      .filter(item => item.unit_code === unitCode)
      .map(item => areaById.get(item.management_id))
      .filter((item): item is Area => Boolean(item))
      .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
      .filter(item => !term || item.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [matrixAreas, unitCode, areaById, search])

  const permissionMap = useMemo(() => {
    const map = new Map<string, Permission>()
    permissions.filter(item => item.authorized_user_id === userId && item.unit_code === unitCode).forEach(item => map.set(item.management_id, item))
    return map
  }, [permissions, userId, unitCode])

  useEffect(() => { if (open && canManage && users.length === 0) void loadData() }, [open, canManage])

  async function loadData() {
    if (!supabase || !canManage) return
    setLoading(true); setError('')
    const [userResult, areaResult, matrixAreaResult, permissionResult] = await Promise.all([
      supabase.rpc('list_area_permission_users'),
      supabase.from('managements_global').select('id,name,unit_code').eq('active', true).order('name'),
      supabase.from('matrix_unit_area_catalog').select('unit_code,management_id').order('created_at'),
      supabase.from('area_user_permissions').select('id,authorized_user_id,unit_code,management_id,can_view,can_edit'),
    ])
    setLoading(false)
    if (userResult.error || areaResult.error || matrixAreaResult.error || permissionResult.error) {
      setError('No pudimos cargar los permisos por área.')
      return
    }
    const loadedUsers = (userResult.data || []) as PermissionUser[]
    setUsers(loadedUsers)
    setAreas((areaResult.data || []) as Area[])
    setMatrixAreas((matrixAreaResult.data || []) as MatrixArea[])
    setPermissions((permissionResult.data || []) as Permission[])
    if (!userId && loadedUsers.length) setUserId(loadedUsers[0].id)
  }

  async function setView(area: Area, enabled: boolean) {
    if (!supabase || !canManage || !userId) return
    const key = `${area.id}:view`; setSavingKey(key); setError(''); setNotice('')
    const current = permissionMap.get(area.id)
    if (!enabled) {
      const result = current ? await supabase.from('area_user_permissions').delete().eq('id', current.id) : { error: null }
      setSavingKey('')
      if (result.error) { setError('No pudimos quitar el acceso.'); return }
      setNotice(`Acceso retirado a ${area.name}.`)
      await loadData(); return
    }
    const { error: upsertError } = await supabase.from('area_user_permissions').upsert({
      authorized_user_id: userId,
      unit_code: unitCode,
      management_id: area.id,
      can_view: true,
      can_edit: current?.can_edit || false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'authorized_user_id,unit_code,management_id' })
    setSavingKey('')
    if (upsertError) { setError('No pudimos asignar el acceso.'); return }
    setNotice(`Acceso habilitado a ${area.name}.`)
    await loadData()
  }

  async function setEdit(area: Area, enabled: boolean) {
    if (!supabase || !canManage || !userId) return
    const key = `${area.id}:edit`; setSavingKey(key); setError(''); setNotice('')
    const current = permissionMap.get(area.id)
    const { error: upsertError } = await supabase.from('area_user_permissions').upsert({
      authorized_user_id: userId,
      unit_code: unitCode,
      management_id: area.id,
      can_view: true,
      can_edit: enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'authorized_user_id,unit_code,management_id' })
    setSavingKey('')
    if (upsertError) { setError('No pudimos actualizar el permiso de edición.'); return }
    setNotice(enabled ? `Edición habilitada en ${area.name}.` : `Edición deshabilitada en ${area.name}.`)
    await loadData()
  }

  return <section className={`permission-catalog config-accordion ${open ? 'open' : ''}`}>
    <button className="config-accordion-head" type="button" onClick={() => setOpen(value => !value)}>
      <span className="config-accordion-icon"><LockKeyhole size={21}/></span>
      <div><small>Seguridad y acceso</small><h2>Permisos por área</h2><p>Define qué usuarios pueden entrar a cada área y, cuando corresponda, editar sus matrices.</p></div>
      <ChevronDown className={open ? 'rotated' : ''} size={20}/>
    </button>

    {open && <div className="config-accordion-body permission-body">
      {!canManage ? <div className="permission-empty">Solo Gestión Estratégica puede administrar estos permisos.</div> : loading ? <div className="permission-loading"><LoaderCircle className="spin" size={20}/> Cargando permisos...</div> : <>
        {error && <div className="permission-message error">{error}</div>}
        {notice && <div className="permission-message success"><Check size={14}/>{notice}</div>}

        <div className="permission-controls">
          <label><span>Usuario</span><select value={userId} onChange={event => { setUserId(event.target.value); setNotice(''); setError('') }}>{users.map(user => <option key={user.id} value={user.id}>{user.full_name || user.email} · {user.email}</option>)}</select></label>
          <label className="permission-search"><span>Buscar área</span><div><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar área"/></div></label>
        </div>

        <div className="permission-unit-tabs">{unitOptions.map(unit => <button key={unit.code} type="button" className={unitCode === unit.code ? 'active' : ''} onClick={() => { setUnitCode(unit.code); setSearch(''); setNotice(''); setError('') }}><strong>{unit.code}</strong><small>{unit.name}</small></button>)}</div>

        {selectedUser?.global_role && <div className="permission-global-note"><ShieldCheck size={17}/><div><strong>Usuario con acceso global</strong><span>{selectedUser.full_name || selectedUser.email} tiene el rol {selectedUser.global_role}. Los permisos de abajo se muestran como referencia; el rol global mantiene acceso a todas las áreas.</span></div></div>}

        <div className="permission-table-wrap"><table className="permission-table"><thead><tr><th>Área</th><th>Puede ingresar</th><th>Puede editar</th></tr></thead><tbody>
          {availableAreas.length === 0 ? <tr><td colSpan={3} className="permission-empty">No hay áreas activadas para esta unidad.</td></tr> : availableAreas.map(area => {
            const permission = permissionMap.get(area.id)
            const view = Boolean(permission?.can_view)
            const edit = Boolean(permission?.can_edit)
            return <tr key={area.id}><td><strong>{area.name}</strong></td><td><label className="permission-switch"><input type="checkbox" checked={view} disabled={Boolean(selectedUser?.global_role) || savingKey.startsWith(area.id)} onChange={event => void setView(area, event.target.checked)}/><span/></label></td><td><label className="permission-switch"><input type="checkbox" checked={edit} disabled={Boolean(selectedUser?.global_role) || savingKey.startsWith(area.id)} onChange={event => void setEdit(area, event.target.checked)}/><span/></label></td></tr>
          })}
        </tbody></table></div>
      </>}
    </div>}
  </section>
}
