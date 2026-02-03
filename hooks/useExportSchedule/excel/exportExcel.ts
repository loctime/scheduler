import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import type { Empleado, Turno, Horario, Separador } from "@/lib/types"
import { 
  createEmployeeMaps, 
  getOrderedItemIds, 
  createHeaderRow, 
  processEmployeeRow, 
  processSeparatorRow 
} from "./excelHelpers"
import { 
  applyHeaderStyles, 
  applySeparatorStyles, 
  applyEmployeeStyles, 
  applyShiftStyles, 
  setupColumnWidths, 
  setupRowHeights 
} from "./excelStyles"

export const useExportExcel = () => {
  const { toast } = useToast()

  const exportExcel = useCallback(async (
    weekDays: Date[],
    employees: Empleado[],
    shifts: Turno[],
    schedule: Horario | null,
    filename: string,
    config?: { 
      separadores?: Separador[]; 
      ordenEmpleados?: string[]; 
      colorEmpresa?: string;
      nombreEmpresa?: string 
    }
  ) => {
    try {
      const XLSX = await import("xlsx-js-style")

      // Crear matriz de datos
      const data: any[][] = []

      // Fila de encabezados: Empleado + días de la semana
      const headerRow = createHeaderRow(weekDays, config?.nombreEmpresa)
      data.push(headerRow)

      // Crear mapa de turnos para búsqueda rápida
      const { shiftMap, separadorMap, employeeMap } = createEmployeeMaps(employees, shifts, config?.separadores)
      
      // Obtener orden de elementos (empleados y separadores)
      const orderedItemIds = getOrderedItemIds(employees, config?.separadores, config?.ordenEmpleados)

      let currentRow = 1 // Empezar después del header

      // Procesar elementos ordenados (empleados y separadores)
      orderedItemIds.forEach((id) => {
        // Verificar si es un separador
        if (separadorMap.has(id)) {
          const separator = separadorMap.get(id)!
          const row = processSeparatorRow(separator, weekDays)
          data.push(row)
          currentRow++
        }
        // Verificar si es un empleado
        else if (employeeMap.has(id)) {
          const employee = employeeMap.get(id)!
          const row = processEmployeeRow(employee, weekDays, schedule, shiftMap)
          data.push(row)
          currentRow++
        }
      })

      // Crear workbook y worksheet
      const ws = XLSX.utils.aoa_to_sheet(data)
      
      // Aplicar estilos
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
      
      // Estilo para encabezados
      applyHeaderStyles(XLSX, ws, range)
      
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
          
          const { separatorColor, separatorTextColor } = applySeparatorStyles(
            XLSX, ws, currentRow, separator, range, lastSeparator, config?.colorEmpresa
          )
          
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
          
          applyEmployeeStyles(XLSX, ws, currentRow, employeeBaseColor)
          
          // Aplicar estilos a celdas de turnos
          weekDays.forEach((day, dayIndex) => {
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
            const assignments = schedule?.assignments[dateStr]?.[employee.id]
            const dayStatus = schedule?.dayStatus?.[dateStr]?.[employee.id] || "normal"
            
            let hasAssignments = false
            let shiftTexts: any[] = []
            
            if (dayStatus === "franco") {
              hasAssignments = true
              shiftTexts = [{ text: "FRANCO", color: "#22c55e" }]
            } else if (assignments && assignments.length > 0) {
              hasAssignments = true
              // Convertir a array de ShiftAssignment
              const assignmentArray = assignments as any[]
              
              // Obtener textos de turnos
              shiftTexts = assignmentArray.map((a) => {
                if (a.type === "franco") {
                  return { text: "FRANCO", color: "#22c55e" }
                }
                
                if (a.type === "medio_franco") {
                  if (a.startTime && a.endTime) {
                    return { text: `${a.startTime} - ${a.endTime}\n(1/2 Franco)`, color: "#22c55e" }
                  }
                  return { text: "1/2 Franco", color: "#22c55e" }
                }
                
                if (a.type === "licencia") {
                  const licenciaTypeLabel = a.licenciaType === "embarazo" ? "Lic. Embarazo" : 
                                           a.licenciaType === "vacaciones" ? "Lic. Vacaciones" :
                                           "Licencia"
                  if (a.startTime && a.endTime) {
                    return { text: `${licenciaTypeLabel}\n${a.startTime} - ${a.endTime}`, color: "#f59e0b" }
                  }
                  return { text: licenciaTypeLabel, color: "#f59e0b" }
                }
                
                if (a.shiftId && a.type === "shift") {
                  const shift = shiftMap.get(a.shiftId)
                  const color = shift?.color || "#808080"
                  
                  const start = a.startTime
                  const end = a.endTime
                  const start2 = a.startTime2
                  const end2 = a.endTime2
                  
                  if (start && end && start2 && end2) {
                    return { text: `${start} - ${end}\n${start2} - ${end2}`, color }
                  }
                  
                  if (start && end) {
                    return { text: `${start} - ${end}`, color }
                  }
                  
                  if (start2 && end2) {
                    return { text: `${start2} - ${end2}`, color }
                  }
                  
                  return { text: "Horario incompleto", color }
                }
                
                return { text: "Horario incompleto", color: "#808080" }
              }).filter(s => s.text)
            }
            
            applyShiftStyles(XLSX, ws, currentRow, dayIndex, shiftTexts, hasAssignments)
          })
          
          currentRow++
        }
      })
      
      // Aplicar los merges al worksheet
      if (merges.length > 0) {
        ws["!merges"] = merges
      }
      
      // Ajustar ancho de columnas
      ws["!cols"] = setupColumnWidths(weekDays)
      
      // Ajustar altura de filas
      ws["!rows"] = setupRowHeights(orderedItemIds, separadorMap)

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
    }
  }, [toast])

  return { exportExcel }
}
