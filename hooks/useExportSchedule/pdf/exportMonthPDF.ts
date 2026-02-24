import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toJpeg } from "html-to-image"
import type { Empleado, Turno, Horario, MedioTurno } from "@/lib/types"
import { addHeader, addFooter } from "./pdfHeaderFooter"
import { addDashboardPage } from "./dashboardPage"

export const useExportMonthPDF = () => {
  const { toast } = useToast()

  const exportMonthPDF = useCallback(async (
    monthWeeks: Date[][],
    getWeekSchedule: (weekStartStr: string) => Horario | null,
    employees: Empleado[],
    shifts: Turno[],
    config?: {
      nombreEmpresa?: string
      colorEmpresa?: string
      monthRange?: { startDate: Date; endDate: Date }
      employeeMonthlyStats?: Record<string, any>
      minutosDescanso?: number;
      horasMinimasParaDescanso?: number;
    }
  ) => {
    try {
      const [jsPDF] = await Promise.all([
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

      // Agregar página de dashboard como PRIMERA página
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

      // Iterar sobre cada semana (empezar desde página 2)
      for (let weekIndex = 0; weekIndex < monthWeeks.length; weekIndex++) {
        const weekDays = monthWeeks[weekIndex]
        const weekStartDate = weekDays[0]
        const weekEndDate = weekDays[weekDays.length - 1]
        const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
        const weekId = `schedule-week-${weekStartStr}`
        
        // Usar el nuevo sistema de clonación para capturar la semana
        const weekElement = document.getElementById(weekId)
        if (!weekElement) continue

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const clone = weekElement.cloneNode(true) as HTMLElement

          const wrapper = document.createElement("div")
          wrapper.style.position = "fixed"
          wrapper.style.top = "-99999px"
          wrapper.style.left = "-99999px"
          wrapper.style.background = "#ffffff"
          wrapper.style.padding = "0"
          wrapper.style.margin = "0"
          wrapper.style.pointerEvents = "none"

          wrapper.appendChild(clone)
          document.body.appendChild(wrapper)

          const realWidth = weekElement.scrollWidth
          clone.style.width = realWidth + "px"
          clone.style.maxWidth = realWidth + "px"
          clone.style.overflow = "visible"

          requestAnimationFrame(() => {
            toJpeg(clone, {
              cacheBust: true,
              pixelRatio: 2,
              backgroundColor: "#ffffff"
            }).then(resolve).catch(reject).finally(() => {
              document.body.removeChild(wrapper)
            })
          })
        })

        // Agregar nueva página para esta semana (excepto la primera que ya es dashboard)
        if (weekIndex > 0) {
          pdf.addPage()
        }

        // Agregar header
        addHeader(pdf, weekIndex + 2, totalWeeks + 1, weekStartDate, weekEndDate, config?.nombreEmpresa)

        // Agregar imagen de la semana
        const img = new Image()
        img.src = dataUrl
        
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
        })

        const imgWidth = pdfWidth - 2 * margin
        const imgHeight = (img.height / img.width) * imgWidth
        
        // Calcular escala para que quepa en la página
        const maxHeight = contentHeight - 10
        const finalWidth = imgWidth
        const finalHeight = Math.min(imgHeight, maxHeight)
        
        pdf.addImage(img, 'JPEG', margin, headerHeight + 5, finalWidth, finalHeight)

        // Agregar footer
        addFooter(pdf, weekIndex + 2, totalWeeks + 1)
      }

      // Guardar PDF
      const monthName = format(monthWeeks[0][0], "MMMM 'de' yyyy", { locale: es })
      pdf.save(`horario-mensual-${monthName}.pdf`)

      toast({
        title: "OK",
        description: "PDF mensual exportado correctamente.",
      })
    } catch (e) {
      console.error(e)
      toast({
        title: "Error",
        description: "No se pudo exportar el PDF mensual.",
        variant: "destructive",
      })
    }
  }, [toast])

  return { exportMonthPDF }
}
