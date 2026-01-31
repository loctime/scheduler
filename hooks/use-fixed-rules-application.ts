import { useMemo } from "react"
import { ShiftAssignment, EmployeeFixedRule } from "@/lib/types"
import { getDay, parseISO, isWithinInterval } from "date-fns"

type FixedRuleResult =
  | { mode: "RULE"; assignments: ShiftAssignment[] }
  | { mode: "OVERRIDE"; assignments: ShiftAssignment[] }
  | { mode: "NONE" }

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
  
  // NOTA: Por ahora se deja filtrado por cada celda.
  // TODO: Evaluar indexado por día (rulesByDay) si hay problemas de performance
  // con muchas reglas (ej: >100 empleados con reglas múltiples)
  
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
    return (date: string, employeeId: string): FixedRuleResult => {
      const validRules = getValidRulesForDate(date)
      const employeeRule = validRules.find(rule => rule.employeeId === employeeId)
      
      if (!employeeRule) return { mode: "NONE" }
      
      // Si ya hay una asignación manual (override), no aplicar la regla
      const currentAssignments = assignments[date]?.[employeeId]
      if (currentAssignments && Array.isArray(currentAssignments) && currentAssignments.length > 0) {
        // Convertir string[] a ShiftAssignment[] si es necesario
        const normalizedCurrent = Array.isArray(currentAssignments) 
          ? currentAssignments.map(a => typeof a === 'string' ? { type: "shift" as const, shiftId: a } : a)
          : []
          
        // Verificar si es un override (diferente de lo que dictaría la regla)
        const ruleAssignments = getRuleAssignments(employeeRule, shifts)
        if (!areAssignmentsEqual(normalizedCurrent, ruleAssignments)) {
          return { mode: "OVERRIDE", assignments: normalizedCurrent }
        }
      }
      
      const ruleAssignments = getRuleAssignments(employeeRule, shifts)
      return { mode: "RULE", assignments: ruleAssignments }
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
      
      // Normalizar asignaciones actuales
      const normalizedCurrent = currentAssignments.map(a => typeof a === 'string' ? { type: "shift" as const, shiftId: a } : a)
      
      const ruleAssignments = getRuleAssignments(employeeRule, shifts)
      return !areAssignmentsEqual(normalizedCurrent, ruleAssignments)
    }
  }, [getValidRulesForDate, assignments, shifts])

  // Obtener asignaciones con reglas aplicadas
  const getAssignmentsWithRules = useMemo(() => {
    return (date: string, employeeId: string): ShiftAssignment[] => {
      const ruleResult = applyFixedRules(date, employeeId)
      
      if (ruleResult.mode === "OVERRIDE") {
        // Es un override, devolver las asignaciones originales
        return ruleResult.assignments
      }
      
      if (ruleResult.mode === "RULE") {
        // Aplicar regla
        return ruleResult.assignments
      }
      
      // Sin regla, devolver asignaciones actuales (normalizadas)
      const currentAssignments = assignments[date]?.[employeeId]
      if (currentAssignments && Array.isArray(currentAssignments)) {
        return currentAssignments.map(a => typeof a === 'string' ? { type: "shift" as const, shiftId: a } : a)
      }
      return []
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
// TODO: Evaluar si es suficiente para doble turno, franco, medio turno
function areAssignmentsEqual(
  assignments1: ShiftAssignment[],
  assignments2: ShiftAssignment[]
): boolean {
  if (assignments1.length !== assignments2.length) return false
  
  return assignments1.every((assignment, index) => {
    const other = assignments2[index]
    if (assignment.type !== other.type) return false
    if ('shiftId' in assignment && 'shiftId' in other && assignment.shiftId !== other.shiftId) return false
    if ('startTime' in assignment && 'startTime' in other && assignment.startTime !== other.startTime) return false
    if ('endTime' in assignment && 'endTime' in other && assignment.endTime !== other.endTime) return false
    if ('startTime2' in assignment && 'startTime2' in other && assignment.startTime2 !== other.startTime2) return false
    if ('endTime2' in assignment && 'endTime2' in other && assignment.endTime2 !== other.endTime2) return false
    if ('texto' in assignment && 'texto' in other && assignment.texto !== other.texto) return false
    if ('licenciaType' in assignment && 'licenciaType' in other && assignment.licenciaType !== other.licenciaType) return false
    return true
  })
}
