import { ShiftAssignment, Turno, MedioTurno, Configuracion } from "@/lib/types"
import { calculateHoursBreakdown } from "@/lib/validations"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"

/**
 * Impacto de una asignación individual en las estadísticas.
 * 
 * Este módulo es la ÚNICA fuente de verdad para cálculo de impacto
 * de asignaciones individuales. Centraliza toda la lógica de negocio.
 */
export interface AssignmentImpact {
  sumaFrancos: number
  horasNormales: number
  horasExtras: number
  horasLicencia: number
  horasMedioFranco: number
  aportaTrabajo: boolean
  aportaLicencia: boolean
}

/**
 * Calcula el impacto de UNA asignación individual.
 * 
 * NO acumula valores, solo devuelve el impacto específico.
 * NO cuenta días, eso es responsabilidad del caller.
 * NO conoce UI, solo aplica reglas de negocio.
 */
export function calculateAssignmentImpact(
  assignment: ShiftAssignment,
  shifts: Turno[],
  mediosTurnos: MedioTurno[],
  config?: Configuracion | null
): AssignmentImpact {
  // Configuración para cálculos
  const minutosDescanso = config?.minutosDescanso ?? 30
  const horasMinimasParaDescanso = config?.horasMinimasParaDescanso ?? 6
  const workingConfig = toWorkingHoursConfig(config)

  // Impacto inicial (valores por defecto)
  const impact: AssignmentImpact = {
    sumaFrancos: 0,
    horasNormales: 0,
    horasExtras: 0,
    horasLicencia: 0,
    horasMedioFranco: 0,
    aportaTrabajo: false,
    aportaLicencia: false,
  }

  // Aplicar reglas de negocio según el tipo de assignment
  switch (assignment.type) {
    case "franco":
      // REGLA: Franco suma +1 franco, NO suma horas, NO aporta trabajo
      impact.sumaFrancos = 1
      impact.horasNormales = 0
      impact.horasExtras = 0
      impact.aportaTrabajo = false
      impact.aportaLicencia = false
      break

    case "medio_franco":
      // REGLA: Medio franco suma +0.5 franco Y horas del medio turno, NO suma horas extra
      impact.sumaFrancos = 0.5
      impact.horasMedioFranco = calculateMedioFrancoHours(assignment, mediosTurnos)
      impact.horasNormales = 0
      impact.horasExtras = 0
      impact.aportaTrabajo = impact.horasMedioFranco > 0
      impact.aportaLicencia = false
      break

    case "shift":
      // REGLA: Turno normal suma horas normales, horas extra separadas, NO suma francos
      const shiftHours = calculateShiftHours(
        assignment,
        shifts,
        minutosDescanso,
        horasMinimasParaDescanso,
        workingConfig
      )
      impact.sumaFrancos = 0
      impact.horasNormales = shiftHours.normales
      impact.horasExtras = shiftHours.extras
      impact.horasMedioFranco = 0
      impact.aportaTrabajo = shiftHours.normales > 0 || shiftHours.extras > 0
      impact.aportaLicencia = false
      break

    case "licencia":
      // REGLA: Licencia suma horas de licencia, NO suma francos ni horas normales
      const licenciaHours = calculateLicenciaHours(
        assignment,
        shifts,
        minutosDescanso,
        horasMinimasParaDescanso
      )
      impact.sumaFrancos = 0
      impact.horasNormales = 0
      impact.horasExtras = 0
      impact.horasLicencia = licenciaHours
      impact.horasMedioFranco = 0
      impact.aportaTrabajo = false
      impact.aportaLicencia = licenciaHours > 0
      break

    case "nota":
      // REGLA: Nota no impacta en estadísticas
      impact.sumaFrancos = 0
      impact.horasNormales = 0
      impact.horasExtras = 0
      impact.horasLicencia = 0
      impact.horasMedioFranco = 0
      impact.aportaTrabajo = false
      impact.aportaLicencia = false
      break

    default:
      // Tipo desconocido, no impacta
      break
  }

  return impact
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
