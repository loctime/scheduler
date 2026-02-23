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

  // Función helper para inferir color basándose en horario
  // IMPORTANTE: Esta inferencia debe coincidir con los colores reales de los turnos
  const inferColorFromTime = (time: string | undefined): string => {
    if (!time) return "#9ca3af" // Gris por defecto
    
    // Turnos que empiezan a las 15:30 o 20:00 -> naranja (turnos de tarde/noche)
    if (time.startsWith("15:30") || time.startsWith("15:") || 
        time.startsWith("20:") || time.startsWith("21:") || time.startsWith("22:")) {
      return "#f97316" // orange-500
    }
    // Turnos que empiezan a las 11:00 o 12:00 -> azul (turnos de mañana/tarde)
    if (time.startsWith("11:") || time.startsWith("12:") || 
        time.startsWith("10:") || time.startsWith("09:")) {
      return "#3b82f6" // blue-500
    }
    // Otros horarios de mañana -> azul claro
    if (time.startsWith("08:") || time.startsWith("07:") || time.startsWith("06:")) {
      return "#60a5fa" // blue-400
    }
    // Horarios de tarde (16-19) -> naranja/amber
    if (time.startsWith("16:") || time.startsWith("17:") || time.startsWith("18:") || time.startsWith("19:")) {
      return "#f97316" // orange-500
    }
    // Horarios de noche (00-05) -> naranja (turnos que terminan a las 00)
    if (time.startsWith("00:") || time.startsWith("01:") || time.startsWith("02:") || time.startsWith("03:") || time.startsWith("04:") || time.startsWith("05:")) {
      return "#f97316" // orange-500 (turnos nocturnos)
    }
    
    return "#9ca3af" // Gris por defecto
  }

  // Obtener shifts de la semana (usando la misma lógica que PwaTodayScheduleCard)
  const shifts = useMemo(() => {
    if (!horario || !currentWeek) return []
    const ownerId = horario.ownerId ?? ""
    
    // Intentar obtener desde snapshot primero (tiene colores reales)
    if (currentWeek.shifts && Array.isArray(currentWeek.shifts) && currentWeek.shifts.length > 0) {
      const shiftsFromSnapshot = currentWeek.shifts.map((s: any) => ({
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
      
      // Si hay turnos cortados sin colorPrimeraFranja/colorSegundaFranja definidos,
      // inferirlos desde los horarios para asegurar colores correctos
      return shiftsFromSnapshot.map((shift) => {
        if (shift.startTime && shift.endTime && shift.startTime2 && shift.endTime2) {
          // Es un turno cortado
          if (!shift.colorPrimeraFranja || !shift.colorSegundaFranja) {
            const color1 = inferColorFromTime(shift.startTime)
            const color2 = inferColorFromTime(shift.startTime2)
            return {
              ...shift,
              colorPrimeraFranja: shift.colorPrimeraFranja || color1,
              colorSegundaFranja: shift.colorSegundaFranja || color2,
            }
          }
        }
        return shift
      })
    }
    
    // Fallback: construir shifts desde assignments (como hace PwaTodayScheduleCard)
    if (currentWeek.days) {
      const shiftMap = new Map<string, { 
        shiftId: string
        startTime?: string
        endTime?: string
        startTime2?: string
        endTime2?: string
        colorPrimeraFranja?: string
        colorSegundaFranja?: string
      }>()
      
      // Recopilar información de los assignments para inferir colores y detectar turnos cortados
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
                const existing = shiftMap.get(shiftId)
                
                // Guardar información del horario para inferir color y detectar turnos cortados
                // Priorizar assignments con más información (turnos cortados)
                if (!existing || 
                    (!existing.startTime && assignment.startTime) ||
                    (!existing.startTime2 && assignment.startTime2)) {
                  shiftMap.set(shiftId, {
                    shiftId,
                    startTime: assignment.startTime || existing?.startTime,
                    endTime: assignment.endTime || existing?.endTime,
                    startTime2: assignment.startTime2 || existing?.startTime2,
                    endTime2: assignment.endTime2 || existing?.endTime2,
                    colorPrimeraFranja: (assignment as any).colorPrimeraFranja || existing?.colorPrimeraFranja,
                    colorSegundaFranja: (assignment as any).colorSegundaFranja || existing?.colorSegundaFranja,
                  })
                }
              }
            })
          })
        }
      })
      
      // Crear turnos básicos desde los IDs encontrados, inferiendo color por horario
      return Array.from(shiftMap.values()).map(({ shiftId, startTime, endTime, startTime2, endTime2, colorPrimeraFranja, colorSegundaFranja }) => {
        // Inferir color de primera franja basándose en startTime
        const inferredColorPrimeraFranja = inferColorFromTime(startTime)
        const color = inferredColorPrimeraFranja
        
        // Si hay turno cortado (startTime2 y endTime2), inferir color de segunda franja
        const isCutShift = !!(startTime2 && endTime2)
        const inferredColorSegundaFranja = isCutShift && startTime2
          ? inferColorFromTime(startTime2)
          : undefined
        
        // Para turnos cortados, siempre usar colores inferidos si no están definidos
        const finalColorPrimeraFranja = colorPrimeraFranja || inferredColorPrimeraFranja
        const finalColorSegundaFranja = isCutShift
          ? (colorSegundaFranja || inferredColorSegundaFranja || inferredColorPrimeraFranja)
          : undefined
        
        return {
          id: shiftId,
          name: `Turno ${shiftId}`,
          color,
          ownerId,
          userId: ownerId,
          startTime,
          endTime,
          startTime2,
          endTime2,
          colorPrimeraFranja: finalColorPrimeraFranja,
          colorSegundaFranja: finalColorSegundaFranja,
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
