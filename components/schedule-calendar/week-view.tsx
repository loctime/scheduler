"use client"

import { useMemo } from "react"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { useEmployeeWeekStats } from "@/hooks/use-employee-week-stats"
import { getHistoricalEmployeeIds } from "@/lib/schedule-history"
import type { Horario, Empleado, Turno, MedioTurno, ShiftAssignment, ShiftAssignmentValue, Configuracion } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"

interface WeekViewProps {
  weekDays: Date[]
  weekStartDate?: Date // weekStart calculado correctamente
  weekIndex: number
  weekSchedule: Horario | null
  employees: Empleado[]
  allEmployees: Empleado[]
  shifts: Turno[]
  monthRange: { start: Date; end: Date }
  mediosTurnos?: MedioTurno[]
  employeeMonthlyStats: Record<string, EmployeeMonthlyStats>
  config?: Configuracion | null
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: ShiftAssignment[], options?: { scheduleId?: string }) => Promise<void>
  onExportImage?: (weekStartDate: Date, weekEndDate: Date) => Promise<void>
  onExportPDF?: (weekStartDate: Date, weekEndDate: Date) => Promise<void>
  onExportExcel?: (weekStartDate: Date, weekDays: Date[], weekSchedule: Horario | null) => Promise<void>
  exporting?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onWeekScheduleRef?: (weekStartDate: Date, element: HTMLDivElement | null) => void
  getWeekSchedule?: (weekStartDate: Date) => Horario | null
  allSchedules?: Horario[]
  user?: any
  onMarkComplete?: (weekId: string) => void
  lastCompletedWeekStart?: Date | null
  onPublishSchedule?: (weekStartDate: Date, weekEndDate: Date) => Promise<void> | void
  isPublishingSchedule?: boolean
  copiedWeekData?: {
    assignments: Horario["assignments"]
    dayStatus: Horario["dayStatus"]
    weekStartDate: string
    copiedAt: string
  } | null
  onCopyCurrentWeek?: (weekStartDate: Date) => void
  onPasteCopiedWeek?: (targetWeekStartDate: Date) => Promise<void>
  isPastingWeek?: boolean
}

export function WeekView({
  weekDays,
  weekStartDate: weekStartDateProp,
  weekIndex,
  weekSchedule,
  employees,
  allEmployees,
  shifts,
  monthRange,
  mediosTurnos,
  employeeMonthlyStats,
  config,
  onAssignmentUpdate,
  onExportImage,
  onExportPDF,
  onExportExcel,
  exporting,
  open,
  onOpenChange,
  onWeekScheduleRef,
  getWeekSchedule,
  allSchedules,
  user,
  onMarkComplete,
  lastCompletedWeekStart,
  onPublishSchedule,
  isPublishingSchedule,
  copiedWeekData,
  onCopyCurrentWeek,
  onPasteCopiedWeek,
  isPastingWeek,
}: WeekViewProps) {
  // Usar el weekStartDate calculado si se proporciona, sino usar weekDays[0]
  const weekStartDate = weekStartDateProp || weekDays[0]


  const statsEmployees = useMemo(() => {
    const map = new Map<string, Empleado>()

    employees.forEach((employee) => {
      map.set(employee.id, employee)
    })

    const historicalIds = getHistoricalEmployeeIds(weekSchedule)
    historicalIds.forEach((employeeId) => {
      if (!map.has(employeeId)) {
        map.set(employeeId, {
          id: employeeId,
          name: `Empleado ${employeeId.slice(0, 8)}`,
        } as Empleado)
      }
    })

    return Array.from(map.values())
  }, [employees, weekSchedule])

  // Usar el hook centralizado para calcular estadísticas semanales
  const weekStatsData = useEmployeeWeekStats({
    employees: statsEmployees,
    weekDays,
    weekSchedule,
    shifts,
    config,
    mediosTurnos,
  })

  // Convertir a formato legado para compatibilidad con WeekSchedule
  const weekStats = useMemo(() => {
    const stats: Record<string, EmployeeMonthlyStats> = {}
    statsEmployees.forEach((employee) => {
      const weekStat = weekStatsData[employee.id]
      const monthStat = employeeMonthlyStats[employee.id] || { 
        francos: 0, 
        francosSemana: 0, 
        horasExtrasSemana: 0, 
        horasExtrasMes: 0, 
        horasComputablesMes: 0, 
        horasSemana: 0,
        horasLicenciaEmbarazo: 0,
        horasMedioFranco: 0
      }
      
      stats[employee.id] = {
        ...monthStat,
        francosSemana: weekStat.francosSemana,
        horasExtrasSemana: weekStat.horasExtrasSemana,
        horasSemana: weekStat.horasNormalesSemana,
      }
    })

    // Debug logs
    Object.entries(stats).forEach(([employeeId, stats]) => {
      if (stats.francosSemana > 0) {
        console.log(`🔧 [WeekView] Final stats: employee ${employeeId}, francosSemana: ${stats.francosSemana}, francos: ${stats.francos}`)
      }
    })

    return stats
  }, [statsEmployees, weekStatsData, employeeMonthlyStats])


  const orderedEmployeeStats = useMemo(() => {
    const preferredOrder = weekSchedule?.completada === true && weekSchedule?.weekSnapshot?.employees
      ? weekSchedule.weekSnapshot.employees.map((employee) => employee.id)
      : employees.map((employee) => employee.id)

    const orderedIds = [
      ...preferredOrder,
      ...Object.keys(weekStats).filter((employeeId) => !preferredOrder.includes(employeeId)),
    ]

    return orderedIds.map((employeeId) => weekStats[employeeId] || {
      francos: 0,
      francosSemana: 0,
      horasExtrasSemana: 0,
      horasExtrasMes: 0,
      horasComputablesMes: 0,
      horasSemana: 0,
      horasLicenciaEmbarazo: 0,
      horasMedioFranco: 0,
    })
  }, [weekSchedule, employees, weekStats])

  return (
    <WeekSchedule
      key={weekIndex}
      ref={(element: HTMLDivElement | null) => onWeekScheduleRef?.(weekStartDate, element)}
      weekDays={weekDays}
      weekStartDate={weekStartDate}
      weekIndex={weekIndex}
      weekSchedule={weekSchedule}
      employees={employees}
      allEmployees={allEmployees}
      shifts={shifts}
      monthRange={{ start: monthRange.start, end: monthRange.end }}
      onAssignmentUpdate={onAssignmentUpdate ? (date: string, employeeId: string, assignments: ShiftAssignment[], options?: { scheduleId?: string }) => {
        onAssignmentUpdate(date, employeeId, assignments, { scheduleId: weekSchedule?.id })
      } : undefined}
      onExportImage={onExportImage}
      onExportPDF={onExportPDF}
      onExportExcel={() => onExportExcel?.(weekStartDate, weekDays, weekSchedule)}
      exporting={exporting}
      mediosTurnos={mediosTurnos}
      employeeStats={orderedEmployeeStats}
      open={open}
      onOpenChange={onOpenChange}
      user={user}
      onMarkComplete={onMarkComplete}
      lastCompletedWeekStart={lastCompletedWeekStart}
      getWeekSchedule={getWeekSchedule}
      allSchedules={allSchedules}
      onPublishSchedule={onPublishSchedule}
      isPublishingSchedule={isPublishingSchedule}
      copiedWeekData={copiedWeekData}
      onCopyCurrentWeek={onCopyCurrentWeek}
      onPasteCopiedWeek={onPasteCopiedWeek}
      isPastingWeek={isPastingWeek}
    />
  )
}
