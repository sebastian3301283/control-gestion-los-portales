import { supabase } from './lib/supabase'

const SUPPORT_BUCKET = 'planning-ppts'

export function guidelineSupportFolder(unitCode: string, periodId: string, guidelineId: string) {
  return `${unitCode}/${periodId}/${guidelineId}`
}

export async function deleteGuidelineSupportFiles(unitCode: string, periodId: string, guidelineId: string) {
  if (!supabase) return { error: 'Supabase no está disponible.' }
  const folder = guidelineSupportFolder(unitCode, periodId, guidelineId)
  const { data, error: listError } = await supabase.storage.from(SUPPORT_BUCKET).list(folder, { limit: 1000 })
  if (listError) return { error: `No pudimos revisar los soportes del lineamiento: ${listError.message}` }

  const paths = (data || [])
    .filter(item => item.name && item.name !== '.emptyFolderPlaceholder')
    .map(item => `${folder}/${item.name}`)
  if (!paths.length) return { error: null }

  const { error: removeError } = await supabase.storage.from(SUPPORT_BUCKET).remove(paths)
  if (removeError) return { error: `No pudimos eliminar los soportes del lineamiento: ${removeError.message}` }
  return { error: null }
}
