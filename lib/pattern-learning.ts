import type { Horario, ShiftAssignment, ShiftAssignmentValue, Empleado } from "./types"
import { normalizeAssignments } from "./schedule-utils"
import { format, parseISO, getDay } from "date-fns"

export interface PatternSuggestion {
  employeeId: string
  dayOfWeek: number // 0 = domingo, 1 = lunes, etc.
  assignments: ShiftAssignment[]
  confidence: number // 0-1, basado en cuántas semanas consecutivas tienen este patrón
  weeksMatched: number
}

export interface EmployeePattern {
  employeeId: string
  dayOfWeek: number
  assignments: ShiftAssignment[]
  frequency: number // cuántas veces aparece este patrón
  consecutiveWeeks: number // semanas consecutivas con este patrón
  lastSeen: string // fecha de la última semana donde se vio
}

/**
 * Compara dos asignaciones para ver si son iguales
 */
function assignmentsEqual(a1: ShiftAssignment[], a2: ShiftAssignment[]): boolean {
  if (a1.length !== a2.length) return false
  
  // Ordenar por shiftId para comparar
  const sortAssignments = (assignments: ShiftAssignment[]) => {
    return [...assignments].sort((a, b) => {
      const aId = a.shiftId || ""
      const bId = b.shiftId || ""
      if (aId !== bId) return aId.localeCompare(bId)
      
      // Si tienen el mismo shiftId, comparar por tipo
      const aType = a.type || "shift"
      const bType = b.type || "shift"
      if (aType !== bType) return aType.localeCompare(bType)
      
      // Comparar horarios ajustados
      const aStart = a.startTime || ""
      const bStart = b.startTime || ""
      if (aStart !== bStart) return aStart.localeCompare(bStart)
      
      const aEnd = a.endTime || ""
      const bEnd = b.endTime || ""
      if (aEnd !== bEnd) return aEnd.localeCompare(bEnd)
      
      return 0
    })
  }
  
  const sorted1 = sortAssignments(a1)
  const sorted2 = sortAssignments(a2)
  
  return sorted1.every((a1, i) => {
    const a2 = sorted2[i]
    return (
      a1.type === a2.type &&
      a1.shiftId === a2.shiftId &&
      a1.startTime === a2.startTime &&
      a1.endTime === a2.endTime &&
      a1.startTime2 === a2.startTime2 &&
      a1.endTime2 === a2.endTime2
    )
  })
}

/**
 * Analiza los horarios pasados de un empleado y detecta patrones
 */
export function analyzeEmployeePatterns(
  employeeId: string,
  schedules: Horario[],
  lookBackWeeks: number = 12 // Analizar últimas 12 semanas
): EmployeePattern[] {
  const patterns: Map<string, EmployeePattern> = new Map()
  
  // Filtrar y ordenar semanas por fecha (más antiguas primero)
  const sortedSchedules = schedules
    .filter(s => s.completada === true && s.assignments) // Solo semanas completadas
    .sort((a, b) => {
      const dateA = a.weekStart || a.semanaInicio || ""
      const dateB = b.weekStart || b.semanaInicio || ""
      return dateA.localeCompare(dateB)
    })
    .slice(-lookBackWeeks) // Últimas N semanas
  
  // Analizar cada semana
  for (const schedule of sortedSchedules) {
    const weekStart = schedule.weekStart || schedule.semanaInicio
    if (!weekStart) continue
    
    const weekStartDate = parseISO(weekStart)
    
    // Analizar cada día de la semana
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(weekStartDate)
      date.setDate(date.getDate() + dayOffset)
      const dateStr = format(date, "yyyy-MM-dd")
      const dayOfWeek = getDay(date) // 0 = domingo, 1 = lunes, etc.
      
      const dateAssignments = schedule.assignments[dateStr]
      if (!dateAssignments) continue
      
      const employeeAssignments = dateAssignments[employeeId]
      if (!employeeAssignments) continue
      
      const normalized = normalizeAssignments(employeeAssignments)
      if (normalized.length === 0) continue
      
      // Crear clave única para este patrón (día de semana + asignaciones)
      // Usar JSON.stringify para comparar asignaciones
      const patternKey = `${dayOfWeek}-${JSON.stringify(normalized)}`
      
      if (!patterns.has(patternKey)) {
        patterns.set(patternKey, {
          employeeId,
          dayOfWeek,
          assignments: normalized,
          frequency: 1,
          consecutiveWeeks: 1,
          lastSeen: weekStart,
        })
      } else {
        const pattern = patterns.get(patternKey)!
        pattern.frequency++
        
        // Verificar si es consecutivo
        const lastSeenDate = parseISO(pattern.lastSeen)
        const currentWeekDate = parseISO(weekStart)
        const weeksDiff = Math.round(
          (currentWeekDate.getTime() - lastSeenDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
        )
        
        if (weeksDiff === 1) {
          // Semana consecutiva
          pattern.consecutiveWeeks++
        } else if (weeksDiff > 1) {
          // No consecutivo, resetear contador
          pattern.consecutiveWeeks = 1
        }
        
        pattern.lastSeen = weekStart
      }
    }
  }
  
  return Array.from(patterns.values())
}

/**
 * Genera sugerencias basadas en patrones detectados
 */
export function generateSuggestions(
  employeeId: string,
  schedules: Horario[],
  targetWeekStart: string, // Semana para la cual generar sugerencias
  minConsecutiveWeeks: number = 3 // Mínimo de semanas consecutivas para considerar sugerencia
): PatternSuggestion[] {
  const patterns = analyzeEmployeePatterns(employeeId, schedules)
  const suggestions: PatternSuggestion[] = []
  
  for (const pattern of patterns) {
    // Solo sugerir si tiene suficientes semanas consecutivas
    if (pattern.consecutiveWeeks >= minConsecutiveWeeks) {
      const confidence = Math.min(pattern.consecutiveWeeks / 10, 1) // Máximo 10 semanas = 100% confianza
      
      suggestions.push({
        employeeId: pattern.employeeId,
        dayOfWeek: pattern.dayOfWeek,
        assignments: pattern.assignments,
        confidence,
        weeksMatched: pattern.consecutiveWeeks,
      })
    }
  }
  
  return suggestions
}

/**
 * Obtiene sugerencia para un empleado en un día específico
 */
export function getSuggestionForDay(
  employeeId: string,
  dayOfWeek: number,
  schedules: Horario[],
  targetWeekStart: string
): PatternSuggestion | null {
  const suggestions = generateSuggestions(employeeId, schedules, targetWeekStart)
  return suggestions.find(s => s.employeeId === employeeId && s.dayOfWeek === dayOfWeek) || null
}

/**
 * Obtiene todas las sugerencias para una semana completa
 */
export function getSuggestionsForWeek(
  employeeId: string,
  schedules: Horario[],
  targetWeekStart: string
): Map<number, PatternSuggestion> {
  const suggestions = generateSuggestions(employeeId, schedules, targetWeekStart)
  const suggestionsMap = new Map<number, PatternSuggestion>()
  
  for (const suggestion of suggestions) {
    if (suggestion.employeeId === employeeId) {
      suggestionsMap.set(suggestion.dayOfWeek, suggestion)
    }
  }
  
  return suggestionsMap
}

