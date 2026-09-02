import { Eye, FileText, LoaderCircle, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import './guideline-ppt-panel.css'

type Unit = { code: string; name: string }
type StoredPpt = {
  name: string
  created_at?: string | null
  updated_at?: string | null
  metadata?: { size?: number } | null
}
type Props = {
  unit: Unit
  periodId: string
  canManage: boolean
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

export default function GuidelinePptPanel({ unit, periodId, canManage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<StoredPpt[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [viewerUrl, setViewerUrl] = useState('')
  const [viewerName, setViewerName] = useState('')

  const folder = `${unit.code}/${periodId}`

  useEffect(() => { void loadFiles() }, [unit.code, periodId])

  async function loadFiles() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error: listError } = await supabase.storage.from('planning-ppts').list(folder, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    setLoading(false)
    if (listError) {
      setError('No pudimos cargar las presentaciones guardadas.')
      return
    }
    setFiles(((data || []) as StoredPpt[]).filter(item => /\.pptx?$/i.test(item.name)))
  }

  async function upload(file: File) {
    if (!supabase || !canManage) return
    if (!/\.pptx?$/i.test(file.name)) {
      setError('Solo se permiten archivos PowerPoint .ppt o .pptx.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('El PPT supera 50 MB.')
      return
    }

    setUploading(true)
    setError('')
    const name = `${Date.now()}-${safeName(file.name) || 'presentacion.pptx'}`
    const { error: uploadError } = await supabase.storage.from('planning-ppts').upload(`${folder}/${name}`, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || (file.name.toLowerCase().endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/vnd.ms-powerpoint'),
    })
    setUploading(false)
    if (uploadError) {
      setError(`No pudimos guardar el PPT: ${uploadError.message}`)
      return
    }
    await loadFiles()
  }

  async function view(file: StoredPpt) {
    if (!supabase) return
    setError('')
    const { data, error: signedError } = await supabase.storage.from('planning-ppts').createSignedUrl(`${folder}/${file.name}`, 60 * 30)
    if (signedError || !data?.signedUrl) {
      setError('No pudimos abrir la presentación.')
      return
    }
    setViewerName(displayName(file.name))
    setViewerUrl(data.signedUrl)
  }

  async function remove(file: StoredPpt) {
    if (!supabase || !canManage) return
    const accepted = window.confirm(`¿Eliminar la presentación “${displayName(file.name)}”?`)
    if (!accepted) return
    const { error: removeError } = await supabase.storage.from('planning-ppts').remove([`${folder}/${file.name}`])
    if (removeError) {
      setError('No pudimos eliminar la presentación.')
      return
    }
    await loadFiles()
  }

  return <section className="guideline-ppt-panel">
    <div className="guideline-ppt-head">
      <div><span>Presentación de soporte</span><h4>PowerPoint de la planificación</h4><p>Guarda y consulta el PPT de esta unidad y periodo junto a sus lineamientos.</p></div>
      {canManage && <>
        <input ref={inputRef} type="file" accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }}/>
        <button type="button" className="guideline-ppt-upload" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={16}/> : <Upload size={16}/>} Guardar PPT</button>
      </>}
    </div>

    {error && <div className="guideline-ppt-error">{error}</div>}

    <div className="guideline-ppt-list">
      {loading ? <div className="guideline-ppt-empty"><LoaderCircle className="spin" size={17}/> Cargando presentaciones...</div> : files.length === 0 ? <div className="guideline-ppt-empty"><FileText size={19}/> Aún no hay un PPT guardado para esta planificación.</div> : files.map(file => <article key={file.name} className="guideline-ppt-file">
        <span className="guideline-ppt-file-icon"><FileText size={21}/></span>
        <div className="guideline-ppt-file-copy"><strong>{displayName(file.name)}</strong><small>{sizeLabel(file.metadata?.size)}{file.created_at ? `${file.metadata?.size ? ' · ' : ''}${new Date(file.created_at).toLocaleString('es-PE')}` : ''}</small></div>
        <button type="button" className="guideline-ppt-view" onClick={() => void view(file)}><Eye size={15}/> Ver PPT</button>
        {canManage && <button type="button" className="guideline-ppt-delete" title="Eliminar PPT" onClick={() => void remove(file)}><Trash2 size={15}/></button>}
      </article>)}
    </div>

    {viewerUrl && <div className="guideline-ppt-viewer-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) { setViewerUrl(''); setViewerName('') } }}>
      <section className="guideline-ppt-viewer" role="dialog" aria-modal="true">
        <div className="guideline-ppt-viewer-head"><div><span>Vista previa</span><strong>{viewerName}</strong></div><button type="button" onClick={() => { setViewerUrl(''); setViewerName('') }}>Cerrar</button></div>
        <iframe title={viewerName} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewerUrl)}`} />
        <div className="guideline-ppt-viewer-foot"><a href={viewerUrl} target="_blank" rel="noreferrer">Abrir archivo directamente</a></div>
      </section>
    </div>}
  </section>
}
