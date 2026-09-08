import fs from 'node:fs'

const path = 'src/GuidelineCatalogV2.tsx'
let source = fs.readFileSync(path, 'utf8')

const rowBefore = "return <tr key={item.id} className={`${!item.active ? 'inactive-row ' : ''}${isSelected ? 'guideline-selected' : ''}`.trim()} aria-selected={isSelected || undefined} onPointerEnter={() => unitCode !== 'CENTRAL' && onPrefetchMatrixForGuideline?.(item.management_id, item.id)} onFocus={() => unitCode !== 'CENTRAL' && onPrefetchMatrixForGuideline?.(item.management_id, item.id)} onClick={() => unitCode !== 'CENTRAL' && onSelectGuideline?.({ id: item.id, managementId: item.management_id, label: item.guideline_text })}>"
const rowAfter = "return <tr key={item.id} className={`${!item.active ? 'inactive-row ' : ''}${isSelected ? 'guideline-selected' : ''}`.trim()} aria-selected={isSelected || undefined} onClick={() => unitCode !== 'CENTRAL' && onSelectGuideline?.({ id: item.id, managementId: item.management_id, label: item.guideline_text })}>"

const arrowBefore = "<button type=\"button\" className=\"guideline-row-matrix-arrow\" onClick={event => stopAndRun(event, () => onOpenMatrixForGuideline?.(item.management_id, item.id))}"
const arrowAfter = "<button type=\"button\" className=\"guideline-row-matrix-arrow\" onPointerEnter={() => onPrefetchMatrixForGuideline?.(item.management_id, item.id)} onFocus={() => onPrefetchMatrixForGuideline?.(item.management_id, item.id)} onClick={event => stopAndRun(event, () => onOpenMatrixForGuideline?.(item.management_id, item.id))}"

if (!source.includes(rowBefore)) throw new Error('Prefetch row handlers not found')
if (!source.includes(arrowBefore)) throw new Error('Matrix arrow not found')
source = source.replace(rowBefore, rowAfter).replace(arrowBefore, arrowAfter)
fs.writeFileSync(path, source)
console.log('Limited exact matrix prefetch to the matrix action control')
