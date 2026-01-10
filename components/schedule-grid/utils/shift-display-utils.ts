import { ShiftAssignment, Turno } from "@/lib/types"

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

  // Comportamiento normal para turnos
  if (!shift) return [""]

  // Si hay asignación, usar SOLO los valores explícitos del assignment (autosuficiencia)
  // NO usar el turno base como fallback - el assignment debe contener todos los datos necesarios
  if (assignment && assignment.type === "shift") {
    // Solo usar valores explícitos del assignment
    const start = assignment.startTime
    const end = assignment.endTime
    const start2 = assignment.startTime2
    const end2 = assignment.endTime2

    // Si tiene primera franja, mostrarla
    if (start && end) {
      const first = formatTimeRange(start, end)
      // Si también tiene segunda franja explícita, mostrarla
      if (start2 && end2) {
        return [first, formatTimeRange(start2, end2)]
      }
      return [first]
    }
    
    // Si no tiene primera franja pero tiene segunda, mostrar solo la segunda
    // (caso raro pero posible si el assignment está incompleto)
    if (start2 && end2) {
      return [formatTimeRange(start2, end2)]
    }
    
    // Si no tiene ninguna franja explícita, el assignment está incompleto
    // Retornar string vacío (se mostrará como celda vacía o con indicador de incompleto)
    return [""]
  }

  // Si NO hay assignment, mostrar el turno base directamente
  // (esto solo ocurre en casos de visualización inicial antes de crear el assignment)
  if (shift?.startTime && shift?.endTime) {
    const first = formatTimeRange(shift.startTime, shift.endTime)
    if (shift.startTime2 && shift.endTime2) {
      return [first, formatTimeRange(shift.startTime2, shift.endTime2)]
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

