import { useCallback } from "react"
import { addDays, format, getDay, parseISO } from "date-fns"
import { EmployeeFixedRule, Empleado, Horario, ShiftAssignment, Turno } from "@/lib/types"
import { getSuggestionForDay } from "@/lib/pattern-learning"
import { normalizeAssignments } from "@/lib/schedule-utils"
import { logger } from "@/lib/logger"

interface LegacyFixedSchedule {
  employeeId: string
  dayOfWeek: number
  assignments?: ShiftAssignment[]
}

interface LegacyFixedScheduleParams {
  weekStartDate: Date
  weekStartStr: string
  employees: Empleado[]
  schedules: Horario[]
  fixedSchedules?: LegacyFixedSchedule[]
  shifts: Turno[]
}

interface LegacySuggestedScheduleParams {
  weekStartDate: Date
  weekStartStr: string
  employees: Empleado[]
  allSchedules: Horario[]
  weekSchedule: Horario | null
  fixedSchedules?: LegacyFixedSchedule[]
}

interface FixedRulesAssignmentsParams {
  employeeId: string
  weekStartDate: Date
  rules: EmployeeFixedRule[]
  shifts: Turno[]
}

export function useFixedRulesEngine() {
  const buildAssignmentsFromLegacyFixedSchedules = useCallback(
    async ({
      weekStartDate,
      weekStartStr,
      employees,
      schedules,
      fixedSchedules,
      shifts,
    }: LegacyFixedScheduleParams): Promise<Record<string, Record<string, ShiftAssignment[]>>> => {
      const assignments: Record<string, Record<string, ShiftAssignment[]>> = {}

      if (!fixedSchedules || fixedSchedules.length === 0) {
        return assignments
      }

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(weekStartDate)
        date.setDate(date.getDate() + dayOffset)
        const dateStr = format(date, "yyyy-MM-dd")
        const dayOfWeek = getDay(date)

        const fixedForDay = fixedSchedules.filter((fixed) => fixed.dayOfWeek === dayOfWeek)

        for (const fixed of fixedForDay) {
          const employee = employees.find((e) => e.id === fixed.employeeId)
          if (!employee) continue

          let assignmentsToApply: ShiftAssignment[] | null = null

          if (fixed.assignments && fixed.assignments.length > 0) {
            assignmentsToApply = fixed.assignments
          } else {
            const suggestion = getSuggestionForDay(fixed.employeeId, dayOfWeek, schedules, weekStartStr)
            if (suggestion && suggestion.assignments.length > 0) {
              assignmentsToApply = suggestion.assignments
            }
          }

          if (!assignmentsToApply || assignmentsToApply.length === 0) {
            const completedSchedules = schedules
              .filter((s) => s.completada === true && s.weekStart && s.weekStart < weekStartStr)
              .sort((a, b) => {
                const dateA = a.weekStart || a.semanaInicio || ""
                const dateB = b.weekStart || b.semanaInicio || ""
                return dateB.localeCompare(dateA)
              })

            for (const completedSchedule of completedSchedules) {
              const completedWeekStart = parseISO(completedSchedule.weekStart || completedSchedule.semanaInicio)
              const completedDate = new Date(completedWeekStart)
              completedDate.setDate(completedDate.getDate() + dayOffset)
              const completedDateStr = format(completedDate, "yyyy-MM-dd")

              const completedAssignments = completedSchedule.assignments[completedDateStr]
              if (completedAssignments && completedAssignments[fixed.employeeId]) {
                const normalized = normalizeAssignments(completedAssignments[fixed.employeeId], shifts)
                if (normalized.length > 0) {
                  assignmentsToApply = normalized
                  break
                }
              }
            }
          }

          if (assignmentsToApply && assignmentsToApply.length > 0) {
            if (!assignments[dateStr]) {
              assignments[dateStr] = {}
            }
            assignments[dateStr][fixed.employeeId] = assignmentsToApply
          }
        }
      }

      return assignments
    },
    []
  )

  const buildSuggestedAssignmentsFromLegacyFixedSchedules = useCallback(
    ({
      weekStartDate,
      weekStartStr,
      employees,
      allSchedules,
      weekSchedule,
      fixedSchedules,
    }: LegacySuggestedScheduleParams): Record<string, Record<string, ShiftAssignment[]>> => {
      const suggestedAssignments: Record<string, Record<string, ShiftAssignment[]>> = {}

      if (!fixedSchedules || fixedSchedules.length === 0) {
        return suggestedAssignments
      }

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(weekStartDate)
        date.setDate(date.getDate() + dayOffset)
        const dateStr = format(date, "yyyy-MM-dd")
        const dayOfWeek = getDay(date)

        const fixedForDay = fixedSchedules.filter((fixed) => fixed.dayOfWeek === dayOfWeek)

        for (const fixed of fixedForDay) {
          const employee = employees.find((e) => e.id === fixed.employeeId)
          if (!employee) continue

          if (weekSchedule?.assignments?.[dateStr]?.[fixed.employeeId]) {
            const currentAssignments = weekSchedule.assignments[dateStr][fixed.employeeId]
            if (Array.isArray(currentAssignments) && currentAssignments.length > 0) {
              continue
            }
          }

          let assignmentsToApply: ShiftAssignment[] | null = null

          if (fixed.assignments && fixed.assignments.length > 0) {
            assignmentsToApply = fixed.assignments
          } else {
            const suggestion = getSuggestionForDay(fixed.employeeId, dayOfWeek, allSchedules, weekStartStr)
            if (suggestion && suggestion.assignments.length > 0) {
              assignmentsToApply = suggestion.assignments
            }
          }

          if (!assignmentsToApply || assignmentsToApply.length === 0) {
            const completedSchedules = allSchedules
              .filter((s) => s.completada === true && s.weekStart && s.weekStart < weekStartStr)
              .sort((a, b) => {
                const dateA = a.weekStart || a.semanaInicio || ""
                const dateB = b.weekStart || b.semanaInicio || ""
                return dateB.localeCompare(dateA)
              })

            for (const completedSchedule of completedSchedules) {
              const completedWeekStart = parseISO(completedSchedule.weekStart || completedSchedule.semanaInicio)
              const completedDate = new Date(completedWeekStart)
              completedDate.setDate(completedDate.getDate() + dayOffset)
              const completedDateStr = format(completedDate, "yyyy-MM-dd")

              const completedAssignments = completedSchedule.assignments[completedDateStr]
              if (completedAssignments && completedAssignments[fixed.employeeId]) {
                const normalized = normalizeAssignments(completedAssignments[fixed.employeeId])
                if (normalized.length > 0) {
                  assignmentsToApply = normalized
                  break
                }
              }
            }
          }

          if ((!assignmentsToApply || assignmentsToApply.length === 0) && weekSchedule) {
            const currentAssignments = weekSchedule.assignments[dateStr]
            if (currentAssignments && currentAssignments[fixed.employeeId]) {
              const normalized = normalizeAssignments(currentAssignments[fixed.employeeId])
              if (normalized.length > 0) {
                assignmentsToApply = normalized
              }
            }
          }

          if (assignmentsToApply && assignmentsToApply.length > 0) {
            if (!suggestedAssignments[dateStr]) {
              suggestedAssignments[dateStr] = {}
            }
            suggestedAssignments[dateStr][fixed.employeeId] = assignmentsToApply
          }
        }
      }

      return suggestedAssignments
    },
    []
  )

  const buildAssignmentsFromFixedRulesForEmployee = useCallback(
    ({ employeeId, weekStartDate, rules, shifts }: FixedRulesAssignmentsParams): Record<string, ShiftAssignment[]> => {
      const assignments: Record<string, ShiftAssignment[]> = {}

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = addDays(weekStartDate, dayOffset)
        const dateStr = format(date, "yyyy-MM-dd")
        const dayOfWeek = getDay(date)

        const rule = rules.find(
          (candidate) => candidate.employeeId === employeeId && candidate.dayOfWeek === dayOfWeek
        )
        if (!rule) continue

        const ruleAssignments = convertRuleToAssignments(rule, shifts)

        if (ruleAssignments.length > 0) {
          assignments[dateStr] = cleanAssignmentsForFirestore(ruleAssignments)

          logger.info("[ImplicitFixedRules] Aplicando regla fija", {
            employeeId,
            date: dateStr,
            dayOfWeek,
            ruleType: rule.type,
            shiftId: rule.shiftId,
            assignmentsCount: ruleAssignments.length,
          })
        }
      }

      return assignments
    },
    []
  )

  return {
    buildAssignmentsFromLegacyFixedSchedules,
    buildSuggestedAssignmentsFromLegacyFixedSchedules,
    buildAssignmentsFromFixedRulesForEmployee,
  }
}

