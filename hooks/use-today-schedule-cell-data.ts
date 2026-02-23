"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { usePublicHorario } from "@/hooks/use-public-horario"
import { ShiftAssignment, Turno, MedioTurno } from "@/lib/types"
import type { CSSProperties } from "react"
import { getDayBackgroundStyle } from "@/components/schedule-grid/utils/get-day-background-style"

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

  // Obtener shifts de la semana (usando la misma lógica que PwaTodayScheduleCard)
  const shifts = useMemo(() => {
    if (!horario || !currentWeek) return []
    const ownerId = horario.ownerId ?? ""
    
    // Intentar obtener desde snapshot primero
    if (currentWeek.shifts && Array.isArray(currentWeek.shifts) && currentWeek.shifts.length > 0) {
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
        colorPrimeraFranja: s.colorPrimeraFranja,
        colorSegundaFranja: s.colorSegundaFranja,
      })) as Turno[]
    }
    
    // Fallback: construir shifts desde assignments (como hace PwaTodayScheduleCard)
    if (currentWeek.days) {
      const shiftMap = new Map<string, { shiftId: string; startTime?: string; endTime?: string }>()
      
      // Recopilar información de los assignments para inferir colores
      Object.values(currentWeek.days).forEach((dayAssignments: any) => {
        if (dayAssignments && typeof dayAssignments === "object") {
          Object.values(dayAssignments).forEach((assignments: any) => {
            if (!Array.isArray(assignments)) return
            assignments.forEach((assignment: any) => {
              if (typeof assignment === "string") {
                // Assignment antiguo formato string (solo ID)
                if (!shiftMap.has(assignment)) {
                  shiftMap.set(assignment, { shiftId: assignment })
                }
                return
              }
              if (assignment && typeof assignment === "object" && "shiftId" in assignment && assignment.shiftId) {
                const shiftId = assignment.shiftId
                // Guardar información del horario para inferir color
                if (!shiftMap.has(shiftId) || !shiftMap.get(shiftId)?.startTime) {
                  shiftMap.set(shiftId, {
                    shiftId,
                    startTime: assignment.startTime,
                    endTime: assignment.endTime,
                  })
                }
              }
            })
          })
        }
      })
      
      // Crear turnos básicos desde los IDs encontrados, inferiendo color por horario
      return Array.from(shiftMap.values()).map(({ shiftId, startTime, endTime }) => {
        // Inferir color basándose en el horario de inicio
        let color = "#9ca3af" // Gris por defecto
        
        if (startTime) {
          // Turnos que empiezan a las 15:30 -> naranja
          if (startTime.startsWith("15:30") || startTime.startsWith("15:")) {
            color = "#f97316" // orange-500
          }
          // Turnos que empiezan a las 11:00 -> azul
          else if (startTime.startsWith("11:") || startTime.startsWith("10:") || startTime.startsWith("09:")) {
            color = "#3b82f6" // blue-500
          }
          // Otros horarios de mañana -> azul claro
          else if (startTime.startsWith("08:") || startTime.startsWith("07:") || startTime.startsWith("06:")) {
            color = "#60a5fa" // blue-400
          }
          // Horarios de tarde/noche -> otros colores
          else if (startTime.startsWith("20:") || startTime.startsWith("21:") || startTime.startsWith("22:")) {
            color = "#8b5cf6" // violet-500
          }
        }
        
        return {
          id: shiftId,
          name: `Turno ${shiftId}`,
          color,
          ownerId,
          userId: ownerId,
          startTime,
          endTime,
        } as Turno
      })
    }
    
    return []
  }, [horario, currentWeek])

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

  // Calcular backgroundStyle usando la misma lógica que ScheduleCell
  const backgroundStyle = useMemo((): CSSProperties | undefined => {
    return getDayBackgroundStyle({
      assignments,
      dayStatus,
      getShiftInfo,
      shifts,
      mediosTurnos,
    })
  }, [assignments, dayStatus, getShiftInfo, shifts, mediosTurnos])

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
