import { format, parseISO, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { getCustomMonthRange, getMonthWeeks } from "@/lib/utils"
import type { Horario } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/types/employee-stats"
import { calculateHoursBreakdown } from "@/lib/validations"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"
import { normalizeAssignments } from "@/lib/domain/normalize-assignments"
import type { ShiftAssignmentValue } from "@/lib/types"

export interface MonthGroup {
  monthKey: string
  monthName: string
  monthDate: Date
  weeks: WeekGroup[]
}

export interface WeekGroup {
  weekStartDate: Date
  weekEndDate: Date
  weekStartStr: string
  schedule: Horario | null
  weekDays: Date[]
}

/**
 * Agrupa schedules por mes y semana.
 * Lógica compartida entre dashboard (Firestore) y PWA (API).
 */
export function buildMonthGroupsFromSchedules(
  schedules: Horario[],
  monthStartDay: number,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
): MonthGroup[] {
  if (schedules.length === 0) return []

  const monthMap = new Map<string, MonthGroup>()

  schedules.forEach((schedule) => {
    if (!schedule.weekStart) return

    const weekStartDate = parseISO(schedule.weekStart)
    const weekStart = weekStartDate
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    const weekEndDate = weekDays[weekDays.length - 1]

    const monthRange = getCustomMonthRange(weekStartDate, monthStartDay)
    let targetMonthDate = monthRange.startDate

    if (weekStartDate < monthRange.startDate) {
      const prevMonth = new Date(monthRange.startDate)
      prevMonth.setMonth(prevMonth.getMonth() - 1)
      targetMonthDate = getCustomMonthRange(prevMonth, monthStartDay).startDate
    }

    const monthKey = format(targetMonthDate, "yyyy-MM")
    const monthName = format(targetMonthDate, "MMMM yyyy", { locale: es })

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        monthKey,
        monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        monthDate: targetMonthDate,
        weeks: [],
      })
    }

    const monthGroup = monthMap.get(monthKey)!
    const weekStartStr = format(weekStart, "yyyy-MM-dd")
    const existingWeek = monthGroup.weeks.find((w) => w.weekStartStr === weekStartStr)

    if (!existingWeek) {
      monthGroup.weeks.push({
        weekStartDate: weekStart,
        weekEndDate,
        weekStartStr,
        schedule,
        weekDays,
      })
    } else {
      existingWeek.schedule = schedule
    }
  })

  monthMap.forEach((month) => {
    month.weeks.sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime())
  })

  return Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey))
}

export interface CreateCalculateMonthlyStatsParams {
  employees: any[]
  shifts: any[]
  config?: any
  schedules: Horario[]
  monthStartDay: number
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

/**
 * Crea la función calculateMonthlyStats usada por MonthlyScheduleView.
 * Lógica compartida entre dashboard y PWA.
 */
export function createCalculateMonthlyStats(
  params: CreateCalculateMonthlyStatsParams
): (monthDate: Date) => Record<string, EmployeeMonthlyStats> {
  const { employees, shifts, config, schedules, monthStartDay, weekStartsOn } = params

  return (monthDate: Date): Record<string, EmployeeMonthlyStats> => {
    const stats: Record<string, EmployeeMonthlyStats> = {}
    employees.forEach((employee) => {
      stats[employee.id] = {
        francos: 0,
        francosSemana: 0,
        horasExtrasSemana: 0,
        horasExtrasMes: 0,
        horasComputablesMes: 0,
        horasSemana: 0,
        horasLicenciaEmbarazo: 0,
        horasMedioFranco: 0,
      }
    })

    if (employees.length === 0 || shifts.length === 0) {
      return stats
    }

    const monthRange = getCustomMonthRange(monthDate, monthStartDay)
    const monthWeeks = getMonthWeeks(monthDate, monthStartDay, weekStartsOn)
    const minutosDescanso = config?.minutosDescanso ?? 30
    const horasMinimasParaDescanso = config?.horasMinimasParaDescanso ?? 6

    monthWeeks.forEach((weekDays) => {
      const weekStartStr = format(weekDays[0], "yyyy-MM-dd")
      const weekSchedule = schedules.find((s) => s.weekStart === weekStartStr) || null
      if (!weekSchedule?.assignments) return

      weekDays.forEach((day) => {
        if (day < monthRange.startDate || day > monthRange.endDate) return

        const dateStr = format(day, "yyyy-MM-dd")
        const dateAssignments = weekSchedule.assignments[dateStr]
        if (!dateAssignments) return

        Object.entries(dateAssignments).forEach(([employeeId, assignmentValue]) => {
          if (!stats[employeeId]) {
            stats[employeeId] = {
              francos: 0,
              francosSemana: 0,
              horasExtrasSemana: 0,
              horasExtrasMes: 0,
              horasComputablesMes: 0,
              horasSemana: 0,
              horasLicenciaEmbarazo: 0,
              horasMedioFranco: 0,
            }
          }

          const normalizedAssignments = normalizeAssignments(assignmentValue as ShiftAssignmentValue)
          if (normalizedAssignments.length === 0) return

          let francosCount = 0
          normalizedAssignments.forEach((assignment) => {
            if (assignment.type === "franco") {
              francosCount += 1
            } else if (assignment.type === "medio_franco") {
              francosCount += 0.5
            }
          })

          if (francosCount > 0) {
            stats[employeeId].francos += francosCount
          }

          const hoursBreakdown = calculateHoursBreakdown(
            normalizedAssignments,
            shifts,
            minutosDescanso,
            horasMinimasParaDescanso
          )
          if (hoursBreakdown.licencia > 0) {
            stats[employeeId].horasLicenciaEmbarazo =
              (stats[employeeId].horasLicenciaEmbarazo || 0) + hoursBreakdown.licencia
          }
          if (hoursBreakdown.medio_franco > 0) {
            stats[employeeId].horasMedioFranco =
              (stats[employeeId].horasMedioFranco || 0) + hoursBreakdown.medio_franco
          }

          const workingConfig = toWorkingHoursConfig(config)
          const { horasComputables, horasExtra } = calculateTotalDailyHours(
            normalizedAssignments,
            workingConfig
          )

          stats[employeeId].horasComputablesMes += horasComputables

          if (horasExtra > 0) {
            stats[employeeId].horasExtrasMes += horasExtra
          }
        })
      })
    })

    Object.keys(stats).forEach((employeeId) => {
      stats[employeeId].horasExtrasSemana = 0
    })

    return stats
  }
}
