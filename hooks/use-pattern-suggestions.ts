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
    }
    
    return result
  }, [employees, schedules, targetWeekStartStr])
  
  // Función helper para obtener sugerencia de un empleado en un día específico
  const getSuggestion = useMemo(
    () => (employeeId: string, dayOfWeek: number): PatternSuggestion | null => {
      const employeeSuggestions = suggestionsByEmployee.get(employeeId)
      if (!employeeSuggestions) return null
      return employeeSuggestions.get(dayOfWeek) || null
    },
    [suggestionsByEmployee]
  )
  
  
  return {
    suggestionsByEmployee,
    getSuggestion,
  }
}

