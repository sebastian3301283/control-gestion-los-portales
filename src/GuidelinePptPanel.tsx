import { Eye, FileImage, FileText, LoaderCircle, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import './guideline-ppt-panel.css'

type Unit = { code: string; name: string }
type StoredDocument = {
  name: string
  path: string
  created_at?: string | null
  updated_at?: string | null
  metadata?: { size?: number } | null
}
type StorageEntry = Omit<StoredDocument, 'path'>
type Props = {
  unit: Unit
  periodId: string
  canManage: boolean
  managementId?: string | null
  managementName?: string | null
}
type ViewerKind = 'pdf' | 'office' | 'image'

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

function isPdf(name: string) { return /\.pdf$/i.test(name) }
function isImage(name: string) { return /\.(png|jpe?g|webp)$/i.test(name) }
function supportedDocument(name: string) { return /\.(pptx?|pdf|png|jpe?g|webp)$/i.test(name) }

function fileTypeLabel(name: string) {
  if (isPdf(name)) return 'PDF'
  if (isImage(name)) return 'Imagen'
  return 'PowerPoint'
}

function contentType(file: File) {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return file.type || 'application/octet-stream'
}

function newestFirst(a: StoredDocument, b: StoredDocument) {
  const aTime = Date.parse(a.created_at || a.updated_at || '') || 0
  const bTime = Date.parse(b.created_at || b.updated_at || '') || 0
  return bTime - aTime || a.name.localeCompare(b.name, 'es')
}

export default function GuidelinePptPanel({ unit, periodId, canManage, managementId, managementName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<StoredDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [viewerUrl, setViewerUrl] = useState('')
  const [viewerName, setViewerName] = useState('')
  const [viewerKind, setViewerKind] = useState<ViewerKind>('office')

  const isCentral = unit.code === 'CENTRAL'
  const baseFolder = `${unit.code}/${periodId}`
  const centralFolder = managementId ? `${baseFolder}/${managementId}` : ''
  const canUseDocuments = !isCentral || Boolean(managementId)

  useEffect(() => { void loadFiles() }, [unit.code, periodId, managementId, isCentral])

  async function listFolder(folder: string) {
    if (!supabase) return { entries: [] as StorageEntry[], error: true }
    const { data, error: listError } = await supabase.storage.from('planning-ppts').list(folder, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    return { entries: (data || []) as StorageEntry[], error: Boolean(listError) }
  }

  async function loadFiles() {
    if (!supabase) return
    if (isCentral && !managementId) {
      setFiles([])
      setLoading(false)
      setError('')
      return
    }

    setLoading(true)
    setError('')

    if (isCentral) {
      const result = await listFolder(centralFolder)
      setLoading(false)
      if (result.error) {
        setFiles([])
        setError('No pudimos cargar los documentos guardados para esta área.')
        return
      }
      setFiles(result.entries.filter(item => supportedDocument(item.name)).map(item => ({ ...item, path: `${centralFolder}/${item.name}` })).sort(newestFirst))
      return
    }

    const rootResult = await listFolder(baseFolder)
    if (rootResult.error) {
      setLoading(false)
      setFiles([])
      setError('No pudimos cargar los documentos de soporte de esta unidad.')
      return
    }

    const directFiles = rootResult.entries
      .filter(item => supportedDocument(item.name))
      .map(item => ({ ...item, path: `${baseFolder}/${item.name}` }))
    const folderEntries = rootResult.entries.filter(item => item.name && !supportedDocument(item.name))
    const nestedResults = await Promise.all(folderEntries.map(async folderEntry => {
      const nestedFolder = `${baseFolder}/${folderEntry.name}`
      const result = await listFolder(nestedFolder)
      if (result.error) return [] as StoredDocument[]
      return result.entries
        .filter(item => supportedDocument(item.name))
        .map(item => ({ ...item, path: `${nestedFolder}/${item.name}` }))
    }))

    setFiles([...directFiles, ...nestedResults.flat()].sort(newestFirst))
    setLoading(false)
  }

  async function upload(file: File) {
    if (!supabase || !canManage || !canUseDocuments) return
    if (!supportedDocument(file.name)) {
      setError('Solo se permiten PowerPoint, PDF o imágenes PNG, JPG, JPEG y WEBP.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('El archivo supera 50 MB.')
      return
    }

    setUploading(true)
    setError('')
    const fallback = isImage(file.name) ? 'imagen.png' : isPdf(file.name) ? 'documento.pdf' : 'presentacion.pptx'
    const name = `${Date.now()}-${safeName(file.name) || fallback}`
    const targetFolder = isCentral ? centralFolder : baseFolder
    const { error: uploadError } = await supabase.storage.from('planning-ppts').upload(`${targetFolder}/${name}`, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: contentType(file),
    })
    setUploading(false)
    if (uploadError) {
      setError(`No pudimos guardar el archivo: ${uploadError.message}`)
      return
    }
    await loadFiles()
  }

  async function view(file: StoredDocument) {
    if (!supabase) return
    setError('')
    const { data, error: signedError } = await supabase.storage.from('planning-ppts').createSignedUrl(file.path, 60 * 30)
    if (signedError || !data?.signedUrl) {
      setError('No pudimos abrir el documento.')
      return
    }
    setViewerName(displayName(file.name))
    setViewerKind(isImage(file.name) ? 'image' : isPdf(file.name) ? 'pdf' : 'office')
    setViewerUrl(data.signedUrl)
  }

  async function remove(file: StoredDocument) {
    if (!supabase || !canManage) return
    const accepted = window.confirm(`¿Eliminar el documento “${displayName(file.name)}”?`)
    if (!accepted) return
    const { error: removeError } = await supabase.storage.from('planning-ppts').remove([file.path])
    if (removeError) {
      setError('No pudimos eliminar el documento.')
      return
    }
    await loadFiles()
  }

  return <section className="guideline-ppt-panel">
    <div className="guideline-ppt-head">
      <div>
        <span>Documentos de soporte{isCentral && managementName ? ` · ${managementName}` : ''}</span>
        <h4>PowerPoint, PDF e imágenes de la planificación</h4>
        <p>{isCentral ? (managementId ? `Los archivos de ${managementName || 'esta área'} se muestran dentro de la selección actual.` : 'Los documentos corresponden al área seleccionada arriba.') : 'Todos los documentos de soporte del periodo se muestran juntos para esta unidad.'}</p>
      </div>
      <div className="guideline-ppt-head-actions">
        {canManage && canUseDocuments && <>
          <input ref={inputRef} type="file" accept=".ppt,.pptx,.pdf,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }}/>
          <button type="button" className="guideline-ppt-upload" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={16}/> : <Upload size={16}/>} Guardar soporte</button>
        </>}
      </div>
    </div>

    {error && <div className="guideline-ppt-error">{error}</div>}

    <div className="guideline-ppt-list">
      {isCentral && !managementId ? <div className="guideline-ppt-empty"><FileText size={19}/> Selecciona un área arriba para ver sus documentos.</div> : loading ? <div className="guideline-ppt-empty"><LoaderCircle className="spin" size={17}/> Cargando documentos...</div> : files.length === 0 ? <div className="guideline-ppt-empty"><FileText size={19}/> Aún no hay documentos de soporte guardados.</div> : files.map(file => <article key={file.path} className="guideline-ppt-file">
        <span className="guideline-ppt-file-icon">{isImage(file.name) ? <FileImage size={21}/> : <FileText size={21}/>}</span>
        <div className="guideline-ppt-file-copy"><strong>{displayName(file.name)}</strong><small>{fileTypeLabel(file.name)}{file.metadata?.size ? ` · ${sizeLabel(file.metadata.size)}` : ''}{file.created_at ? ` · ${new Date(file.created_at).toLocaleString('es-PE')}` : ''}</small></div>
        <button type="button" className="guideline-ppt-view" onClick={() => void view(file)}><Eye size={15}/> Ver</button>
        {canManage && <button type="button" className="guideline-ppt-delete" title="Eliminar documento" onClick={() => void remove(file)}><Trash2 size={15}/></button>}
      </article>)}
    </div>

    {viewerUrl && <div className="guideline-ppt-viewer-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) { setViewerUrl(''); setViewerName('') } }}>
      <section className="guideline-ppt-viewer" role="dialog" aria-modal="true">
        <div className="guideline-ppt-viewer-head"><div><span>Vista previa</span><strong>{viewerName}</strong></div><button type="button" onClick={() => { setViewerUrl(''); setViewerName('') }}>Cerrar</button></div>
        {viewerKind === 'image' ? <img className="guideline-ppt-viewer-image" src={viewerUrl} alt={viewerName}/> : <iframe title={viewerName} src={viewerKind === 'pdf' ? viewerUrl : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewerUrl)}`} />}
        <div className="guideline-ppt-viewer-foot"><a href={viewerUrl} target="_blank" rel="noreferrer">Abrir archivo directamente</a></div>
      </section>
    </div>}
  </section>
}
