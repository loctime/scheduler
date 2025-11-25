"use client"

import { memo, useMemo, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Empleado, Turno, Horario, HistorialItem } from "@/lib/types"

interface ScheduleGridProps {
  weekDays: Date[]
  employees: Empleado[]
  shifts: Turno[]
  schedule: Horario | HistorialItem | null
}

export const ScheduleGrid = memo(function ScheduleGrid({
  weekDays,
  employees,
  shifts,
  schedule,
}: ScheduleGridProps) {
  // Memoizar mapa de turnos para búsqueda O(1)
  const shiftMap = useMemo(() => {
    return new Map(shifts.map((s) => [s.id, s]))
  }, [shifts])

  // Memoizar función de obtener turnos de empleado
  const getEmployeeShifts = useCallback(
    (employeeId: string, date: string): string[] => {
      if (!schedule?.assignments) return []
      const dateAssignments = schedule.assignments[date] || {}
      const employeeShifts = dateAssignments[employeeId]
      return Array.isArray(employeeShifts) ? employeeShifts : []
    },
    [schedule?.assignments],
  )

  // Memoizar función de obtener info de turno
  const getShiftInfo = useCallback(
    (shiftId: string): Turno | undefined => {
      return shiftMap.get(shiftId)
    },
    [shiftMap],
  )

  return (
    <Card id="schedule-grid" className="overflow-hidden border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="min-w-[180px] border-r border-border px-4 py-3 text-left text-sm font-semibold text-foreground">
                Empleado
              </th>
              {weekDays.map((day) => (
                <th
                  key={day.toISOString()}
                  className="min-w-[140px] border-r border-border px-4 py-3 text-center text-sm font-semibold text-foreground last:border-r-0"
                >
                  <div className="flex flex-col">
                    <span className="capitalize">{format(day, "EEEE", { locale: es })}</span>
                    <span className="text-xs font-normal text-muted-foreground">
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
                <td className="border-r border-border bg-muted/30 px-4 py-3 font-medium text-foreground">
                  {employee.name}
                </td>
                {weekDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd")
                  const employeeShifts = getEmployeeShifts(employee.id, dateStr)
                  return (
                    <td key={day.toISOString()} className="border-r border-border px-2 py-3 last:border-r-0">
                      <div className="flex flex-col gap-1">
                        {employeeShifts.length > 0 ? (
                          employeeShifts.map((shiftId: string) => {
                            const shift = getShiftInfo(shiftId)
                            return shift ? (
                              <Badge
                                key={shiftId}
                                className="justify-center text-xs"
                                style={{
                                  backgroundColor: shift.color,
                                  color: "#ffffff",
                                }}
                              >
                                {shift.name}
                              </Badge>
                            ) : null
                          })
                        ) : (
                          <span className="text-center text-xs text-muted-foreground">-</span>
                        )}
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
  )
})
