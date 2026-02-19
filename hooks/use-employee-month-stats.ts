import { useMemo } from "react"
import { format } from "date-fns"
import { 
  EmployeeMonthStats, 
  initializeEmployeeMonthStats
} from "@/types/employee-stats"
import { ShiftAssignment, Turno, MedioTurno, Configuracion } from "@/lib/types"
import { calculateAssignmentImpact } from "@/lib/domain/assignment-hours"
import { normalizeAssignments } from "@/lib/domain/normalize-assignments"

interface UseEmployeeMonthStatsProps {
  employees: Array<{ id: string; name: string }>
  shifts: Turno[]
  monthWeeks: Date[][]
  monthRange: { startDate: Date; endDate: Date }
  getWeekSchedule: (weekStartStr: string) => any // 🔥 Cambio: string en lugar de Date
  config?: Configuracion | null
  mediosTurnos?: MedioTurno[]
}

/**
 * Hook centralizado para cálculo de estadísticas mensuales de empleados.
 * 
 * Este hook es la FUENTE ÚNICA DE VERDAD para todas las estadísticas mensuales.
 * Se calcula una sola vez y contiene SOLO datos mensuales reales.
 * 
 * NO incluye datos semanales ni lógica de render.
 */
export function useEmployeeMonthStats({
  employees,
  shifts,
  monthWeeks,
  monthRange,
  getWeekSchedule,
  config,
  mediosTurnos = [],
}: UseEmployeeMonthStatsProps): Record<string, EmployeeMonthStats> {
  return useMemo(() => {
    // Inicializar stats para todos los empleados
    const stats: Record<string, EmployeeMonthStats> = {}
    employees.forEach((employee) => {
      stats[employee.id] = initializeEmployeeMonthStats()
    })

    // Early return si no hay datos suficientes
    if (employees.length === 0 || shifts.length === 0) {
      return stats
    }

    // Procesar cada semana del mes
    monthWeeks.forEach((weekDays) => {
      const weekStartStr = format(weekDays[0], "yyyy-MM-dd")
      const weekSchedule = getWeekSchedule(weekStartStr)
      if (!weekSchedule?.assignments) return

      // Procesar cada día de la semana
      weekDays.forEach((day) => {
        // Ignorar días fuera del rango del mes
        if (day < monthRange.startDate || day > monthRange.endDate) return

        const dateStr = format(day, "yyyy-MM-dd")
        const dateAssignments = weekSchedule.assignments?.[dateStr] || {}
        const dayStatuses = weekSchedule.dayStatus?.[dateStr] || {}
        const employeeIds = new Set([
          ...Object.keys(dateAssignments),
          ...Object.keys(dayStatuses),
        ])
        if (employeeIds.size === 0) return

        // Procesar asignaciones de cada empleado en este día
        employeeIds.forEach((employeeId) => {
          if (!stats[employeeId]) {
            stats[employeeId] = initializeEmployeeMonthStats()
          }

          // Normalizar asignaciones
          const assignmentValue = dateAssignments[employeeId]
          const normalizedAssignments = normalizeAssignments(assignmentValue)
          const dayStatus = dayStatuses[employeeId] || "normal"
          if (normalizedAssignments.length === 0 && dayStatus === "normal") {
            return
          }

          // Inicializar flags diarios para contar días UNA SOLA VEZ
          let trabajoHoy = false
          let licenciaHoy = false
          let francosDelDia = 0

          // Procesar cada asignación del empleado en este día
          normalizedAssignments.forEach((assignment) => {
            // Usar el módulo centralizado para calcular impacto
            const impact = calculateAssignmentImpact(
              assignment,
              shifts,
              mediosTurnos,
              config
            )

            // Acumular valores del impacto
            stats[employeeId].francosMes += impact.sumaFrancos
            stats[employeeId].horasNormalesMes += impact.horasNormales
            stats[employeeId].horasExtrasMes += impact.horasExtras
            stats[employeeId].horasLicenciaEmbarazoMes += impact.horasLicencia
            stats[employeeId].horasMedioFrancoMes += impact.horasMedioFranco
            francosDelDia += impact.sumaFrancos

            // Actualizar flags diarios (fuera del loop de assignments)
            if (impact.aportaTrabajo) trabajoHoy = true
            if (impact.aportaLicencia) licenciaHoy = true
          })

          if (francosDelDia === 0) {
            if (dayStatus === "franco") {
              stats[employeeId].francosMes += 1
            } else if (dayStatus === "medio_franco") {
              stats[employeeId].francosMes += 0.5
            }
          }

          // Contar días UNA SOLA VEZ al finalizar todos los assignments del día
          if (trabajoHoy) {
            stats[employeeId].diasTrabajadosMes = (stats[employeeId].diasTrabajadosMes || 0) + 1
          }
          if (licenciaHoy) {
            stats[employeeId].diasLicenciaMes = (stats[employeeId].diasLicenciaMes || 0) + 1
          }
        })
      })
    })

    return stats
  }, [
    employees,
    shifts,
    monthWeeks,
    monthRange.startDate,
    monthRange.endDate,
    getWeekSchedule,
    config,
    mediosTurnos,
  ])
}
