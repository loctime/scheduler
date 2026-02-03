import { useCallback } from "react"
import { addDays, format, getDay } from "date-fns"
import { EmployeeFixedRule, ShiftAssignment, Turno } from "@/lib/types"
import { logger } from "@/lib/logger"

interface FixedRulesAssignmentsParams {
  employeeId: string
  weekStartDate: Date
  rules: EmployeeFixedRule[]
  shifts: Turno[]
}

export function useFixedRulesEngine() {
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
