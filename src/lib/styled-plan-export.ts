const XLSX_STYLE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/+esm'

export type StyledPlanExportInput = {
  year: number
  unitCode: string
  unitName: string
  areaName?: string | null
  guideline?: string | null
  managementNames?: string[]
  responsibleNames?: string[]
  headers: string[]
  rows: Array<Array<string | number | null | undefined>>
  central?: boolean
  fileName?: string
}

type Cell = { v?: unknown; s?: Record<string, unknown> }
type Sheet = Record<string, unknown> & { '!merges'?: unknown[]; '!cols'?: unknown[]; '!autofilter'?: unknown; '!freeze'?: unknown }

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
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
}

function textList(values?: string[]) {
  return (values || []).filter(Boolean).join(', ') || 'Sin asignar'
}

function safeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Plan_de_Accion'
}

function setCellStyle(XLSX: XlsxModule, sheet: Sheet, row: number, col: number, style: Record<string, unknown>) {
  const address = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = sheet[address] as Cell | undefined
  if (cell) cell.s = style
}

export async function exportStyledPlanWorkbook(input: StyledPlanExportInput) {
  const imported = await import(/* @vite-ignore */ XLSX_STYLE_MODULE_URL) as unknown as XlsxModule & { default?: XlsxModule }
  const XLSX = (imported.default || imported) as XlsxModule
  const accent = UNIT_ACCENTS[input.unitCode] || UNIT_ACCENTS.CENTRAL
  const columnCount = Math.max(input.headers.length, 1)

  const metaRows: unknown[][] = input.central
    ? [
      [`PLAN DE ACCIÓN ${input.year}`],
      [`ÁREA: ${input.areaName || 'Central'}`, `UNIDAD: ${input.unitName}`],
      [`RESPONSABLE(S): ${textList(input.responsibleNames)}`],
      [],
    ]
    : [
      [`PLAN DE ACCIÓN ${input.year}`],
      [input.guideline || 'Lineamiento sin descripción'],
      [`Unidad: ${input.unitName}`, `Gerencia(s) Responsable(s): ${textList(input.managementNames)}`, `Responsable(s): ${textList(input.responsibleNames)}`],
      [],
    ]

  const headerRow = metaRows.length
  const grid: unknown[][] = [...metaRows, input.headers, ...input.rows]
  const sheet = XLSX.utils.aoa_to_sheet(grid)

  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
    ...(!input.central ? [{ s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } }] : []),
  ]
  sheet['!cols'] = input.headers.map((header, index) => ({ wch: index < 2 ? (index === 0 ? 34 : 48) : Math.max(14, Math.min(32, header.length + 8)) }))
  sheet['!autofilter'] = { ref: `A${headerRow + 1}:${String.fromCharCode(64 + Math.min(columnCount, 26))}${grid.length}` }
  sheet['!freeze'] = { xSplit: 0, ySplit: headerRow + 1, topLeftCell: `A${headerRow + 2}`, activePane: 'bottomLeft', state: 'frozen' }

  const titleStyle = {
    font: { bold: true, sz: 20, color: { rgb: accent } },
    alignment: { vertical: 'center', horizontal: 'left' },
  }
  for (let col = 0; col < columnCount; col += 1) setCellStyle(XLSX, sheet, 0, col, titleStyle)

  if (!input.central) {
    const guidelineStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: accent } },
      font: { bold: true, sz: 13, color: { rgb: 'FFFFFF' } },
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: BORDER,
    }
    for (let col = 0; col < columnCount; col += 1) setCellStyle(XLSX, sheet, 1, col, guidelineStyle)
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
      setCellStyle(XLSX, sheet, row, col, {
        alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
        border: BORDER,
      })
    }
  }

  for (let row = 2; row < headerRow; row += 1) {
    for (let col = 0; col < Math.min(columnCount, 3); col += 1) {
      setCellStyle(XLSX, sheet, row, col, {
        font: { bold: true, color: { rgb: '1F3B53' } },
        alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      })
    }
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Plan de Acción')
  const fileName = input.fileName || `Plan_de_Accion_${safeName(input.unitCode)}_${safeName(input.areaName || input.unitName)}_${input.year}.xlsx`
  XLSX.writeFile(workbook, fileName)
}
