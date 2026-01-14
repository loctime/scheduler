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
 * - ShiftAssignment es autosuficiente para validación
 * - Prioridad: usar horarios del assignment si existen
 * - Fallback de display: si es placeholder { type:"shift", shiftId } sin horarios,
 *   usar horarios del turno base SOLO para mostrar (NO modifica, NO valida, NO normaliza)
 * - El turno base solo se usa para display, nunca como fuente de validación
 * 
 * @param shiftId - ID del turno (para referencia y fallback de display)
 * @param shift - Turno base (para fallback de display cuando el assignment es placeholder)
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

  // CONTRATO v1.0: Assignment autosuficiente para validación
  // Para display: usar horarios del assignment si existen, sino usar turno base SOLO para mostrar
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
    if (isAssignmentIncomplete(assignment)) {
      return ["Horario incompleto"]
    }
    
    // FALLBACK DE DISPLAY: Si es un placeholder válido sin horarios, usar turno base SOLO para mostrar
    // Esto NO modifica el assignment, NO valida, NO normaliza
    // Es solo para que la UI muestre algo útil mientras el assignment está pendiente de hidratar
    if (assignment.shiftId && shift) {
      const shiftStart = shift.startTime
      const shiftEnd = shift.endTime
      const shiftStart2 = shift.startTime2
      const shiftEnd2 = shift.endTime2

      // Turno cortado: mostrar ambas franjas del turno base
      if (shiftStart && shiftEnd && shiftStart2 && shiftEnd2) {
        return [
          formatTimeRange(shiftStart, shiftEnd),
          formatTimeRange(shiftStart2, shiftEnd2)
        ]
      }

      // Turno simple: mostrar primera franja del turno base
      if (shiftStart && shiftEnd) {
        return [formatTimeRange(shiftStart, shiftEnd)]
      }
    }
    
    // Si no hay turno base o no tiene horarios, no mostrar nada
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

