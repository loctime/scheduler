import { useMemo } from "react"
import type { Horario, Empleado, Configuracion } from "@/lib/types"
import { getSuggestionsForWeek, getSuggestionForDay, type PatternSuggestion } from "@/lib/pattern-learning"
import { format } from "date-fns"

interface UsePatternSuggestionsProps {
  employees: Empleado[]
  schedules: Horario[]
  targetWeekStart: Date
  config?: Configuracion | null
}

export function usePatternSuggestions({
  employees,
  schedules,
  targetWeekStart,
  config,
}: UsePatternSuggestionsProps) {
  const targetWeekStartStr = format(targetWeekStart, "yyyy-MM-dd")
  
  // Generar sugerencias para todos los empleados
  const suggestionsByEmployee = useMemo(() => {
    const result = new Map<string, Map<number, PatternSuggestion>>()
    
    for (const employee of employees) {
      const suggestions = getSuggestionsForWeek(employee.id, schedules, targetWeekStartStr)
      if (suggestions.size > 0) {
        result.set(employee.id, suggestions)
      }
      
      // Agregar horarios marcados manualmente como fijos
      if (config?.fixedSchedules) {
        config.fixedSchedules.forEach((fixed) => {
          if (fixed.employeeId === employee.id) {
            if (!result.has(employee.id)) {
              result.set(employee.id, new Map())
            }
            const employeeSuggestions = result.get(employee.id)!
            // Si ya hay una sugerencia automática, mantenerla, sino crear una manual
            if (!employeeSuggestions.has(fixed.dayOfWeek)) {
              employeeSuggestions.set(fixed.dayOfWeek, {
                employeeId: employee.id,
                dayOfWeek: fixed.dayOfWeek,
                assignments: [], // Se llenará con las asignaciones actuales
                confidence: 1.0,
                weeksMatched: 0,
                isFixed: true,
              })
            }
          }
        })
      }
    }
    
    return result
  }, [employees, schedules, targetWeekStartStr, config?.fixedSchedules])
  
  // Función helper para obtener sugerencia de un empleado en un día específico
  const getSuggestion = useMemo(
    () => (employeeId: string, dayOfWeek: number): PatternSuggestion | null => {
      const employeeSuggestions = suggestionsByEmployee.get(employeeId)
      if (!employeeSuggestions) return null
      return employeeSuggestions.get(dayOfWeek) || null
    },
    [suggestionsByEmployee]
  )
  
  // Función helper para verificar si un empleado tiene horario fijo
  const hasFixedSchedule = useMemo(
    () => (employeeId: string): boolean => {
      const employeeSuggestions = suggestionsByEmployee.get(employeeId)
      if (!employeeSuggestions) return false
      return Array.from(employeeSuggestions.values()).some(s => s.isFixed)
    },
    [suggestionsByEmployee]
  )
  
  return {
    suggestionsByEmployee,
    getSuggestion,
    hasFixedSchedule,
  }
}

