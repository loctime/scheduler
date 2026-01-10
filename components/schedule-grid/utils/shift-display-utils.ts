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

  // Si hay asignación con horarios ajustados, usar esos
  if (assignment) {
    // Para turnos con ajustes, usar los valores del assignment
    // CRÍTICO: Si el assignment tiene startTime/endTime explícitos, solo mostrar segunda franja
    // si también está explícitamente definida en el assignment (no usar la del turno base como fallback)
    // Esto evita mostrar franjas no deseadas cuando se divide un turno cortado
    const start = assignment.startTime !== undefined ? assignment.startTime : shift.startTime
    const end = assignment.endTime !== undefined ? assignment.endTime : shift.endTime
    
    // Para la segunda franja: solo usar si está explícitamente en el assignment
    // Si el assignment tiene startTime/endTime pero NO tiene startTime2/endTime2, no mostrar segunda franja
    let start2: string | undefined = undefined
    let end2: string | undefined = undefined
    
    // Si el assignment tiene startTime2/endTime2 explícitos, usarlos
    if (assignment.startTime2 !== undefined || assignment.endTime2 !== undefined) {
      start2 = assignment.startTime2 || shift.startTime2
      end2 = assignment.endTime2 || shift.endTime2
    } else if (assignment.startTime === undefined && assignment.endTime === undefined) {
      // Si el assignment no tiene primera franja explícita, puede usar la segunda del turno base
      start2 = shift.startTime2
      end2 = shift.endTime2
    }
    // Si el assignment tiene primera franja pero no segunda, start2/end2 quedan undefined

    if (start && end) {
      const first = formatTimeRange(start, end)
      if (start2 && end2) {
        // Retornar en dos líneas separadas
        return [first, formatTimeRange(start2, end2)]
      }
      return [first]
    }
  }

  // Usar horarios del turno base
  if (shift.startTime && shift.endTime) {
    const first = formatTimeRange(shift.startTime, shift.endTime)
    if (shift.startTime2 && shift.endTime2) {
      // Retornar en dos líneas separadas
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

