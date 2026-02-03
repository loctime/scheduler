import type { Horario, ShiftAssignment, ShiftAssignmentValue, Turno } from "./types"

/**
 * Normaliza asignaciones de turnos a formato ShiftAssignment[]
 *
 * @param value - Valor a normalizar (ShiftAssignment[])
 * @param shifts - Array opcional de turnos para lookup (no se usa para normalización)
 */
export function normalizeAssignments(
  value: ShiftAssignmentValue | undefined,
  shifts?: Turno[]
): ShiftAssignment[] {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  return (value as ShiftAssignment[]).map((assignment) => ({
    ...assignment,
    type: assignment.type || "shift",
  }))
}

/**
 * Verifica si un schedule está marcado como completado
 */
export function isScheduleCompleted(schedule: Horario | null | undefined): boolean {
  return schedule?.completada === true
}

/**
 * Determina si se debe solicitar confirmación antes de una acción
 * en una semana completada
 */
export function shouldRequestConfirmation(
  schedule: Horario | null | undefined,
  action: "edit" | "copy" | "clear"
): boolean {
  if (!isScheduleCompleted(schedule)) {
    return false
  }

  // Todas las acciones requieren confirmación en semanas completadas
  return true
}

/**
 * Crea un objeto de assignments vacío para una semana
 */
export function createEmptyAssignments(): Record<string, Record<string, ShiftAssignment[]>> {
  return {}
}

/**
 * Clona un objeto de assignments (deep copy)
 */
export function cloneAssignments(
  assignments: Record<string, Record<string, ShiftAssignmentValue>>
): Record<string, Record<string, ShiftAssignment[]>> {
  return JSON.parse(JSON.stringify(assignments))
}

/**
 * Actualiza una asignación específica en el objeto de assignments
 */
export function updateAssignmentInAssignments(
  assignments: Record<string, Record<string, ShiftAssignment[]>>,
  date: string,
  employeeId: string,
  newAssignments: ShiftAssignment[]
): Record<string, Record<string, ShiftAssignment[]>> {
  const updated = { ...assignments }
  if (!updated[date]) {
    updated[date] = {}
  }
  updated[date] = {
    ...updated[date],
    [employeeId]: newAssignments,
  }
  return updated
}

/**
 * Elimina una asignación específica del objeto de assignments
 */
export function removeAssignmentFromAssignments(
  assignments: Record<string, Record<string, ShiftAssignment[]>>,
  date: string,
  employeeId: string
): Record<string, Record<string, ShiftAssignment[]>> {
  const updated = cloneAssignments(assignments)
  if (updated[date] && updated[date][employeeId]) {
    delete updated[date][employeeId]
    // Si la fecha queda vacía, eliminarla también
    if (Object.keys(updated[date]).length === 0) {
      delete updated[date]
    }
  }
  return updated
}

/**
 * Verifica si un empleado tiene asignaciones en una fecha específica
 */
export function hasAssignmentsOnDate(
  assignments: Record<string, Record<string, ShiftAssignmentValue>> | undefined,
  date: string,
  employeeId: string
): boolean {
  return !!(assignments?.[date]?.[employeeId] && 
    Array.isArray(assignments[date][employeeId]) && 
    assignments[date][employeeId].length > 0)
}

/**
 * Hidrata assignments con los horarios del turno base cuando faltan.
 * 
 * Reglas:
 * - Si a.type==="shift" y tiene shiftId:
 *   - Si startTime/endTime faltan => copiarlos desde el turno correspondiente (si existe)
 *   - Si existen, NO tocarlos (no pisar edición real)
 *   - Copiar también startTime2/endTime2 si el turno lo tiene y el assignment no
 * - Si no existe el turno (huérfano), NO inventar nada.
 * 
 * @param assignments - Array de assignments a hidratar
 * @param shiftsById - Map de turnos por ID para búsqueda rápida
 * @returns Array de assignments hidratados
 */
export function hydrateAssignmentsWithShiftTimes(
  assignments: ShiftAssignment[],
  shiftsById: Map<string, Turno>
): ShiftAssignment[] {
  return assignments.map((assignment) => {
    // Solo procesar assignments de tipo "shift" con shiftId
    if (assignment.type !== "shift" || !assignment.shiftId) {
      return assignment
    }

    const shift = shiftsById.get(assignment.shiftId)
    
    // Si no existe el turno (huérfano), retornar sin cambios
    if (!shift) {
      return assignment
    }

    // Crear copia del assignment para no mutar el original
    const hydrated: ShiftAssignment = { ...assignment }

    // Si faltan startTime/endTime, copiarlos desde el turno
    if (!hydrated.startTime && shift.startTime) {
      hydrated.startTime = shift.startTime
    }
    if (!hydrated.endTime && shift.endTime) {
      hydrated.endTime = shift.endTime
    }

    // Si el turno tiene segunda franja y el assignment no, copiarla
    if (shift.startTime2 && shift.endTime2) {
      if (!hydrated.startTime2) {
        hydrated.startTime2 = shift.startTime2
      }
      if (!hydrated.endTime2) {
        hydrated.endTime2 = shift.endTime2
      }
    }

    return hydrated
  })
}