function cleanAssignmentsForFirestore(assignments: ShiftAssignment[]): ShiftAssignment[] {
  return assignments.map((assignment) => {
    const cleaned: Record<string, unknown> = {}

    Object.entries(assignment).forEach(([key, value]) => {
      if (value !== undefined) {
        cleaned[key] = value
      }
    })

    return cleaned as ShiftAssignment
  })
}

function convertRuleToAssignments(rule: EmployeeFixedRule, shifts: Turno[]): ShiftAssignment[] {
  if (rule.type === "OFF") {
    return [{ type: "franco" }]
  }

  if (rule.type === "SHIFT" && rule.shiftId) {
    const shift = shifts.find((s) => s.id === rule.shiftId)
    if (shift) {
      const assignment: ShiftAssignment = {
        type: "shift",
        shiftId: rule.shiftId,
        startTime: shift.startTime || "",
        endTime: shift.endTime || "",
      }

      if (shift.startTime2 && shift.endTime2) {
        assignment.startTime2 = shift.startTime2
        assignment.endTime2 = shift.endTime2
      }

      return [assignment]
    }

    logger.warn("[ImplicitFixedRules] Turno no encontrado para regla", {
      ruleId: rule.id,
      shiftId: rule.shiftId,
    })
  }

  return []
}
