import { useCallback, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Empleado, Turno, Horario, ShiftAssignment } from "@/lib/types"

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

  const exportImage = useCallback(async (elementId: string, filename: string) => {
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
    const htmlElement = element as HTMLElement

    // Guardar overflow original
    const originalOverflow = {
      overflow: htmlElement.style.overflow,
      overflowX: htmlElement.style.overflowX,
      overflowY: htmlElement.style.overflowY,
    }

    try {
      disablePseudoElements()

      // mostrar todo el contenido
      htmlElement.style.overflow = "visible"
      htmlElement.style.overflowX = "visible"
      htmlElement.style.overflowY = "visible"

      // limpiar celdas
      const cleanedFlex = cleanFlexDivs(htmlElement)

      const domtoimage = await import("dom-to-image-more")

      // Aumentar la escala para una imagen más grande y de mayor resolución
      const scale = 4 // Aumentar a 4x para mejor calidad y tamaño más grande
      const dataUrl = await domtoimage.toPng(htmlElement, {
        quality: 1.0,
        bgcolor: "#ffffff",
        width: element.scrollWidth * scale,
        height: element.scrollHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        },
      })

      const link = document.createElement("a")
      link.download = filename
      link.href = dataUrl
      link.click()

      restoreFlexDivs(cleanedFlex)

      toast({
        title: "OK",
        description: "Imagen exportada correctamente.",
      })
    } catch (e) {
      console.error(e)
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
  }, [])


  const exportPDF = useCallback(async (elementId: string, filename: string) => {
    const element = document.getElementById(elementId)
    if (!element) return

    setExporting(true)

    const htmlElement = element as HTMLElement
    const originalOverflow = {
      overflow: htmlElement.style.overflow,
      overflowX: htmlElement.style.overflowX,
      overflowY: htmlElement.style.overflowY,
    }

    try {
      disablePseudoElements()

      htmlElement.style.overflow = "visible"
      htmlElement.style.overflowX = "visible"
      htmlElement.style.overflowY = "visible"

      const cleanedFlex = cleanFlexDivs(htmlElement)

      const [domtoimage, jsPDF] = await Promise.all([
        import("dom-to-image-more"),
        import("jspdf").then(m => m.default),
      ])

      // Aumentar la escala para una imagen más grande y de mayor resolución
      const scale = 4 // Aumentar a 4x para mejor calidad y tamaño más grande
      const dataUrl = await domtoimage.toPng(htmlElement, {
        quality: 1.0,
        bgcolor: "#ffffff",
        width: element.scrollWidth * scale,
        height: element.scrollHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        },
      })

      const pdf = new jsPDF("l", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()

      const img = new Image()
      img.src = dataUrl
      await new Promise(res => (img.onload = res))

      const pdfHeight = (img.height * pdfWidth) / img.width
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight)
      pdf.save(filename)

      restoreFlexDivs(cleanedFlex)

      toast({
        title: "PDF exportado",
        description: "Se generó correctamente.",
      })
    } finally {
      enablePseudoElements()
      htmlElement.style.overflow = originalOverflow.overflow
      htmlElement.style.overflowX = originalOverflow.overflowX
      htmlElement.style.overflowY = originalOverflow.overflowY
      setExporting(false)
    }
  }, [])

  // Función para exportar a Excel
  const exportExcel = useCallback(async (
    weekDays: Date[],
    employees: Empleado[],
    shifts: Turno[],
    schedule: Horario | null,
    filename: string
  ) => {
    setExporting(true)
    try {
      const XLSX = await import("xlsx")

      // Crear matriz de datos
      const data: any[][] = []

      // Fila de encabezados: Empleado + días de la semana
      const headerRow = ["Empleado"]
      weekDays.forEach((day) => {
        headerRow.push(format(day, "EEE d MMM", { locale: es }))
      })
      data.push(headerRow)

      // Función helper para obtener el texto del turno
      const getShiftText = (assignment: ShiftAssignment | string, shiftMap: Map<string, Turno>): string => {
        if (typeof assignment === "string") {
          const shift = shiftMap.get(assignment)
          return shift?.name || ""
        }
        
        if (assignment.type === "franco") {
          return "FRANCO"
        }
        
        if (assignment.type === "medio_franco") {
          if (assignment.startTime && assignment.endTime) {
            return `${assignment.startTime} - ${assignment.endTime} (1/2 Franco)`
          }
          return "1/2 Franco"
        }
        
        if (assignment.shiftId) {
          const shift = shiftMap.get(assignment.shiftId)
          if (!shift) return ""
          
          const start = assignment.startTime || shift.startTime
          const end = assignment.endTime || shift.endTime
          const start2 = assignment.startTime2 || shift.startTime2
          const end2 = assignment.endTime2 || shift.endTime2
          
          if (start && end) {
            if (start2 && end2) {
              return `${start} - ${end}\n${start2} - ${end2}`
            }
            return `${start} - ${end}`
          }
          return shift.name
        }
        
        return ""
      }

      // Crear mapa de turnos para búsqueda rápida
      const shiftMap = new Map(shifts.map((s) => [s.id, s]))

      // Filas de datos: una por empleado
      employees.forEach((employee) => {
        const row = [employee.name]
        
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
                // Formato antiguo: string[]
                assignmentArray = (assignments as string[]).map((shiftId) => ({
                  shiftId,
                  type: "shift" as const,
                }))
              } else {
                // Formato nuevo: ShiftAssignment[]
                assignmentArray = assignments as ShiftAssignment[]
              }
            }
            
            // Convertir asignaciones a texto
            const texts = assignmentArray.map((a) => getShiftText(a, shiftMap)).filter(Boolean)
            row.push(texts.join("\n") || "-")
          }
        })
        
        data.push(row)
      })

      // Crear workbook y worksheet
      const ws = XLSX.utils.aoa_to_sheet(data)
      
      // Ajustar ancho de columnas
      const colWidths = [{ wch: 20 }] // Columna de empleado
      weekDays.forEach(() => colWidths.push({ wch: 15 }))
      ws["!cols"] = colWidths

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

  return { exporting, exportImage, exportPDF, exportExcel }
}
