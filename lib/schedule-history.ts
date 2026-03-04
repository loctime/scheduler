import type { Horario } from "@/lib/types"

type ScheduleDataSource = "snapshot" | "live"

export interface ScheduleDataForStats {
  assignments: Horario["assignments"]
  dayStatus: Horario["dayStatus"]
  source: ScheduleDataSource
}

/**
 * Fuente única para lectura de datos de semana en cálculos históricos.
 * - Semana completada: usar snapshot congelado.
 * - Semana no completada: usar datos vivos.
 */
export function getScheduleDataForStats(schedule: Horario | null | undefined): ScheduleDataForStats {
  if (!schedule) {
    return { assignments: {}, dayStatus: {}, source: "live" }
  }

  if (schedule.completada === true && schedule.weekSnapshot) {
    return {
      assignments: schedule.weekSnapshot.assignments || {},
      dayStatus: schedule.weekSnapshot.dayStatus || {},
      source: "snapshot",
    }
  }

  return {
    assignments: schedule.assignments || {},
    dayStatus: schedule.dayStatus || {},
    source: "live",
  }
}

export function getHistoricalEmployeeIds(schedule: Horario | null | undefined): string[] {
  if (!schedule) return []

  const ids = new Set<string>()

  const source = getScheduleDataForStats(schedule)
  Object.values(source.assignments || {}).forEach((dayAssignments) => {
    if (!dayAssignments || typeof dayAssignments !== "object") return
    Object.keys(dayAssignments).forEach((employeeId) => ids.add(employeeId))
  })

  Object.values(source.dayStatus || {}).forEach((dayStatuses) => {
    if (!dayStatuses || typeof dayStatuses !== "object") return
    Object.keys(dayStatuses).forEach((employeeId) => ids.add(employeeId))
  })

  if (schedule.weekSnapshot?.employees?.length) {
    schedule.weekSnapshot.employees.forEach((employee) => ids.add(employee.id))
  }

  return Array.from(ids)
}
