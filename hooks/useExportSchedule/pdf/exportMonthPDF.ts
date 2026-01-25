import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Empleado, Turno, Horario, MedioTurno } from "@/lib/types"
import { prepareElementForCapture } from "../dom/prepareElementForCapture"
import { restoreElementAfterCapture } from "../dom/restoreElementAfterCapture"
import { disablePseudoElements, enablePseudoElements } from "../dom/pseudoElements"
import { addHeader, addFooter } from "./pdfHeaderFooter"
import { addDashboardPage } from "./dashboardPage"

export const useExportMonthPDF = () => {
  const { toast } = useToast()

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
    try {
      // Desactivar pseudo-elementos UNA SOLA VEZ al inicio
      disablePseudoElements()
      
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

      const totalWeeks = monthWeeks.length

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
        
        // Feedback de progreso NO intrusivo
        if (weekIndex > 0) {
          toast({
            title: "Procesando...",
            description: `Semana ${weekIndex + 1} de ${monthWeeks.length}`,
          })
        }
        
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

        // Preparar el elemento para exportación usando el helper
        const snapshot = prepareElementForCapture(htmlElement, config)

        const scale = 2
        // Usar el ancho real de la tabla, no del contenedor, más los márgenes
        const actualWidth = table ? table.scrollWidth : htmlElement.scrollWidth
        const actualHeight = table ? table.scrollHeight : htmlElement.scrollHeight

        // Capturar como imagen JPEG con compresión para reducir tamaño
        const dataUrl = await domtoimage.toJpeg(htmlElement, {
          quality: 0.8,
          bgcolor: "#ffffff",
          width: (actualWidth + 20) * scale,
          height: (actualHeight + 20) * scale,
          style: {
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          },
        })

        // Restaurar el elemento usando el helper
        restoreElementAfterCapture(htmlElement, snapshot)

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

        // Agregar imagen al PDF (usar JPEG para menor tamaño)
        pdf.addImage(dataUrl, "JPEG", x, y, imgWidth, imgHeight)

        // Agregar footer
        addFooter(pdf, weekIndex + 1, totalWeeks)
      }

      pdf.save(filename)

      toast({
        title: "PDF exportado",
        description: `Se generó correctamente con ${totalWeeks} ${totalWeeks === 1 ? 'página' : 'páginas'}.`,
      })
    } catch (e) {
      console.error(e)
      toast({
        title: "Error",
        description: "No se pudo exportar el PDF mensual.",
        variant: "destructive",
      })
    } finally {
      // Restaurar pseudo-elementos UNA SOLA VEZ al final
      enablePseudoElements()
    }
  }, [toast])

  return { exportMonthPDF }
}
