import { ShiftAssignment, Horario } from "./types"

export interface IncompleteAssignment {
  date: string
  employeeId: string
  assignment: ShiftAssignment
  reason: string
}

/**
 * Verifica si un assignment está incompleto según el contrato
 * 
 * IMPORTANTE: "Incompleto" ≠ "Inválido"
 * - Incompleto: Faltan datos requeridos (ej: falta startTime, falta licenciaType)
 * - Inválido: Los datos están presentes pero son incorrectos (ej: startTime === endTime, solapamientos)
 * 
 * Esta función solo detecta incompletitud (falta de datos).
 * Para validar corrección de datos, usar validateAssignmentComplete().
 * 
 * Uso:
 * - Bloqueo de edición: usar isAssignmentIncomplete() (bloquea si falta datos)
 * - Validación antes de guardar: usar validateAssignmentComplete() (valida datos presentes)
 */
export function isAssignmentIncomplete(assignment: ShiftAssignment): boolean {
  if (!assignment.type) {
    return true
  }

  switch (assignment.type) {
    case "shift":
      // Turno debe tener shiftId, startTime y endTime
      if (!assignment.shiftId || !assignment.startTime || !assignment.endTime) {
        return true
      }
      
      // Si tiene startTime2 o endTime2, debe tener ambos
      const hasPartialSecond = 
        (assignment.startTime2 !== undefined && assignment.endTime2 === undefined) ||
        (assignment.startTime2 === undefined && assignment.endTime2 !== undefined)
      
      if (hasPartialSecond) {
        return true
      }
      
      return false

    case "medio_franco":
      // Medio franco debe tener startTime y endTime, NO shiftId
      if (!assignment.startTime || !assignment.endTime) {
        return true
      }
      if (assignment.shiftId) {
        return true // Medio franco no debe tener shiftId
      }
      return false

    case "licencia":
      // Licencia debe tener startTime, endTime y licenciaType, NO shiftId
      if (!assignment.startTime || !assignment.endTime || !assignment.licenciaType) {
        return true
      }
      if (assignment.shiftId) {
        return true // Licencia no debe tener shiftId
      }
      return false

    case "franco":
      // Franco no requiere campos adicionales
      return false

    case "nota":
      // Nota requiere texto
      if (!assignment.texto) {
        return true
      }
      return false

    default:
      // Tipo desconocido se considera incompleto
      return true
  }
}

/**
 * Detecta todos los assignments incompletos en un schedule
 */
export function detectIncompleteAssignments(schedule: Horario): IncompleteAssignment[] {
  const incomplete: IncompleteAssignment[] = []

  if (!schedule.assignments) {
    return incomplete
  }

  Object.entries(schedule.assignments).forEach(([date, dateAssignments]) => {
    Object.entries(dateAssignments).forEach(([employeeId, assignments]) => {
      // Normalizar assignments (puede ser string[] o ShiftAssignment[])
      const normalizedAssignments = normalizeAssignments(assignments)

      normalizedAssignments.forEach((assignment) => {
        if (isAssignmentIncomplete(assignment)) {
          incomplete.push({
            date,
            employeeId,
            assignment,
            reason: getIncompletenessReason(assignment)
          })
        }
      })
    })
  })

  return incomplete
}

/**
 * Obtiene razón legible de por qué un assignment está incompleto
 */
function getIncompletenessReason(assignment: ShiftAssignment): string {
  if (!assignment.type) {
    return "Falta el tipo de assignment"
  }

  switch (assignment.type) {
    case "shift":
      if (!assignment.shiftId) {
        return "Falta shiftId"
      }
      if (!assignment.startTime || !assignment.endTime) {
        return "Faltan startTime o endTime"
      }
      const hasPartialSecond = 
        (assignment.startTime2 !== undefined && assignment.endTime2 === undefined) ||
        (assignment.startTime2 === undefined && assignment.endTime2 !== undefined)
      if (hasPartialSecond) {
        return "Turno cortado incompleto: falta startTime2 o endTime2"
      }
      return "Assignment incompleto"

    case "medio_franco":
      if (!assignment.startTime || !assignment.endTime) {
        return "Faltan startTime o endTime"
      }
      if (assignment.shiftId) {
        return "Medio franco no debe tener shiftId"
      }
      return "Assignment incompleto"

    case "licencia":
      if (!assignment.startTime || !assignment.endTime) {
        return "Faltan startTime o endTime"
      }
      if (!assignment.licenciaType) {
        return "Falta licenciaType"
      }
      if (assignment.shiftId) {
        return "Licencia no debe tener shiftId"
      }
      return "Assignment incompleto"

    case "nota":
      if (!assignment.texto) {
        return "Falta texto"
      }
      return "Assignment incompleto"

    default:
      return `Tipo desconocido: ${assignment.type}`
  }
}

/**
 * Normaliza assignments (puede ser string[] o ShiftAssignment[])
 */
function normalizeAssignments(
  assignments: ShiftAssignment[] | string[] | undefined
): ShiftAssignment[] {
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return []
  }

  // Si es string[], convertir a ShiftAssignment[]
  if (typeof assignments[0] === "string") {
    return (assignments as string[]).map((shiftId) => ({
      shiftId,
      type: "shift" as const
    }))
  }

  // Ya es ShiftAssignment[]
  return assignments as ShiftAssignment[]
}
