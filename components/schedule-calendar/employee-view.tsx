"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScheduleGrid } from "@/components/schedule-grid"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { EmptyStateCard, LoadingStateCard } from "@/components/schedule-calendar/state-card"
import type { Empleado, Turno, Horario, MedioTurno } from "@/lib/types"

interface EmployeeViewProps {
  dataLoading: boolean
  employees: Empleado[]
  shifts: Turno[]
  mediosTurnos?: MedioTurno[]
  selectedEmployeeId: string
  selectedEmployeeName?: string
  onEmployeeChange: (employeeId: string) => void
  employeeViewMode: "week" | "month"
  onViewModeChange: (mode: "week" | "month") => void
  employeeWeekLabel: string
  employeeWeekDays: Date[]
  employeeWeekSchedule: Horario | null
  employeeWeekRange: { startDate: Date; endDate: Date } | null
  filteredEmployees: Empleado[]
  employeeMonthRange: { startDate: Date; endDate: Date }
  employeeMonthRangeLabel: string
  employeeMonthWeeks: Date[][]
  getWeekSchedule: (weekStartDate: Date) => Horario | null
  onPreviousWeek: () => void
  onCurrentWeek: () => void
  onNextWeek: () => void
  onPreviousMonth: () => void
  onCurrentMonth: () => void
  onNextMonth: () => void
  exporting: boolean
}

export function EmployeeView({
  dataLoading,
  employees,
  shifts,
  mediosTurnos,
  selectedEmployeeId,
  selectedEmployeeName,
  onEmployeeChange,
  employeeViewMode,
  onViewModeChange,
  employeeWeekLabel,
  employeeWeekDays,
  employeeWeekSchedule,
  employeeWeekRange,
  filteredEmployees,
  employeeMonthRange,
  employeeMonthRangeLabel,
  employeeMonthWeeks,
  getWeekSchedule,
  onPreviousWeek,
  onCurrentWeek,
  onNextWeek,
  onPreviousMonth,
  onCurrentMonth,
  onNextMonth,
  exporting,
}: EmployeeViewProps) {
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
            <h3 className="text-lg font-semibold">Vista por empleado</h3>
            <p className="text-sm text-muted-foreground">Visualiza el horario semanal o mensual para una sola persona.</p>
          </div>
          <Select value={selectedEmployeeId} onValueChange={onEmployeeChange} disabled={employees.length === 0}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Sin empleados disponibles" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="inline-flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-full rounded-md border p-1 sm:w-auto">
            <Button
              variant={employeeViewMode === "week" ? "default" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => onViewModeChange("week")}
            >
              Vista semanal
            </Button>
            <Button
              variant={employeeViewMode === "month" ? "default" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => onViewModeChange("month")}
            >
              Vista mensual
            </Button>
          </div>
          <p className="text-sm text-muted-foreground sm:text-right">
            {selectedEmployeeName
              ? `${selectedEmployeeName} · ${employeeViewMode === "week" ? employeeWeekLabel : employeeMonthRangeLabel}`
              : "Selecciona un empleado"}
          </p>
        </div>
      </Card>

      {!selectedEmployeeId ? (
        <EmptyStateCard message="Selecciona un empleado para visualizar su horario." />
      ) : employeeViewMode === "week" ? (
        <Card className="space-y-4 p-4 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xl font-semibold">{selectedEmployeeName}</p>
              <p className="text-sm text-muted-foreground">{employeeWeekLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onPreviousWeek}>
                Semana anterior
              </Button>
              <Button variant="outline" size="sm" onClick={onCurrentWeek}>
                Semana actual
              </Button>
              <Button variant="outline" size="sm" onClick={onNextWeek}>
                Semana siguiente
              </Button>
            </div>
          </div>
          <ScheduleGrid
            weekDays={employeeWeekDays}
            employees={filteredEmployees}
            shifts={shifts}
            schedule={employeeWeekSchedule}
            monthRange={
              employeeWeekRange || {
                startDate: employeeWeekDays[0],
                endDate: employeeWeekDays[employeeWeekDays.length - 1],
              }
            }
            mediosTurnos={mediosTurnos}
            readonly
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xl font-semibold">{selectedEmployeeName}</p>
              <p className="text-sm text-muted-foreground capitalize">{employeeMonthRangeLabel}</p>
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
          <div id="employee-month-container" className="space-y-6">
            {employeeMonthWeeks.map((weekDays, weekIndex) => {
              const weekStartDate = weekDays[0]
              const weekSchedule = getWeekSchedule(weekStartDate)
              const weekKey = `${selectedEmployeeId}-${weekStartDate.toISOString()}`

              return (
                <WeekSchedule
                  key={weekKey}
                  weekDays={weekDays}
                  weekIndex={weekIndex}
                  weekSchedule={weekSchedule}
                  employees={filteredEmployees}
                  shifts={shifts}
                  monthRange={employeeMonthRange}
                  mediosTurnos={mediosTurnos}
                  exporting={exporting}
                  readonly
                  showActions={false}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}




