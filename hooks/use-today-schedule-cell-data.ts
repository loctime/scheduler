"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { usePublicHorario } from "@/hooks/use-public-horario"
import { ShiftAssignment, Turno, MedioTurno } from "@/lib/types"
import type { CSSProperties } from "react"
import { hexToRgba } from "@/components/schedule-grid/utils/schedule-grid-utils"

interface UseTodayScheduleCellDataProps {
  companySlug: string
  employeeId?: string
}

interface UseTodayScheduleCellDataReturn {
  assignments: ShiftAssignment[]
  dayStatus: "normal" | "franco" | "medio_franco"
  backgroundStyle?: CSSProperties
  getShiftInfo: (shiftId: string) => Turno | undefined
  mediosTurnos: MedioTurno[]
  hasIncompleteAssignments: boolean
  isLoading: boolean
  error: string | null
}

/**
 * Hook readonly para obtener datos del día de hoy desde horario público.
 * 
 * Prepara props para DayCellContent:
 * - assignments: asignaciones del día de hoy
 * - dayStatus: estado del día (normal/franco/medio_franco)
 * - backgroundStyle: estilo de fondo calculado
 * - getShiftInfo: función para obtener info de turnos
 * - mediosTurnos: medios turnos disponibles
 * - hasIncompleteAssignments: si hay assignments incompletos
 */
export function useTodayScheduleCellData({
  companySlug,
  employeeId,
}: UseTodayScheduleCellDataProps): UseTodayScheduleCellDataReturn {
  const { horario, isLoading, error } = usePublicHorario(companySlug)

  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")

  // Obtener datos de la semana publicada actual
  const currentWeek = horario?.weeks?.[horario?.publishedWeekId]
  const dayData = currentWeek?.days?.[todayStr] as Record<string, ShiftAssignment[]> | undefined
  const dayStatusData = currentWeek?.dayStatus?.[todayStr] as Record<string, "normal" | "franco" | "medio_franco"> | undefined

  // Obtener assignments del empleado (si está especificado)
  const assignments = useMemo(() => {
    if (!employeeId || !dayData) return []
    const employeeAssignments = dayData[employeeId]
    if (!Array.isArray(employeeAssignments)) return []
    
    // Normalizar assignments (asegurar que tienen type)
    return employeeAssignments.map((assignment) => ({
      ...assignment,
      type: assignment.type || "shift",
    })) as ShiftAssignment[]
  }, [employeeId, dayData])

  // Obtener dayStatus del empleado
  const dayStatus = useMemo(() => {
    if (!employeeId || !dayStatusData) return "normal" as const
    return dayStatusData[employeeId] || "normal"
  }, [employeeId, dayStatusData])

  // Obtener shifts de la semana
  const shifts = useMemo(() => {
    if (!currentWeek?.shifts || !Array.isArray(currentWeek.shifts)) return []
    const ownerId = horario?.ownerId ?? ""
    return currentWeek.shifts.map((s: any) => ({
      id: s.id,
      name: s.name || `Turno ${s.id}`,
      color: s.color?.trim() || "#9ca3af",
      ownerId,
      userId: ownerId,
      startTime: s.startTime,
      endTime: s.endTime,
      startTime2: s.startTime2,
      endTime2: s.endTime2,
    })) as Turno[]
  }, [currentWeek?.shifts, horario?.ownerId])

  // Crear función getShiftInfo
  const getShiftInfo = useMemo(() => {
    return (shiftId: string): Turno | undefined => {
      return shifts.find((s) => s.id === shiftId)
    }
  }, [shifts])

  // mediosTurnos vacío por ahora (no está en el horario público)
  const mediosTurnos: MedioTurno[] = useMemo(() => [], [])

  // Verificar assignments incompletos
  const hasIncompleteAssignments = useMemo(() => {
    return assignments.some((assignment) => {
      if (assignment.type === "shift" && assignment.shiftId) {
        // Verificar si falta startTime o endTime
        if (!assignment.startTime || !assignment.endTime) {
          return true
        }
      }
      return false
    })
  }, [assignments])

  // Calcular backgroundStyle (simplificado, solo para franco y turnos básicos)
  const backgroundStyle = useMemo((): CSSProperties | undefined => {
    if (assignments.length === 0) {
      if (dayStatus === "franco") {
        return { backgroundColor: "rgba(34, 197, 94, 0.35)" }
      }
      return undefined
    }

    // Color verde para franco
    const defaultGreenColor = "rgba(34, 197, 94, 0.35)"

    if (assignments.some((a) => a.type === "franco") || dayStatus === "franco") {
      return { backgroundColor: defaultGreenColor }
    }

    // Buscar turnos normales
    const shiftAssignments = assignments.filter((a) => a.type === "shift" && a.shiftId)
    
    if (shiftAssignments.length > 0) {
      const firstAssignment = shiftAssignments[0]
      const firstShift = getShiftInfo(firstAssignment.shiftId || "")
      if (firstShift && firstShift.color) {
        return { backgroundColor: hexToRgba(firstShift.color, 0.35) }
      }
    }

    return undefined
  }, [assignments, dayStatus, getShiftInfo])

  return {
    assignments,
    dayStatus,
    backgroundStyle,
    getShiftInfo,
    mediosTurnos,
    hasIncompleteAssignments,
    isLoading,
    error,
  }
}
