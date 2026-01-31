import { useMemo } from "react"
import { ShiftAssignment, EmployeeFixedRule } from "@/lib/types"
import { getDay, parseISO, isWithinInterval } from "date-fns"

interface UseFixedRulesApplicationProps {
  fixedRules: EmployeeFixedRule[]
  assignments: Record<string, Record<string, ShiftAssignment[] | string[]>>
  shifts: any[]
}

export function useFixedRulesApplication({
  fixedRules,
  assignments,
  shifts
}: UseFixedRulesApplicationProps) {
  
  // Obtener reglas válidas para una fecha específica
  const getValidRulesForDate = useMemo(() => {
    return (date: string) => {
      const dateObj = parseISO(date)
      const dayOfWeek = getDay(dateObj)
      
      return fixedRules.filter(rule => {
        // Verificar día de la semana
        if (rule.dayOfWeek !== dayOfWeek) return false
        
        // Verificar fechas de inicio y fin
        if (rule.startDate && dateObj < parseISO(rule.startDate)) return false
        if (rule.endDate && dateObj > parseISO(rule.endDate)) return false
        
        return true
      })
    }
  }, [fixedRules])

  // Aplicar reglas fijas a las asignaciones
  const applyFixedRules = useMemo(() => {
    return (date: string, employeeId: string) => {
      const validRules = getValidRulesForDate(date)
      const employeeRule = validRules.find(rule => rule.employeeId === employeeId)
      
      if (!employeeRule) return null
      
      // Si ya hay una asignación manual (override), no aplicar la regla
      const currentAssignments = assignments[date]?.[employeeId]
      if (currentAssignments && Array.isArray(currentAssignments) && currentAssignments.length > 0) {
        // Verificar si es un override (diferente de lo que dictaría la regla)
        const ruleAssignments = getRuleAssignments(employeeRule, shifts)
        if (!areAssignmentsEqual(currentAssignments, ruleAssignments)) {
          return { isOverride: true, originalAssignments: currentAssignments }
        }
      }
      
      return getRuleAssignments(employeeRule, shifts)
    }
  }, [getValidRulesForDate, assignments, shifts])

  // Verificar si una celda tiene un override
  const hasOverride = useMemo(() => {
    return (date: string, employeeId: string) => {
      const validRules = getValidRulesForDate(date)
      const employeeRule = validRules.find(rule => rule.employeeId === employeeId)
      
      if (!employeeRule) return false
      
      const currentAssignments = assignments[date]?.[employeeId]
      if (!currentAssignments || !Array.isArray(currentAssignments) || currentAssignments.length === 0) {
        return false
      }
      
      const ruleAssignments = getRuleAssignments(employeeRule, shifts)
      return !areAssignmentsEqual(currentAssignments, ruleAssignments)
    }
  }, [getValidRulesForDate, assignments, shifts])

  // Obtener asignaciones con reglas aplicadas
  const getAssignmentsWithRules = useMemo(() => {
    return (date: string, employeeId: string) => {
      const ruleResult = applyFixedRules(date, employeeId)
      
      if (ruleResult && typeof ruleResult === 'object' && 'isOverride' in ruleResult) {
        // Es un override, devolver las asignaciones originales
        return ruleResult.originalAssignments
      }
      
      if (ruleResult) {
        // Aplicar regla
        return ruleResult
      }
      
      // Sin regla, devolver asignaciones actuales
      return assignments[date]?.[employeeId] || []
    }
  }, [applyFixedRules, assignments])

  return {
    getValidRulesForDate,
    applyFixedRules,
    hasOverride,
    getAssignmentsWithRules
  }
}

// Función auxiliar para convertir regla a asignaciones
function getRuleAssignments(rule: EmployeeFixedRule, shifts: any[]): ShiftAssignment[] {
  if (rule.type === "OFF") {
    return [{ type: "franco" }]
  }
  
  if (rule.type === "SHIFT" && rule.shiftId) {
    const shift = shifts.find(s => s.id === rule.shiftId)
    if (shift) {
      return [{
        type: "shift",
        shiftId: rule.shiftId,
        startTime: shift.startTime,
        endTime: shift.endTime,
        startTime2: shift.startTime2,
        endTime2: shift.endTime2
      }]
    }
  }
  
  return []
}

// Función auxiliar para comparar asignaciones
function areAssignmentsEqual(
  assignments1: ShiftAssignment[] | string[],
  assignments2: ShiftAssignment[]
): boolean {
  // Convertir string[] a ShiftAssignment[] si es necesario
  const normalized1 = Array.isArray(assignments1) 
    ? assignments1.map(a => typeof a === 'string' ? { type: "shift" as const, shiftId: a } : a)
    : []
  
  if (normalized1.length !== assignments2.length) return false
  
  return normalized1.every((assignment, index) => {
    const other = assignments2[index]
    if (assignment.type !== other.type) return false
    if ('shiftId' in assignment && 'shiftId' in other && assignment.shiftId !== other.shiftId) return false
    if ('startTime' in assignment && 'startTime' in other && assignment.startTime !== other.startTime) return false
    if ('endTime' in assignment && 'endTime' in other && assignment.endTime !== other.endTime) return false
    return true
  })
}
