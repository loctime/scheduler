"use client"

import { memo, useMemo, useCallback, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Empleado, Turno, Horario, HistorialItem, ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"
import { ShiftSelectorPopover } from "./shift-selector-popover"

interface ScheduleGridProps {
  weekDays: Date[]
  employees: Empleado[]
  shifts: Turno[]
  schedule: Horario | HistorialItem | null
  onShiftUpdate?: (date: string, employeeId: string, shiftIds: string[]) => void // formato antiguo (compatibilidad)
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: ShiftAssignment[]) => void // nuevo formato
  readonly?: boolean
  monthRange?: { startDate: Date; endDate: Date } // Rango del mes para deshabilitar días fuera del rango
}

export const ScheduleGrid = memo(function ScheduleGrid({
  weekDays,
  employees,
  shifts,
  schedule,
  onShiftUpdate,
  onAssignmentUpdate,
  readonly = false,
  monthRange,
}: ScheduleGridProps) {
  const [selectedCell, setSelectedCell] = useState<{ date: string; employeeId: string } | null>(null)

  // Memoizar mapa de turnos para búsqueda O(1)
  const shiftMap = useMemo(() => {
    return new Map(shifts.map((s) => [s.id, s]))
  }, [shifts])

  // Helper: convertir ShiftAssignmentValue a string[] (IDs)
  const toShiftIds = useCallback((value: ShiftAssignmentValue | undefined): string[] => {
    if (!value || !Array.isArray(value)) return []
    if (value.length === 0) return []
    // Si es string[] (formato antiguo)
    if (typeof value[0] === "string") {
      return value as string[]
    }
    // Si es ShiftAssignment[] (formato nuevo)
    return (value as ShiftAssignment[]).map((a) => a.shiftId)
  }, [])

  // Helper: convertir ShiftAssignmentValue a ShiftAssignment[]
  const toAssignments = useCallback((value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
    if (!value || !Array.isArray(value)) return []
    if (value.length === 0) return []
    // Si es string[] (formato antiguo), convertir
    if (typeof value[0] === "string") {
      return (value as string[]).map((shiftId) => ({ shiftId, type: "shift" as const }))
    }
    // Si es ShiftAssignment[] (formato nuevo)
    return (value as ShiftAssignment[]).map((a) => ({
      ...a,
      type: a.type || "shift" as const,
    }))
  }, [])

  // Memoizar función de obtener turnos de empleado (IDs)
  const getEmployeeShifts = useCallback(
    (employeeId: string, date: string): string[] => {
      if (!schedule?.assignments) return []
      const dateAssignments = schedule.assignments[date] || {}
      const employeeShifts = dateAssignments[employeeId]
      return toShiftIds(employeeShifts)
    },
    [schedule?.assignments, toShiftIds],
  )

  // Nueva función para obtener asignaciones completas
  const getEmployeeAssignments = useCallback(
    (employeeId: string, date: string): ShiftAssignment[] => {
      if (!schedule?.assignments) return []
      const dateAssignments = schedule.assignments[date] || {}
      const employeeShifts = dateAssignments[employeeId]
      return toAssignments(employeeShifts)
    },
    [schedule?.assignments, toAssignments],
  )

  // Memoizar función de obtener info de turno
  const getShiftInfo = useCallback(
    (shiftId: string): Turno | undefined => {
      return shiftMap.get(shiftId)
    },
    [shiftMap],
  )

  // Obtener horario para mostrar (ajustado o base)
  const getShiftDisplayTime = useCallback(
    (shiftId: string, assignment?: ShiftAssignment): string => {
      // Si es medio franco, usar sus horarios directamente
      if (assignment?.type === "medio_franco") {
        if (assignment.startTime && assignment.endTime) {
          return `${assignment.startTime} - ${assignment.endTime}`
        }
        return "1/2 Franco"
      }
      
      // Si es franco, no debería llegar aquí, pero por seguridad:
      if (assignment?.type === "franco") {
        return "FRANCO"
      }
      
      // Comportamiento normal para turnos
      const shift = getShiftInfo(shiftId)
      if (!shift) return ""

      // Si hay asignación con horarios ajustados, usar esos
      if (assignment) {
        const start = assignment.startTime || shift.startTime
        const end = assignment.endTime || shift.endTime
        const start2 = assignment.startTime2 || shift.startTime2
        const end2 = assignment.endTime2 || shift.endTime2

        if (start && end) {
          const first = `${start} - ${end}`
          if (start2 && end2) {
            return `${first} / ${start2} - ${end2}`
          }
          return first
        }
      }

      // Usar horarios del turno base
      if (shift.startTime && shift.endTime) {
        const first = `${shift.startTime} - ${shift.endTime}`
        if (shift.startTime2 && shift.endTime2) {
          return `${first} / ${shift.startTime2} - ${shift.endTime2}`
        }
        return first
      }

      return ""
    },
    [getShiftInfo],
  )

  // Verificar si un turno tiene horarios ajustados
  const hasAdjustedTimes = useCallback((assignment: ShiftAssignment, shift: Turno): boolean => {
    if (!assignment) return false
    return !!(
      (assignment.startTime && assignment.startTime !== shift.startTime) ||
      (assignment.endTime && assignment.endTime !== shift.endTime) ||
      (assignment.startTime2 && assignment.startTime2 !== shift.startTime2) ||
      (assignment.endTime2 && assignment.endTime2 !== shift.endTime2)
    )
  }, [])

  const handleCellClick = useCallback(
    (date: string, employeeId: string) => {
      if (!readonly && (onShiftUpdate || onAssignmentUpdate)) {
        setSelectedCell({ date, employeeId })
      }
    },
    [readonly, onShiftUpdate, onAssignmentUpdate],
  )

  const handleShiftUpdate = useCallback(
    (shiftIds: string[]) => {
      if (selectedCell && onShiftUpdate) {
        onShiftUpdate(selectedCell.date, selectedCell.employeeId, shiftIds)
      }
      setSelectedCell(null)
    },
    [selectedCell, onShiftUpdate],
  )

  const handleAssignmentUpdate = useCallback(
    (assignments: ShiftAssignment[]) => {
      if (selectedCell && onAssignmentUpdate) {
        onAssignmentUpdate(selectedCell.date, selectedCell.employeeId, assignments)
      }
      setSelectedCell(null)
    },
    [selectedCell, onAssignmentUpdate],
  )

  const selectedEmployee = selectedCell
    ? employees.find((e) => e.id === selectedCell.employeeId)
    : null
  const selectedDate = selectedCell
    ? weekDays.find((d) => format(d, "yyyy-MM-dd") === selectedCell.date)
    : null

  // Memoizar los valores pasados al diálogo para evitar re-renders infinitos
  const selectedShiftIds = useMemo(() => {
    if (!selectedCell) return []
    return getEmployeeShifts(selectedCell.employeeId, selectedCell.date)
  }, [selectedCell?.employeeId, selectedCell?.date, schedule?.assignments, getEmployeeShifts])

  const selectedAssignments = useMemo(() => {
    if (!selectedCell || !onAssignmentUpdate) return undefined
    return getEmployeeAssignments(selectedCell.employeeId, selectedCell.date)
  }, [selectedCell?.employeeId, selectedCell?.date, schedule?.assignments, onAssignmentUpdate, getEmployeeAssignments])

  return (
    <>
      <Card className="overflow-hidden border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="min-w-[220px] border-r border-border px-6 py-4 text-left text-xl font-semibold text-foreground">
                Empleado
              </th>
              {weekDays.map((day) => (
                <th
                  key={day.toISOString()}
                  className="min-w-[180px] border-r border-border px-6 py-4 text-center text-xl font-semibold text-foreground last:border-r-0"
                >
                  <div className="flex flex-col">
                    <span className="capitalize">{format(day, "EEEE", { locale: es })}</span>
                    <span className="text-base font-normal text-muted-foreground">
                      {format(day, "d MMM", { locale: es })}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="border-b border-border last:border-b-0">
                <td className="border-r border-border bg-muted/30 px-6 py-4 text-lg font-medium text-foreground">
                  {employee.name}
                </td>
                {weekDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd")
                  const employeeShifts = getEmployeeShifts(employee.id, dateStr)
                  const isSelected = selectedCell?.date === dateStr && selectedCell?.employeeId === employee.id
                  // Verificar si el día está fuera del rango del mes
                  const isOutOfRange = monthRange 
                    ? (day < monthRange.startDate || day > monthRange.endDate)
                    : false
                  
                  return (
                    <td
                      key={day.toISOString()}
                      className={`border-r border-border px-4 py-4 last:border-r-0 ${
                        isOutOfRange 
                          ? "bg-muted/20 opacity-50"
                          : !readonly && (onShiftUpdate || onAssignmentUpdate)
                          ? "cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted"
                          : ""
                      } ${isSelected ? "bg-primary/10" : ""}`}
                      onClick={() => !isOutOfRange && handleCellClick(dateStr, employee.id)}
                    >
                      <div className="flex flex-col gap-2">
                        {(() => {
                          const assignments = getEmployeeAssignments(employee.id, dateStr)
                          if (assignments.length === 0) {
                            return <span className="text-center text-lg text-muted-foreground">-</span>
                          }
                          return assignments.map((assignment, idx) => {
                            // Manejar franco
                            if (assignment.type === "franco") {
                              return (
                                <Badge
                                  key={`franco-${idx}`}
                                  className="justify-center text-base py-2 px-3 bg-gray-500 text-white"
                                >
                                  FRANCO
                                </Badge>
                              )
                            }
                            
                            // Manejar medio franco
                            if (assignment.type === "medio_franco") {
                              const displayTime = assignment.startTime && assignment.endTime
                                ? `${assignment.startTime} - ${assignment.endTime}`
                                : "1/2 Franco"
                              return (
                                <Badge
                                  key={`medio-franco-${idx}`}
                                  className="justify-center text-base py-2 px-3 bg-orange-500 text-white"
                                >
                                  {displayTime} (1/2 Franco)
                                </Badge>
                              )
                            }
                            
                            // Comportamiento normal para turnos
                            const shift = getShiftInfo(assignment.shiftId || "")
                            if (!shift) return null
                            const displayTime = getShiftDisplayTime(assignment.shiftId || "", assignment)

                            // Si no hay horario para mostrar, mostrar el nombre del turno como fallback
                            if (!displayTime) {
                              return (
                                <Badge
                                  key={assignment.shiftId}
                                  className="justify-center text-base py-2 px-3"
                                  style={{
                                    backgroundColor: shift.color,
                                    color: "#ffffff",
                                  }}
                                >
                                  {shift.name}
                                </Badge>
                              )
                            }

                            return (
                              <Badge
                                key={assignment.shiftId}
                                className="justify-center text-base py-2 px-3"
                                style={{
                                  backgroundColor: shift.color,
                                  color: "#ffffff",
                                }}
                                title={shift.name}
                              >
                                {displayTime}
                              </Badge>
                            )
                          })
                        })()}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
      {selectedCell && selectedEmployee && selectedDate && (
        <ShiftSelectorPopover
          open={true}
          onOpenChange={(open) => !open && setSelectedCell(null)}
          shifts={shifts}
          selectedShiftIds={selectedShiftIds}
          selectedAssignments={selectedAssignments}
          onShiftChange={onShiftUpdate ? handleShiftUpdate : undefined}
          onAssignmentsChange={onAssignmentUpdate ? handleAssignmentUpdate : undefined}
          employeeName={selectedEmployee.name}
          date={format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
        />
      )}
    </>
  )
})
