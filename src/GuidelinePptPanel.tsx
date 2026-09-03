import { Eye, FileText, LoaderCircle, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import './guideline-ppt-panel.css'

type Unit = { code: string; name: string }
type StoredDocument = {
  name: string
  created_at?: string | null
  updated_at?: string | null
  metadata?: { size?: number } | null
}
type AreaOption = { id: string; name: string }
type Props = {
  unit: Unit
  periodId: string
  canManage: boolean
  managementId?: string | null
  managementName?: string | null
}

function safeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function displayName(name: string) {
  return name.replace(/^\d{13}-/, '')
}

function sizeLabel(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isPdf(name: string) {
  return /\.pdf$/i.test(name)
}

export default function GuidelinePptPanel({ unit, periodId, canManage, managementId, managementName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<StoredDocument[]>([])
  const [areas, setAreas] = useState<AreaOption[]>([])
  const [localAreaId, setLocalAreaId] = useState('')
  const [loadingAreas, setLoadingAreas] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [viewerUrl, setViewerUrl] = useState('')
  const [viewerName, setViewerName] = useState('')
  const [viewerPdf, setViewerPdf] = useState(false)
  const [areaCanEdit, setAreaCanEdit] = useState(false)

  const effectiveManagementId = managementId || localAreaId || ''
  const effectiveArea = useMemo(() => {
    if (managementId) return { id: managementId, name: managementName || 'Área seleccionada' }
    return areas.find(area => area.id === localAreaId) || null
  }, [managementId, managementName, areas, localAreaId])
  const folder = effectiveManagementId ? `${unit.code}/${periodId}/${effectiveManagementId}` : ''
  const canUpload = canManage || areaCanEdit

  useEffect(() => {
    if (!managementId) void loadAreas()
  }, [unit.code, managementId, canManage])

  useEffect(() => {
    if (managementId) return
    if (!localAreaId && areas.length) setLocalAreaId(areas[0].id)
    if (localAreaId && !areas.some(area => area.id === localAreaId)) setLocalAreaId(areas[0]?.id || '')
  }, [areas, localAreaId, managementId])

  useEffect(() => {
    void loadPermission()
    void loadFiles()
  }, [unit.code, periodId, effectiveManagementId])

  async function loadAreas() {
    if (!supabase) return
    setLoadingAreas(true)
    setError('')

    const { data, error: areaError } = await supabase
      .from('managements_global')
      .select('id,name')
      .eq('unit_code', unit.code)
      .eq('active', true)
      .order('name')

    if (areaError) {
      setLoadingAreas(false)
      setAreas([])
      setError('No pudimos cargar las áreas de esta unidad.')
      return
    }

    const unitAreas = (data || []) as AreaOption[]

    if (canManage) {
      setAreas(unitAreas)
      setLoadingAreas(false)
      return
    }

    const permissionResults = await Promise.all(
      unitAreas.map(async area => {
        const { data: allowed, error: permissionError } = await supabase.rpc('can_access_management', {
          management_id_input: area.id,
          unit_code_input: unit.code,
        })
        return !permissionError && Boolean(allowed) ? area : null
      }),
    )

    setAreas(permissionResults.filter((area): area is AreaOption => Boolean(area)))
    setLoadingAreas(false)
  }

  async function loadPermission() {
    if (!supabase || !effectiveManagementId || canManage) { setAreaCanEdit(false); return }
    const { data } = await supabase.rpc('can_edit_management', { management_id_input: effectiveManagementId, unit_code_input: unit.code })
    setAreaCanEdit(Boolean(data))
  }

  async function loadFiles() {
    if (!supabase) return
    if (!effectiveManagementId) {
      setFiles([])
      setLoading(false)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    const { data, error: listError } = await supabase.storage.from('planning-ppts').list(folder, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    setLoading(false)
    if (listError) {
      setError('No pudimos cargar los documentos guardados para esta área.')
      return
    }
    setFiles(((data || []) as StoredDocument[]).filter(item => /\.(pptx?|pdf)$/i.test(item.name)))
  }

  async function upload(file: File) {
    if (!supabase || !canUpload || !effectiveManagementId) return
    if (!/\.(pptx?|pdf)$/i.test(file.name)) {
      setError('Solo se permiten archivos PowerPoint (.ppt/.pptx) o PDF (.pdf).')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('El archivo supera 50 MB.')
      return
    }

    setUploading(true)
    setError('')
    const fallback = isPdf(file.name) ? 'documento.pdf' : 'presentacion.pptx'
    const name = `${Date.now()}-${safeName(file.name) || fallback}`
    const contentType = isPdf(file.name)
      ? 'application/pdf'
      : file.type || (file.name.toLowerCase().endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/vnd.ms-powerpoint')
    const { error: uploadError } = await supabase.storage.from('planning-ppts').upload(`${folder}/${name}`, file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    })
    setUploading(false)
    if (uploadError) {
      setError(`No pudimos guardar el archivo: ${uploadError.message}`)
      return
    }
    await loadFiles()
  }

  async function view(file: StoredDocument) {
    if (!supabase || !effectiveManagementId) return
    setError('')
    const { data, error: signedError } = await supabase.storage.from('planning-ppts').createSignedUrl(`${folder}/${file.name}`, 60 * 30)
    if (signedError || !data?.signedUrl) {
      setError('No pudimos abrir el documento.')
      return
    }
    setViewerName(displayName(file.name))
    setViewerPdf(isPdf(file.name))
    setViewerUrl(data.signedUrl)
  }

  async function remove(file: StoredDocument) {
    if (!supabase || !canUpload || !effectiveManagementId) return
    const accepted = window.confirm(`¿Eliminar el documento “${displayName(file.name)}”?`)
    if (!accepted) return
    const { error: removeError } = await supabase.storage.from('planning-ppts').remove([`${folder}/${file.name}`])
    if (removeError) {
      setError('No pudimos eliminar el documento.')
      return
    }
    await loadFiles()
  }

  return <section className="guideline-ppt-panel">
    <div className="guideline-ppt-head">
      <div><span>Documentos de soporte{effectiveArea ? ` · ${effectiveArea.name}` : ''}</span><h4>PowerPoint y PDF de la planificación</h4><p>{effectiveArea ? `Los archivos de ${effectiveArea.name} solo se muestran a usuarios con acceso a esta área.` : 'Selecciona un área para ver sus documentos de soporte.'}</p></div>
      <div className="guideline-ppt-head-actions">
        {!managementId && <label className="guideline-ppt-area-select"><span>Área</span><select value={localAreaId} onChange={event => setLocalAreaId(event.target.value)} disabled={loadingAreas || areas.length === 0}><option value="">{loadingAreas ? 'Cargando áreas...' : areas.length ? 'Selecciona un área' : 'Sin áreas disponibles'}</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>}
        {canUpload && effectiveManagementId && <>
          <input ref={inputRef} type="file" accept=".ppt,.pptx,.pdf,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }}/>
          <button type="button" className="guideline-ppt-upload" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={16}/> : <Upload size={16}/>} Guardar PPT / PDF</button>
        </>}
      </div>
    </div>

    {error && <div className="guideline-ppt-error">{error}</div>}

    <div className="guideline-ppt-list">
      {!effectiveManagementId ? <div className="guideline-ppt-empty"><FileText size={19}/> {loadingAreas ? 'Cargando áreas disponibles...' : 'Selecciona un área para ver sus documentos.'}</div> : loading ? <div className="guideline-ppt-empty"><LoaderCircle className="spin" size={17}/> Cargando documentos...</div> : files.length === 0 ? <div className="guideline-ppt-empty"><FileText size={19}/> Aún no hay un PPT o PDF guardado para esta área.</div> : files.map(file => <article key={file.name} className="guideline-ppt-file">
        <span className="guideline-ppt-file-icon"><FileText size={21}/></span>
        <div className="guideline-ppt-file-copy"><strong>{displayName(file.name)}</strong><small>{isPdf(file.name) ? 'PDF' : 'PowerPoint'}{file.metadata?.size ? ` · ${sizeLabel(file.metadata.size)}` : ''}{file.created_at ? ` · ${new Date(file.created_at).toLocaleString('es-PE')}` : ''}</small></div>
        <button type="button" className="guideline-ppt-view" onClick={() => void view(file)}><Eye size={15}/> Ver</button>
        {canUpload && <button type="button" className="guideline-ppt-delete" title="Eliminar documento" onClick={() => void remove(file)}><Trash2 size={15}/></button>}
      </article>)}
    </div>

    {viewerUrl && <div className="guideline-ppt-viewer-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) { setViewerUrl(''); setViewerName('') } }}>
      <section className="guideline-ppt-viewer" role="dialog" aria-modal="true">
        <div className="guideline-ppt-viewer-head"><div><span>Vista previa</span><strong>{viewerName}</strong></div><button type="button" onClick={() => { setViewerUrl(''); setViewerName('') }}>Cerrar</button></div>
        <iframe title={viewerName} src={viewerPdf ? viewerUrl : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewerUrl)}`} />
        <div className="guideline-ppt-viewer-foot"><a href={viewerUrl} target="_blank" rel="noreferrer">Abrir archivo directamente</a></div>
      </section>
    </div>}
  </section>
}
