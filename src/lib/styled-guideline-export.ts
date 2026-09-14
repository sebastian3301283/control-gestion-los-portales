const XLSX_STYLE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/+esm'

export type StyledGuidelineExportInput = {
  year: number
  unitCode: string
  unitName: string
  areaName?: string | null
  headers: string[]
  rows: string[][]
  fileName?: string
}

type Cell = { v?: unknown; s?: Record<string, unknown> }
type Sheet = Record<string, unknown> & {
  '!merges'?: unknown[]
  '!cols'?: unknown[]
  '!rows'?: unknown[]
  '!autofilter'?: unknown
  '!freeze'?: unknown
}
type XlsxModule = {
  utils: {
    aoa_to_sheet: (rows: unknown[][]) => Sheet
    encode_cell: (cell: { r: number; c: number }) => string
    book_new: () => unknown
    book_append_sheet: (workbook: unknown, sheet: Sheet, name: string) => void
  }
  writeFile: (workbook: unknown, fileName: string) => void
}

const UNIT_ACCENTS: Record<string, string> = {
  CENTRAL: '176FB3',
  HU: '00B050',
  DEP: 'F28A22',
  VS: '2BB5D6',
  HOT: '262A2F',
}

const BORDER = {
  top: { style: 'thin', color: { rgb: 'B8C4CE' } },
  bottom: { style: 'thin', color: { rgb: 'B8C4CE' } },
  left: { style: 'thin', color: { rgb: 'B8C4CE' } },
  right: { style: 'thin', color: { rgb: 'B8C4CE' } },
}

function safeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Lineamientos'
}

function setCellStyle(XLSX: XlsxModule, sheet: Sheet, row: number, col: number, style: Record<string, unknown>) {
  const address = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = sheet[address] as Cell | undefined
  if (cell) cell.s = style
}

function widthsFor(headers: string[]) {
  return headers.map(header => {
    const normalized = header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (normalized.includes('lineamiento')) return { wch: 72 }
    if (normalized === 'n°' || normalized === 'n' || normalized.includes('codigo')) return { wch: 11 }
    if (normalized.includes('categoria')) return { wch: 24 }
    if (normalized.includes('area') || normalized.includes('gerencia')) return { wch: 34 }
    return { wch: Math.max(18, Math.min(34, header.length + 8)) }
  })
}

export async function exportStyledGuidelineWorkbook(input: StyledGuidelineExportInput) {
  const imported = await import(/* @vite-ignore */ XLSX_STYLE_MODULE_URL) as unknown as XlsxModule & { default?: XlsxModule }
  const XLSX = (imported.default || imported) as XlsxModule
  const accent = UNIT_ACCENTS[input.unitCode] || UNIT_ACCENTS.CENTRAL
  const columnCount = Math.max(input.headers.length, 1)
  const title = `LINEAMIENTOS DE ${input.unitName.toUpperCase()} ${input.year}`
  const metaRows: unknown[][] = input.areaName
    ? [[title], [`ÁREA: ${input.areaName}`], []]
    : [[title], []]
  const headerRow = metaRows.length
  const grid: unknown[][] = [...metaRows, input.headers, ...input.rows]
  const sheet = XLSX.utils.aoa_to_sheet(grid)

  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
    ...(input.areaName ? [{ s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } }] : []),
  ]
  sheet['!cols'] = widthsFor(input.headers)
  sheet['!rows'] = grid.map((_, index) => ({ hpt: index === 0 ? 28 : index === headerRow ? 24 : index > headerRow ? 42 : 20 }))
  sheet['!autofilter'] = { ref: `A${headerRow + 1}:${String.fromCharCode(64 + Math.min(columnCount, 26))}${grid.length}` }
  sheet['!freeze'] = { xSplit: 0, ySplit: headerRow + 1, topLeftCell: `A${headerRow + 2}`, activePane: 'bottomLeft', state: 'frozen' }

  const titleStyle = {
    font: { bold: true, sz: 18, color: { rgb: accent } },
    alignment: { vertical: 'center', horizontal: 'left' },
  }
  for (let col = 0; col < columnCount; col += 1) setCellStyle(XLSX, sheet, 0, col, titleStyle)

  if (input.areaName) {
    for (let col = 0; col < columnCount; col += 1) setCellStyle(XLSX, sheet, 1, col, {
      font: { bold: true, color: { rgb: '1F3B53' } },
      alignment: { vertical: 'center', horizontal: 'left' },
    })
  }

  for (let col = 0; col < columnCount; col += 1) {
    setCellStyle(XLSX, sheet, headerRow, col, {
      fill: { patternType: 'solid', fgColor: { rgb: accent } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: BORDER,
    })
  }

  for (let row = headerRow + 1; row < grid.length; row += 1) {
    for (let col = 0; col < columnCount; col += 1) {
      const isNumber = input.headers[col]?.trim().toLowerCase() === 'n°'
      const isCategory = input.headers[col]?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('categoria')
      setCellStyle(XLSX, sheet, row, col, {
        fill: row % 2 === 0 ? { patternType: 'solid', fgColor: { rgb: 'F7FAFC' } } : undefined,
        font: { bold: isNumber || isCategory, color: { rgb: '12324A' } },
        alignment: { vertical: 'top', horizontal: isNumber ? 'center' : 'left', wrapText: true },
        border: BORDER,
      })
    }
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Lineamientos')
  const suffix = input.areaName ? `_${safeName(input.areaName)}` : ''
  const fileName = input.fileName || `Lineamientos_${safeName(input.unitCode)}_${input.year}${suffix}.xlsx`
  XLSX.writeFile(workbook, fileName)
}
