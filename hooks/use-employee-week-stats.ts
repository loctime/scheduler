import { useMemo } from "react"
import { format } from "date-fns"
import { 
  EmployeeWeekStats, 
  initializeEmployeeWeekStats
} from "@/types/employee-stats"
import { ShiftAssignment, Turno, MedioTurno, Configuracion } from "@/lib/types"
import { calculateAssignmentImpact } from "@/lib/domain/assignment-hours"

interface UseEmployeeWeekStatsProps {
  employees: Array<{ id: string; name: string }>
  weekDays: Date[]
  weekSchedule: any
  shifts: Turno[]
  config?: Configuracion | null
  mediosTurnos?: MedioTurno[]
}

/**
 * Hook para cálculo de estadísticas semanales de empleados.
 * 
 * Se calcula solo con los días de la semana visible.
 * Es independiente de las estadísticas mensuales.
 */
export function useEmployeeWeekStats({
  employees,
  weekDays,
  weekSchedule,
  shifts,
  config,
  mediosTurnos = [],
}: UseEmployeeWeekStatsProps): Record<string, EmployeeWeekStats> {
  return useMemo(() => {
    // Inicializar stats para todos los empleados
    const stats: Record<string, EmployeeWeekStats> = {}
    employees.forEach((employee) => {
      stats[employee.id] = initializeEmployeeWeekStats()
    })

    // Early return si no hay datos suficientes
    if (employees.length === 0 || shifts.length === 0 || !weekSchedule?.assignments) {
      return stats
    }

    // Procesar cada día de la semana
    weekDays.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd")
      const dateAssignments = weekSchedule.assignments[dateStr]
      if (!dateAssignments) return

      // Procesar asignaciones de cada empleado en este día
      Object.entries(dateAssignments).forEach(([employeeId, assignmentValue]) => {
        if (!stats[employeeId]) {
          stats[employeeId] = initializeEmployeeWeekStats()
        }

        // Normalizar asignaciones
        const normalizedAssignments = normalizeAssignments(assignmentValue)
        if (normalizedAssignments.length === 0) return

        // Inicializar flags diarios para contar días UNA SOLA VEZ
        let trabajoHoy = false
        let licenciaHoy = false

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
          stats[employeeId].francosSemana += impact.sumaFrancos
          stats[employeeId].horasNormalesSemana += impact.horasNormales
          stats[employeeId].horasExtrasSemana += impact.horasExtras
          stats[employeeId].horasLicenciaEmbarazoSemana += impact.horasLicencia
          stats[employeeId].horasMedioFrancoSemana += impact.horasMedioFranco

          // Actualizar flags diarios (fuera del loop de assignments)
          if (impact.aportaTrabajo) trabajoHoy = true
          if (impact.aportaLicencia) licenciaHoy = true
        })

        // Contar días UNA SOLA VEZ al finalizar todos los assignments del día
        if (trabajoHoy) {
          stats[employeeId].diasTrabajadosSemana = (stats[employeeId].diasTrabajadosSemana || 0) + 1
        }
        if (licenciaHoy) {
          stats[employeeId].diasLicenciaSemana = (stats[employeeId].diasLicenciaSemana || 0) + 1
        }
      })
    })

    return stats
  }, [
    employees,
    weekDays,
    weekSchedule,
    shifts,
    config?.minutosDescanso,
    config?.horasMinimasParaDescanso,
    mediosTurnos,
  ])
}

/**
 * Normaliza asignaciones desde diferentes formatos.
 */
function normalizeAssignments(value: any): ShiftAssignment[] {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  
  return (value as ShiftAssignment[]).map((assignment) => ({
    ...assignment,
    type: assignment.type || "shift",
  }))
}
