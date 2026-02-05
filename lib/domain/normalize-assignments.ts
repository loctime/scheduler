import { ShiftAssignment } from "@/lib/types"

/**
 * Normaliza asignaciones desde diferentes formatos.
 * 
 * Helper centralizado para evitar duplicación.
 */
export function normalizeAssignments(value: any): ShiftAssignment[] {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  
  return (value as ShiftAssignment[]).map((assignment) => ({
    ...assignment,
    type: assignment.type || "shift",
  }))
}
