/**
 * Utilidades para el manejo de días especiales del calendario
 */

import type { 
  CalendarSpecialDay, 
  FormattedSpecialDay, 
  SchedulingWarning,
  SpecialDaysFilter 
} from '@/lib/types/calendar-special-days'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Genera ID único para un día especial basado en ciudad y fecha
 * Formato: "{city}-{date}" (ej: "viedma-2026-01-01")
 */
export function generateSpecialDayId(city: string, date: string): string {
  const normalizedCity = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return `${normalizedCity}-${date}`
}

/**
 * Parsea una fecha de API (día, mes, año) a formato ISO
 */
export function parseAPIDate(day: number, month: number, year: number): string {
  // Validate inputs before calling toString()
  if (day == null || month == null || year == null) {
    throw new Error("Invalid date parameters: day, month, and year are required")
  }
  
  const monthStr = month.toString().padStart(2, '0')
  const dayStr = day.toString().padStart(2, '0')
  return `${year}-${monthStr}-${dayStr}`
}

/**
 * Formatea fecha ISO a display para usuario (DD/MM/YYYY)
 */
export function formatDateDisplay(dateISO: string): string {
  try {
    const date = parseISO(dateISO)
    return format(date, 'dd/MM/yyyy', { locale: es })
  } catch {
    return dateISO // Fallback si falla el parseo
  }
}

/**
 * Formatea ubicación completa
 */
export function formatLocation(city: string, province: string, country: string): string {
  return `${city}, ${province}, ${country}`
}

/**
 * Convierte CalendarSpecialDay a FormattedSpecialDay para UI
 */
export function formatSpecialDayForUI(specialDay: CalendarSpecialDay): FormattedSpecialDay {
  return {
    id: specialDay.id,
    date: specialDay.date,
    dateDisplay: formatDateDisplay(specialDay.date),
    title: specialDay.title,
    description: specialDay.description,
    type: specialDay.type,
    scope: specialDay.scope,
    severity: specialDay.severity,
    affectsScheduling: specialDay.affectsScheduling,
    location: formatLocation(specialDay.city, specialDay.province, specialDay.country),
    source: specialDay.source
  }
}

/**
 * Genera mensaje de advertencia para generación de horarios
 */
export function generateSchedulingWarning(specialDay: FormattedSpecialDay): SchedulingWarning {
  let message = ''
  
  switch (specialDay.type) {
    case 'feriado':
      message = `Feriado: ${specialDay.title}`
      break
    case 'no_laborable':
      message = `Día no laborable: ${specialDay.title}`
      break
    case 'local':
      message = `Día especial local: ${specialDay.title}`
      break
    case 'evento':
      message = `Evento: ${specialDay.title}`
      break
    default:
      message = `Día especial: ${specialDay.title}`
  }
  
  // Agregar información de alcance si no es nacional
  if (specialDay.scope !== 'nacional') {
    message += ` (${specialDay.scope})`
  }
  
  return {
    date: specialDay.date,
    dateDisplay: specialDay.dateDisplay,
    specialDay,
    message,
    severity: specialDay.severity
  }
}

/**
 * Filtra días especiales según criterios
 */
export function filterSpecialDays(
  specialDays: CalendarSpecialDay[], 
  filter: SpecialDaysFilter
): CalendarSpecialDay[] {
  return specialDays.filter(day => {
    // Rango de fechas
    if (filter.startDate && day.date < filter.startDate) return false
    if (filter.endDate && day.date > filter.endDate) return false
    
    // Ubicación
    if (filter.city && day.city.toLowerCase() !== filter.city.toLowerCase()) return false
    if (filter.province && day.province.toLowerCase() !== filter.province.toLowerCase()) return false
    if (filter.country && day.country.toLowerCase() !== filter.country.toLowerCase()) return false
    
    // Clasificación
    if (filter.type && day.type !== filter.type) return false
    if (filter.scope && day.scope !== filter.scope) return false
    if (filter.severity && day.severity !== filter.severity) return false
    if (filter.source && day.source !== filter.source) return false
    
    // Configuración
    if (filter.affectsScheduling !== undefined && day.affectsScheduling !== filter.affectsScheduling) {
      return false
    }
    
    return true
  })
}

/**
 * Agrupa días especiales por fecha
 */
export function groupSpecialDaysByDate(specialDays: CalendarSpecialDay[]): Record<string, CalendarSpecialDay[]> {
  return specialDays.reduce((groups, day) => {
    const date = day.date
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(day)
    return groups
  }, {} as Record<string, CalendarSpecialDay[]>)
}

/**
 * Obtiene días especiales que afectan un rango de fechas
 */
export function getSpecialDaysInDateRange(
  specialDays: CalendarSpecialDay[],
  startDate: string,
  endDate: string
): CalendarSpecialDay[] {
  return specialDays.filter(day => 
    day.date >= startDate && 
    day.date <= endDate && 
    day.affectsScheduling
  )
}

/**
 * Genera advertencias para un rango de fechas
 */
export function generateSchedulingWarnings(
  specialDays: CalendarSpecialDay[],
  startDate: string,
  endDate: string
): SchedulingWarning[] {
  const relevantDays = getSpecialDaysInDateRange(specialDays, startDate, endDate)
  const formattedDays = relevantDays.map(formatSpecialDayForUI)
  
  return formattedDays
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(generateSchedulingWarning)
}

/**
 * Valida si una fecha es día especial
 */
export function isSpecialDay(
  specialDays: CalendarSpecialDay[],
  date: string,
  city?: string
): CalendarSpecialDay | null {
  const day = specialDays.find(d => d.date === date)
  
  if (!day) return null
  
  // Si se especifica ciudad, verificar que coincida o que sea nacional
  if (city) {
    if (day.scope === 'nacional') return day
    if (day.city.toLowerCase() === city.toLowerCase()) return day
    return null
  }
  
  return day
}

/**
 * Obtiene color para tipo de día especial
 */
export function getSpecialDayTypeColor(type: CalendarSpecialDay['type']): string {
  switch (type) {
    case 'feriado':
      return '#ef4444' // red-500
    case 'no_laborable':
      return '#f97316' // orange-500
    case 'local':
      return '#3b82f6' // blue-500
    case 'evento':
      return '#8b5cf6' // violet-500
    default:
      return '#6b7280' // gray-500
  }
}

/**
 * Obtiene color para severidad
 */
export function getSeverityColor(severity: CalendarSpecialDay['severity']): string {
  switch (severity) {
    case 'critical':
      return '#dc2626' // red-600
    case 'warning':
      return '#d97706' // amber-600
    case 'info':
      return '#2563eb' // blue-600
    default:
      return '#6b7280' // gray-500
  }
}
