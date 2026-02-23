import { useCallback } from "react"
import type { CSSProperties } from "react"
import { ShiftAssignment, Turno, MedioTurno } from "@/lib/types"
import { getDayBackgroundStyle } from "../utils/get-day-background-style"

interface UseCellBackgroundStylesProps {
  getEmployeeAssignments: (employeeId: string, date: string) => ShiftAssignment[]
  getEmployeeDayStatus: (employeeId: string, date: string) => "normal" | "franco" | "medio_franco"
  getShiftInfo: (shiftId: string) => Turno | undefined
  shifts: Turno[]
  mediosTurnos: MedioTurno[]
}

export function useCellBackgroundStyles({
  getEmployeeAssignments,
  getEmployeeDayStatus,
  getShiftInfo,
  shifts,
  mediosTurnos,
}: UseCellBackgroundStylesProps) {
  // Obtener el color de fondo para una celda basado en las asignaciones
  // Usa la función compartida getDayBackgroundStyle para mantener consistencia
  const getCellBackgroundStyle = useCallback(
    (employeeId: string, date: string): CSSProperties | undefined => {
      const dayStatus = getEmployeeDayStatus(employeeId, date)
      const assignments = getEmployeeAssignments(employeeId, date)

      return getDayBackgroundStyle({
        assignments,
        dayStatus,
        getShiftInfo,
        shifts,
        mediosTurnos,
      })
    },
    [getEmployeeAssignments, getEmployeeDayStatus, getShiftInfo, shifts, mediosTurnos]
  )

  return {
    getCellBackgroundStyle,
  }
}
