/**
 * Servicio de dominio para cálculo de horas trabajadas
 * 
 * REGLAS DE NEGOCIO:
 * - Las horas normales se definen exclusivamente por configuración (reglasHorarias.horasNormalesPorDia)
 * - Las horas extra se calculan por celda (assignment) en base al horario registrado
 * - El turno es solo una referencia planificada (visual / comparativa)
 * - El comportamiento debe ser idéntico en todas las vistas
 */

import type { ShiftAssignment, Configuracion } from "@/lib/types"
import { calculateShiftDurationMinutes } from "@/lib/time-utils"

/**
 * Configuración mínima requerida para cálculos
 */
interface WorkingHoursConfig {
  minutosDescanso: number
  horasMinimasParaDescanso: number
  reglasHorarias?: {
    horasNormalesPorDia?: number
  }
}

/**
 * Resultado del cálculo de horas diarias
 */
export interface DailyHoursResult {
  horasComputables: number
  horasNormales: number
  horasExtra: number
}

/**
 * Resultado del cálculo de horas para un período (múltiples días)
 * Es la suma de DailyHoursResult de cada día
 */
export interface PeriodHoursResult {
  horasComputables: number
  horasNormales: number
  horasExtra: number
}

/**
 * Calcula las horas computables de un assignment
 * 
 * REGLAS:
 * - Horario continuo: horas = duración(horario registrado)
 *   Si horas >= config.horasMinimasParaDescanso: horas -= config.minutosDescanso
 * - Horario cortado: horas = duración(tramo A) + duración(tramo B)
 *   (no aplicar descanso nunca)
 * 
 * @param assignment La asignación con horario registrado
 * @param config Configuración con minutosDescanso y horasMinimasParaDescanso
 * @returns Horas computables (en horas, no minutos)
 */
export function calculateComputableHours(
  assignment: ShiftAssignment,
  config: WorkingHoursConfig
): number {
  // Solo computan assignments de tipo "shift"
  if (assignment.type !== "shift") {
    return 0
  }

  // Assignment debe tener horario completo
  if (!assignment.startTime || !assignment.endTime) {
    return 0
  }

  // Calcular duración total del horario registrado
  const horarioRegistrado: {
    startTime?: string | null
    endTime?: string | null
    startTime2?: string | null
    endTime2?: string | null
  } = {
    startTime: assignment.startTime,
    endTime: assignment.endTime,
    startTime2: assignment.startTime2 || undefined,
    endTime2: assignment.endTime2 || undefined,
  }

  const totalMinutes = calculateShiftDurationMinutes(horarioRegistrado)
  let horas = totalMinutes / 60

  // Si tiene segunda franja (turno cortado), NO aplicar descanso
  if (assignment.startTime2 || assignment.endTime2) {
    return horas
  }

  // Horario continuo: aplicar descanso si cumple horas mínimas
  if (horas >= config.horasMinimasParaDescanso) {
    const minutosDescanso = config.minutosDescanso || 0
    horas = Math.max(0, (totalMinutes - minutosDescanso) / 60)
  }

  return horas
}

/**
 * Calcula horas computables, normales y extra de un assignment
 * 
 * REGLA ÚNICA:
 * - horasNormales = min(horasComputables, config.reglasHorarias.horasNormalesPorDia)
 * - horasExtra = max(0, horasComputables - config.reglasHorarias.horasNormalesPorDia)
 * 
 * @param assignment La asignación con horario registrado
 * @param config Configuración completa con reglasHorarias
 * @returns Objeto con horasComputables, horasNormales y horasExtra
 */
export function calculateDailyHours(
  assignment: ShiftAssignment,
  config: WorkingHoursConfig
): DailyHoursResult {
  // Calcular horas computables
  const horasComputables = calculateComputableHours(assignment, config)

  // Obtener horas normales por día de la configuración (default: 8)
  const horasNormalesPorDia = config.reglasHorarias?.horasNormalesPorDia ?? 8

  // Aplicar regla única: horas normales y extra
  const horasNormales = Math.min(horasComputables, horasNormalesPorDia)
  const horasExtra = Math.max(0, horasComputables - horasNormalesPorDia)

  return {
    horasComputables,
    horasNormales,
    horasExtra,
  }
}

/**
 * Calcula horas totales de un array de assignments
 * Útil para calcular horas de un día completo con múltiples turnos
 * 
 * @param assignments Array de asignaciones
 * @param config Configuración completa
 * @returns Objeto con horasComputables, horasNormales y horasExtra totales
 */
export function calculateTotalDailyHours(
  assignments: ShiftAssignment[],
  config: WorkingHoursConfig
): DailyHoursResult {
  let totalHorasComputables = 0
  let totalHorasNormales = 0
  let totalHorasExtra = 0

  assignments.forEach((assignment) => {
    // Solo computan assignments de tipo "shift"
    // ❌ licencia, franco, medio_franco no computan
    if (assignment.type === "shift") {
      const result = calculateDailyHours(assignment, config)
      totalHorasComputables += result.horasComputables
      totalHorasNormales += result.horasNormales
      totalHorasExtra += result.horasExtra
    }
  })

  return {
    horasComputables: totalHorasComputables,
    horasNormales: totalHorasNormales,
    horasExtra: totalHorasExtra,
  }
}

/**
 * Calcula horas totales para un período (múltiples días)
 * Suma las horas computables, normales y extra de cada día
 * 
 * @param daysAssignments Objeto con assignments por día (clave: fecha "yyyy-MM-dd")
 * @param config Configuración completa
 * @returns Objeto con horasComputables, horasNormales y horasExtra totales del período
 */
export function calculatePeriodHours(
  daysAssignments: Record<string, ShiftAssignment[]>,
  config: WorkingHoursConfig
): PeriodHoursResult {
  let totalHorasComputables = 0
  let totalHorasNormales = 0
  let totalHorasExtra = 0

  // Iterar por cada día y sumar horas usando el dominio
  Object.values(daysAssignments).forEach((dayAssignments) => {
    if (dayAssignments.length === 0) return

    // Usar calculateTotalDailyHours para calcular horas del día
    const dayResult = calculateTotalDailyHours(dayAssignments, config)
    totalHorasComputables += dayResult.horasComputables
    totalHorasNormales += dayResult.horasNormales
    totalHorasExtra += dayResult.horasExtra
  })

  return {
    horasComputables: totalHorasComputables,
    horasNormales: totalHorasNormales,
    horasExtra: totalHorasExtra,
  }
}

/**
 * Convierte Configuracion a WorkingHoursConfig
 * Helper para facilitar el uso desde componentes
 */
export function toWorkingHoursConfig(config: Configuracion | null | undefined): WorkingHoursConfig {
  return {
    minutosDescanso: config?.minutosDescanso ?? 30,
    horasMinimasParaDescanso: config?.horasMinimasParaDescanso ?? 6,
    reglasHorarias: {
      horasNormalesPorDia: config?.reglasHorarias?.horasNormalesPorDia ?? 8,
    },
  }
}
