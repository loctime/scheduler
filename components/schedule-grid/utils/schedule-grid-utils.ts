import { ShiftAssignment, ShiftAssignmentValue, Turno } from "@/lib/types"

/**
 * Convertir ShiftAssignmentValue a string[] (IDs)
 */
export function toShiftIds(value: ShiftAssignmentValue | undefined): string[] {
  if (!value || !Array.isArray(value)) return []
  if (value.length === 0) return []
  // Si es string[] (formato antiguo)
  if (typeof value[0] === "string") {
    return value as string[]
  }
  // Si es ShiftAssignment[] (formato nuevo), extraer shiftId y filtrar undefined
  return (value as ShiftAssignment[])
    .map((a) => a.shiftId)
    .filter((id): id is string => id !== undefined)
}

/**
 * Convertir ShiftAssignmentValue a ShiftAssignment[]
 * 
 * NUEVO MODELO SIMPLE: Cuando se convierte desde string[], copia automáticamente
 * los horarios del turno base al assignment para que nazca con horario real explícito.
 * 
 * @param value - Valor a convertir (string[] o ShiftAssignment[])
 * @param shifts - Array opcional de turnos para copiar horarios al convertir desde string[]
 */
export function toAssignments(
  value: ShiftAssignmentValue | undefined,
  shifts?: Turno[]
): ShiftAssignment[] {
  if (!value || !Array.isArray(value)) return []
  if (value.length === 0) return []
  // Si es string[] (formato antiguo), convertir copiando horarios del turno
  if (typeof value[0] === "string") {
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
  // Si es ShiftAssignment[] (formato nuevo)
  return (value as ShiftAssignment[]).map((a) => ({
    ...a,
    type: a.type || ("shift" as const),
  }))
}

/**
 * Convertir color hex a rgba
 */
export function hexToRgba(hex: string, opacity: number = 0.35): string {
  const cleanHex = hex.replace("#", "")
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * Convertir hora "HH:mm" a minutos desde medianoche
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Formatear valor de estadística
 */
export function formatStatValue(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return "0"
  }
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}

