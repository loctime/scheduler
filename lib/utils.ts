import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import { startOfWeek, addDays, addWeeks, setDate, addMonths } from "date-fns"
import { format } from "date-fns"

/**
 * Ajusta una hora en formato HH:mm sumando o restando minutos
 * @param timeStr Hora en formato "HH:mm"
 * @param minutes Minutos a sumar (positivo) o restar (negativo)
 * @returns Nueva hora en formato "HH:mm"
 */
export function adjustTime(timeStr: string | undefined, minutes: number): string {
  if (!timeStr) return ""
  
  const [hours, mins] = timeStr.split(":").map(Number)
  const totalMinutes = hours * 60 + mins + (minutes ?? 0)
  
  // Normalizar a 24 horas
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440
  const newHours = Math.floor(normalizedMinutes / 60)
  const newMins = normalizedMinutes % 60
  
  return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`
}

/**
 * Determina el mes correcto para mostrar basándose en la fecha actual y mesInicioDia
 * Si el día actual es menor a mesInicioDia, muestra el mes anterior (el rango que termina en el mes actual)
 * Si el día actual es mayor o igual a mesInicioDia, muestra el mes actual (el rango que comienza en el mes actual)
 */
export function getInitialMonthForRange(currentDate: Date, monthStartDay: number): Date {
  const dayOfMonth = currentDate.getDate()
  
  // Si el día actual es menor al día de inicio del mes, estamos en el rango que termina en este mes
  // Por lo tanto, debemos mostrar el mes anterior
  if (dayOfMonth < monthStartDay) {
    return addMonths(currentDate, -1)
  }
  
  // Si el día actual es mayor o igual al día de inicio, estamos en el rango que comienza en este mes
  return currentDate
}

/**
 * Calcula el rango del mes personalizado basado en mesInicioDia
 */
export function getCustomMonthRange(date: Date, monthStartDay: number) {
  const year = date.getFullYear()
  const month = date.getMonth()
  
  // Fecha de inicio: mesInicioDia del mes actual
  const startDate = setDate(new Date(year, month, 1), monthStartDay)
  
  // Fecha de fin: día anterior al mesInicioDia del mes siguiente
  const nextMonth = addMonths(new Date(year, month, 1), 1)
  const endDate = addDays(setDate(nextMonth, monthStartDay), -1)
  
  return { startDate, endDate }
}

/**
 * Determina el mes principal basándose en qué mes tiene más días en el rango.
 * Útil cuando un período abarca dos meses (ej. 26 ene - 25 feb): devuelve el mes con más días.
 * Si hay empate, prefiere el mes posterior.
 */
export function getMainMonth(startDate: Date, endDate: Date): Date {
  const monthDays: Map<string, number> = new Map()
  let currentDate = new Date(startDate)
  const end = new Date(endDate)

  while (currentDate <= end) {
    const monthKey = format(currentDate, "yyyy-MM")
    monthDays.set(monthKey, (monthDays.get(monthKey) || 0) + 1)
    currentDate = addDays(currentDate, 1)
  }

  let maxDays = 0
  let mainMonthKey = ""
  monthDays.forEach((days, monthKey) => {
    if (days > maxDays) {
      maxDays = days
      mainMonthKey = monthKey
    }
  })

  if (maxDays > 0) {
    const allMonthKeys = Array.from(monthDays.keys()).sort()
    const candidatesWithMaxDays = allMonthKeys.filter((key) => monthDays.get(key) === maxDays)
    const selectedMonthKey =
      candidatesWithMaxDays.length > 1
        ? candidatesWithMaxDays[candidatesWithMaxDays.length - 1]
        : mainMonthKey
    const [year, month] = selectedMonthKey.split("-").map(Number)
    return new Date(year, month - 1, 15)
  }

  return new Date(endDate)
}

/**
 * Genera todas las semanas del mes basado en el rango personalizado
 */
export function getMonthWeeks(
  date: Date,
  monthStartDay: number,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
): Date[][] {
  const { startDate, endDate } = getCustomMonthRange(date, monthStartDay)
  const weeks: Date[][] = []
  
  // Encontrar el inicio de la semana que contiene el startDate
  let weekStart = startOfWeek(startDate, { weekStartsOn })
  
  // Generar semanas hasta cubrir todo el rango
  while (weekStart <= endDate) {
    const week: Date[] = []
    
    // Generar 7 días completos de la semana
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i)
      week.push(new Date(day))
    }
    
    // Verificar si la semana tiene al menos un día dentro del rango del mes
    const hasDaysInRange = week.some((day) => day >= startDate && day <= endDate)
    
    if (hasDaysInRange) {
      weeks.push(week)
    }
    
    // Mover a la siguiente semana
    weekStart = addWeeks(weekStart, 1)
    
    // Si el inicio de la siguiente semana ya pasó el endDate, terminar
    if (weekStart > endDate && week[week.length - 1] > endDate) {
      break
    }
  }
  
  return weeks
}
