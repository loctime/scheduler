import { ShiftAssignment, Turno } from "@/lib/types"

/**
 * Obtener horario para mostrar (ajustado o base) - retorna array de líneas
 */
export function getShiftDisplayTime(
  shiftId: string,
  shift: Turno | undefined,
  assignment?: ShiftAssignment
): string[] {
  // Si es medio franco, usar sus horarios directamente
  if (assignment?.type === "medio_franco") {
    if (assignment.startTime && assignment.endTime) {
      return [`${assignment.startTime} - ${assignment.endTime}`]
    }
    return ["1/2 Franco"]
  }

  // Si es franco, no debería llegar aquí, pero por seguridad:
  if (assignment?.type === "franco") {
    return ["FRANCO"]
  }

  // Comportamiento normal para turnos
  if (!shift) return [""]

  // Si hay asignación con horarios ajustados, usar esos
  if (assignment) {
    const start = assignment.startTime || shift.startTime
    const end = assignment.endTime || shift.endTime
    const start2 = assignment.startTime2 || shift.startTime2
    const end2 = assignment.endTime2 || shift.endTime2

    if (start && end) {
      const first = `${start} - ${end}`
      if (start2 && end2) {
        // Retornar en dos líneas separadas
        return [first, `${start2} - ${end2}`]
      }
      return [first]
    }
  }

  // Usar horarios del turno base
  if (shift.startTime && shift.endTime) {
    const first = `${shift.startTime} - ${shift.endTime}`
    if (shift.startTime2 && shift.endTime2) {
      // Retornar en dos líneas separadas
      return [first, `${shift.startTime2} - ${shift.endTime2}`]
    }
    return [first]
  }

  return [""]
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

