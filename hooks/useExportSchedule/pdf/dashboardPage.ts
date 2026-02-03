import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Empleado, Turno, Horario, MedioTurno } from "@/lib/types"
import { normalizeAssignments } from "../utils/assignments"
import { calculateDailyHours, calculateHoursBreakdown } from "@/lib/validations"

export const addDashboardPage = (
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
        const dayStatus = weekSchedule.dayStatus?.[dateStr]?.[employee.id] || "normal"
        
        // Type guard to ensure proper type checking
        const isFranco = dayStatus === "franco"
        
        if (isFranco) {
          francosCount += 1
          return
        }

        const assignments = weekSchedule.assignments[dateStr]?.[employee.id]
        if (!assignments || assignments.length === 0) return

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
          if (assignment.type === "medio_franco") {
            medioFrancos += 0.5
          }
        })

        // Si no es franco completo, contar como día trabajado y calcular horas
        if (!isFranco) {
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
