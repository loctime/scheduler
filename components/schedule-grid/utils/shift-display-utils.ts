import { ShiftAssignment, Turno } from "@/lib/types"
import { isAssignmentIncomplete } from "@/lib/assignment-utils"

/**
 * Formatea una hora omitiendo :00 si los minutos son 0
 * Ejemplo: "11:00" -> "11", "11:30" -> "11:30"
 */
function formatTime(time: string): string {
  if (!time) return time
  // Si termina en :00, remover los minutos
  if (time.endsWith(":00")) {
    return time.slice(0, -3)
  }
  return time
}

/**
 * Formatea un rango de tiempo (start - end) omitiendo :00 cuando corresponda
 * Ejemplo: "11:00 - 15:00" -> "11 a 15", "11:00 - 15:30" -> "11 a 15:30"
 */
function formatTimeRange(start: string, end: string): string {
  const formattedStart = formatTime(start)
  const formattedEnd = formatTime(end)
  return `${formattedStart} a ${formattedEnd}`
}

/**
 * Obtener horario para mostrar desde el assignment (CONTRATO v1.0)
 * 
 * REGLAS:
 * - ShiftAssignment es autosuficiente
 * - El horario visible DEBE salir del assignment
 * - El turno base (Turno) NO debe usarse para render
 * - No se permiten fallbacks visuales al turno base
 * 
 * @param shiftId - ID del turno (solo para referencia, no se usa para display)
 * @param shift - Turno base (solo para referencia, NO se usa para display)
 * @param assignment - Assignment del cual extraer el horario
 * @returns Array de líneas de texto con el horario a mostrar
 */
export function getShiftDisplayTime(
  shiftId: string,
  shift: Turno | undefined,
  assignment?: ShiftAssignment
): string[] {
  // Si es medio franco, usar sus horarios directamente
  if (assignment?.type === "medio_franco") {
    if (assignment.startTime && assignment.endTime) {
      return [formatTimeRange(assignment.startTime, assignment.endTime)]
    }
    return ["1/2 Franco"]
  }

  // Si es licencia, usar sus horarios directamente
  if (assignment?.type === "licencia") {
    if (assignment.startTime && assignment.endTime) {
      return [formatTimeRange(assignment.startTime, assignment.endTime)]
    }
    const licenciaTypeLabel = assignment.licenciaType === "embarazo" ? "LICENCIA EMBARAZO" : 
                               assignment.licenciaType === "vacaciones" ? "LICENCIA VACACIONES" :
                               "LICENCIA"
    return [licenciaTypeLabel]
  }

  // Si es franco, no debería llegar aquí, pero por seguridad:
  if (assignment?.type === "franco") {
    return ["FRANCO"]
  }

  // CONTRATO v1.0: Assignment autosuficiente
  // Si hay asignación, usar SOLO los valores explícitos del assignment
  // NUNCA usar el turno base como fallback
  if (assignment && assignment.type === "shift") {
    // Solo usar valores explícitos del assignment
    const start = assignment.startTime
    const end = assignment.endTime
    const start2 = assignment.startTime2
    const end2 = assignment.endTime2

    // Turno cortado: mostrar ambas franjas
    if (start && end && start2 && end2) {
      return [
        formatTimeRange(start, end),
        formatTimeRange(start2, end2)
      ]
    }

    // Turno simple: mostrar primera franja
    if (start && end) {
      return [formatTimeRange(start, end)]
    }
    
    // Si no tiene primera franja pero tiene segunda, mostrar solo la segunda
    // (caso raro pero posible si el assignment está incompleto)
    if (start2 && end2) {
      return [formatTimeRange(start2, end2)]
    }
    
    // CRÍTICO: Solo mostrar "Horario incompleto" si realmente está incompleto
    // Los placeholders { type: "shift", shiftId } sin horarios NO son incompletos
    // Son válidos pero pendientes de hidratar
    if (isAssignmentIncomplete(assignment)) {
      return ["Horario incompleto"]
    }
    
    // Si es un placeholder válido, no mostrar nada (o mostrar el nombre del turno si está disponible)
    // Por ahora, retornar array vacío para que no se muestre nada
    return []
  }

  // Si NO hay assignment, no hay nada que mostrar
  // (esto no debería ocurrir en el flujo normal, pero por seguridad)
  return []
}

/**
 * Verificar si un turno tiene horarios ajustados
 */
export function hasAdjustedTimes(assignment: ShiftAssignment, shift: Turno): boolean {
  if (!assignment) return false
  return !!(
    (assignment.startTime && assignment.startTime !== shift.startTime) ||
    (assignment.endTime && assignment.endTime !== shift.endTime) ||
    (assignment.startTime2 && assignment.startTime2 !== shift.startTime2) ||
    (assignment.endTime2 && assignment.endTime2 !== shift.endTime2)
  )
}

