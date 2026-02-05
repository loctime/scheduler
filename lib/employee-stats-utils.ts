import { 
  EmployeeMonthStats, 
  EmployeeWeekStats, 
  EmployeeStatsView,
  createEmployeeStatsView,
  migrateLegacyStats,
  convertToLegacyStats,
  BUSINESS_RULES,
  type EmployeeMonthlyStats
} from "@/types/employee-stats"
import { ShiftAssignment, Turno, MedioTurno, Configuracion } from "@/lib/types"
import { calculateHoursBreakdown } from "@/lib/validations"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"

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
 * Valida que las reglas de negocio se apliquen correctamente.
 * 
 * Esta función es útil para debugging y testing.
 */
export function validateBusinessRules(
  assignment: ShiftAssignment,
  expectedMonthDelta: Partial<EmployeeMonthStats>,
  expectedWeekDelta: Partial<EmployeeWeekStats>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Validar reglas según el tipo de assignment
  switch (assignment.type) {
    case "franco":
      if (expectedMonthDelta.francosMes !== BUSINESS_RULES.franco.sumaFrancos) {
        errors.push(`Franco: se esperaba +${BUSINESS_RULES.franco.sumaFrancos} francos, se recibió ${expectedMonthDelta.francosMes}`)
      }
      if ((expectedMonthDelta.horasNormalesMes || 0) !== BUSINESS_RULES.franco.sumaHoras) {
        errors.push(`Franco: se esperaba ${BUSINESS_RULES.franco.sumaHoras} horas, se recibió ${expectedMonthDelta.horasNormalesMes}`)
      }
      break
      
    case "medio_franco":
      if (expectedMonthDelta.francosMes !== BUSINESS_RULES.medioFranco.sumaFrancos) {
        errors.push(`Medio franco: se esperaba +${BUSINESS_RULES.medioFranco.sumaFrancos} francos, se recibió ${expectedMonthDelta.francosMes}`)
      }
      if (expectedMonthDelta.horasExtrasMes !== BUSINESS_RULES.medioFranco.sumaHorasExtras) {
        errors.push(`Medio franco: se esperaba ${BUSINESS_RULES.medioFranco.sumaHorasExtras} horas extra, se recibió ${expectedMonthDelta.horasExtrasMes}`)
      }
      break
      
    case "shift":
      if ((expectedMonthDelta.francosMes || 0) !== BUSINESS_RULES.turnoNormal.sumaFrancos) {
        errors.push(`Turno: se esperaba ${BUSINESS_RULES.turnoNormal.sumaFrancos} francos, se recibió ${expectedMonthDelta.francosMes}`)
      }
      break
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Calcula el impacto de una asignación individual en las estadísticas.
 * 
 * Útil para debugging y para cálculos incrementales.
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
  const minutosDescanso = config?.minutosDescanso ?? 30
  const horasMinimasParaDescanso = config?.horasMinimasParaDescanso ?? 6
  const workingConfig = toWorkingHoursConfig(config)
  
  const monthDelta = initializeEmployeeMonthStats()
  const weekDelta = initializeEmployeeWeekStats()
  
  switch (assignment.type) {
    case "franco":
      monthDelta.francosMes = BUSINESS_RULES.franco.sumaFrancos
      weekDelta.francosSemana = BUSINESS_RULES.franco.sumaFrancos
      break
      
    case "medio_franco":
      monthDelta.francosMes = BUSINESS_RULES.medioFranco.sumaFrancos
      weekDelta.francosSemana = BUSINESS_RULES.medioFranco.sumaFrancos
      
      // Calcular horas del medio turno
      const medioFrancoHours = calculateMedioFrancoHours(assignment, mediosTurnos)
      monthDelta.horasMedioFrancoMes = medioFrancoHours
      weekDelta.horasMedioFrancoSemana = medioFrancoHours
      break
      
    case "shift":
      const shiftHours = calculateShiftHours(
        assignment,
        shifts,
        minutosDescanso,
        horasMinimasParaDescanso,
        workingConfig
      )
      
      monthDelta.horasNormalesMes = shiftHours.normales
      weekDelta.horasNormalesSemana = shiftHours.normales
      
      if (shiftHours.extras > 0) {
        monthDelta.horasExtrasMes = shiftHours.extras
        weekDelta.horasExtrasSemana = shiftHours.extras
      }
      
      if (shiftHours.normales > 0 || shiftHours.extras > 0) {
        monthDelta.diasTrabajadosMes = 1
        weekDelta.diasTrabajadosSemana = 1
      }
      break
      
    case "licencia":
      const licenciaHours = calculateLicenciaHours(
        assignment,
        shifts,
        minutosDescanso,
        horasMinimasParaDescanso
      )
      
      monthDelta.horasLicenciaEmbarazoMes = licenciaHours
      weekDelta.horasLicenciaEmbarazoSemana = licenciaHours
      
      monthDelta.diasLicenciaMes = 1
      weekDelta.diasLicenciaSemana = 1
      break
  }
  
  return { monthDelta, weekDelta }
}

// Re-exportar funciones desde types para conveniencia
export { convertToLegacyStats } from "@/types/employee-stats"

// Funciones auxiliares re-exportadas para conveniencia
export function calculateMedioFrancoHours(
  assignment: ShiftAssignment,
  mediosTurnos: MedioTurno[]
): number {
  if (assignment.startTime && assignment.endTime) {
    const start = new Date(`2000-01-01T${assignment.startTime}`)
    const end = new Date(`2000-01-01T${assignment.endTime}`)
    const diffMs = end.getTime() - start.getTime()
    return Math.max(0, diffMs / (1000 * 60 * 60))
  }
  return 0
}

export function calculateShiftHours(
  assignment: ShiftAssignment,
  shifts: Turno[],
  minutosDescanso: number,
  horasMinimasParaDescanso: number,
  workingConfig: any
): { normales: number; extras: number } {
  const hoursBreakdown = calculateHoursBreakdown(
    [assignment],
    shifts,
    minutosDescanso,
    horasMinimasParaDescanso
  )
  
  const { horasComputables, horasExtra } = calculateTotalDailyHours([assignment], workingConfig)
  
  return {
    normales: horasComputables,
    extras: horasExtra,
  }
}

export function calculateLicenciaHours(
  assignment: ShiftAssignment,
  shifts: Turno[],
  minutosDescanso: number,
  horasMinimasParaDescanso: number
): number {
  const hoursBreakdown = calculateHoursBreakdown(
    [assignment],
    shifts,
    minutosDescanso,
    horasMinimasParaDescanso
  )
  
  return hoursBreakdown.licencia || 0
}
