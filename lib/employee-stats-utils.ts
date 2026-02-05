import { 
  EmployeeMonthStats, 
  EmployeeWeekStats, 
  EmployeeStatsView,
  createEmployeeStatsView,
  migrateLegacyStats,
  convertToLegacyStats
} from "@/types/employee-stats"
import { ShiftAssignment, Turno, MedioTurno, Configuracion } from "@/lib/types"

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

// Re-exportar funciones desde types para conveniencia
export { convertToLegacyStats } from "@/types/employee-stats"
