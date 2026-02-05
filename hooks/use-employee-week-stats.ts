import { useMemo } from "react"
import { format } from "date-fns"
import { 
  EmployeeWeekStats, 
  initializeEmployeeWeekStats,
  BUSINESS_RULES 
} from "@/types/employee-stats"
import { ShiftAssignment, Turno, MedioTurno, Configuracion } from "@/lib/types"
import { calculateHoursBreakdown } from "@/lib/validations"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"

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

    // Configuración para cálculos
    const minutosDescanso = config?.minutosDescanso ?? 30
    const horasMinimasParaDescanso = config?.horasMinimasParaDescanso ?? 6
    const workingConfig = toWorkingHoursConfig(config)

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

        // Procesar cada asignación del empleado
        normalizedAssignments.forEach((assignment) => {
          processAssignmentForWeekStats(
            assignment,
            stats[employeeId],
            shifts,
            mediosTurnos,
            minutosDescanso,
            horasMinimasParaDescanso,
            workingConfig
          )
        })
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
 * Procesa una asignación individual para actualizar estadísticas semanales.
 * Aplica las mismas reglas de negocio que el cálculo mensual pero solo para la semana.
 */
function processAssignmentForWeekStats(
  assignment: ShiftAssignment,
  stats: EmployeeWeekStats,
  shifts: Turno[],
  mediosTurnos: MedioTurno[],
  minutosDescanso: number,
  horasMinimasParaDescanso: number,
  workingConfig: any
): void {
  switch (assignment.type) {
    case "franco":
      // REGLA: Franco suma +1 franco, NO suma horas
      stats.francosSemana += BUSINESS_RULES.franco.sumaFrancos
      // NO suma horas normales ni extras
      break

    case "medio_franco":
      // REGLA: Medio franco suma +0.5 franco Y suma horas del medio turno
      stats.francosSemana += BUSINESS_RULES.medioFranco.sumaFrancos
      
      // Calcular horas del medio turno
      const medioFrancoHours = calculateMedioFrancoHours(
        assignment,
        mediosTurnos
      )
      stats.horasMedioFrancoSemana += medioFrancoHours
      
      // NO suma horas extras
      break

    case "shift":
      // REGLA: Turno normal suma horas normales, NO suma francos
      const shiftHours = calculateShiftHours(
        assignment,
        shifts,
        minutosDescanso,
        horasMinimasParaDescanso,
        workingConfig
      )
      stats.horasNormalesSemana += shiftHours.normales
      
      // Las horas extras se calculan por separado
      if (shiftHours.extras > 0) {
        stats.horasExtrasSemana += shiftHours.extras
      }
      
      // Contar día trabajado si tiene horas
      if (shiftHours.normales > 0 || shiftHours.extras > 0) {
        stats.diasTrabajadosSemana = (stats.diasTrabajadosSemana || 0) + 1
      }
      break

    case "licencia":
      // REGLA: Licencia suma horas de licencia, NO suma francos ni horas normales
      const licenciaHours = calculateLicenciaHours(
        assignment,
        shifts,
        minutosDescanso,
        horasMinimasParaDescanso
      )
      stats.horasLicenciaEmbarazoSemana += licenciaHours
      
      // Contar día de licencia
      stats.diasLicenciaSemana = (stats.diasLicenciaSemana || 0) + 1
      break

    case "nota":
      // Las notas no afectan las estadísticas
      break

    default:
      // Tipo desconocido, ignorar
      break
  }
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

/**
 * Calcula horas para un medio franco.
 */
function calculateMedioFrancoHours(
  assignment: ShiftAssignment,
  mediosTurnos: MedioTurno[]
): number {
  // Usar horas específicas del assignment si existen
  if (assignment.startTime && assignment.endTime) {
    // Calcular diferencia en horas
    const start = new Date(`2000-01-01T${assignment.startTime}`)
    const end = new Date(`2000-01-01T${assignment.endTime}`)
    const diffMs = end.getTime() - start.getTime()
    return Math.max(0, diffMs / (1000 * 60 * 60))
  }
  
  // Si no hay horas específicas, buscar en medios turnos configurados
  // (lógica adicional si es necesario)
  return 0
}

/**
 * Calcula horas para un turno normal.
 */
function calculateShiftHours(
  assignment: ShiftAssignment,
  shifts: Turno[],
  minutosDescanso: number,
  horasMinimasParaDescanso: number,
  workingConfig: any
): { normales: number; extras: number } {
  // Usar calculateHoursBreakdown para obtener desglose
  const hoursBreakdown = calculateHoursBreakdown(
    [assignment],
    shifts,
    minutosDescanso,
    horasMinimasParaDescanso
  )
  
  // Usar calculateTotalDailyHours para separar normales de extras
  const { horasComputables, horasExtra } = calculateTotalDailyHours([assignment], workingConfig)
  
  return {
    normales: horasComputables,
    extras: horasExtra,
  }
}

/**
 * Calcula horas para licencia.
 */
function calculateLicenciaHours(
  assignment: ShiftAssignment,
  shifts: Turno[],
  minutosDescanso: number,
  horasMinimasParaDescanso: number
): number {
  // Usar calculateHoursBreakdown para obtener horas de licencia
  const hoursBreakdown = calculateHoursBreakdown(
    [assignment],
    shifts,
    minutosDescanso,
    horasMinimasParaDescanso
  )
  
  return hoursBreakdown.licencia || 0
}
