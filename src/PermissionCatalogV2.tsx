import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, LockKeyhole, Search, ShieldCheck, SlidersHorizontal, UsersRound } from 'lucide-react'
import { supabase } from './lib/supabase'
import './permission-catalog-v2.css'

type Unit = { code: string; name: string }
type PermissionUser = { id: string; email: string; full_name: string | null; global_role: string | null; active: boolean }
type Area = { id: string; name: string; unit_code: string }
type MatrixArea = { unit_code: string; management_id: string }
type Permission = { id: string; authorized_user_id: string; unit_code: string; management_id: string; can_view: boolean; can_edit: boolean }
type Props = { units?: Unit[]; canManage: boolean }
type BulkAction = 'VIEW' | 'EDIT' | 'REMOVE'

const PAGE_SIZE = 10
const fallbackUnits: Unit[] = [
  { code: 'CENTRAL', name: 'Central' },
  { code: 'HU', name: 'Habilitación Urbana' },
  { code: 'DEP', name: 'Departamentos' },
  { code: 'VS', name: 'Vivienda Social' },
  { code: 'HOT', name: 'Hoteles' },
]

const roleLabel = (role: string | null) => {
  if (role === 'GESTION_ESTRATEGICA') return 'Gestión Estratégica'
  if (role === 'GERENTE_GENERAL') return 'Gerente General'
  return 'Acceso por área'
}
const initials = (user: PermissionUser) => {
  const value = (user.full_name || user.email.split('@')[0] || 'U').trim()
  const parts = value.split(/\s+/).filter(Boolean)
  return (parts.slice(0, 2).map(part => part[0]).join('') || 'U').toUpperCase()
}

