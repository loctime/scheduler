"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { MonthHeader } from "@/components/schedule-calendar/month-header"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { EmptyStateCard, LoadingStateCard } from "@/components/schedule-calendar/state-card"
import type { Horario, Empleado, Turno, MedioTurno, ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { format } from "date-fns"
import { calculateExtraHours } from "@/lib/validations"

type AssignmentUpdateHandler = (
  date: string,
  employeeId: string,
  assignments: ShiftAssignment[],
  options?: { scheduleId?: string },
) => Promise<void>

interface GeneralViewProps {
  dataLoading: boolean
  employees: Empleado[]
  shifts: Turno[]
  monthRange: { startDate: Date; endDate: Date }
  monthWeeks: Date[][]
  exporting: boolean
  mediosTurnos?: MedioTurno[]
  employeeMonthlyStats: Record<string, EmployeeMonthlyStats>
  getWeekSchedule: (weekStartDate: Date) => Horario | null
  onAssignmentUpdate?: AssignmentUpdateHandler
  onExportMonthImage: () => Promise<void>
  onExportMonthPDF: () => Promise<void>
  onExportWeekImage: (weekStartDate: Date, weekEndDate: Date) => Promise<void>
  onExportWeekPDF: (weekStartDate: Date, weekEndDate: Date) => Promise<void>
  onExportWeekExcel: (weekStartDate: Date, weekDays: Date[], weekSchedule: Horario | null) => Promise<void>
  onPreviousMonth: () => void
  onNextMonth: () => void
  user?: any
  onMarkWeekComplete?: (weekStartDate: Date, completed: boolean) => Promise<void>
}

export function GeneralView({
  dataLoading,
  employees,
  shifts,
  monthRange,
  monthWeeks,
  exporting,
  mediosTurnos,
  employeeMonthlyStats,
  getWeekSchedule,
  onAssignmentUpdate,
  onExportMonthImage,
  onExportMonthPDF,
  onExportWeekImage,
  onExportWeekPDF,
  onExportWeekExcel,
  onPreviousMonth,
  onNextMonth,
  user,
  onMarkWeekComplete,
}: GeneralViewProps) {
  // Crear un mapa de semanas expandidas usando la fecha de inicio de semana como clave
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => {
    // Por defecto, todas las semanas están cerradas
    return new Set<string>()
  })

  // Sincronizar el estado cuando cambian las semanas del mes
  const weekKeys = useMemo(
    () => monthWeeks.map((weekDays) => format(weekDays[0], "yyyy-MM-dd")),
    [monthWeeks],
  )

  // Limpiar semanas que ya no existen cuando cambian las semanas del mes
  useEffect(() => {
    setExpandedWeeks((prev) => {
      const updated = new Set<string>()
      // Mantener solo las semanas que aún existen
      prev.forEach((key) => {
        if (weekKeys.includes(key)) {
          updated.add(key)
        }
      })
      return updated
    })
  }, [weekKeys])

  const handleWeekToggle = useCallback((weekStartDate: Date, isOpen: boolean) => {
    const weekKey = format(weekStartDate, "yyyy-MM-dd")
    setExpandedWeeks((prev) => {
      const updated = new Set(prev)
      if (isOpen) {
        updated.add(weekKey)
      } else {
        updated.delete(weekKey)
      }
      return updated
    })
  }, [])

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
      <MonthHeader
        monthRange={monthRange}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        onExportImage={onExportMonthImage}
        onExportPDF={onExportMonthPDF}
        exporting={exporting}
      />

      <div id="schedule-month-container" className="space-y-6">
        {monthWeeks.map((weekDays, weekIndex) => {
          const weekStartDate = weekDays[0]
          const weekSchedule = getWeekSchedule(weekStartDate)
          const weekKey = format(weekStartDate, "yyyy-MM-dd")
          const isExpanded = expandedWeeks.has(weekKey)

          // Calcular horas extras para esta semana específica
          const weekStats: Record<string, EmployeeMonthlyStats> = {}
          employees.forEach((employee) => {
            weekStats[employee.id] = {
              ...employeeMonthlyStats[employee.id],
              horasExtrasSemana: 0,
            }
          })

          if (weekSchedule?.assignments) {
            const normalizeAssignments = (value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
              if (!value || !Array.isArray(value) || value.length === 0) return []
              if (typeof value[0] === "string") {
                return (value as string[]).map((shiftId) => ({ shiftId, type: "shift" as const }))
              }
              return (value as ShiftAssignment[]).map((assignment) => ({
                ...assignment,
                type: assignment.type || "shift",
              }))
            }

            weekDays.forEach((day) => {
              const dateStr = format(day, "yyyy-MM-dd")
              const dateAssignments = weekSchedule.assignments[dateStr]
              if (!dateAssignments) return

              Object.entries(dateAssignments).forEach(([employeeId, assignmentValue]) => {
                if (!weekStats[employeeId]) {
                  weekStats[employeeId] = {
                    ...employeeMonthlyStats[employeeId],
                    horasExtrasSemana: 0,
                  }
                }

                const normalizedAssignments = normalizeAssignments(assignmentValue)
                if (normalizedAssignments.length === 0) {
                  return
                }

                // Calcular horas extras para este día
                const extraHours = calculateExtraHours(normalizedAssignments, shifts)
                if (extraHours > 0) {
                  weekStats[employeeId].horasExtrasSemana += extraHours
                }
              })
            })
          }

          return (
            <WeekSchedule
              key={weekIndex}
              weekDays={weekDays}
              weekIndex={weekIndex}
              weekSchedule={weekSchedule}
              employees={employees}
              shifts={shifts}
              monthRange={monthRange}
              onAssignmentUpdate={onAssignmentUpdate}
              onExportImage={onExportWeekImage}
              onExportPDF={onExportWeekPDF}
              onExportExcel={() => onExportWeekExcel(weekStartDate, weekDays, weekSchedule)}
              exporting={exporting}
              mediosTurnos={mediosTurnos}
              employeeStats={weekStats}
              open={isExpanded}
              onOpenChange={(open) => handleWeekToggle(weekStartDate, open)}
              user={user}
              onMarkComplete={onMarkWeekComplete}
            />
          )
        })}
      </div>
    </div>
  )
}
