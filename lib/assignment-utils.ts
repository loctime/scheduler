import { ShiftAssignment, Horario, Turno } from "./types"
import { logger } from "./logger"

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
      // Turno debe tener shiftId
      if (!assignment.shiftId) {
        return true
      }
      
      // CONTRATO v1.0: La validación se basa EXCLUSIVAMENTE en el assignment real
      // NO se compara con el turno base
      // Un horario simple es válido con solo startTime y endTime
      const hasFirstSegment = assignment.startTime && assignment.endTime
      const hasSecondSegment = assignment.startTime2 && assignment.endTime2
      
      // CRÍTICO: Un assignment { type: "shift", shiftId } sin horarios NO es incompleto
      // Es un "placeholder pendiente de hidratar" (normalizado desde string[])
      // No debe marcarse como error, sino como válido pero sin expandir
      if (!hasFirstSegment && !hasSecondSegment) {
        // Si tiene shiftId pero no horarios, es un placeholder válido (no incompleto)
        // Estos se crean cuando normalizeAssignments() convierte string[] a ShiftAssignment[]
        // Ya sabemos que shiftId existe porque pasamos la verificación anterior
        logger.debug("[Assignment] Placeholder sin hidratar detectado", {
          shiftId: assignment.shiftId,
          type: assignment.type
        })
        return false // No es incompleto, solo pendiente de hidratar
      }
      
      // Si tiene alguna parte de la segunda franja, debe tener ambas partes
      // (pero la segunda franja NO es obligatoria si no existe)
      const hasPartialSecond = 
        (assignment.startTime2 !== undefined && assignment.endTime2 === undefined) ||
        (assignment.startTime2 === undefined && assignment.endTime2 !== undefined)
      
      if (hasPartialSecond) {
        return true
      }
      
      // Un assignment con solo primera franja es válido (turno simple)
      // Un assignment con ambas franjas es válido (turno cortado)
      // La validación NO debe exigir la segunda franja si no existe en el assignment
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
 * 
 * EXPORTADO para uso en UI y logging
 * 
 * GUARD DEFENSIVO: Si el assignment NO está incompleto, retornar ""
 * Esto previene falsos positivos cuando se usa sin validar primero isAssignmentIncomplete()
 */
export function getIncompletenessReason(assignment: ShiftAssignment): string {
  // Guard defensivo: si no está incompleto, retornar ""
  if (!isAssignmentIncomplete(assignment)) {
    return ""
  }

  if (!assignment.type) {
    return "Falta el tipo de assignment"
  }

  switch (assignment.type) {
    case "shift":
      if (!assignment.shiftId) {
        return "Falta shiftId"
      }
      const hasFirstSegment = assignment.startTime && assignment.endTime
      const hasSecondSegment = assignment.startTime2 && assignment.endTime2
      if (!hasFirstSegment && !hasSecondSegment) {
        return "Falta al menos una franja completa (startTime+endTime o startTime2+endTime2)"
      }
      const hasPartialSecond = 
        (assignment.startTime2 !== undefined && assignment.endTime2 === undefined) ||
        (assignment.startTime2 === undefined && assignment.endTime2 !== undefined)
      if (hasPartialSecond) {
        return "Segunda franja incompleta: falta startTime2 o endTime2"
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

/**
 * Normaliza un assignment desde un turno base
 * 
 * CRÍTICO: Esta función copia TODA la estructura del turno base al assignment,
 * asegurando que el assignment sea autosuficiente desde su creación.
 * 
 * Uso: Solo para migración/normalización explícita de datos existentes.
 * NO usar en flujo normal de creación (ya se hace en buildAssignmentFromShift).
 * 
 * @param assignment - Assignment a normalizar (puede estar incompleto)
 * @param shift - Turno base del cual copiar la estructura completa
 * @returns Assignment normalizado con toda la estructura copiada
 */
export function normalizeAssignmentFromShift(
  assignment: ShiftAssignment,
  shift: Turno
): ShiftAssignment {
  // Si el assignment no tiene shiftId o no coincide, no normalizar
  if (!assignment.shiftId || assignment.shiftId !== shift.id) {
    return assignment
  }

  // Detectar si se está normalizando (copiando datos del turno base)
  const wasIncomplete = isAssignmentIncomplete(assignment)
  const needsNormalization = 
    !assignment.startTime || 
    !assignment.endTime ||
    (shift.startTime2 && shift.endTime2 && (!assignment.startTime2 || !assignment.endTime2))

  // Crear assignment normalizado copiando TODA la estructura del turno
  const normalized: ShiftAssignment = {
    ...assignment,
    type: "shift",
    shiftId: shift.id,
    // CRÍTICO: Copiar siempre startTime y endTime del turno base
    startTime: assignment.startTime || shift.startTime || "",
    endTime: assignment.endTime || shift.endTime || "",
  }

  // Si el turno tiene segunda franja, copiarla también
  if (shift.startTime2 && shift.endTime2) {
    normalized.startTime2 = assignment.startTime2 || shift.startTime2
    normalized.endTime2 = assignment.endTime2 || shift.endTime2
  } else {
    // Si el turno NO tiene segunda franja, asegurar que el assignment tampoco la tenga
    delete normalized.startTime2
    delete normalized.endTime2
  }

  // FASE 12: Observabilidad - Log cuando se normaliza automáticamente
  if (wasIncomplete || needsNormalization) {
    logger.info("[Normalización] Assignment normalizado desde turno base", {
      shiftId: shift.id,
      shiftName: shift.name,
      wasIncomplete,
      needsNormalization,
      before: {
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        startTime2: assignment.startTime2,
        endTime2: assignment.endTime2,
      },
      after: {
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        startTime2: normalized.startTime2,
        endTime2: normalized.endTime2,
      },
    })
  }

  return normalized
}
