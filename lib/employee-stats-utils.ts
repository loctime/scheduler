import { 
  EmployeeMonthStats, 
  EmployeeWeekStats, 
  EmployeeStatsView,
  createEmployeeStatsView,
  migrateLegacyStats,
  convertToLegacyStats
} from "@/types/employee-stats"
import { ShiftAssignment, Turno, MedioTurno, Configuracion } from "@/lib/types"
import { calculateAssignmentImpact as calculateAssignmentImpactCore } from "@/lib/domain/assignment-hours"

/**
 * Utilidad centralizada para combinar estadísticas mensuales y semanales.
 * 
 * Esta función crea el objeto EmployeeStatsView que se pasa a los componentes UI.
 * NO realiza cálculos, solo combina datos ya calculados.
 */
export function createEmployeeStatsViewForUI(
  monthStats: Record<string, EmployeeMonthStats>,
  weekStats: Record<string, EmployeeWeekStats>
): Record<string, EmployeeStatsView> {
  const combined: Record<string, EmployeeStatsView> = {}
  
  // Combinar stats para cada empleado
  Object.keys(monthStats).forEach((employeeId) => {
    const monthStat = monthStats[employeeId]
    const weekStat = weekStats[employeeId] || initializeEmployeeWeekStats()
    
    combined[employeeId] = createEmployeeStatsView(monthStat, weekStat)
  })
  
  // Asegurar que todos los empleados con stats semanales también estén en el resultado
  Object.keys(weekStats).forEach((employeeId) => {
    if (!combined[employeeId]) {
      const monthStat = initializeEmployeeMonthStats()
      const weekStat = weekStats[employeeId]
      
      combined[employeeId] = createEmployeeStatsView(monthStat, weekStat)
    }
  })
  
  return combined
}

/**
 * Inicializa stats mensuales en cero (re-export para conveniencia).
 */
export function initializeEmployeeMonthStats(): EmployeeMonthStats {
  return {
    francosMes: 0,
    horasNormalesMes: 0,
    horasExtrasMes: 0,
    horasLicenciaEmbarazoMes: 0,
    horasMedioFrancoMes: 0,
    diasTrabajadosMes: 0,
    diasLicenciaMes: 0,
  }
}

/**
 * Inicializa stats semanales en cero (re-export para conveniencia).
 */
export function initializeEmployeeWeekStats(): EmployeeWeekStats {
  return {
    francosSemana: 0,
    horasNormalesSemana: 0,
    horasExtrasSemana: 0,
    horasLicenciaEmbarazoSemana: 0,
    horasMedioFrancoSemana: 0,
    diasTrabajadosSemana: 0,
    diasLicenciaSemana: 0,
  }
}

/**
 * Calcula el impacto de una asignación individual en las estadísticas.
 * 
 * Esta función ahora usa el módulo centralizado assignment-hours.ts
 * para evitar duplicación de lógica de negocio.
 */
export function calculateAssignmentImpact(
  assignment: ShiftAssignment,
  shifts: Turno[],
  mediosTurnos: MedioTurno[],
  config?: Configuracion | null
): {
  monthDelta: EmployeeMonthStats
  weekDelta: EmployeeWeekStats
} {
  // Usar el módulo centralizado para calcular impacto
  const impact = calculateAssignmentImpactCore(assignment, shifts, mediosTurnos, config)
  
  const monthDelta = initializeEmployeeMonthStats()
  const weekDelta = initializeEmployeeWeekStats()
  
  // Mapear impacto a deltas mensuales
  monthDelta.francosMes = impact.sumaFrancos
  monthDelta.horasNormalesMes = impact.horasNormales
  monthDelta.horasExtrasMes = impact.horasExtras
  monthDelta.horasLicenciaEmbarazoMes = impact.horasLicencia
  monthDelta.horasMedioFrancoMes = impact.horasMedioFranco
  
  if (impact.aportaTrabajo) {
    monthDelta.diasTrabajadosMes = 1
  }
  if (impact.aportaLicencia) {
    monthDelta.diasLicenciaMes = 1
  }
  
  // Mapear impacto a deltas semanales
  weekDelta.francosSemana = impact.sumaFrancos
  weekDelta.horasNormalesSemana = impact.horasNormales
  weekDelta.horasExtrasSemana = impact.horasExtras
  weekDelta.horasLicenciaEmbarazoSemana = impact.horasLicencia
  weekDelta.horasMedioFrancoSemana = impact.horasMedioFranco
  
  if (impact.aportaTrabajo) {
    weekDelta.diasTrabajadosSemana = 1
  }
  if (impact.aportaLicencia) {
    weekDelta.diasLicenciaSemana = 1
  }
  
  return { monthDelta, weekDelta }
}

// Re-exportar funciones desde types para conveniencia
export { convertToLegacyStats } from "@/types/employee-stats"
