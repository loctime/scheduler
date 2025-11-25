"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface ScheduleGridProps {
  weekDays: Date[]
  employees: any[]
  shifts: any[]
  schedule: any
}

export function ScheduleGrid({ weekDays, employees, shifts, schedule }: ScheduleGridProps) {
  const getEmployeeShifts = (employeeId: string, date: string) => {
    if (!schedule?.assignments) return []
    // El historial puede tener asignaciones con formato diferente
    const dateAssignments = schedule.assignments[date] || {}
    const shifts = dateAssignments[employeeId]
    return Array.isArray(shifts) ? shifts : []
  }

  const getShiftInfo = (shiftId: string) => {
    return shifts.find((s) => s.id === shiftId)
  }

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
}
