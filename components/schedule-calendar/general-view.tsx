"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { MonthHeader } from "@/components/schedule-calendar/month-header"
import { WeekView } from "@/components/schedule-calendar/week-view"
import { EmptyStateCard, LoadingStateCard } from "@/components/schedule-calendar/state-card"
import type { Horario, Empleado, Turno, MedioTurno, ShiftAssignment, ShiftAssignmentValue, Configuracion } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { format } from "date-fns"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"
import { calculateAssignmentImpact } from "@/lib/domain/assignment-hours"
import { normalizeAssignments } from "@/lib/domain/normalize-assignments"

type AssignmentUpdateHandler = (
  date: string,
  employeeId: string,
  assignments: ShiftAssignment[],
  options?: { scheduleId?: string },
) => Promise<void>

type CopiedWeekData = {
  assignments: Horario["assignments"]
  dayStatus: Horario["dayStatus"]
  weekStartDate: string
  copiedAt: string
}

interface GeneralViewProps {
  dataLoading: boolean
  employees: Empleado[]
  shifts: Turno[]
  monthRange: { startDate: Date; endDate: Date }
  currentMonth: Date
  monthWeeks: Date[][]
  exporting: boolean
  mediosTurnos?: MedioTurno[]
  employeeMonthlyStats: Record<string, EmployeeMonthlyStats>
  getWeekSchedule: (weekStartDate: Date) => Horario | null
  onAssignmentUpdate?: AssignmentUpdateHandler
  onExportMonthPDF: () => Promise<void>
  onExportWeekImage: (weekStartDate: Date, weekEndDate: Date) => Promise<void>
  onExportWeekPDF: (weekStartDate: Date, weekEndDate: Date) => Promise<void>
  onExportWeekExcel: (weekStartDate: Date, weekDays: Date[], weekSchedule: Horario | null) => Promise<void>
  onPreviousMonth: () => void
  onNextMonth: () => void
  user?: any
  onMarkWeekComplete?: (weekStartDate: Date, completed: boolean) => Promise<void>
  lastCompletedWeekStart?: string | null
  allSchedules?: Horario[]
  config?: Configuracion | null
  onPublishSchedule?: (weekStartDate: Date, weekEndDate: Date) => Promise<void> | void
  isPublishingSchedule?: boolean
  onWeekScheduleRef?: (weekKey: string, element: HTMLDivElement) => void
  copiedWeekData?: CopiedWeekData | null
  onCopyCurrentWeek?: (weekStartDate: Date) => void
  onPasteCopiedWeek?: (targetWeekStartDate: Date) => Promise<void>
  isPastingWeek?: boolean
}

