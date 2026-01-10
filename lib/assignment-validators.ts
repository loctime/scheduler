import { ShiftAssignment, Turno } from "./types"

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

/**
 * Valida que un assignment esté completo según su tipo
 */
export function validateAssignmentComplete(assignment: ShiftAssignment): ValidationResult {
  const errors: string[] = []

  if (!assignment.type) {
    errors.push("El assignment debe tener un tipo definido")
    return { valid: false, errors }
  }

  // Validar según el tipo
  switch (assignment.type) {
    case "shift":
      return validateShiftAssignment(assignment)
    
    case "medio_franco":
      return validateMedioFranco(assignment)
    
    case "licencia":
      return validateLicencia(assignment)
    
    case "franco":
      // Franco no requiere horarios
      return { valid: true, errors: [] }
    
    case "nota":
      // Nota solo requiere texto
      return { valid: true, errors: [] }
    
    default:
      errors.push(`Tipo de assignment desconocido: ${assignment.type}`)
      return { valid: false, errors }
  }
}

/**
 * Valida un assignment de tipo shift
 */
function validateShiftAssignment(assignment: ShiftAssignment): ValidationResult {
  const errors: string[] = []

  if (!assignment.shiftId) {
    errors.push("Un turno debe tener shiftId")
  }

  if (!assignment.startTime || !assignment.endTime) {
    errors.push("Un turno simple debe tener startTime y endTime")
    return { valid: false, errors }
  }

  // Validar orden temporal de primera franja
  if (!isValidTimeRange(assignment.startTime, assignment.endTime)) {
    errors.push("startTime debe ser anterior a endTime en la primera franja")
  }

  // Si tiene segunda franja, debe tener ambas propiedades
  const hasSecondSegment = assignment.startTime2 !== undefined || assignment.endTime2 !== undefined
  
  if (hasSecondSegment) {
    if (!assignment.startTime2 || !assignment.endTime2) {
      errors.push("Un turno cortado debe tener startTime2 y endTime2 completos")
      return { valid: false, errors }
    }

    // Validar orden temporal de segunda franja
    if (!isValidTimeRange(assignment.startTime2, assignment.endTime2)) {
      errors.push("startTime2 debe ser anterior a endTime2 en la segunda franja")
    }

    // Validar que las franjas no se solapen
    if (!validateNoOverlapBetweenSegments(assignment.startTime, assignment.endTime, assignment.startTime2, assignment.endTime2)) {
      errors.push("Las franjas de un turno cortado no pueden solaparse")
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Valida un assignment de tipo medio_franco
 */
function validateMedioFranco(assignment: ShiftAssignment): ValidationResult {
  const errors: string[] = []

  if (!assignment.startTime || !assignment.endTime) {
    errors.push("Un medio franco debe tener startTime y endTime")
    return { valid: false, errors }
  }

  if (!isValidTimeRange(assignment.startTime, assignment.endTime)) {
    errors.push("startTime debe ser anterior a endTime")
  }

  if (assignment.shiftId) {
    errors.push("Un medio franco no debe tener shiftId")
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Valida un assignment de tipo licencia
 */
function validateLicencia(assignment: ShiftAssignment): ValidationResult {
  const errors: string[] = []

  if (!assignment.startTime || !assignment.endTime) {
    errors.push("Una licencia debe tener startTime y endTime")
    return { valid: false, errors }
  }

  if (!isValidTimeRange(assignment.startTime, assignment.endTime)) {
    errors.push("startTime debe ser anterior a endTime")
  }

  // licenciaType es opcional pero recomendado
  if (!assignment.licenciaType) {
    errors.push("Una licencia debe tener licenciaType definido")
  }

  if (assignment.shiftId) {
    errors.push("Una licencia no debe tener shiftId")
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Valida que un turno cortado tenga ambas franjas completas
 */
export function validateTurnoCortado(assignment: ShiftAssignment): ValidationResult {
  const errors: string[] = []

  if (assignment.type !== "shift") {
    errors.push("Solo los turnos pueden ser cortados")
    return { valid: false, errors }
  }

  const hasFirstSegment = assignment.startTime && assignment.endTime
  const hasSecondSegment = assignment.startTime2 && assignment.endTime2

  if (!hasFirstSegment) {
    errors.push("Un turno cortado debe tener primera franja completa")
  }

  if (!hasSecondSegment) {
    errors.push("Un turno cortado debe tener segunda franja completa")
  }

  if (hasFirstSegment && hasSecondSegment) {
    // Validar que no se solapen
    if (!validateNoOverlapBetweenSegments(
      assignment.startTime!,
      assignment.endTime!,
      assignment.startTime2!,
      assignment.endTime2!
    )) {
      errors.push("Las franjas de un turno cortado no pueden solaparse")
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Valida que no haya solapamientos entre assignments en una celda
 */
export function validateNoOverlaps(assignments: ShiftAssignment[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Filtrar solo assignments con horarios definidos
  const assignmentsWithTimes = assignments.filter(a => 
    a.startTime && a.endTime && 
    (a.type === "shift" || a.type === "medio_franco" || a.type === "licencia")
  )

  // Comparar todos los pares
  for (let i = 0; i < assignmentsWithTimes.length; i++) {
    for (let j = i + 1; j < assignmentsWithTimes.length; j++) {
      const a1 = assignmentsWithTimes[i]
      const a2 = assignmentsWithTimes[j]

      // Ignorar solapamientos entre francos y otros tipos (pueden coexistir)
      if (a1.type === "franco" || a2.type === "franco") {
        continue
      }

      // Verificar solapamiento entre primera franja de ambos
      if (hasTimeOverlap(
        a1.startTime!,
        a1.endTime!,
        a2.startTime!,
        a2.endTime!
      )) {
        errors.push(
          `Solapamiento detectado entre ${getAssignmentDescription(a1)} y ${getAssignmentDescription(a2)}`
        )
      }

      // Si alguno tiene segunda franja, verificar también
      if (a1.startTime2 && a1.endTime2) {
        if (hasTimeOverlap(
          a1.startTime2,
          a1.endTime2,
          a2.startTime!,
          a2.endTime!
        )) {
          errors.push(
            `Solapamiento detectado entre segunda franja de ${getAssignmentDescription(a1)} y ${getAssignmentDescription(a2)}`
          )
        }
      }

      if (a2.startTime2 && a2.endTime2) {
        if (hasTimeOverlap(
          a1.startTime!,
          a1.endTime!,
          a2.startTime2,
          a2.endTime2
        )) {
          errors.push(
            `Solapamiento detectado entre ${getAssignmentDescription(a1)} y segunda franja de ${getAssignmentDescription(a2)}`
          )
        }
      }

      // Si ambos tienen segunda franja
      if (a1.startTime2 && a1.endTime2 && a2.startTime2 && a2.endTime2) {
        if (hasTimeOverlap(
          a1.startTime2,
          a1.endTime2,
          a2.startTime2,
          a2.endTime2
        )) {
          errors.push(
            `Solapamiento detectado entre segundas franjas de ${getAssignmentDescription(a1)} y ${getAssignmentDescription(a2)}`
          )
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Valida todos los assignments de una celda (completitud + solapamientos)
 */
export function validateCellAssignments(assignments: ShiftAssignment[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validar completitud de cada assignment
  for (const assignment of assignments) {
    const result = validateAssignmentComplete(assignment)
    if (!result.valid) {
      errors.push(...result.errors.map(e => `${getAssignmentDescription(assignment)}: ${e}`))
    }
    if (result.warnings) {
      warnings.push(...result.warnings.map(w => `${getAssignmentDescription(assignment)}: ${w}`))
    }
  }

  // Validar solapamientos
  const overlapResult = validateNoOverlaps(assignments)
  if (!overlapResult.valid) {
    errors.push(...overlapResult.errors)
  }
  if (overlapResult.warnings) {
    warnings.push(...overlapResult.warnings)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Valida antes de persistir (completitud + solapamientos)
 */
export function validateBeforePersist(assignments: ShiftAssignment[]): ValidationResult {
  return validateCellAssignments(assignments)
}

// Funciones auxiliares

/**
 * Valida que startTime < endTime (considerando cruce de medianoche)
 */
function isValidTimeRange(startTime: string, endTime: string): boolean {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  
  // Si end < start, cruza medianoche (válido)
  // Si end === start, duración cero (inválido)
  // Si end > start, rango normal (válido)
  return end !== start
}

/**
 * Valida que dos segmentos no se solapen (considerando cruce de medianoche)
 */
function validateNoOverlapBetweenSegments(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  // Para turnos cortados, end1 debe ser <= start2 (pueden ser iguales si son consecutivos)
  const end1Minutes = timeToMinutes(end1)
  const start2Minutes = timeToMinutes(start2)
  
  // Normalizar considerando cruce de medianoche
  const normalizedEnd1 = end1Minutes < timeToMinutes(start1) ? end1Minutes + 24 * 60 : end1Minutes
  const normalizedStart2 = start2Minutes < timeToMinutes(start1) ? start2Minutes + 24 * 60 : start2Minutes
  
  return normalizedEnd1 <= normalizedStart2
}

/**
 * Verifica si dos rangos de tiempo se solapan (considerando cruce de medianoche)
 */
function hasTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1)
  const e1 = timeToMinutes(end1)
  const s2 = timeToMinutes(start2)
  const e2 = timeToMinutes(end2)

  // Si alguno cruza medianoche, normalizar
  const crossesMidnight1 = e1 < s1
  const crossesMidnight2 = e2 < s2

  if (crossesMidnight1 && crossesMidnight2) {
    // Ambos cruzan medianoche - comparar directamente
    return true // Simplificación: si ambos cruzan, asumimos solapamiento
  } else if (crossesMidnight1) {
    // Solo el primero cruza medianoche
    return s2 <= e1 || s2 >= s1 || e2 >= s1
  } else if (crossesMidnight2) {
    // Solo el segundo cruza medianoche
    return s1 <= e2 || s1 >= s2 || e1 >= s2
  } else {
    // Ninguno cruza medianoche - comparación normal
    return s1 < e2 && s2 < e1
  }
}

/**
 * Convierte tiempo "HH:mm" a minutos desde medianoche
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Obtiene descripción legible de un assignment para mensajes de error
 */
function getAssignmentDescription(assignment: ShiftAssignment): string {
  if (assignment.type === "shift" && assignment.shiftId) {
    return `turno ${assignment.shiftId}`
  }
  if (assignment.type === "medio_franco") {
    return "medio franco"
  }
  if (assignment.type === "licencia") {
    return `licencia ${assignment.licenciaType || ""}`
  }
  return assignment.type || "assignment desconocido"
}
