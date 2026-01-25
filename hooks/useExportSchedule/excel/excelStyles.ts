import { softenColor, hexToRgb, getTextColor } from "../utils/colors"
import type { Separador } from "@/lib/types"

export const applyHeaderStyles = (XLSX: any, ws: any, range: any) => {
  // Estilo para encabezados (fila 0) - más grandes y en negrita
  for (let col = 0; col <= range.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col })
    if (!ws[cellRef]) ws[cellRef] = {}
    ws[cellRef].s = {
      fill: { fgColor: { rgb: "E0E0E0" } },
      font: { bold: true, sz: 12 },
      alignment: { wrapText: true, vertical: "center", horizontal: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      }
    }
  }
}

export const applySeparatorStyles = (
  XLSX: any,
  ws: any,
  currentRow: number,
  separator: Separador,
  range: any,
  lastSeparator: Separador | null,
  colorEmpresa?: string
) => {
  // Suavizar el color del separador
  const softenedSeparatorColor = softenColor(separator.color || "#D3D3D3")
  const separatorColor = hexToRgb(softenedSeparatorColor)
  const separatorTextColor = getTextColor(softenedSeparatorColor)
  
  // IMPORTANTE: Eliminar las otras celdas de la fila ANTES de aplicar el merge
  // Esto previene que el contenido se duplique cuando se combinan las celdas
  for (let col = 1; col <= range.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col })
    if (ws[cellRef]) {
      delete ws[cellRef]
    }
  }
  
  return {
    separatorColor,
    separatorTextColor,
    softenedSeparatorColor
  }
}

export const applyEmployeeStyles = (
  XLSX: any,
  ws: any,
  currentRow: number,
  employeeBaseColor: string
) => {
  // Suavizar el color del empleado
  const softenedEmployeeColor = softenColor(employeeBaseColor)
  const employeeBgColor = hexToRgb(softenedEmployeeColor)
  const employeeTextColor = getTextColor(softenedEmployeeColor)
  
  const employeeCellRef = XLSX.utils.encode_cell({ r: currentRow, c: 0 })
  if (!ws[employeeCellRef]) ws[employeeCellRef] = {}
  ws[employeeCellRef].s = {
    fill: { fgColor: { rgb: employeeBgColor } },
    font: { bold: true, color: { rgb: employeeTextColor }, sz: 12 },
    alignment: { wrapText: true, vertical: "center", horizontal: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    }
  }
  
  return { employeeBgColor, employeeTextColor }
}

export const applyShiftStyles = (
  XLSX: any,
  ws: any,
  currentRow: number,
  dayIndex: number,
  shiftTexts: any[],
  hasAssignments: boolean
) => {
  const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: dayIndex + 1 })
  
  if (!ws[cellRef]) ws[cellRef] = {}
  
  if (!hasAssignments) {
    ws[cellRef].s = {
      font: { bold: true, sz: 12 },
      alignment: { wrapText: true, vertical: "center", horizontal: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      }
    }
  } else {
    // Obtener color del primer turno (o el más común si hay varios)
    const primaryColor = shiftTexts[0]?.color || "FFFFFF"
    // Suavizar el color antes de usarlo
    const softenedColor = softenColor(primaryColor)
    const bgColor = hexToRgb(softenedColor)
    const textColor = getTextColor(softenedColor)
    
    ws[cellRef].s = {
      fill: { fgColor: { rgb: bgColor } },
      font: { bold: true, color: { rgb: textColor }, sz: 12 },
      alignment: { wrapText: true, vertical: "center", horizontal: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      }
    }
  }
}

export const setupColumnWidths = (weekDays: Date[]) => {
  const colWidths = [{ wch: 25 }] // Columna de empleado más ancha
  weekDays.forEach(() => colWidths.push({ wch: 18 })) // Columnas de días más anchas
  return colWidths
}

export const setupRowHeights = (orderedItemIds: string[], separadorMap: Map<string, Separador>) => {
  const rowHeights: any[] = []
  // Header
  rowHeights.push({ hpt: 30 })
  
  // Aplicar alturas según el tipo de fila
  orderedItemIds.forEach((id) => {
    if (separadorMap.has(id)) {
      // Separadores más chicos
      rowHeights.push({ hpt: 20 })
    } else {
      // Filas de empleados más altas para acomodar múltiples líneas
      rowHeights.push({ hpt: 50 })
    }
  })
  return rowHeights
}