export function GeneralView({
  dataLoading,
  employees,
  shifts,
  monthRange,
  currentMonth,
  monthWeeks,
  exporting,
  mediosTurnos,
  employeeMonthlyStats,
  getWeekSchedule,
  onAssignmentUpdate,
  onExportMonthPDF,
  onExportWeekImage,
  onExportWeekPDF,
  onExportWeekExcel,
  onPreviousMonth,
  onNextMonth,
  user,
  onMarkWeekComplete,
  lastCompletedWeekStart,
  allSchedules = [],
  config,
  onPublishSchedule,
  isPublishingSchedule,
  onWeekScheduleRef,
  copiedWeekData,
  onCopyCurrentWeek,
  onPasteCopiedWeek,
  isPastingWeek = false,
}: GeneralViewProps) {
  const DEBUG = false
  // Create shift map for efficient lookup
  const shiftMap = useMemo(() => {
    return new Map(shifts.map((s) => [s.id, s]))
  }, [shifts])

  const getShiftInfo = (shiftId: string) => {
    return shiftMap.get(shiftId)
  }

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

  // Función para manejar refs de los ScheduleGrid
  const handleWeekScheduleRef = useCallback((weekStartDate: Date, element: HTMLDivElement | null) => {
    const weekKey = format(weekStartDate, "yyyy-MM-dd")
    if (DEBUG) {
      console.log("🔧 [GeneralView] Recibiendo ref:", { weekKey, hasElement: !!element })
    }
    if (element && onWeekScheduleRef) {
      // Pasar el ref al componente padre (ScheduleCalendar)
      if (DEBUG) {
        console.log("🔧 [GeneralView] Pasando ref al padre:", weekKey)
      }
      onWeekScheduleRef(weekKey, element)
    } else {
      if (DEBUG) {
        console.log("🔧 [GeneralView] No se pasó ref:", { hasElement: !!element, hasCallback: !!onWeekScheduleRef })
      }
    }
  }, [onWeekScheduleRef])

  // Verificar si hay semanas completadas en el rango del mes
  // IMPORTANTE: Este hook debe estar antes de cualquier return condicional
  const hasCompletedWeeks = useMemo(() => {
    return monthWeeks.some((weekDays) => {
      const weekSchedule = getWeekSchedule(weekDays[0])
      return weekSchedule?.completada === true
    })
  }, [monthWeeks, getWeekSchedule])

  if (dataLoading) {
    return <LoadingStateCard />
  }

  // Si no hay empleados ni turnos activos, pero hay semanas completadas, mostrar el calendario
  // (las semanas completadas tienen sus propios snapshots de empleados)
  if (employees.length === 0 && !hasCompletedWeeks) {
    return <EmptyStateCard message="No hay empleados registrados. Agrega empleados para crear horarios." />
  }

  if (shifts.length === 0 && !hasCompletedWeeks) {
    return <EmptyStateCard message="No hay turnos configurados. Agrega turnos para crear horarios." />
  }

  return (
    <div className="space-y-6">
      <MonthHeader
        monthRange={monthRange}
        currentMonth={currentMonth}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        onExportPDF={onExportMonthPDF}
        exporting={exporting}
        user={user}
      />

      <div id="schedule-month-container" className="space-y-6">
        {monthWeeks.map((weekDays, weekIndex) => {
          const weekStartDate = weekDays[0]
          const weekSchedule = getWeekSchedule(weekStartDate)
          const weekKey = format(weekStartDate, "yyyy-MM-dd")
          const isExpanded = expandedWeeks.has(weekKey)

          // Si la semana está completada y tiene snapshot, usar empleados del snapshot
          // Si no hay empleados activos pero hay snapshot, usar el snapshot
          const employeesForWeek = (() => {
            if (weekSchedule?.completada === true && weekSchedule?.empleadosSnapshot && weekSchedule.empleadosSnapshot.length > 0) {
              // Si hay snapshot, usar empleados del snapshot
              const snapshotEmployees = weekSchedule.empleadosSnapshot.map((snapshotEmp) => ({
                id: snapshotEmp.id,
                name: snapshotEmp.name,
                email: snapshotEmp.email,
                phone: snapshotEmp.phone,
                userId: '', // No disponible en snapshot
              } as Empleado))
              
              // Si hay empleados activos, combinar (priorizar activos)
              if (employees.length > 0) {
                const activeEmployeesMap = new Map(employees.map((emp) => [emp.id, emp]))
                return snapshotEmployees.map((snapshotEmp) => 
                  activeEmployeesMap.get(snapshotEmp.id) || snapshotEmp
                )
              }
              
              return snapshotEmployees
            }
            return employees
          })()

          return (
            <WeekView
              key={weekIndex}
              weekDays={weekDays}
              weekIndex={weekIndex}
              weekSchedule={weekSchedule}
              employees={employeesForWeek}
              allEmployees={employees}
              shifts={shifts}
              monthRange={{ start: monthRange.startDate, end: monthRange.endDate }}
              mediosTurnos={mediosTurnos}
              employeeMonthlyStats={employeeMonthlyStats}
              config={config}
              onAssignmentUpdate={onAssignmentUpdate ? async (date: string, employeeId: string, assignments: ShiftAssignment[], options?: { scheduleId?: string }) => {
                await onAssignmentUpdate(date, employeeId, assignments, { scheduleId: weekSchedule?.id })
              } : undefined}
              onExportImage={onExportWeekImage}
              onExportPDF={onExportWeekPDF}
              onExportExcel={onExportWeekExcel}
              exporting={exporting}
              open={isExpanded}
              onOpenChange={(open: boolean) => handleWeekToggle(weekStartDate, open)}
              onWeekScheduleRef={handleWeekScheduleRef}
              getWeekSchedule={getWeekSchedule}
              allSchedules={allSchedules}
            />
          )
        })}
      </div>
    </div>
  )
}
