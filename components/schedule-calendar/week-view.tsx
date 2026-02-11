"use client"

import { useMemo } from "react"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { useEmployeeWeekStats } from "@/hooks/use-employee-week-stats"
import type { Horario, Empleado, Turno, MedioTurno, ShiftAssignment, ShiftAssignmentValue, Configuracion } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"

interface WeekViewProps {
  weekDays: Date[]
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
  const weekStartDate = weekDays[0]

  // Usar el hook centralizado para calcular estadísticas semanales
  const weekStatsData = useEmployeeWeekStats({
    employees,
    weekDays,
    weekSchedule,
    shifts,
    config,
    mediosTurnos,
  })

  // Convertir a formato legado para compatibilidad con WeekSchedule
  const weekStats = useMemo(() => {
    const stats: Record<string, EmployeeMonthlyStats> = {}
    employees.forEach((employee) => {
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
  }, [employees, weekStatsData, employeeMonthlyStats])

  return (
    <WeekSchedule
      key={weekIndex}
      ref={(element: HTMLDivElement | null) => onWeekScheduleRef?.(weekStartDate, element)}
      weekDays={weekDays}
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
      employeeStats={Object.values(weekStats)}
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
