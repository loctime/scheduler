import { hexToRgba } from "../utils/colors"

// Función para agregar separador inferior con nombre de empresa
export const addBottomSeparator = (table: HTMLTableElement, nombreEmpresa?: string, colorEmpresa?: string) => {
  if (!nombreEmpresa) return null

  const tbody = table.querySelector("tbody")
  if (!tbody) return null

  // Crear fila de separador
  const separatorRow = document.createElement("tr")
  separatorRow.className = "export-bottom-separator"
  
  const separatorColor = colorEmpresa || "#D3D3D3"
  const backgroundColor = hexToRgba(separatorColor, 0.1)
  
  separatorRow.style.borderBottomColor = separatorColor
  separatorRow.style.borderBottomWidth = "2px"
  separatorRow.style.backgroundColor = backgroundColor

  // Obtener número de columnas (empleado + días de la semana)
  const headerRow = table.querySelector("thead tr")
  const columnCount = headerRow ? headerRow.children.length : 8 // Por defecto 8 (empleado + 7 días)

  // Crear celda que abarca todas las columnas
  const cell = document.createElement("td")
  cell.colSpan = columnCount
  cell.className = "px-4 py-0.5"
  cell.style.padding = "8px 16px"

  // Crear contenido del separador (similar a SeparatorRow pero sin días de semana)
  const separatorContent = document.createElement("div")
  separatorContent.className = "flex items-center justify-center"
  separatorContent.style.width = "100%"

  // Línea izquierda
  const lineLeft = document.createElement("div")
  lineLeft.className = "h-px flex-1"
  lineLeft.style.backgroundColor = separatorColor
  separatorContent.appendChild(lineLeft)

  // Nombre de empresa
  const empresaName = document.createElement("span")
  empresaName.className = "text-xs font-semibold uppercase tracking-wide"
  empresaName.style.color = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || '#000000'
  empresaName.style.margin = "0 12px"
  empresaName.textContent = nombreEmpresa
  separatorContent.appendChild(empresaName)

  // Línea derecha
  const lineRight = document.createElement("div")
  lineRight.className = "h-px flex-1"
  lineRight.style.backgroundColor = separatorColor
  separatorContent.appendChild(lineRight)

  cell.appendChild(separatorContent)
  separatorRow.appendChild(cell)
  tbody.appendChild(separatorRow)

  return separatorRow
}
