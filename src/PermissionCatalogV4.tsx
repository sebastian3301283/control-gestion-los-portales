import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Edit3, LoaderCircle, LockKeyhole, Search, ShieldCheck, SlidersHorizontal, UsersRound, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './permission-catalog-v2.css'
import './permission-catalog-v3.css'
import './permission-catalog-v4.css'

type Unit = { code: string; name: string }
type PermissionUser = { id: string; email: string; full_name: string | null; global_role: string | null; active: boolean }
type Area = { id: string; name: string; unit_code: string }
type MatrixArea = { unit_code: string; management_id: string }
type Permission = { id: string; authorized_user_id: string; unit_code: string; management_id: string; can_view: boolean; can_edit: boolean }
type Props = { units?: Unit[]; canManage: boolean }
type BulkAction = 'VIEW' | 'EDIT' | 'REMOVE'
type RoleValue = 'GESTION_ESTRATEGICA' | 'GERENTE_GENERAL' | 'AREA'

const PAGE_SIZE = 10
const fallbackUnits: Unit[] = [
  { code: 'CENTRAL', name: 'Central' },
  { code: 'HU', name: 'Habilitación Urbana' },
  { code: 'DEP', name: 'Departamentos' },
  { code: 'VS', name: 'Vivienda Social' },
  { code: 'HOT', name: 'Hoteles' },
]

const roleValue = (role: string | null): RoleValue => role === 'GESTION_ESTRATEGICA' ? 'GESTION_ESTRATEGICA' : role === 'GERENTE_GENERAL' ? 'GERENTE_GENERAL' : 'AREA'
const initials = (user: PermissionUser) => {
  const value = (user.full_name || user.email.split('@')[0] || 'U').trim()
  const parts = value.split(/\s+/).filter(Boolean)
  return (parts.slice(0, 2).map(part => part[0]).join('') || 'U').toUpperCase()
}

