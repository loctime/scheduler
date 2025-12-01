import type { Horario, ShiftAssignment, ShiftAssignmentValue } from "./types"

/**
 * Normaliza asignaciones de turnos a formato ShiftAssignment[]
 * Soporta tanto formato antiguo (string[]) como nuevo (ShiftAssignment[])
 */
export function normalizeAssignments(value: ShiftAssignmentValue | undefined): ShiftAssignment[] {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  if (typeof value[0] === "string") {
    return (value as string[]).map((shiftId) => ({ shiftId, type: "shift" as const }))
  }
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


