"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { EmptyStateCard, LoadingStateCard } from "@/components/schedule-calendar/state-card"
import type { Empleado, Turno } from "@/lib/types"

interface ShiftAssignmentsMatrix {
  [date: string]: {
    [shiftId: string]: string[]
  }
}

interface ShiftViewProps {
  dataLoading: boolean
  employees: Empleado[]
  shifts: Turno[]
  shiftMonthDays: Date[]
  shiftMonthLabel: string
  shiftAssignmentsByDay: ShiftAssignmentsMatrix
  hasShiftAssignments: boolean
  onPreviousMonth: () => void
  onCurrentMonth: () => void
  onNextMonth: () => void
}

export function ShiftView({
  dataLoading,
  employees,
  shifts,
  shiftMonthDays,
  shiftMonthLabel,
  shiftAssignmentsByDay,
  hasShiftAssignments,
  onPreviousMonth,
  onCurrentMonth,
  onNextMonth,
}: ShiftViewProps) {
  if (dataLoading) {
    return <LoadingStateCard />
  }

  if (employees.length === 0) {
    return <EmptyStateCard message="No hay empleados registrados. Agrega empleados para crear horarios." />
  }

  if (shifts.length === 0) {
    return <EmptyStateCard message="No hay turnos configurados. Agrega turnos para crear horarios." />
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Vista por turnos</h3>
            <p className="text-sm text-muted-foreground">Observa qué empleados están asignados a cada turno en todo el mes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onPreviousMonth}>
              Mes anterior
            </Button>
            <Button variant="outline" size="sm" onClick={onCurrentMonth}>
              Mes actual
            </Button>
            <Button variant="outline" size="sm" onClick={onNextMonth}>
              Mes siguiente
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground capitalize">{shiftMonthLabel}</p>
      </Card>

      <Card className="p-0">
        {!hasShiftAssignments && (
          <div className="border-b px-4 py-3 text-sm text-muted-foreground">
            No se encontraron asignaciones para este mes. Las celdas mostrarán "-" hasta que existan horarios cargados.
          </div>
        )}
        <div className="w-full overflow-auto">
          <table className="min-w-[720px] table-fixed text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="w-48 border-b bg-background px-3 py-3 text-left">Turno</th>
                {shiftMonthDays.map((day) => (
                  <th key={day.toISOString()} className="min-w-[140px] border-b border-l px-3 py-3">
                    <div className="text-xs font-semibold uppercase">{format(day, "EEE d", { locale: es })}</div>
                    <div className="text-[11px] text-muted-foreground">{format(day, "MMM yyyy", { locale: es })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} className="border-t">
                  <td className="bg-muted/40 px-3 py-2 text-sm font-semibold">{shift.name}</td>
                  {shiftMonthDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd")
                    const employeesForShift = shiftAssignmentsByDay[dateStr]?.[shift.id] || []

                    return (
                      <td key={`${shift.id}-${dateStr}`} className="border-l px-3 py-2 align-top">
                        {employeesForShift.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {employeesForShift.map((employeeName) => (
                              <span
                                key={`${shift.id}-${dateStr}-${employeeName}`}
                                className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                              >
                                {employeeName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}