export default function PermissionCatalogV4({ units, canManage }: Props) {
  const unitOptions = units?.length ? units : fallbackUnits
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<PermissionUser[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [matrixAreas, setMatrixAreas] = useState<MatrixArea[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [unitCode, setUnitCode] = useState(unitOptions[0]?.code || 'CENTRAL')
  const [targetAreaId, setTargetAreaId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingUser, setEditingUser] = useState<PermissionUser | null>(null)
  const [editorUnit, setEditorUnit] = useState(unitOptions[0]?.code || 'CENTRAL')

  const areaById = useMemo(() => new Map(areas.map(item => [item.id, item])), [areas])
  const areasForUnit = (code: string) => matrixAreas
    .filter(item => item.unit_code === code)
    .map(item => areaById.get(item.management_id))
    .filter((item): item is Area => Boolean(item))
    .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const availableAreas = useMemo(() => areasForUnit(unitCode), [matrixAreas, areaById, unitCode])
  const editorAreas = useMemo(() => areasForUnit(editorUnit), [matrixAreas, areaById, editorUnit])

  useEffect(() => {
    if (!availableAreas.length) { setTargetAreaId(''); return }
    if (!availableAreas.some(area => area.id === targetAreaId)) setTargetAreaId(availableAreas[0].id)
  }, [availableAreas, targetAreaId])

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter(user => {
      const matchesSearch = !term || `${user.full_name || ''} ${user.email}`.toLowerCase().includes(term)
      const matchesRole = roleFilter === 'ALL' || (roleFilter === 'AREA' && !user.global_role) || user.global_role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const pageUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search, roleFilter])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const targetArea = availableAreas.find(item => item.id === targetAreaId) || null
  const permissionFor = (userId: string, areaId: string, code = unitCode) => permissions.find(item => item.authorized_user_id === userId && item.unit_code === code && item.management_id === areaId)

  const assignedAreasFor = (user: PermissionUser) => {
    if (user.global_role) return unitOptions.map(unit => ({ key: unit.code, unit: unit.code, label: unit.code }))
    return permissions.filter(permission => permission.authorized_user_id === user.id && permission.can_view).map(permission => ({
      key: `${permission.unit_code}:${permission.management_id}`,
      unit: permission.unit_code,
      label: areaById.get(permission.management_id)?.name || permission.unit_code,
    }))
  }

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
      setError('No pudimos cargar el panel de permisos.')
      return
    }
    const loadedUsers = (userResult.data || []) as PermissionUser[]
    setUsers(loadedUsers)
    setAreas((areaResult.data || []) as Area[])
    setMatrixAreas((matrixAreaResult.data || []) as MatrixArea[])
    setPermissions((permissionResult.data || []) as Permission[])
    if (editingUser) setEditingUser(loadedUsers.find(item => item.id === editingUser.id) || null)
  }

  async function updateRole(user: PermissionUser, nextRole: RoleValue) {
    if (!supabase || !canManage || roleValue(user.global_role) === nextRole) return
    setSavingKey(`${user.id}:role`); setError(''); setNotice('')
    const { error: roleError } = await supabase.rpc('set_permission_user_role', { user_id_input: user.id, role_input: nextRole })
    setSavingKey('')
    if (roleError) { setError(roleError.message || 'No pudimos cambiar el rol.'); return }
    setRoleFilter('ALL')
    setNotice(nextRole === 'AREA'
      ? `${user.full_name || user.email} ahora tiene acceso restringido por unidad y área.`
      : `${user.full_name || user.email} ahora tiene acceso global como ${nextRole === 'GERENTE_GENERAL' ? 'Gerente General' : 'Gestión Estratégica'}.`)
    await loadData()
  }

  async function updatePermissionFor(user: PermissionUser, code: string, areaId: string, mode: 'view' | 'edit', enabled: boolean) {
    if (!supabase || !canManage || user.global_role) return
    const key = `${user.id}:${code}:${areaId}:${mode}`
    setSavingKey(key); setError('')
    const current = permissionFor(user.id, areaId, code)

    if (mode === 'view' && !enabled) {
      if (current) {
        const { error: deleteError } = await supabase.from('area_user_permissions').delete().eq('id', current.id)
        setSavingKey('')
        if (deleteError) { setError('No pudimos quitar el acceso.'); return }
      } else setSavingKey('')
      await loadData(); return
    }

    if (mode === 'edit' && !enabled && !current) { setSavingKey(''); return }

    const { error: upsertError } = await supabase.from('area_user_permissions').upsert({
      authorized_user_id: user.id,
      unit_code: code,
      management_id: areaId,
      can_view: true,
      can_edit: mode === 'edit' ? enabled : Boolean(current?.can_edit),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'authorized_user_id,unit_code,management_id' })
    setSavingKey('')
    if (upsertError) { setError('No pudimos actualizar el permiso.'); return }
    await loadData()
  }

  async function updateCurrentAreaPermission(user: PermissionUser, mode: 'view' | 'edit', enabled: boolean) {
    if (!targetArea) return
    await updatePermissionFor(user, unitCode, targetArea.id, mode, enabled)
  }

  async function applyBulk(action: BulkAction) {
    if (!supabase || !targetArea || !selectedIds.size) return
    const selectedUsers = users.filter(user => selectedIds.has(user.id))
    const areaUsers = selectedUsers.filter(user => !user.global_role)
    if (!areaUsers.length) {
      setError('Los usuarios seleccionados tienen acceso global. Primero cambia su Rol principal a “Acceso por área”.')
      return
    }
    setBulkSaving(true); setError(''); setNotice(''); setBulkOpen(false)

    if (action === 'REMOVE') {
      const { error: deleteError } = await supabase.from('area_user_permissions').delete().in('authorized_user_id', areaUsers.map(user => user.id)).eq('unit_code', unitCode).eq('management_id', targetArea.id)
      setBulkSaving(false)
      if (deleteError) { setError('No pudimos quitar los accesos seleccionados.'); return }
    } else {
      const payload = areaUsers.map(user => {
        const current = permissionFor(user.id, targetArea.id)
        return { authorized_user_id: user.id, unit_code: unitCode, management_id: targetArea.id, can_view: true, can_edit: action === 'EDIT' ? true : Boolean(current?.can_edit), updated_at: new Date().toISOString() }
      })
      const { error: upsertError } = await supabase.from('area_user_permissions').upsert(payload, { onConflict: 'authorized_user_id,unit_code,management_id' })
      setBulkSaving(false)
      if (upsertError) { setError('No pudimos aplicar la acción masiva.'); return }
    }

    const skipped = selectedUsers.length - areaUsers.length
    setNotice(`${areaUsers.length} usuario${areaUsers.length === 1 ? '' : 's'} actualizado${areaUsers.length === 1 ? '' : 's'}${skipped ? `. ${skipped} usuario(s) global(es) se omitieron.` : '.'}`)
    setSelectedIds(new Set())
    await loadData()
  }

  const allPageSelected = pageUsers.length > 0 && pageUsers.every(user => selectedIds.has(user.id))
  const toggleSelectAll = () => setSelectedIds(current => {
    const next = new Set(current)
    if (allPageSelected) pageUsers.forEach(user => next.delete(user.id))
    else pageUsers.forEach(user => next.add(user.id))
    return next
  })

  return <section className={`permission-v2 permission-v4 config-accordion ${open ? 'open' : ''}`}>
    <button className="config-accordion-head" type="button" onClick={() => setOpen(value => !value)}>
      <span className="config-accordion-icon"><LockKeyhole size={21}/></span>
      <div><small>SEGURIDAD Y ACCESO</small><h2>Panel de Control de Permisos por Rol y Área</h2><p>Define claramente quién tiene acceso global y quién trabaja solo en unidades y áreas específicas.</p></div>
      <ChevronDown className={open ? 'rotated' : ''} size={20}/>
    </button>

    {open && <div className="config-accordion-body permission-v2-body">
      {!canManage ? <div className="permission-v2-empty">Solo Gestión Estratégica puede administrar estos permisos.</div> : loading ? <div className="permission-v2-loading"><LoaderCircle className="spin" size={20}/> Cargando usuarios...</div> : <>
        {error && <div className="permission-v2-message error">{error}</div>}
        {notice && <div className="permission-v2-message success"><Check size={14}/>{notice}</div>}

        <div className="permission-v4-definition-grid">
          <div><strong>Gestión Estratégica</strong><span>Acceso global a las 5 unidades y administración de configuración y permisos.</span></div>
          <div><strong>Gerente General</strong><span>Acceso global a las 5 unidades. No necesita permisos por área.</span></div>
          <div><strong>Acceso por área</strong><span>Solo entra a las unidades y áreas que habilites. Puede tener solo lectura o también edición.</span></div>
        </div>

        <div className="permission-v4-title-row"><div><strong>Asignación de permisos</strong><span>Selecciona un área para cambios rápidos o usa “Editar permisos” para configurar todo el usuario.</span></div></div>
        <div className="permission-v2-toolbar">
          <label className="permission-v2-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar usuario o correo"/></label>
          <label className="permission-v2-select"><SlidersHorizontal size={14}/><select value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="ALL">Todos los roles</option><option value="GESTION_ESTRATEGICA">Gestión Estratégica</option><option value="GERENTE_GENERAL">Gerente General</option><option value="AREA">Acceso por área</option></select></label>
          <label className="permission-v2-select"><select value={unitCode} onChange={event => { setUnitCode(event.target.value); setBulkOpen(false) }}>{unitOptions.map(unit => <option key={unit.code} value={unit.code}>{unit.code} · {unit.name}</option>)}</select></label>
          <label className="permission-v2-select permission-v2-area-select"><select value={targetAreaId} onChange={event => { setTargetAreaId(event.target.value); setBulkOpen(false) }}>{availableAreas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          <div className="permission-v2-bulk-wrap"><button type="button" className="permission-v2-bulk" disabled={!selectedIds.size || !targetArea || bulkSaving} onClick={() => setBulkOpen(value => !value)}>{bulkSaving ? <LoaderCircle className="spin" size={14}/> : <UsersRound size={15}/>} Acciones en masa</button>{bulkOpen && <div className="permission-v2-bulk-menu"><button onClick={() => void applyBulk('VIEW')}>Dar acceso al área</button><button onClick={() => void applyBulk('EDIT')}>Dar acceso + edición</button><button className="danger" onClick={() => void applyBulk('REMOVE')}>Quitar acceso al área</button></div>}</div>
        </div>

        <div className="permission-v2-context"><div><strong>{targetArea ? `${unitCode} · ${targetArea.name}` : `${unitCode} · Sin área activa`}</strong><span>Los interruptores modifican esta área.</span></div><div><strong>{users.length}</strong><span>Usuarios totales</span></div><div><strong>Página {page} de {totalPages}</strong><span>{filteredUsers.length} resultados</span></div></div>

        <div className="permission-v2-table-wrap"><table className="permission-v2-table permission-v4-table"><thead><tr><th className="permission-v2-check"><input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}/></th><th>Usuario</th><th>Correo electrónico</th><th>Rol principal</th><th>Áreas asignadas</th><th>Acceso</th><th>Edición</th><th>Acciones</th></tr></thead><tbody>
          {pageUsers.length === 0 ? <tr><td colSpan={8} className="permission-v2-empty">No encontramos usuarios con esos filtros.</td></tr> : pageUsers.map(user => {
            const permission = targetArea ? permissionFor(user.id, targetArea.id) : undefined
            const isGlobal = Boolean(user.global_role)
            const view = Boolean(isGlobal || permission?.can_view)
            const edit = Boolean(isGlobal || permission?.can_edit)
            const badges = assignedAreasFor(user)
            return <tr key={user.id} className={selectedIds.has(user.id) ? 'selected' : ''}>
              <td className="permission-v2-check"><input type="checkbox" checked={selectedIds.has(user.id)} onChange={event => setSelectedIds(current => { const next = new Set(current); event.target.checked ? next.add(user.id) : next.delete(user.id); return next })}/></td>
              <td><div className="permission-v2-user"><span className="permission-v2-avatar">{initials(user)}</span><div><strong>{user.full_name || user.email.split('@')[0]}</strong><small>{user.active ? 'Activo' : 'Inactivo'}</small></div></div></td>
              <td className="permission-v2-email">{user.email}</td>
              <td><select className="permission-v4-role-select" value={roleValue(user.global_role)} disabled={savingKey === `${user.id}:role`} onChange={event => void updateRole(user, event.target.value as RoleValue)}><option value="GESTION_ESTRATEGICA">Gestión Estratégica</option><option value="GERENTE_GENERAL">Gerente General</option><option value="AREA">Acceso por área</option></select></td>
              <td><div className="permission-v2-badges">{badges.slice(0, 6).map(badge => <span key={badge.key} className={`unit-${badge.unit.toLowerCase()}`} title={badge.label}>{badge.label}</span>)}{badges.length > 6 && <span className="more">+{badges.length - 6}</span>}{badges.length === 0 && <em>Sin áreas</em>}</div></td>
              <td className="permission-v2-switch-cell">{isGlobal ? <span className="permission-v2-global"><ShieldCheck size={14}/> Global</span> : <label className="permission-v2-switch"><input type="checkbox" checked={view} disabled={!targetArea || savingKey.startsWith(`${user.id}:`)} onChange={event => void updateCurrentAreaPermission(user, 'view', event.target.checked)}/><span/></label>}</td>
              <td className="permission-v2-switch-cell">{isGlobal ? <span className="permission-v2-global"><ShieldCheck size={14}/> Global</span> : <label className="permission-v2-switch"><input type="checkbox" checked={edit} disabled={!targetArea || !view || savingKey.startsWith(`${user.id}:`)} onChange={event => void updateCurrentAreaPermission(user, 'edit', event.target.checked)}/><span/></label>}</td>
              <td><button className="permission-v4-edit-btn" type="button" onClick={() => { setEditingUser(user); setEditorUnit(unitCode) }}><Edit3 size={13}/> Editar permisos</button></td>
            </tr>
          })}
        </tbody></table></div>

        <div className="permission-v2-footer"><div className="permission-v4-selection-note"><strong>{selectedIds.size} seleccionado(s)</strong><span>La casilla sirve para acciones en masa. Para cambiar el rol de una persona, usa el selector de Rol principal o “Editar permisos”.</span></div><div className="permission-v2-pagination"><button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={16}/></button><span>{page}</span><button disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}><ChevronRight size={16}/></button></div></div>
      </>}
    </div>}

    {editingUser && <div className="permission-v4-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditingUser(null) }}><div className="permission-v4-modal" role="dialog" aria-modal="true">
      <div className="permission-v4-modal-head"><div><small>EDITAR PERMISOS</small><h3>{editingUser.full_name || editingUser.email}</h3><p>{editingUser.email}</p></div><button type="button" onClick={() => setEditingUser(null)}><X size={18}/></button></div>
      <div className="permission-v4-modal-role"><label><span>Rol principal</span><select value={roleValue(editingUser.global_role)} disabled={savingKey === `${editingUser.id}:role`} onChange={event => void updateRole(editingUser, event.target.value as RoleValue)}><option value="GESTION_ESTRATEGICA">Gestión Estratégica</option><option value="GERENTE_GENERAL">Gerente General</option><option value="AREA">Acceso por área</option></select></label><div className={`permission-v4-role-help ${editingUser.global_role ? 'global' : ''}`}>{editingUser.global_role ? 'Acceso global: este usuario entra a las 5 unidades y todas sus áreas.' : 'Acceso restringido: activa únicamente las áreas que este usuario debe ver o editar.'}</div></div>
      {!editingUser.global_role && <><div className="permission-v4-unit-tabs">{unitOptions.map(unit => <button type="button" key={unit.code} className={editorUnit === unit.code ? 'active' : ''} onClick={() => setEditorUnit(unit.code)}><strong>{unit.code}</strong><span>{unit.name}</span></button>)}</div><div className="permission-v4-area-editor"><div className="permission-v4-area-head"><strong>Áreas de {unitOptions.find(unit => unit.code === editorUnit)?.name || editorUnit}</strong><span>“Acceso” permite ingresar. “Edición” permite modificar la matriz.</span></div>{editorAreas.length === 0 ? <div className="permission-v2-empty">No hay áreas habilitadas para esta unidad.</div> : editorAreas.map(area => { const current = permissionFor(editingUser.id, area.id, editorUnit); const view = Boolean(current?.can_view); const edit = Boolean(current?.can_edit); return <div className="permission-v4-area-row" key={area.id}><div><strong>{area.name}</strong><span>{editorUnit}</span></div><div className="permission-v4-area-control"><span>Acceso</span><label className="permission-v2-switch"><input type="checkbox" checked={view} disabled={savingKey.startsWith(`${editingUser.id}:`)} onChange={event => void updatePermissionFor(editingUser, editorUnit, area.id, 'view', event.target.checked)}/><span/></label></div><div className="permission-v4-area-control"><span>Edición</span><label className="permission-v2-switch"><input type="checkbox" checked={edit} disabled={!view || savingKey.startsWith(`${editingUser.id}:`)} onChange={event => void updatePermissionFor(editingUser, editorUnit, area.id, 'edit', event.target.checked)}/><span/></label></div></div> })}</div></>}
      <div className="permission-v4-modal-foot"><button type="button" onClick={() => setEditingUser(null)}>Cerrar</button></div>
    </div></div>}
  </section>
}
