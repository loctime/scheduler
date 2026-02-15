import { useMemo } from "react"
import type { Separador, ShiftAssignment } from "@/lib/types"
import type { GridItem } from "./use-schedule-grid-data"

const BLOCK_MINUTES = 30
const MINUTES_PER_DAY = 24 * 60

/** Convierte "HH:mm" a minutos desde medianoche (0-1440). */
function timeToMinutes(time: string): number {
  const parts = time.trim().split(":")
  const h = parseInt(parts[0] || "0", 10)
  const m = parseInt(parts[1] || "0", 10)
  return Math.max(0, Math.min(MINUTES_PER_DAY, h * 60 + m))
}

/**
 * Extrae intervalos [startMin, endMin] en los que el empleado está activo (trabajando)
 * a partir de sus asignaciones del día.
 * - type "shift": usa startTime/endTime y opcionalmente startTime2/endTime2 como tiempo trabajado
 * - type "franco" | "medio_franco" | "licencia" | "nota": no aportan tiempo activo para cobertura
 */
function getActiveMinutesFromAssignments(assignments: ShiftAssignment[]): Array<[number, number]> {
  const intervals: Array<[number, number]> = []
  for (const a of assignments) {
    if (a.type !== "shift") continue
    if (a.startTime && a.endTime) {
      const start = timeToMinutes(a.startTime)
      const end = timeToMinutes(a.endTime)
      if (end > start) intervals.push([start, end])
    }
    if (a.startTime2 && a.endTime2) {
      const start2 = timeToMinutes(a.startTime2)
      const end2 = timeToMinutes(a.endTime2)
      if (end2 > start2) intervals.push([start2, end2])
    }
  }
  return intervals
}

/** Indica si el bloque [blockStartMin, blockStartMin + 30) se solapa con [segStart, segEnd] (intervalo de trabajo). */
function blockOverlapsSegment(
  blockStartMin: number,
  segStart: number,
  segEnd: number
): boolean {
  const blockEnd = blockStartMin + BLOCK_MINUTES
  return blockStartMin < segEnd && blockEnd > segStart
}

/** Cuenta cuántos empleados del sector están activos en el bloque de 30 min para ese día. */
function countActiveInBlock(
  sectorEmployeeIds: string[],
  dayAssignments: Record<string, ShiftAssignment[]>,
  blockStartMin: number
): number {
  let count = 0
  for (const empId of sectorEmployeeIds) {
    const list = dayAssignments[empId]
    if (!list?.length) continue
    const intervals = getActiveMinutesFromAssignments(list)
    for (const [s, e] of intervals) {
      if (blockOverlapsSegment(blockStartMin, s, e)) {
        count += 1
        break
      }
    }
  }
  return count
}

export type SectorCoverageResult = {
  [separatorId: string]: {
    [dayKey: string]: { hasAlert: boolean }
  }
}

interface UseSectorCoverageProps {
  orderedItems: GridItem[]
  assignments: Record<string, Record<string, ShiftAssignment[]>>
  separadores: Separador[]
  weekDays: Date[]
}

/**
 * Analiza cobertura mínima por sector (separador) y día.
 * Para cada separador, toma los empleados debajo de él hasta el siguiente separador.
 * Para cada día, divide en bloques de 30 min y cuenta empleados activos por bloque.
 * Si en algún bloque activos < minimoCobertura → hasAlert true para ese día.
 */
export function useSectorCoverage({
  orderedItems,
  assignments,
  separadores,
  weekDays,
}: UseSectorCoverageProps): SectorCoverageResult {
  return useMemo(() => {
    const result: SectorCoverageResult = {}
    const separatorMap = new Map(separadores.map((s) => [s.id, s]))

    // Construir por cada separador la lista de empleados del sector (debajo hasta el siguiente separador)
    const sectorBySeparator: Array<{ separatorId: string; employeeIds: string[]; minCobertura: number }> = []
    let currentSector: { separatorId: string; employeeIds: string[]; minCobertura: number } | null = null

    for (const item of orderedItems) {
      if (item.type === "separator") {
        const sep = item.data as Separador
        const minCobertura = sep.minimoCobertura ?? 1
        if (currentSector) sectorBySeparator.push(currentSector)
        currentSector = {
          separatorId: sep.id,
          employeeIds: [],
          minCobertura,
        }
        continue
      }
      if (item.type === "employee" && currentSector) {
        currentSector.employeeIds.push((item.data as { id: string }).id)
      }
    }
    if (currentSector) sectorBySeparator.push(currentSector)

    for (const sector of sectorBySeparator) {
      result[sector.separatorId] = {}
      for (const day of weekDays) {
        const dayKey = formatDayKey(day)
        const dayAssignments = assignments[dayKey] || {}
        let hasAlert = false
        for (let blockStart = 0; blockStart < MINUTES_PER_DAY; blockStart += BLOCK_MINUTES) {
          const active = countActiveInBlock(
            sector.employeeIds,
            dayAssignments,
            blockStart
          )
          if (active < sector.minCobertura) {
            hasAlert = true
            break
          }
        }
        result[sector.separatorId][dayKey] = { hasAlert }
      }
    }

    return result
  }, [orderedItems, assignments, separadores, weekDays])
}

function formatDayKey(day: Date): string {
  const y = day.getFullYear()
  const m = String(day.getMonth() + 1).padStart(2, "0")
  const d = String(day.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
