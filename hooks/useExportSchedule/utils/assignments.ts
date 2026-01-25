import type { ShiftAssignment, ShiftAssignmentValue, Turno } from "@/lib/types"

// Función helper para normalizar asignaciones
export const normalizeAssignments = (value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  if (typeof value[0] === "string") {
    return (value as string[]).map((shiftId) => ({ shiftId, type: "shift" as const }))
  }
  return (value as ShiftAssignment[]).map((assignment) => ({
    ...assignment,
    type: assignment.type || "shift",
  }))
}

// Función helper para obtener el texto del turno (CONTRATO v1.0)
// Usa SOLO datos del assignment, nunca el turno base como fallback
export const getShiftText = (assignment: ShiftAssignment | string, shiftMap: Map<string, Turno>): { text: string, color?: string } => {
  // Caso legacy: assignment como string (shiftId)
  // En este caso, no tenemos datos del assignment, solo el ID
  // Por contrato, deberíamos mostrar "Horario incompleto", pero para compatibilidad
  // mostramos el nombre del turno (esto debería migrarse eventualmente)
  if (typeof assignment === "string") {
    const shift = shiftMap.get(assignment)
    return { text: shift?.name || "Horario incompleto", color: shift?.color }
  }
  
  if (assignment.type === "franco") {
    return { text: "FRANCO", color: "#22c55e" } // Verde (igual que medio franco) - hardcodeado
  }
  
  if (assignment.type === "medio_franco") {
    if (assignment.startTime && assignment.endTime) {
      return { text: `${assignment.startTime} - ${assignment.endTime}\n(1/2 Franco)`, color: "#22c55e" } // Verde por defecto - hardcodeado
    }
    return { text: "1/2 Franco", color: "#22c55e" } // Verde por defecto - hardcodeado
  }
  
  if (assignment.type === "licencia") {
    if (assignment.startTime && assignment.endTime) {
      const licenciaTypeLabel = assignment.licenciaType === "embarazo" ? "Lic. Embarazo" : 
                                       assignment.licenciaType === "vacaciones" ? "Lic. Vacaciones" :
                                       "Licencia"
      return { text: `${licenciaTypeLabel}\n${assignment.startTime} - ${assignment.endTime}`, color: "#f59e0b" } // Ámbar
    }
    const licenciaTypeLabel = assignment.licenciaType === "embarazo" ? "LICENCIA EMBARAZO" : 
                                     assignment.licenciaType === "vacaciones" ? "LICENCIA VACACIONES" :
                                     "LICENCIA"
    return { text: licenciaTypeLabel, color: "#f59e0b" }
  }
  
  // CONTRATO v1.0: Assignment autosuficiente
  // Usar SOLO valores explícitos del assignment
  if (assignment.shiftId && assignment.type === "shift") {
    const shift = shiftMap.get(assignment.shiftId)
    const color = shift?.color || "#808080" // Color por defecto si no hay turno
    
    // Solo usar valores explícitos del assignment
    const start = assignment.startTime
    const end = assignment.endTime
    const start2 = assignment.startTime2
    const end2 = assignment.endTime2
    
    // Turno cortado: mostrar ambas franjas
    if (start && end && start2 && end2) {
      return { text: `${start} - ${end}\n${start2} - ${end2}`, color }
    }
    
    // Turno simple: mostrar primera franja
    if (start && end) {
      return { text: `${start} - ${end}`, color }
    }
    
    // Si no tiene primera franja pero tiene segunda, mostrar solo la segunda
    if (start2 && end2) {
      return { text: `${start2} - ${end2}`, color }
    }
    
    // CONTRATO v1.0: Si falta horario, mostrar "Horario incompleto"
    // Nunca mostrar shift.name ni leer horarios desde Turno
    return { text: "Horario incompleto", color }
  }
  
  // Horario especial (sin shiftId pero con startTime/endTime)
  if (assignment.type === "shift" && !assignment.shiftId && (assignment.startTime || assignment.endTime)) {
    if (assignment.startTime && assignment.endTime) {
      return { text: `${assignment.startTime} - ${assignment.endTime}`, color: "#808080" }
    }
    return { text: "Horario incompleto", color: "#808080" }
  }
  
  return { text: "Horario incompleto", color: "#808080" }
}
