import type { Horario, ShiftAssignment, ShiftAssignmentValue, Turno } from "./types"

/**
 * Normaliza asignaciones de turnos a formato ShiftAssignment[]
 * Soporta tanto formato antiguo (string[]) como nuevo (ShiftAssignment[])
 * 
 * NUEVO MODELO SIMPLE: Cuando se convierte desde string[], copia automáticamente
 * los horarios del turno base al assignment para que nazca con horario real explícito.
 * 
 * @param value - Valor a normalizar (string[] o ShiftAssignment[])
 * @param shifts - Array opcional de turnos para copiar horarios al convertir desde string[]
 */
export function normalizeAssignments(
  value: ShiftAssignmentValue | undefined,
  shifts?: Turno[]
): ShiftAssignment[] {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  if (typeof value[0] === "string") {
    // Formato antiguo: convertir string[] a ShiftAssignment[] copiando horarios del turno
    return (value as string[]).map((shiftId) => {
      const assignment: ShiftAssignment = { shiftId, type: "shift" as const }
      
      // NUEVO MODELO SIMPLE: Copiar horarios del turno si está disponible
      if (shifts) {
        const shift = shifts.find((s) => s.id === shiftId)
        if (shift) {
          // Copiar primera franja
          if (shift.startTime) {
            assignment.startTime = shift.startTime
          }
          if (shift.endTime) {
            assignment.endTime = shift.endTime
          }
          
          // Copiar segunda franja si existe (turno cortado)
          if (shift.startTime2) {
            assignment.startTime2 = shift.startTime2
          }
          if (shift.endTime2) {
            assignment.endTime2 = shift.endTime2
          }
        }
      }
      
      return assignment
    })
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