export default function PermissionCatalogV2({ units, canManage }: Props) {
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

  const areaById = useMemo(() => new Map(areas.map(item => [item.id, item])), [areas])
  const availableAreas = useMemo(() => matrixAreas
    .filter(item => item.unit_code === unitCode)
    .map(item => areaById.get(item.management_id))
    .filter((item): item is Area => Boolean(item))
    .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
    .sort((a, b) => a.name.localeCompare(b.name, 'es')), [matrixAreas, unitCode, areaById])

  useEffect(() => {
    if (!availableAreas.length) { setTargetAreaId(''); return }
    if (!availableAreas.some(area => area.id === targetAreaId)) setTargetAreaId(availableAreas[0].id)
  }, [availableAreas, targetAreaId])

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter(user => {
      const matchesSearch = !term || `${user.full_name || ''} ${user.email}`.toLowerCase().includes(term)
      const matchesRole = roleFilter === 'ALL' ||
        (roleFilter === 'AREA' && !user.global_role) ||
        user.global_role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const pageUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search, roleFilter])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const permissionFor = (userId: string, areaId: string) => permissions.find(item => item.authorized_user_id === userId && item.unit_code === unitCode && item.management_id === areaId)
  const targetArea = availableAreas.find(item => item.id === targetAreaId) || null

  const assignedAreasFor = (user: PermissionUser) => {
    if (user.global_role) return unitOptions.map(unit => ({ key: unit.code, unit: unit.code, label: unit.code }))
    return permissions
      .filter(permission => permission.authorized_user_id === user.id && permission.can_view)
      .map(permission => ({
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
    setUsers((userResult.data || []) as PermissionUser[])
    setAreas((areaResult.data || []) as Area[])
    setMatrixAreas((matrixAreaResult.data || []) as MatrixArea[])
    setPermissions((permissionResult.data || []) as Permission[])
  }

  async function updatePermission(user: PermissionUser, mode: 'view' | 'edit', enabled: boolean) {
    if (!supabase || !canManage || !targetArea) return
    if (user.global_role) return
    const key = `${user.id}:${mode}`
    setSavingKey(key); setError(''); setNotice('')
    const current = permissionFor(user.id, targetArea.id)

    if (mode === 'view' && !enabled) {
      const result = current ? await supabase.from('area_user_permissions').delete().eq('id', current.id) : { error: null }
      setSavingKey('')
      if (result.error) { setError('No pudimos quitar el acceso.'); return }
      setNotice(`Acceso retirado a ${targetArea.name}.`)
      await loadData(); return
    }

    const { error: upsertError } = await supabase.from('area_user_permissions').upsert({
      authorized_user_id: user.id,
      unit_code: unitCode,
      management_id: targetArea.id,
      can_view: true,
      can_edit: mode === 'edit' ? enabled : Boolean(current?.can_edit),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'authorized_user_id,unit_code,management_id' })
    setSavingKey('')
    if (upsertError) { setError('No pudimos actualizar el permiso.'); return }
    setNotice(mode === 'edit' ? (enabled ? `Edición habilitada en ${targetArea.name}.` : `Edición deshabilitada en ${targetArea.name}.`) : `Acceso habilitado a ${targetArea.name}.`)
    await loadData()
  }

  async function applyBulk(action: BulkAction) {
    if (!supabase || !targetArea || !selectedIds.size) return
    const selectedUsers = users.filter(user => selectedIds.has(user.id) && !user.global_role)
    if (!selectedUsers.length) { setError('Selecciona al menos un usuario sin acceso global.'); return }
    setBulkSaving(true); setError(''); setNotice(''); setBulkOpen(false)

    if (action === 'REMOVE') {
      const { error: deleteError } = await supabase.from('area_user_permissions')
        .delete()
        .in('authorized_user_id', selectedUsers.map(user => user.id))
        .eq('unit_code', unitCode)
        .eq('management_id', targetArea.id)
      setBulkSaving(false)
      if (deleteError) { setError('No pudimos quitar los accesos seleccionados.'); return }
    } else {
      const payload = selectedUsers.map(user => {
        const current = permissionFor(user.id, targetArea.id)
        return {
          authorized_user_id: user.id,
          unit_code: unitCode,
          management_id: targetArea.id,
          can_view: true,
          can_edit: action === 'EDIT' ? true : Boolean(current?.can_edit),
          updated_at: new Date().toISOString(),
        }
      })
      const { error: upsertError } = await supabase.from('area_user_permissions').upsert(payload, { onConflict: 'authorized_user_id,unit_code,management_id' })
      setBulkSaving(false)
      if (upsertError) { setError('No pudimos aplicar la acción masiva.'); return }
    }

    setNotice(`${selectedUsers.length} usuario${selectedUsers.length === 1 ? '' : 's'} actualizado${selectedUsers.length === 1 ? '' : 's'} en ${targetArea.name}.`)
    setSelectedIds(new Set())
    await loadData()
  }

  const selectablePageUsers = pageUsers.filter(user => !user.global_role)
  const allPageSelected = selectablePageUsers.length > 0 && selectablePageUsers.every(user => selectedIds.has(user.id))
  const toggleSelectAll = () => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (allPageSelected) selectablePageUsers.forEach(user => next.delete(user.id))
      else selectablePageUsers.forEach(user => next.add(user.id))
      return next
    })
  }

  return <section className={`permission-v2 config-accordion ${open ? 'open' : ''}`}>
    <button className="config-accordion-head" type="button" onClick={() => setOpen(value => !value)}>
      <span className="config-accordion-icon"><LockKeyhole size={21}/></span>
      <div><small>Seguridad y acceso</small><h2>Permisos por área</h2><p>Administra usuarios, roles de referencia y accesos a matrices desde un solo panel.</p></div>
      <ChevronDown className={open ? 'rotated' : ''} size={20}/>
    </button>

    {open && <div className="config-accordion-body permission-v2-body">
      {!canManage ? <div className="permission-v2-empty">Solo Gestión Estratégica puede administrar estos permisos.</div> : loading ? <div className="permission-v2-loading"><LoaderCircle className="spin" size={20}/> Cargando usuarios...</div> : <>
        {error && <div className="permission-v2-message error">{error}</div>}
        {notice && <div className="permission-v2-message success"><Check size={14}/>{notice}</div>}

        <div className="permission-v2-toolbar">
          <label className="permission-v2-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar usuario o correo"/></label>
          <label className="permission-v2-select"><SlidersHorizontal size={14}/><select value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="ALL">Filtrar por rol</option><option value="GESTION_ESTRATEGICA">Gestión Estratégica</option><option value="GERENTE_GENERAL">Gerente General</option><option value="AREA">Acceso por área</option></select></label>
          <label className="permission-v2-select"><select value={unitCode} onChange={event => { setUnitCode(event.target.value); setSelectedIds(new Set()); setBulkOpen(false) }}>{unitOptions.map(unit => <option key={unit.code} value={unit.code}>{unit.code} · {unit.name}</option>)}</select></label>
          <label className="permission-v2-select permission-v2-area-select"><select value={targetAreaId} onChange={event => { setTargetAreaId(event.target.value); setBulkOpen(false) }}>{availableAreas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          <div className="permission-v2-bulk-wrap">
            <button type="button" className="permission-v2-bulk" disabled={!selectedIds.size || !targetArea || bulkSaving} onClick={() => setBulkOpen(value => !value)}>{bulkSaving ? <LoaderCircle className="spin" size={14}/> : <UsersRound size={15}/>} Acciones en masa</button>
            {bulkOpen && <div className="permission-v2-bulk-menu"><button onClick={() => void applyBulk('VIEW')}>Dar acceso</button><button onClick={() => void applyBulk('EDIT')}>Dar acceso + edición</button><button className="danger" onClick={() => void applyBulk('REMOVE')}>Quitar acceso</button></div>}
          </div>
        </div>

        <div className="permission-v2-context"><div><strong>{targetArea ? `${unitCode} · ${targetArea.name}` : `${unitCode} · Sin área activa`}</strong><span>Los interruptores de la tabla modifican esta área.</span></div><div><strong>{users.length}</strong><span>Usuarios totales</span></div><div><strong>Página {page} de {totalPages}</strong><span>{filteredUsers.length} resultados</span></div></div>

        <div className="permission-v2-table-wrap"><table className="permission-v2-table"><thead><tr><th className="permission-v2-check"><input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}/></th><th>Usuario</th><th>Correo electrónico</th><th>Rol principal</th><th>Áreas asignadas</th><th>Acceso</th><th>Edición</th></tr></thead><tbody>
          {pageUsers.length === 0 ? <tr><td colSpan={7} className="permission-v2-empty">No encontramos usuarios con esos filtros.</td></tr> : pageUsers.map(user => {
            const permission = targetArea ? permissionFor(user.id, targetArea.id) : undefined
            const view = Boolean(user.global_role || permission?.can_view)
            const edit = Boolean(user.global_role || permission?.can_edit)
            const badges = assignedAreasFor(user)
            return <tr key={user.id} className={selectedIds.has(user.id) ? 'selected' : ''}>
              <td className="permission-v2-check"><input type="checkbox" checked={selectedIds.has(user.id)} disabled={Boolean(user.global_role)} onChange={event => setSelectedIds(current => { const next = new Set(current); event.target.checked ? next.add(user.id) : next.delete(user.id); return next })}/></td>
              <td><div className="permission-v2-user"><span className="permission-v2-avatar">{initials(user)}</span><div><strong>{user.full_name || user.email.split('@')[0]}</strong><small>{user.active ? 'Activo' : 'Inactivo'}</small></div></div></td>
              <td className="permission-v2-email">{user.email}</td>
              <td><span className={`permission-v2-role ${user.global_role ? 'global' : ''}`}>{roleLabel(user.global_role)}</span></td>
              <td><div className="permission-v2-badges">{badges.slice(0, 6).map(badge => <span key={badge.key} className={`unit-${badge.unit.toLowerCase()}`} title={badge.label}>{badge.label}</span>)}{badges.length > 6 && <span className="more">+{badges.length - 6}</span>}{badges.length === 0 && <em>Sin áreas</em>}</div></td>
              <td className="permission-v2-switch-cell">{user.global_role ? <span className="permission-v2-global"><ShieldCheck size={14}/> Global</span> : <label className="permission-v2-switch"><input type="checkbox" checked={view} disabled={!targetArea || savingKey.startsWith(user.id)} onChange={event => void updatePermission(user, 'view', event.target.checked)}/><span/></label>}</td>
              <td className="permission-v2-switch-cell">{user.global_role ? <span className="permission-v2-global"><ShieldCheck size={14}/> Global</span> : <label className="permission-v2-switch"><input type="checkbox" checked={edit} disabled={!targetArea || savingKey.startsWith(user.id)} onChange={event => void updatePermission(user, 'edit', event.target.checked)}/><span/></label>}</td>
            </tr>
          })}
        </tbody></table></div>

        <div className="permission-v2-footer"><div className="permission-v2-global-units"><strong>Unidades con acceso global</strong>{unitOptions.map(unit => <span key={unit.code} className={`unit-${unit.code.toLowerCase()}`}>{unit.code}</span>)}</div><div className="permission-v2-pagination"><button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={16}/></button><span>{page}</span><button disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}><ChevronRight size={16}/></button></div></div>
      </>}
    </div>}
  </section>
}
