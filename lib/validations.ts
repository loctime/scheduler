import { Turno, Empleado } from "@/lib/types"
import { ShiftOverlap } from "@/lib/types"

/**
 * Valida si dos turnos se solapan en horario
 */
export function checkShiftOverlap(shift1: Turno, shift2: Turno): boolean {
  if (!shift1.startTime || !shift1.endTime || !shift2.startTime || !shift2.endTime) {
    return false // Si no tienen horarios definidos, no hay solapamiento
  }

  const [h1Start, m1Start] = shift1.startTime.split(":").map(Number)
  const [h1End, m1End] = shift1.endTime.split(":").map(Number)
  const [h2Start, m2Start] = shift2.startTime.split(":").map(Number)
  const [h2End, m2End] = shift2.endTime.split(":").map(Number)

  const start1 = h1Start * 60 + m1Start
  const end1 = h1End * 60 + m1End
  const start2 = h2Start * 60 + m2Start
  const end2 = h2End * 60 + m2End

  // Verificar solapamiento
  return start1 < end2 && start2 < end1
}

/**
 * Valida todas las asignaciones de un horario y encuentra solapamientos
 */
export function validateScheduleAssignments(
  assignments: {
    [date: string]: {
      [employeeId: string]: string[]
    }
  },
  employees: Empleado[],
  shifts: Turno[],
): ShiftOverlap[] {
  const overlaps: ShiftOverlap[] = []
  const shiftMap = new Map(shifts.map((s) => [s.id, s]))

  Object.entries(assignments).forEach(([date, dateAssignments]) => {
    Object.entries(dateAssignments).forEach(([employeeId, shiftIds]) => {
      if (shiftIds.length <= 1) return // No hay solapamiento si hay 1 o menos turnos

      // Verificar todos los pares de turnos
      for (let i = 0; i < shiftIds.length; i++) {
        for (let j = i + 1; j < shiftIds.length; j++) {
          const shift1 = shiftMap.get(shiftIds[i])
          const shift2 = shiftMap.get(shiftIds[j])

          if (shift1 && shift2 && checkShiftOverlap(shift1, shift2)) {
            const employee = employees.find((e) => e.id === employeeId)
            overlaps.push({
              employeeId,
              date,
              shifts: [shiftIds[i], shiftIds[j]],
              message: `Solapamiento detectado: ${shift1.name} y ${shift2.name} para ${employee?.name || "empleado"}`,
            })
          }
        }
      }
    })
  })

  return overlaps
}

/**
 * Calcula las horas trabajadas de un turno, considerando el descanso de 30 minutos
 * Solo aplica descanso si el turno es continuo (no cortado) y tiene más de 6 horas
 */
export function calculateShiftHours(
  shift: Turno,
  minutosDescanso: number = 30,
  horasMinimasParaDescanso: number = 6
): number {
  if (!shift.startTime || !shift.endTime) return 0

  // Si tiene segunda franja (turno cortado), NO aplica descanso
  if (shift.startTime2 || shift.endTime2) {
    // Calcular ambas franjas sin descanso
    let totalMinutes = 0
    
    // Primera franja
    const [h1Start, m1Start] = shift.startTime.split(":").map(Number)
    const [h1End, m1End] = shift.endTime.split(":").map(Number)
    const start1 = h1Start * 60 + m1Start
    const end1 = h1End * 60 + m1End
    totalMinutes += end1 - start1
    
    // Segunda franja (si existe)
    if (shift.startTime2 && shift.endTime2) {
      const [h2Start, m2Start] = shift.startTime2.split(":").map(Number)
      const [h2End, m2End] = shift.endTime2.split(":").map(Number)
      const start2 = h2Start * 60 + m2Start
      const end2 = h2End * 60 + m2End
      totalMinutes += end2 - start2
    }
    
    return totalMinutes / 60
  }

  // Turno continuo: calcular horas
  const [hStart, mStart] = shift.startTime.split(":").map(Number)
  const [hEnd, mEnd] = shift.endTime.split(":").map(Number)
  const start = hStart * 60 + mStart
  const end = hEnd * 60 + mEnd
  const totalMinutes = end - start
  const totalHours = totalMinutes / 60

  // Solo aplicar descanso si el turno es >= horasMinimasParaDescanso
  if (totalHours >= horasMinimasParaDescanso) {
    const horasConDescanso = (totalMinutes - minutosDescanso) / 60
    return Math.max(0, horasConDescanso) // No puede ser negativo
  }

  return totalHours
}

/**
 * Calcula las horas trabajadas totales de un empleado en un día
 * Considera todos los turnos asignados y aplica descanso cuando corresponde
 */
export function calculateDailyHours(
  shiftIds: string[],
  shifts: Turno[],
  minutosDescanso: number = 30,
  horasMinimasParaDescanso: number = 6
): number {
  const shiftMap = new Map(shifts.map((s) => [s.id, s]))
  let totalHours = 0

  shiftIds.forEach((shiftId) => {
    const shift = shiftMap.get(shiftId)
    if (shift) {
      totalHours += calculateShiftHours(shift, minutosDescanso, horasMinimasParaDescanso)
    }
  })

  return totalHours
}

/**
 * Valida que un empleado no tenga más de X horas por semana
 * Actualizado para considerar descansos
 */
export function validateWeeklyHours(
  assignments: {
    [date: string]: {
      [employeeId: string]: string[]
    }
  },
  employeeId: string,
  shifts: Turno[],
  maxHours: number = 48,
  minutosDescanso: number = 30,
  horasMinimasParaDescanso: number = 6
): { valid: boolean; hours: number; message?: string } {
  let totalHours = 0

  Object.values(assignments).forEach((dateAssignments) => {
    const employeeShifts = dateAssignments[employeeId] || []
    totalHours += calculateDailyHours(employeeShifts, shifts, minutosDescanso, horasMinimasParaDescanso)
  })

  const valid = totalHours <= maxHours

  return {
    valid,
    hours: totalHours,
    message: valid
      ? undefined
      : `El empleado tiene ${totalHours.toFixed(1)} horas esta semana (máximo: ${maxHours}h)`,
  }
}

/**
 * Valida horas máximas por día considerando descansos
 */
export function validateDailyHours(
  shiftIds: string[],
  shifts: Turno[],
  maxHours: number,
  minutosDescanso: number = 30,
  horasMinimasParaDescanso: number = 6
): { valid: boolean; hours: number; message?: string } {
  const hours = calculateDailyHours(shiftIds, shifts, minutosDescanso, horasMinimasParaDescanso)
  const valid = hours <= maxHours

  return {
    valid,
    hours,
    message: valid
      ? undefined
      : `El empleado tiene ${hours.toFixed(1)} horas este día (máximo: ${maxHours}h)`,
  }
}

