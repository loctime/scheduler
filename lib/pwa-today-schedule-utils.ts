import type { Turno } from "@/lib/types"

export type TodayScheduleStatus = "trabaja" | "medio_franco" | "franco"

export interface TimeBlock {
  /** Etiqueta opcional (ej: nombre del turno) */
  label?: string
  startTime: string
  endTime: string
}

export interface TodayScheduleInfo {
  status: TodayScheduleStatus
  /** Bloques de horario (vacío si franco, 1+ si trabaja o medio franco) */
  timeBlocks: TimeBlock[]
  /** Nombre del turno si aplica */
  shiftName?: string
}

type RawAssignment = {
  type?: string
  shiftId?: string
  startTime?: string
  endTime?: string
  startTime2?: string
  endTime2?: string
  texto?: string
} | string

/**
 * Obtiene la información estructurada del horario del día para un empleado.
 *
 * Soporta:
 * - Franco completo (status: "franco")
 * - Medio franco (status: "medio_franco", puede tener 1 o 2 bloques)
 * - Horario cortado / múltiples turnos (2+ bloques en timeBlocks)
 * - Turno simple (1 bloque)
 * - Varios assignments en el mismo día (shift, medio_franco)
 *
 * No duplica lógica: usa la misma estructura de ShiftAssignment que el resto del sistema.
 */
export function getTodayScheduleInfo(
  todayAssignments: RawAssignment[] | RawAssignment | undefined,
  shifts: Turno[]
): TodayScheduleInfo {
  const empty: TodayScheduleInfo = { status: "franco", timeBlocks: [] }

  if (!todayAssignments) return empty

  const arr: RawAssignment[] = Array.isArray(todayAssignments) ? todayAssignments : [todayAssignments]

  if (arr.length === 0) return empty

  const timeBlocks: TimeBlock[] = []
  let hasFranco = false
  let hasMedioFranco = false
  let hasShift = false
  let shiftName: string | undefined

  for (const raw of arr) {
    const a: RawAssignment =
      typeof raw === "string"
        ? { type: "shift", shiftId: raw }
        : (raw as { type?: string; shiftId?: string; startTime?: string; endTime?: string; startTime2?: string; endTime2?: string })

    const type = (a.type ?? "shift").replace("-", "_")

    if (type === "franco") {
      hasFranco = true
      continue
    }

    if (type === "medio_franco") {
      hasMedioFranco = true
      if (a.startTime && a.endTime) {
        timeBlocks.push({ startTime: a.startTime, endTime: a.endTime })
      }
      if (a.startTime2 && a.endTime2) {
        timeBlocks.push({ startTime: a.startTime2, endTime: a.endTime2 })
      }
      continue
    }

    if (type === "shift" || type === "licencia" || type === "nota") {
      // Solo procesamos shifts para horarios
      if (type === "shift" || (a.startTime && a.endTime)) {
        hasShift = true
        const shiftId = typeof raw === "string" ? raw : a.shiftId
        const shift = shiftId ? shifts.find((s) => s.id === shiftId) : undefined
        if (shift?.name) shiftName = shift.name

        if (a.startTime && a.endTime) {
          timeBlocks.push({
            label: shift?.name,
            startTime: a.startTime,
            endTime: a.endTime,
          })
        }
        if (a.startTime2 && a.endTime2) {
          timeBlocks.push({
            label: shift?.name,
            startTime: a.startTime2,
            endTime: a.endTime2,
          })
        }
        // Si solo tiene shiftId (sin startTime/endTime en assignment), buscar en shifts
        if (!a.startTime && !a.endTime && !a.startTime2 && !a.endTime2 && shift) {
          timeBlocks.push({
            label: shift.name,
            startTime: shift.startTime || "",
            endTime: shift.endTime || "",
          })
          if (shift.startTime2 && shift.endTime2) {
            timeBlocks.push({
              label: shift.name,
              startTime: shift.startTime2,
              endTime: shift.endTime2,
            })
          }
        }
      }
    }
  }

  // Prioridad: franco > medio franco > trabaja
  if (hasFranco && !hasMedioFranco && !hasShift) {
    return { status: "franco", timeBlocks: [] }
  }
  if (hasMedioFranco && !hasShift) {
    return { status: "medio_franco", timeBlocks }
  }
  if (hasShift || timeBlocks.length > 0) {
    return { status: "trabaja", timeBlocks, shiftName }
  }
  // Medio franco sin bloques explícitos
  if (hasMedioFranco) {
    return { status: "medio_franco", timeBlocks: [] }
  }

  return empty
}
