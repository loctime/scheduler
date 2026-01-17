import { Turno, Empleado, ShiftAssignment } from "@/lib/types"
import { ShiftOverlap } from "@/lib/types"
import { adjustTime } from "@/lib/utils"
import {
  splitShiftIntoIntervals,
  rangesOverlap,
  calculateShiftDurationMinutes,
  TimeInterval,
} from "@/lib/time-utils"

/**
 * Valida si dos turnos se solapan en horario
 * Soporta cruce de medianoche y turnos cortados (dos franjas)
 */
export function checkShiftOverlap(shift1: Turno, shift2: Turno): boolean {
  // Obtener intervalos de ambos turnos
  const intervals1 = splitShiftIntoIntervals(shift1)
  const intervals2 = splitShiftIntoIntervals(shift2)

  if (intervals1.length === 0 || intervals2.length === 0) {
    return false // Si no tienen horarios definidos, no hay solapamiento
  }

  // Verificar si cualquier intervalo de shift1 se solapa con cualquier intervalo de shift2
  for (const interval1 of intervals1) {
    for (const interval2 of intervals2) {
      // Comparación directa de intervalos normalizados
      // Los intervalos ya están normalizados (end puede ser > 1440 si cruza medianoche)
      if (interval1.start < interval2.end && interval2.start < interval1.end) {
        return true
      }
    }
  }

  return false
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
 * Soporta cruce de medianoche y turnos cortados (dos franjas)
 */
export function calculateShiftHours(
  shift: Turno | { startTime?: string | null; endTime?: string | null; startTime2?: string | null; endTime2?: string | null },
  minutosDescanso: number = 30,
  horasMinimasParaDescanso: number = 6
): number {
  if (!shift.startTime || !shift.endTime) return 0

  // Calcular duración total usando utilidades de tiempo
  const totalMinutes = calculateShiftDurationMinutes(shift)
  const totalHours = totalMinutes / 60

  // Si tiene segunda franja (turno cortado), NO aplica descanso
  if (shift.startTime2 || shift.endTime2) {
    return totalHours
  }

  // Turno continuo: aplicar descanso si cumple horas mínimas
  if (totalHours >= horasMinimasParaDescanso) {
    const horasConDescanso = (totalMinutes - minutosDescanso) / 60
    return Math.max(0, horasConDescanso) // No puede ser negativo
  }

  return totalHours
}

/**
 * Calcula las horas extras comparando el turno base con el horario real de la asignación
 * Las horas extra se derivan automáticamente de la diferencia entre el turno teórico y el horario trabajado
 * 
 * @param assignment La asignación diaria con horario real
 * @param shift El turno base (plantilla teórica)
 * @param minutosDescanso Minutos de descanso a aplicar
 * @param horasMinimasParaDescanso Horas mínimas para aplicar descanso
 * @returns Objeto con horas normales y horas extra
 */
export function calculateExtraHours(
  assignment: any,
  shift: Turno,
  minutosDescanso: number = 30,
  horasMinimasParaDescanso: number = 6
): { horasNormales: number; horasExtra: number } {
  // Si no hay turno base o asignación, retornar ceros
  if (!shift || !assignment || assignment.type === "franco" || assignment.type === "medio_franco") {
    return { horasNormales: 0, horasExtra: 0 }
  }

  // Calcular horas del turno base (horario teórico)
  const horasTurnoBase = calculateShiftHours(shift, minutosDescanso, horasMinimasParaDescanso)

  // Calcular horas del horario real (asignación)
  // Si la asignación no tiene horarios explícitos, usar los del turno base
  const startTimeReal = assignment.startTime || shift.startTime
  const endTimeReal = assignment.endTime || shift.endTime
  const startTime2Real = assignment.startTime2 || shift.startTime2
  const endTime2Real = assignment.endTime2 || shift.endTime2

  if (!startTimeReal || !endTimeReal) {
    return { horasNormales: horasTurnoBase, horasExtra: 0 }
  }

  // Crear turno temporal con horario real
  const turnoReal: any = {
    startTime: startTimeReal,
    endTime: endTimeReal,
    startTime2: startTime2Real,
    endTime2: endTime2Real,
  }

  const horasHorarioReal = calculateShiftHours(turnoReal, minutosDescanso, horasMinimasParaDescanso)

  // Las horas extra son la diferencia positiva entre horario real y turno base
  const horasExtra = Math.max(0, horasHorarioReal - horasTurnoBase)
  const horasNormales = horasTurnoBase

  return { horasNormales, horasExtra }
}

/**
 * Calcula las horas extras totales de un array de asignaciones
 * Útil para calcular horas extra de un día completo con múltiples turnos
 */
export function calculateTotalExtraHours(
  assignments: any[],
  shifts: Turno[],
  minutosDescanso: number = 30,
  horasMinimasParaDescanso: number = 6
): { horasNormales: number; horasExtra: number } {
  const shiftMap = new Map(shifts.map((s) => [s.id, s]))
  let totalHorasNormales = 0
  let totalHorasExtra = 0

  assignments.forEach((assignment) => {
    // Ignorar francos y medio francos
    if (assignment.type === "franco" || assignment.type === "medio_franco") {
      return
    }

    if (assignment.shiftId) {
      const shift = shiftMap.get(assignment.shiftId)
      if (shift) {
        const { horasNormales, horasExtra } = calculateExtraHours(
          assignment,
          shift,
          minutosDescanso,
          horasMinimasParaDescanso
        )
        totalHorasNormales += horasNormales
        totalHorasExtra += horasExtra
      }
    }
  })

  return { horasNormales: totalHorasNormales, horasExtra: totalHorasExtra }
}

/**
 * Calcula las horas trabajadas totales de un empleado en un día
 * Considera todos los turnos asignados y aplica descanso cuando corresponde
 * Soporta ShiftAssignment[] para manejar francos y medio francos
 */
export function calculateDailyHours(
  shiftIds: string[] | any[], // Puede ser string[] o ShiftAssignment[]
  shifts: Turno[],
  minutosDescanso: number = 30,
  horasMinimasParaDescanso: number = 6
): number {
  const shiftMap = new Map(shifts.map((s) => [s.id, s]))
  let totalHours = 0

  // Si es array de ShiftAssignment
  if (shiftIds.length > 0 && typeof shiftIds[0] === "object" && "type" in shiftIds[0]) {
    const assignments = shiftIds as any[]
    assignments.forEach((assignment) => {
      // Ignorar francos
      if (assignment.type === "franco") {
        return
      }
      
      // Calcular horas de medio franco
      if (assignment.type === "medio_franco") {
        if (assignment.startTime && assignment.endTime) {
          const [hStart, mStart] = assignment.startTime.split(":").map(Number)
          const [hEnd, mEnd] = assignment.endTime.split(":").map(Number)
          const start = hStart * 60 + mStart
          const end = hEnd * 60 + mEnd
          const totalMinutes = end - start
          totalHours += totalMinutes / 60
        }
        return
      }
      
      // Turno normal - usar SOLO valores explícitos del assignment (autosuficiencia)
      if (assignment.shiftId && assignment.type === "shift") {
        // El assignment debe tener startTime y endTime explícitos
        // Si no los tiene, está incompleto y no podemos calcular horas
        if (!assignment.startTime || !assignment.endTime) {
          // Assignment incompleto - no calcular horas basándose en turno base
          // Esto fuerza a completar el assignment antes de calcular
          return // Saltar este assignment incompleto
        }
        
        // Crear un turno temporal solo con los valores explícitos del assignment
        const tempShift: any = {
          startTime: assignment.startTime,
          endTime: assignment.endTime,
        }
        
        // Si tiene segunda franja explícita, incluirla
        if (assignment.startTime2 && assignment.endTime2) {
          tempShift.startTime2 = assignment.startTime2
          tempShift.endTime2 = assignment.endTime2
        }
        
        totalHours += calculateShiftHours(tempShift, minutosDescanso, horasMinimasParaDescanso)
      }
    })
    return totalHours
  }

  // Comportamiento original para string[]
  shiftIds.forEach((shiftId) => {
    const shift = shiftMap.get(shiftId)
    if (shift) {
      totalHours += calculateShiftHours(shift, minutosDescanso, horasMinimasParaDescanso)
    }
  })

  return totalHours
}

/**
 * Calcula el desglose de horas por tipo de tramo
 * Retorna horas trabajadas, horas de licencia embarazo y horas de medio franco
 */
export function calculateHoursBreakdown(
  shiftIds: string[] | any[], // Puede ser string[] o ShiftAssignment[]
  shifts: Turno[],
  minutosDescanso: number = 30,
  horasMinimasParaDescanso: number = 6
): {
  trabajo: number
  licencia: number
  medio_franco: number
} {
  const shiftMap = new Map(shifts.map((s) => [s.id, s]))
  let horasTrabajo = 0
  let horasLicencia = 0
  let horasMedioFranco = 0

  // Si es array de ShiftAssignment
  if (shiftIds.length > 0 && typeof shiftIds[0] === "object" && "type" in shiftIds[0]) {
    const assignments = shiftIds as any[]
    assignments.forEach((assignment) => {
      // Ignorar francos
      if (assignment.type === "franco") {
        return
      }
      
      // Calcular horas de medio franco
      if (assignment.type === "medio_franco") {
        if (assignment.startTime && assignment.endTime) {
          const [hStart, mStart] = assignment.startTime.split(":").map(Number)
          const [hEnd, mEnd] = assignment.endTime.split(":").map(Number)
          const start = hStart * 60 + mStart
          const end = hEnd * 60 + mEnd
          const totalMinutes = end - start
          horasMedioFranco += totalMinutes / 60
        }
        return
      }

      // Calcular horas de licencia
      if (assignment.type === "licencia") {
        if (assignment.startTime && assignment.endTime) {
          const [hStart, mStart] = assignment.startTime.split(":").map(Number)
          const [hEnd, mEnd] = assignment.endTime.split(":").map(Number)
          const start = hStart * 60 + mStart
          const end = hEnd * 60 + mEnd
          const totalMinutes = end - start
          horasLicencia += totalMinutes / 60
        }
        return
      }
      
      // Turno normal (trabajo) - usar SOLO valores explícitos del assignment (autosuficiencia)
      if (assignment.shiftId && assignment.type === "shift") {
        // El assignment debe tener startTime y endTime explícitos
        // Si no los tiene, está incompleto y no podemos calcular horas
        if (!assignment.startTime || !assignment.endTime) {
          // Assignment incompleto - no calcular horas basándose en turno base
          return // Saltar este assignment incompleto
        }
        
        // Crear un turno temporal solo con los valores explícitos del assignment
        const tempShift: any = {
          startTime: assignment.startTime,
          endTime: assignment.endTime,
        }
        
        // Si tiene segunda franja explícita, incluirla
        if (assignment.startTime2 && assignment.endTime2) {
          tempShift.startTime2 = assignment.startTime2
          tempShift.endTime2 = assignment.endTime2
        }
        
        horasTrabajo += calculateShiftHours(tempShift, minutosDescanso, horasMinimasParaDescanso)
      }
    })
    return {
      trabajo: horasTrabajo,
      licencia: horasLicencia,
      medio_franco: horasMedioFranco
    }
  }

  // Comportamiento original para string[] - todo cuenta como trabajo
  shiftIds.forEach((shiftId) => {
    const shift = shiftMap.get(shiftId)
    if (shift) {
      horasTrabajo += calculateShiftHours(shift, minutosDescanso, horasMinimasParaDescanso)
    }
  })

  return {
    trabajo: horasTrabajo,
      licencia: 0,
    medio_franco: 0
  }
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
 * Soporta string[] o ShiftAssignment[] para manejar francos y medio francos
 */
export function validateDailyHours(
  shiftIds: string[] | any[],
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

