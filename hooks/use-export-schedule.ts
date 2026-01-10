import { useCallback, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Empleado, Turno, Horario, ShiftAssignment, Separador, MedioTurno, ShiftAssignmentValue } from "@/lib/types"
import { calculateDailyHours, calculateHoursBreakdown } from "@/lib/validations"

export function useExportSchedule() {
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  // Desactiva todos los pseudo-elementos que generan los "cuadritos"
  const disablePseudoElements = () => {
    document.body.classList.add("exporting-image")
  }

  const enablePseudoElements = () => {
    document.body.classList.remove("exporting-image")
  }

  const cleanFlexDivs = (element: HTMLElement) => {
    const cleaned: Array<{
      el: HTMLElement
      background: string
      border: string
      boxShadow: string
      display: string
      padding: string
    }> = []

    // Limpiar divs en las celdas (td)
    const cells = element.querySelectorAll("td")
    cells.forEach((td) => {
      const innerDivs = td.querySelectorAll("div.flex.flex-col, div.text-center")
      innerDivs.forEach((div) => {
        const el = div as HTMLElement
        cleaned.push({
          el,
          background: el.style.background || "",
          border: el.style.border || "",
          boxShadow: el.style.boxShadow || "",
          display: el.style.display || "",
          padding: el.style.padding || "",
        })

        el.style.background = "transparent"
        el.style.border = "none"
        el.style.boxShadow = "none"
        el.style.display = "block"
      })
    })

    // Limpiar divs en el header (th) - los que tienen "Lunes", "24 nov", etc.
    const headers = element.querySelectorAll("th")
    headers.forEach((th) => {
      const innerDivs = th.querySelectorAll("div.flex.flex-col, div.text-center")
      innerDivs.forEach((div) => {
        const el = div as HTMLElement
        cleaned.push({
          el,
          background: el.style.background || "",
          border: el.style.border || "",
          boxShadow: el.style.boxShadow || "",
          display: el.style.display || "",
          padding: el.style.padding || "",
        })

        el.style.background = "transparent"
        el.style.border = "none"
        el.style.boxShadow = "none"
        el.style.display = "block"
        el.style.padding = "4px 8px"  // Padding reducido para celdas más compactas
      })
      
      // También agregar padding a los spans dentro del header
      const spans = th.querySelectorAll("span")
      spans.forEach((span) => {
        const spanEl = span as HTMLElement
        if (spanEl.style) {
          cleaned.push({
            el: spanEl,
            background: spanEl.style.background || "",
            border: spanEl.style.border || "",
            boxShadow: spanEl.style.boxShadow || "",
            display: spanEl.style.display || "",
            padding: spanEl.style.padding || "",
          })
          spanEl.style.padding = "2px 4px"  // Padding reducido para más compacidad
        }
      })
    })

    return cleaned
  }

  const restoreFlexDivs = (cleaned: any[]) => {
    cleaned.forEach(({ el, background, border, boxShadow, display, padding }) => {
      el.style.background = background
      el.style.border = border
      el.style.boxShadow = boxShadow
      el.style.display = display
      el.style.padding = padding || ""
    })
  }

  // Función helper para convertir hex a rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const cleanHex = hex.replace("#", "").trim()
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16)
      const g = parseInt(cleanHex.substring(2, 4), 16)
      const b = parseInt(cleanHex.substring(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    // Si el hex no es válido, devolver un color por defecto
    return `rgba(211, 211, 211, ${alpha})`
  }

  // Función para agregar separador inferior con nombre de empresa
  const addBottomSeparator = (table: HTMLTableElement, nombreEmpresa?: string, colorEmpresa?: string) => {
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

  const exportImage = useCallback(async (
    elementId: string, 
    filename: string,
    config?: { nombreEmpresa?: string; colorEmpresa?: string }
  ) => {
    const element = document.getElementById(elementId)
    if (!element) {
      toast({
        title: "Error",
        description: "No se encontró el elemento a exportar.",
        variant: "destructive",
      })
      return
    }

    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      toast({
        title: "Error",
        description: "El elemento no es visible.",
        variant: "destructive",
      })
      return
    }

    setExporting(true)
    
    // Esperar un frame para que el overlay se renderice
    await new Promise((resolve) => requestAnimationFrame(resolve))
    
    const htmlElement = element as HTMLElement

    // Guardar overflow original
    const originalOverflow = {
      overflow: htmlElement.style.overflow,
      overflowX: htmlElement.style.overflowX,
      overflowY: htmlElement.style.overflowY,
    }

    let bottomSeparatorRow: HTMLTableRowElement | null = null

    try {
      disablePseudoElements()

      // Eliminar padding y márgenes del elemento y sus hijos
      const originalStyles = new Map<HTMLElement, { padding: string; margin: string }>()
      const removeSpacing = (el: HTMLElement) => {
        originalStyles.set(el, {
          padding: el.style.padding || getComputedStyle(el).padding,
          margin: el.style.margin || getComputedStyle(el).margin,
        })
        el.style.padding = "0"
        el.style.margin = "0"
      }
      
      removeSpacing(htmlElement)
      htmlElement.querySelectorAll("*").forEach((el) => {
        if (el instanceof HTMLElement) {
          removeSpacing(el)
        }
      })

      // mostrar todo el contenido
      htmlElement.style.overflow = "visible"
      htmlElement.style.overflowX = "visible"
      htmlElement.style.overflowY = "visible"

      // limpiar celdas
      const cleanedFlex = cleanFlexDivs(htmlElement)

      // Ajustar contenedores al ancho real de la tabla para eliminar espacios en blanco
      const table = htmlElement.querySelector("table")
      if (table) {
        // Agregar separador inferior antes de exportar
        if (config?.nombreEmpresa) {
          bottomSeparatorRow = addBottomSeparator(table, config.nombreEmpresa, config.colorEmpresa)
        }

        const tableWidth = table.scrollWidth
        const containers = htmlElement.querySelectorAll(".overflow-x-auto, .overflow-hidden, [class*='Card'], [class*='card']")
        containers.forEach((container) => {
          if (container instanceof HTMLElement) {
            container.style.width = `${tableWidth}px`
            container.style.maxWidth = `${tableWidth}px`
          }
        })
        htmlElement.style.width = `${tableWidth}px`
        htmlElement.style.maxWidth = `${tableWidth}px`
      }

      // Agregar margen abajo y a la derecha antes de exportar
      const marginRight = 20
      const marginBottom = 20
      const originalPadding = htmlElement.style.padding || getComputedStyle(htmlElement).padding
      htmlElement.style.padding = `0 ${marginRight}px ${marginBottom}px 0`
      htmlElement.style.boxSizing = "content-box"

      const domtoimage = await import("dom-to-image-more")

      // Aumentar la escala para una imagen más grande y de mayor resolución
      const scale = 4 // Aumentar a 4x para mejor calidad y tamaño más grande
      
      // Usar el ancho real de la tabla, no del contenedor, más los márgenes
      const actualWidth = table ? table.scrollWidth : element.scrollWidth
      const actualHeight = table ? table.scrollHeight : element.scrollHeight
      
      const dataUrl = await domtoimage.toPng(htmlElement, {
        quality: 1.0,
        bgcolor: "#ffffff",
        width: (actualWidth + marginRight) * scale,
        height: (actualHeight + marginBottom) * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        },
      })

      // Restaurar padding original
      htmlElement.style.padding = originalPadding

      // Remover separador inferior después de exportar
      if (bottomSeparatorRow && bottomSeparatorRow.parentNode) {
        bottomSeparatorRow.parentNode.removeChild(bottomSeparatorRow)
      }

      const link = document.createElement("a")
      link.download = filename
      link.href = dataUrl
      link.click()

      restoreFlexDivs(cleanedFlex)

      // Restaurar estilos originales
      originalStyles.forEach((styles, el) => {
        el.style.padding = styles.padding
        el.style.margin = styles.margin
      })

      toast({
        title: "OK",
        description: "Imagen exportada correctamente.",
      })
    } catch (e) {
      console.error(e)
      // Asegurar que el separador se elimine incluso si hay error
      if (bottomSeparatorRow && bottomSeparatorRow.parentNode) {
        bottomSeparatorRow.parentNode.removeChild(bottomSeparatorRow)
      }
      toast({
        title: "Error",
        description: "No se pudo exportar.",
        variant: "destructive",
      })
    } finally {
      enablePseudoElements()
      htmlElement.style.overflow = originalOverflow.overflow
      htmlElement.style.overflowX = originalOverflow.overflowX
      htmlElement.style.overflowY = originalOverflow.overflowY
      setExporting(false)
    }
  }, [toast])


  const exportPDF = useCallback(async (
    elementId: string, 
    filename: string,
    config?: { nombreEmpresa?: string; colorEmpresa?: string }
  ) => {
    const element = document.getElementById(elementId)
    if (!element) return

    setExporting(true)
    
    // Esperar un frame para que el overlay se renderice
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const htmlElement = element as HTMLElement
    const originalOverflow = {
      overflow: htmlElement.style.overflow,
      overflowX: htmlElement.style.overflowX,
      overflowY: htmlElement.style.overflowY,
    }

    let bottomSeparatorRow: HTMLTableRowElement | null = null

    try {
      disablePseudoElements()

      // Eliminar padding y márgenes del elemento y sus hijos
      const originalStyles = new Map<HTMLElement, { padding: string; margin: string }>()
      const removeSpacing = (el: HTMLElement) => {
        originalStyles.set(el, {
          padding: el.style.padding || getComputedStyle(el).padding,
          margin: el.style.margin || getComputedStyle(el).margin,
        })
        el.style.padding = "0"
        el.style.margin = "0"
      }
      
      removeSpacing(htmlElement)
      htmlElement.querySelectorAll("*").forEach((el) => {
        if (el instanceof HTMLElement) {
          removeSpacing(el)
        }
      })

      htmlElement.style.overflow = "visible"
      htmlElement.style.overflowX = "visible"
      htmlElement.style.overflowY = "visible"

      const cleanedFlex = cleanFlexDivs(htmlElement)

      // Ajustar contenedores al ancho real de la tabla para eliminar espacios en blanco
      const table = htmlElement.querySelector("table")
      if (table) {
        // Agregar separador inferior antes de exportar
        if (config?.nombreEmpresa) {
          bottomSeparatorRow = addBottomSeparator(table, config.nombreEmpresa, config.colorEmpresa)
        }

        const tableWidth = table.scrollWidth
        const containers = htmlElement.querySelectorAll(".overflow-x-auto, .overflow-hidden, [class*='Card'], [class*='card']")
        containers.forEach((container) => {
          if (container instanceof HTMLElement) {
            container.style.width = `${tableWidth}px`
            container.style.maxWidth = `${tableWidth}px`
          }
        })
        htmlElement.style.width = `${tableWidth}px`
        htmlElement.style.maxWidth = `${tableWidth}px`
      }

      // Agregar margen abajo y a la derecha antes de exportar
      const marginRight = 20
      const marginBottom = 20
      const originalPadding = htmlElement.style.padding || getComputedStyle(htmlElement).padding
      htmlElement.style.padding = `0 ${marginRight}px ${marginBottom}px 0`
      htmlElement.style.boxSizing = "content-box"

      const [domtoimage, jsPDF] = await Promise.all([
        import("dom-to-image-more"),
        import("jspdf").then(m => m.default),
      ])

      // Aumentar la escala para una imagen más grande y de mayor resolución
      const scale = 4 // Aumentar a 4x para mejor calidad y tamaño más grande
      
      // Usar el ancho real de la tabla, no del contenedor, más los márgenes
      const actualWidth = table ? table.scrollWidth : element.scrollWidth
      const actualHeight = table ? table.scrollHeight : element.scrollHeight
      
      const dataUrl = await domtoimage.toPng(htmlElement, {
        quality: 1.0,
        bgcolor: "#ffffff",
        width: (actualWidth + marginRight) * scale,
        height: (actualHeight + marginBottom) * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        },
      })

      // Restaurar padding original
      htmlElement.style.padding = originalPadding

      // Remover separador inferior después de exportar
      if (bottomSeparatorRow && bottomSeparatorRow.parentNode) {
        bottomSeparatorRow.parentNode.removeChild(bottomSeparatorRow)
      }

      const pdf = new jsPDF("l", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()

      const img = new Image()
      img.src = dataUrl
      await new Promise(res => (img.onload = res))

      const pdfHeight = (img.height * pdfWidth) / img.width
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight)
      pdf.save(filename)

      restoreFlexDivs(cleanedFlex)

      // Restaurar estilos originales
      originalStyles.forEach((styles, el) => {
        el.style.padding = styles.padding
        el.style.margin = styles.margin
      })

      toast({
        title: "PDF exportado",
        description: "Se generó correctamente.",
      })
    } catch (e) {
      console.error(e)
      // Asegurar que el separador se elimine incluso si hay error
      if (bottomSeparatorRow && bottomSeparatorRow.parentNode) {
        bottomSeparatorRow.parentNode.removeChild(bottomSeparatorRow)
      }
      toast({
        title: "Error",
        description: "No se pudo exportar el PDF.",
        variant: "destructive",
      })
    } finally {
      enablePseudoElements()
      htmlElement.style.overflow = originalOverflow.overflow
      htmlElement.style.overflowX = originalOverflow.overflowX
      htmlElement.style.overflowY = originalOverflow.overflowY
      setExporting(false)
    }
  }, [toast])

  // Función helper para convertir color hex a RGB sin #
  const hexToRgb = (hex: string): string => {
    if (!hex) return "FFFFFF"
    const cleanHex = hex.replace("#", "").trim()
    if (cleanHex.length === 6) {
      return cleanHex.toUpperCase()
    }
    if (cleanHex.length === 3) {
      // Expandir formato corto #RGB a #RRGGBB
      return cleanHex.split("").map(c => c + c).join("").toUpperCase()
    }
    return "FFFFFF"
  }

  // Función helper para determinar color de texto según contraste
  const getTextColor = (bgColor: string): string => {
    const rgb = hexToRgb(bgColor)
    const r = parseInt(rgb.substring(0, 2), 16)
    const g = parseInt(rgb.substring(2, 4), 16)
    const b = parseInt(rgb.substring(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? "000000" : "FFFFFF"
  }

  // Función helper para suavizar colores (aumentar luminosidad ligeramente)
  const softenColor = (hex: string, factor: number = 0.15): string => {
    // Asegurarse de que el hex no tenga #
    const cleanHex = hex.replace("#", "").trim()
    const rgb = hexToRgb(cleanHex)
    const r = parseInt(rgb.substring(0, 2), 16)
    const g = parseInt(rgb.substring(2, 4), 16)
    const b = parseInt(rgb.substring(4, 6), 16)
    
    // Mezclar con blanco para suavizar (factor: 0 = color original, 1 = blanco)
    const newR = Math.round(r + (255 - r) * factor)
    const newG = Math.round(g + (255 - g) * factor)
    const newB = Math.round(b + (255 - b) * factor)
    
    return `${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`.toUpperCase()
  }

  // Función para exportar a Excel
  const exportExcel = useCallback(async (
    weekDays: Date[],
    employees: Empleado[],
    shifts: Turno[],
    schedule: Horario | null,
    filename: string,
    config?: { 
      separadores?: Separador[], 
      ordenEmpleados?: string[], 
      colorEmpresa?: string,
      nombreEmpresa?: string 
    }
  ) => {
    setExporting(true)
    try {
      const XLSX = await import("xlsx-js-style")

      // Crear matriz de datos
      const data: any[][] = []

      // Fila de encabezados: Empleado + días de la semana
      const headerRow = [config?.nombreEmpresa || "Empleado"]
      weekDays.forEach((day) => {
        headerRow.push(format(day, "EEE d MMM", { locale: es }))
      })
      data.push(headerRow)

      // Función helper para obtener el texto del turno (con formato de líneas)
      const getShiftText = (assignment: ShiftAssignment | string, shiftMap: Map<string, Turno>): { text: string, color?: string } => {
        if (typeof assignment === "string") {
          const shift = shiftMap.get(assignment)
          return { text: shift?.name || "", color: shift?.color }
        }
        
        if (assignment.type === "franco") {
          return { text: "FRANCO", color: "#22c55e" } // Verde (igual que medio franco) - hardcodeado
        }
        
        if (assignment.type === "medio_franco") {
          if (assignment.startTime && assignment.endTime) {
            return { text: `${assignment.startTime} - ${assignment.endTime}\n(1/2 Franco)`, color: "#22c55e" } // Verde por defecto - hardcodeado
          }
          return { text: "1/2 Franco", color: "#22c55e" } // Verde por defecto - hardcodeado
        }
        
        if (assignment.shiftId) {
          const shift = shiftMap.get(assignment.shiftId)
          if (!shift) return { text: "" }
          
          const start = assignment.startTime || shift.startTime
          const end = assignment.endTime || shift.endTime
          const start2 = assignment.startTime2 || shift.startTime2
          const end2 = assignment.endTime2 || shift.endTime2
          
          if (start && end) {
            if (start2 && end2) {
              // Turno cortado: una línea arriba, otra abajo
              return { text: `${start} - ${end}\n${start2} - ${end2}`, color: shift.color }
            }
            return { text: `${start} - ${end}`, color: shift.color }
          }
          return { text: shift.name, color: shift.color }
        }
        
        return { text: "" }
      }

      // Crear mapa de turnos para búsqueda rápida
      const shiftMap = new Map(shifts.map((s) => [s.id, s]))
      
      // Crear mapa de separadores
      const separadorMap = new Map((config?.separadores || []).map((s) => [s.id, s]))
      
      // Crear mapa de empleados
      const employeeMap = new Map(employees.map((e) => [e.id, e]))

      // Obtener orden de elementos (empleados y separadores)
      let orderedItemIds: string[] = []
      if (config?.ordenEmpleados && config.ordenEmpleados.length > 0) {
        const employeeIds = new Set(employees.map((e) => e.id))
        const separatorIds = new Set((config.separadores || []).map((s) => s.id))
        const validOrder = config.ordenEmpleados.filter((id) => employeeIds.has(id) || separatorIds.has(id))
        const newEmployees = employees.filter((emp) => !validOrder.includes(emp.id)).map((emp) => emp.id)
        orderedItemIds = [...validOrder, ...newEmployees]
      } else {
        orderedItemIds = employees.map((emp) => emp.id)
      }

      let currentRow = 1 // Empezar después del header

      // Procesar elementos ordenados (empleados y separadores)
      orderedItemIds.forEach((id) => {
        // Verificar si es un separador
        if (separadorMap.has(id)) {
          const separator = separadorMap.get(id)!
          // Para separadores, solo poner contenido en la primera celda
          // Las demás celdas deben estar vacías para que el merge funcione correctamente
          const row: any[] = [separator.nombre]
          // Agregar celdas vacías para el resto de columnas (días)
          for (let i = 0; i < weekDays.length; i++) {
            row.push(null) // Usar null en lugar de "" para celdas vacías
          }
          data.push(row)
          currentRow++
        }
        // Verificar si es un empleado
        else if (employeeMap.has(id)) {
          const employee = employeeMap.get(id)!
          const row: any[] = [employee.name]
          
          weekDays.forEach((day) => {
            const dateStr = format(day, "yyyy-MM-dd")
            const assignments = schedule?.assignments[dateStr]?.[employee.id]
            
            if (!assignments || (Array.isArray(assignments) && assignments.length === 0)) {
              row.push("-")
            } else {
              // Convertir a array de ShiftAssignment
              let assignmentArray: ShiftAssignment[] = []
              if (Array.isArray(assignments)) {
                if (assignments.length > 0 && typeof assignments[0] === "string") {
                  assignmentArray = (assignments as string[]).map((shiftId) => ({
                    shiftId,
                    type: "shift" as const,
                  }))
                } else {
                  assignmentArray = assignments as ShiftAssignment[]
                }
              }
              
              // Convertir asignaciones a texto (múltiples turnos separados por \n)
              const shiftTexts = assignmentArray.map((a) => getShiftText(a, shiftMap)).filter(s => s.text)
              
              if (shiftTexts.length === 0) {
                row.push("-")
              } else {
                // Combinar textos con \n (cada turno en una línea)
                const combinedText = shiftTexts.map(s => s.text).join("\n")
                row.push(combinedText)
              }
            }
          })
          
          data.push(row)
          currentRow++
        }
      })

      // Crear workbook y worksheet
      const ws = XLSX.utils.aoa_to_sheet(data)
      
      // Aplicar estilos
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
      
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
      
      // Inicializar array de merges para combinar celdas
      const merges: any[] = []
      
      // Rastrear el último separador encontrado para aplicar su color a empleados
      let lastSeparator: Separador | null = null
      
      // Aplicar estilos a filas de datos
      currentRow = 1
      orderedItemIds.forEach((id) => {
        // Verificar si es un separador
        if (separadorMap.has(id)) {
          const separator = separadorMap.get(id)!
          lastSeparator = separator
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
          
          // Combinar celdas de la fila del separador (desde columna 0 hasta la última)
          merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: range.e.c } })
          
          // Aplicar estilo solo a la primera celda (las demás se combinarán)
          const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: 0 })
          if (!ws[cellRef]) ws[cellRef] = {}
          // Asegurar que el contenido esté solo en la primera celda
          ws[cellRef].v = separator.nombre
          ws[cellRef].t = "s" // Tipo string
          ws[cellRef].s = {
            fill: { fgColor: { rgb: separatorColor } },
            font: { bold: true, color: { rgb: separatorTextColor }, sz: 12 },
            alignment: { wrapText: true, vertical: "center", horizontal: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            }
          }
          
          currentRow++
        }
        // Verificar si es un empleado
        else if (employeeMap.has(id)) {
          const employee = employeeMap.get(id)!
          
          // Color de fondo para columna de empleado: usar color del separador si existe, sino colorEmpresa
          const employeeBaseColor = lastSeparator 
            ? (lastSeparator.color || "#D3D3D3")
            : (config?.colorEmpresa || "#FFFFFF")
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
          
          // Aplicar estilos a celdas de turnos
          weekDays.forEach((day, dayIndex) => {
            const dateStr = format(day, "yyyy-MM-dd")
            const assignments = schedule?.assignments[dateStr]?.[employee.id]
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: dayIndex + 1 })
            
            if (!ws[cellRef]) ws[cellRef] = {}
            
            if (!assignments || (Array.isArray(assignments) && assignments.length === 0)) {
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
              // Convertir a array de ShiftAssignment
              let assignmentArray: ShiftAssignment[] = []
              if (Array.isArray(assignments)) {
                if (assignments.length > 0 && typeof assignments[0] === "string") {
                  assignmentArray = (assignments as string[]).map((shiftId) => ({
                    shiftId,
                    type: "shift" as const,
                  }))
                } else {
                  assignmentArray = assignments as ShiftAssignment[]
                }
              }
              
              // Obtener color del primer turno (o el más común si hay varios)
              const shiftTexts = assignmentArray.map((a) => getShiftText(a, shiftMap)).filter(s => s.text)
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
          })
          
          currentRow++
        }
      })
      
      // Aplicar los merges al worksheet
      if (merges.length > 0) {
        ws["!merges"] = merges
      }
      
      // Ajustar ancho de columnas
      const colWidths = [{ wch: 25 }] // Columna de empleado más ancha
      weekDays.forEach(() => colWidths.push({ wch: 18 })) // Columnas de días más anchas
      ws["!cols"] = colWidths
      
      // Ajustar altura de filas (más altas para que se vea mejor el texto con wrap)
      const rowHeights: any[] = []
      // Header
      rowHeights.push({ hpt: 30 })
      
      // Aplicar alturas según el tipo de fila
      currentRow = 1
      orderedItemIds.forEach((id) => {
        if (separadorMap.has(id)) {
          // Separadores más chicos
          rowHeights.push({ hpt: 20 })
        } else if (employeeMap.has(id)) {
          // Filas de empleados más altas para acomodar múltiples líneas
          rowHeights.push({ hpt: 50 })
        }
      })
      ws["!rows"] = rowHeights

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Horario")

      // Descargar archivo
      XLSX.writeFile(wb, filename)

      toast({
        title: "Excel exportado",
        description: "El archivo se descargó correctamente.",
      })
    } catch (error) {
      console.error("Error al exportar a Excel:", error)
      toast({
        title: "Error",
        description: "No se pudo exportar a Excel.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }, [toast])

  const exportMonthPDF = useCallback(async (
    monthWeeks: Date[][],
    getWeekSchedule: (weekStartDate: Date) => Horario | null,
    employees: Empleado[],
    shifts: Turno[],
    filename: string,
    config?: { 
      nombreEmpresa?: string; 
      colorEmpresa?: string;
      monthRange?: { startDate: Date; endDate: Date };
      mediosTurnos?: MedioTurno[];
      employeeMonthlyStats?: Record<string, any>;
      minutosDescanso?: number;
      horasMinimasParaDescanso?: number;
    }
  ) => {
    setExporting(true)
    
    try {
      const [domtoimage, jsPDF] = await Promise.all([
        import("dom-to-image-more"),
        import("jspdf").then(m => m.default),
      ])

      const pdf = new jsPDF("l", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      // Margen para header y footer
      const headerHeight = 20
      const footerHeight = 20
      const contentHeight = pdfHeight - headerHeight - footerHeight
      const margin = 10

      // Función para agregar header
      const addHeader = (pdf: any, pageNum: number, totalPages: number, weekStartDate: Date, weekEndDate: Date, nombreEmpresa?: string) => {
        pdf.setFontSize(16)
        pdf.setFont(undefined, "bold")
        
        // Título del mes/empresa
        if (nombreEmpresa) {
          pdf.text(nombreEmpresa, margin, 15)
        }
        
        // Fecha de la semana
        pdf.setFontSize(12)
        pdf.setFont(undefined, "normal")
        const weekText = `Semana del ${format(weekStartDate, "d", { locale: es })} - ${format(weekEndDate, "d 'de' MMMM yyyy", { locale: es })}`
        pdf.text(weekText, pdfWidth - margin - pdf.getTextWidth(weekText), 15)
      }

      // Función para agregar footer
      const addFooter = (pdf: any, pageNum: number, totalPages: number) => {
        pdf.setFontSize(10)
        pdf.setFont(undefined, "normal")
        const footerText = `Página ${pageNum} de ${totalPages}`
        const footerWidth = pdf.getTextWidth(footerText)
        pdf.text(footerText, (pdfWidth - footerWidth) / 2, pdfHeight - 5)
        
        // Línea separadora
        pdf.setDrawColor(200, 200, 200)
        pdf.line(margin, pdfHeight - footerHeight + 5, pdfWidth - margin, pdfHeight - footerHeight + 5)
      }

      const totalWeeks = monthWeeks.length

      // Función helper para normalizar asignaciones
      const normalizeAssignments = (value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
        if (!value || !Array.isArray(value) || value.length === 0) return []
        if (typeof value[0] === "string") {
          return (value as string[]).map((shiftId) => ({ shiftId, type: "shift" as const }))
        }
        return (value as ShiftAssignment[]).map((assignment) => ({
          ...assignment,
          type: assignment.type || "shift",
        }))
      }

      // Función para agregar página de dashboard
      const addDashboardPage = (
        pdf: any,
        employees: Empleado[],
        employeeMonthlyStats: Record<string, any>,
        monthRange: { startDate: Date; endDate: Date },
        monthWeeks: Date[][],
        getWeekSchedule: (weekStartDate: Date) => Horario | null,
        shifts: Turno[],
        nombreEmpresa?: string,
        config?: { minutosDescanso?: number; horasMinimasParaDescanso?: number }
      ) => {
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const margin = 15
        const headerHeight = 25
        const footerHeight = 20

        // Header
        pdf.setFontSize(18)
        pdf.setFont(undefined, "bold")
        const title = nombreEmpresa ? `Resumen Mensual - ${nombreEmpresa}` : "Resumen Mensual"
        pdf.text(title, margin, headerHeight)
        
        pdf.setFontSize(11)
        pdf.setFont(undefined, "normal")
        const monthText = `${format(monthRange.startDate, "d 'de' MMMM", { locale: es })} - ${format(monthRange.endDate, "d 'de' MMMM, yyyy", { locale: es })}`
        pdf.text(monthText, margin, headerHeight + 8)

        // Recopilar TODOS los empleados únicos de TODAS las semanas
        // Incluyendo empleados activos, de snapshots, y de asignaciones
        const allEmployeeIds = new Set<string>()
        const employeeMap = new Map<string, Empleado>()
        
        // 1. Agregar empleados activos
        employees.forEach(emp => {
          allEmployeeIds.add(emp.id)
          employeeMap.set(emp.id, emp)
        })
        
        // 2. Agregar empleados de snapshots de semanas completadas
        monthWeeks.forEach((weekDays) => {
          const weekSchedule = getWeekSchedule(weekDays[0])
          if (weekSchedule?.empleadosSnapshot) {
            weekSchedule.empleadosSnapshot.forEach((snapshotEmp) => {
              allEmployeeIds.add(snapshotEmp.id)
              if (!employeeMap.has(snapshotEmp.id)) {
                employeeMap.set(snapshotEmp.id, {
                  id: snapshotEmp.id,
                  name: snapshotEmp.name,
                  email: snapshotEmp.email,
                  phone: snapshotEmp.phone,
                  userId: '',
                } as Empleado)
              }
            })
          }
        })
        
        // 3. Agregar empleados que aparecen en asignaciones (por si acaso no están en lista activa ni en snapshots)
        monthWeeks.forEach((weekDays) => {
          const weekSchedule = getWeekSchedule(weekDays[0])
          if (weekSchedule?.assignments) {
            Object.values(weekSchedule.assignments).forEach((dateAssignments) => {
              if (dateAssignments && typeof dateAssignments === 'object') {
                Object.keys(dateAssignments).forEach((employeeId) => {
                  if (!allEmployeeIds.has(employeeId)) {
                    allEmployeeIds.add(employeeId)
                    // Si no está en el mapa, crear un empleado básico
                    if (!employeeMap.has(employeeId)) {
                      employeeMap.set(employeeId, {
                        id: employeeId,
                        name: `Empleado ${employeeId.substring(0, 8)}`,
                        email: '',
                        phone: '',
                        userId: '',
                      } as Empleado)
                    }
                  }
                })
              }
            })
          }
        })

        const allEmployees = Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name))

        // Calcular métricas adicionales para cada empleado
        const dashboardData = allEmployees.map((employee) => {
          const stats = employeeMonthlyStats[employee.id] || { francos: 0, horasExtrasSemana: 0, horasExtrasMes: 0, horasLicenciaEmbarazo: 0, horasMedioFranco: 0 }
          
          // Calcular horas trabajadas totales del mes
          let totalHoursWorked = 0
          let daysWorked = 0
          let medioFrancos = 0
          let francosCount = 0
          let totalLicenciaEmbarazo = 0
          let totalMedioFranco = 0

          monthWeeks.forEach((weekDays) => {
            const weekSchedule = getWeekSchedule(weekDays[0])
            if (!weekSchedule?.assignments) return

            weekDays.forEach((day) => {
              if (day < monthRange.startDate || day > monthRange.endDate) return

              const dateStr = format(day, "yyyy-MM-dd")
              const assignments = weekSchedule.assignments[dateStr]?.[employee.id]
              if (!assignments || (Array.isArray(assignments) && assignments.length === 0)) return

              const normalizedAssignments = normalizeAssignments(assignments)
              if (normalizedAssignments.length === 0) return

              // Calcular desglose de horas por tipo
              const hoursBreakdown = calculateHoursBreakdown(
                normalizedAssignments,
                shifts,
                config?.minutosDescanso ?? 30,
                config?.horasMinimasParaDescanso ?? 6
              )
              totalLicenciaEmbarazo += hoursBreakdown.licencia
              totalMedioFranco += hoursBreakdown.medio_franco

              // Contar francos y medio francos
              normalizedAssignments.forEach((assignment) => {
                if (assignment.type === "franco") {
                  francosCount += 1
                } else if (assignment.type === "medio_franco") {
                  medioFrancos += 0.5
                }
              })

              // Si no es franco completo, contar como día trabajado y calcular horas
              const hasFullFranco = normalizedAssignments.some(a => a.type === "franco")
              if (!hasFullFranco) {
                daysWorked++
                const dailyHours = calculateDailyHours(
                  normalizedAssignments,
                  shifts,
                  config?.minutosDescanso ?? 30,
                  config?.horasMinimasParaDescanso ?? 6
                )
                totalHoursWorked += dailyHours
              }
            })
          })

          // Usar francos calculados si stats.francos es 0 pero encontramos francos
          const finalFrancos = stats.francos > 0 ? stats.francos : francosCount

          const totalWeeks = monthWeeks.length
          const avgHoursPerWeek = totalWeeks > 0 ? totalHoursWorked / totalWeeks : 0
          const avgExtraHoursPerWeek = totalWeeks > 0 ? stats.horasExtrasMes / totalWeeks : 0

          return {
            name: employee.name,
            francos: finalFrancos,
            medioFrancos,
            horasExtrasMes: stats.horasExtrasMes,
            horasTrabajadas: totalHoursWorked,
            diasTrabajados: daysWorked,
            promedioHorasSemana: avgHoursPerWeek,
            promedioHorasExtrasSemana: avgExtraHoursPerWeek,
            horasLicenciaEmbarazo: totalLicenciaEmbarazo > 0 ? totalLicenciaEmbarazo : (stats.horasLicenciaEmbarazo || 0),
            horasMedioFranco: totalMedioFranco > 0 ? totalMedioFranco : (stats.horasMedioFranco || 0),
          }
        })

        // Verificar si hay datos de licencia embarazo o medio franco para incluir columnas
        const hasLicenciaEmbarazo = dashboardData.some(d => (d.horasLicenciaEmbarazo || 0) > 0)
        const hasMedioFranco = dashboardData.some(d => (d.horasMedioFranco || 0) > 0)
        const hasExtraColumns = hasLicenciaEmbarazo || hasMedioFranco

        // Crear tabla
        const tableStartY = headerHeight + 20
        const rowHeight = 8
        const baseColWidths = [
          pdfWidth * 0.25, // Nombre (reducido si hay columnas extras)
          pdfWidth * 0.10, // Francos
          pdfWidth * 0.10, // Horas Trabajadas
          pdfWidth * 0.10, // Horas Extras
          pdfWidth * 0.10, // Días Trabajados
          pdfWidth * 0.10, // Promedio/Semana
        ]
        
        const extraColWidths: number[] = []
        if (hasLicenciaEmbarazo) {
          extraColWidths.push(pdfWidth * 0.10) // Lic. Embarazo
        }
        if (hasMedioFranco) {
          extraColWidths.push(pdfWidth * 0.10) // Medio Franco
        }
        
        // Ajustar ancho de columnas base si hay columnas extras
        if (hasExtraColumns) {
          const totalExtraWidth = extraColWidths.reduce((a, b) => a + b, 0)
          const adjustment = totalExtraWidth / baseColWidths.length
          for (let i = 0; i < baseColWidths.length; i++) {
            baseColWidths[i] -= adjustment * 0.5
          }
        }
        
        const colWidths = [...baseColWidths, ...extraColWidths]

        // Encabezados de tabla
        pdf.setFontSize(10)
        pdf.setFont(undefined, "bold")
        pdf.setFillColor(240, 240, 240)
        pdf.rect(margin, tableStartY, pdfWidth - (margin * 2), rowHeight, 'F')
        
        // Bordes del encabezado
        pdf.setDrawColor(200, 200, 200)
        pdf.line(margin, tableStartY, pdfWidth - margin, tableStartY)
        pdf.line(margin, tableStartY + rowHeight, pdfWidth - margin, tableStartY + rowHeight)
        
        const headers = ['Empleado', 'Francos', 'Horas Trab.', 'Horas Extras', 'Días Trab.', 'Prom./Sem.']
        if (hasLicenciaEmbarazo) {
          headers.push('Lic. Emb.')
        }
        if (hasMedioFranco) {
          headers.push('Med. Franco')
        }
        let currentX = margin + 3
        headers.forEach((header, index) => {
          pdf.text(header, currentX, tableStartY + 5.5)
          // Línea vertical entre columnas (excepto la última)
          if (index < headers.length - 1) {
            pdf.line(currentX + colWidths[index] - 1, tableStartY, currentX + colWidths[index] - 1, tableStartY + rowHeight)
          }
          currentX += colWidths[index]
        })

        // Filas de datos
        pdf.setFontSize(9)
        pdf.setFont(undefined, "normal")
        let currentY = tableStartY + rowHeight

        dashboardData.forEach((data, index) => {
          // Alternar color de fondo para mejor legibilidad
          if (index % 2 === 0) {
            pdf.setFillColor(250, 250, 250)
            pdf.rect(margin, currentY, pdfWidth - (margin * 2), rowHeight, 'F')
          }

          // Bordes
          pdf.setDrawColor(220, 220, 220)
          pdf.line(margin, currentY, pdfWidth - margin, currentY)

          // Datos
          let x = margin + 3
          pdf.text(data.name.substring(0, 25), x, currentY + 5.5) // Truncar nombre si es muy largo
          // Línea vertical
          pdf.line(x + colWidths[0] - 1, currentY, x + colWidths[0] - 1, currentY + rowHeight)
          x += colWidths[0]
          
          pdf.text(data.francos.toFixed(1), x, currentY + 5.5)
          pdf.line(x + colWidths[1] - 1, currentY, x + colWidths[1] - 1, currentY + rowHeight)
          x += colWidths[1]
          
          pdf.text(data.horasTrabajadas.toFixed(1), x, currentY + 5.5)
          pdf.line(x + colWidths[2] - 1, currentY, x + colWidths[2] - 1, currentY + rowHeight)
          x += colWidths[2]
          
          pdf.text(data.horasExtrasMes.toFixed(1), x, currentY + 5.5)
          pdf.line(x + colWidths[3] - 1, currentY, x + colWidths[3] - 1, currentY + rowHeight)
          x += colWidths[3]
          
          pdf.text(data.diasTrabajados.toString(), x, currentY + 5.5)
          pdf.line(x + colWidths[4] - 1, currentY, x + colWidths[4] - 1, currentY + rowHeight)
          x += colWidths[4]
          
          pdf.text(`${data.promedioHorasSemana.toFixed(1)}h`, x, currentY + 5.5)
          if (hasExtraColumns) {
            pdf.line(x + colWidths[5] - 1, currentY, x + colWidths[5] - 1, currentY + rowHeight)
          }
          x += colWidths[5]
          
          if (hasLicenciaEmbarazo) {
            pdf.text((data.horasLicenciaEmbarazo || 0).toFixed(1), x, currentY + 5.5)
            const colIndex = 6
            if (colIndex < colWidths.length - 1 || hasMedioFranco) {
              pdf.line(x + colWidths[colIndex] - 1, currentY, x + colWidths[colIndex] - 1, currentY + rowHeight)
            }
            x += colWidths[colIndex]
          }
          
          if (hasMedioFranco) {
            pdf.text((data.horasMedioFranco || 0).toFixed(1), x, currentY + 5.5)
          }

          currentY += rowHeight

          // Si se acaba el espacio, agregar nueva página
          if (currentY > pdfHeight - footerHeight - 20) {
            pdf.addPage()
            currentY = margin + rowHeight
            // Re-dibujar encabezados
            pdf.setFontSize(10)
            pdf.setFont(undefined, "bold")
            pdf.setFillColor(240, 240, 240)
            pdf.rect(margin, margin, pdfWidth - (margin * 2), rowHeight, 'F')
            currentX = margin + 2
            headers.forEach((header, idx) => {
              pdf.text(header, currentX, margin + 6)
              currentX += colWidths[idx]
            })
            pdf.setFontSize(9)
            pdf.setFont(undefined, "normal")
          }
        })

        // Footer
        pdf.setFontSize(10)
        pdf.setFont(undefined, "normal")
        const footerText = "Resumen de estadísticas mensuales"
        pdf.text(footerText, margin, pdfHeight - 10)
      }

      // Agregar página de dashboard como PRIMERA página (antes de las semanas)
      const monthRange = config?.monthRange || { startDate: monthWeeks[0][0], endDate: monthWeeks[monthWeeks.length - 1][6] }
      addDashboardPage(
        pdf,
        employees,
        config?.employeeMonthlyStats || {},
        monthRange,
        monthWeeks,
        getWeekSchedule,
        shifts,
        config?.nombreEmpresa,
        { 
          minutosDescanso: config?.minutosDescanso ?? 30, 
          horasMinimasParaDescanso: config?.horasMinimasParaDescanso ?? 6 
        }
      )

      // Iterar sobre cada semana (empezar desde página 2, ya que la 1 es el dashboard)
      for (let weekIndex = 0; weekIndex < monthWeeks.length; weekIndex++) {
        const weekDays = monthWeeks[weekIndex]
        const weekStartDate = weekDays[0]
        const weekEndDate = weekDays[weekDays.length - 1]
        const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
        
        // Esperar a que el elemento esté disponible
        await new Promise((resolve) => setTimeout(resolve, 100))
        
        const weekElement = document.getElementById(weekId)
        if (!weekElement) {
          console.warn(`No se encontró el elemento de la semana ${weekId}`)
          continue
        }

        // Expandir la semana si está colapsada
        const collapsible = weekElement.closest('[data-slot="collapsible"]')
        if (collapsible) {
          const isClosed = collapsible.getAttribute('data-state') === 'closed'
          if (isClosed) {
            const trigger = collapsible.querySelector('[data-slot="collapsible-trigger"]') as HTMLElement
            if (trigger) {
              trigger.click()
              // Esperar a que se expanda (animación + renderizado)
              await new Promise((resolve) => setTimeout(resolve, 600))
              // Esperar múltiples frames para asegurar que todos los estilos se hayan aplicado
              await new Promise((resolve) => requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(resolve)
                })
              }))
            }
          }
        }

        // Usar el elemento completo del CollapsibleContent (igual que exportPDF individual)
        // El weekElement es el CollapsibleContent que contiene el ScheduleGrid
        const htmlElement = weekElement as HTMLElement

        // Verificar que el elemento esté visible y tenga contenido
        const table = htmlElement.querySelector("table")
        if (!table) {
          console.warn(`No se encontró la tabla en la semana ${weekId}`)
          continue
        }

        // Preparar el elemento para exportación (similar a exportPDF)
        disablePseudoElements()

        const originalOverflow = {
          overflow: htmlElement.style.overflow,
          overflowX: htmlElement.style.overflowX,
          overflowY: htmlElement.style.overflowY,
        }

        let bottomSeparatorRow: HTMLTableRowElement | null = null

        // Eliminar padding y márgenes
        const originalStyles = new Map<HTMLElement, { padding: string; margin: string }>()
        const removeSpacing = (el: HTMLElement) => {
          originalStyles.set(el, {
            padding: el.style.padding || getComputedStyle(el).padding,
            margin: el.style.margin || getComputedStyle(el).margin,
          })
          el.style.padding = "0"
          el.style.margin = "0"
        }
        
        removeSpacing(htmlElement)
        htmlElement.querySelectorAll("*").forEach((el) => {
          if (el instanceof HTMLElement) {
            removeSpacing(el)
          }
        })

        htmlElement.style.overflow = "visible"
        htmlElement.style.overflowX = "visible"
        htmlElement.style.overflowY = "visible"

        const cleanedFlex = cleanFlexDivs(htmlElement)

        // Ajustar contenedores al ancho real de la tabla
        if (table) {
          // Agregar separador inferior antes de exportar
          if (config?.nombreEmpresa) {
            bottomSeparatorRow = addBottomSeparator(table, config.nombreEmpresa, config.colorEmpresa)
          }

          const tableWidth = table.scrollWidth
          const containers = htmlElement.querySelectorAll(".overflow-x-auto, .overflow-hidden, [class*='Card'], [class*='card']")
          containers.forEach((container) => {
            if (container instanceof HTMLElement) {
              container.style.width = `${tableWidth}px`
              container.style.maxWidth = `${tableWidth}px`
            }
          })
          htmlElement.style.width = `${tableWidth}px`
          htmlElement.style.maxWidth = `${tableWidth}px`
        }

        // Agregar margen abajo y a la derecha antes de exportar
        const marginRight = 20
        const marginBottom = 20
        const originalPadding = htmlElement.style.padding || getComputedStyle(htmlElement).padding
        htmlElement.style.padding = `0 ${marginRight}px ${marginBottom}px 0`
        htmlElement.style.boxSizing = "content-box"

        const scale = 4
        // Usar el ancho real de la tabla, no del contenedor, más los márgenes
        const actualWidth = table ? table.scrollWidth : htmlElement.scrollWidth
        const actualHeight = table ? table.scrollHeight : htmlElement.scrollHeight

        // Capturar como imagen
        const dataUrl = await domtoimage.toPng(htmlElement, {
          quality: 1.0,
          bgcolor: "#ffffff",
          width: (actualWidth + marginRight) * scale,
          height: (actualHeight + marginBottom) * scale,
          style: {
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          },
        })

        // Restaurar estilos
        htmlElement.style.padding = originalPadding
        if (bottomSeparatorRow && bottomSeparatorRow.parentNode) {
          bottomSeparatorRow.parentNode.removeChild(bottomSeparatorRow)
        }
        restoreFlexDivs(cleanedFlex)
        originalStyles.forEach((styles, el) => {
          el.style.padding = styles.padding
          el.style.margin = styles.margin
        })
        htmlElement.style.overflow = originalOverflow.overflow
        htmlElement.style.overflowX = originalOverflow.overflowX
        htmlElement.style.overflowY = originalOverflow.overflowY

        // Agregar nueva página para cada semana (el dashboard está en la página 1)
        pdf.addPage()

        // Agregar header
        addHeader(pdf, weekIndex + 1, totalWeeks, weekStartDate, weekEndDate, config?.nombreEmpresa)

        // Calcular dimensiones de la imagen para que quepa en la página
        const img = new Image()
        img.src = dataUrl
        await new Promise(res => (img.onload = res))

        const imgAspectRatio = img.width / img.height
        const availableWidth = pdfWidth - (margin * 2)
        const availableHeight = contentHeight - (margin * 2)

        let imgWidth = availableWidth
        let imgHeight = imgWidth / imgAspectRatio

        // Si la imagen es muy alta, ajustar por altura
        if (imgHeight > availableHeight) {
          imgHeight = availableHeight
          imgWidth = imgHeight * imgAspectRatio
        }

        // Centrar la imagen
        const x = (pdfWidth - imgWidth) / 2
        const y = headerHeight + margin

        // Agregar imagen al PDF
        pdf.addImage(dataUrl, "PNG", x, y, imgWidth, imgHeight)

        // Agregar footer
        addFooter(pdf, weekIndex + 1, totalWeeks)

        // Restaurar pseudo-elementos después de procesar cada semana
        enablePseudoElements()
      }

      pdf.save(filename)

      toast({
        title: "PDF exportado",
        description: `Se generó correctamente con ${totalWeeks} ${totalWeeks === 1 ? 'página' : 'páginas'}.`,
      })
    } catch (e) {
      console.error(e)
      enablePseudoElements()
      toast({
        title: "Error",
        description: "No se pudo exportar el PDF mensual.",
        variant: "destructive",
      })
    } finally {
      enablePseudoElements() // Asegurar que siempre se restaure
      setExporting(false)
    }
  }, [toast, disablePseudoElements, enablePseudoElements, cleanFlexDivs, restoreFlexDivs, addBottomSeparator])

  return { exporting, exportImage, exportPDF, exportExcel, exportMonthPDF }
}
