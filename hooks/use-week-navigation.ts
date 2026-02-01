import { useState, useEffect } from "react"
import { format, addDays, subDays, startOfWeek, getWeek } from "date-fns"
import { es } from "date-fns/locale"

export interface WeekData {
  weekId: string
  startDate: string // DD/MM/AAAA
  endDate: string   // DD/MM/AAAA
  weekNumber: number
  year: number
  month: number
}

export interface UseWeekNavigationReturn {
  currentWeek: WeekData | null
  isLoading: boolean
  goToPreviousWeek: () => void
  goToNextWeek: () => void
  goToWeek: (weekId: string) => void
  formatWeekDisplay: () => string
  getAllWeeksOfYear: (year: number) => WeekData[]
}

// Función para generar ID de semana en formato MM/AAAA-W{n}
export function generateWeekId(date: Date): string {
  const month = format(date, "MM", { locale: es })
  const year = format(date, "yyyy", { locale: es })
  const weekNumber = getWeek(date, { weekStartsOn: 1, locale: es })
  
  return `${month}/${year}-W${weekNumber}`
}

// Función para parsear weekId a Date
export function parseWeekId(weekId: string): Date | null {
  try {
    const match = weekId.match(/^(\d{2})\/(\d{4})-W(\d+)$/)
    if (!match) return null
    
    const [, monthStr, yearStr, weekNumStr] = match
    const month = parseInt(monthStr, 10) - 1 // JavaScript months are 0-indexed
    const year = parseInt(yearStr, 10)
    const weekNumber = parseInt(weekNumStr, 10)
    
    // Encontrar la primera fecha de esta semana
    // Aproximación: primer día del año + semanas * 7 días
    const firstDayOfYear = new Date(year, 0, 1)
    const daysToAdd = (weekNumber - 1) * 7
    
    // Ajustar para que la semana comience en lunes
    const candidateDate = new Date(firstDayOfYear)
    candidateDate.setDate(firstDayOfYear.getDate() + daysToAdd)
    
    // Encontrar el lunes de esa semana
    const monday = startOfWeek(candidateDate, { weekStartsOn: 1 })
    
    // Verificar que el mes coincida (para semanas que caen en meses diferentes)
    if (monday.getMonth() === month || 
        (monday.getMonth() === month - 1 && monday.getDate() > 25) ||
        (monday.getMonth() === month + 1 && monday.getDate() < 5)) {
      return monday
    }
    
    return monday
  } catch {
    return null
  }
}

// Función para obtener datos de una semana
export function getWeekData(date: Date): WeekData {
  const monday = startOfWeek(date, { weekStartsOn: 1 })
  const sunday = addDays(monday, 6)
  
  return {
    weekId: generateWeekId(monday),
    startDate: format(monday, "dd/MM/yyyy", { locale: es }),
    endDate: format(sunday, "dd/MM/yyyy", { locale: es }),
    weekNumber: getWeek(monday, { weekStartsOn: 1, locale: es }),
    year: monday.getFullYear(),
    month: monday.getMonth()
  }
}

export function useWeekNavigation(initialWeekId?: string): UseWeekNavigationReturn {
  const [currentWeek, setCurrentWeek] = useState<WeekData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (initialWeekId) {
      const date = parseWeekId(initialWeekId)
      if (date) {
        setCurrentWeek(getWeekData(date))
      } else {
        // Si el weekId es inválido, usar semana actual
        setCurrentWeek(getWeekData(new Date()))
      }
    } else {
      // Sin weekId inicial, usar semana actual
      setCurrentWeek(getWeekData(new Date()))
    }
    setIsLoading(false)
  }, [initialWeekId])

  const goToPreviousWeek = () => {
    if (!currentWeek) return
    
    const currentDate = parseWeekId(currentWeek.weekId)
    if (currentDate) {
      const previousDate = subDays(currentDate, 7)
      setCurrentWeek(getWeekData(previousDate))
    }
  }

  const goToNextWeek = () => {
    if (!currentWeek) return
    
    const currentDate = parseWeekId(currentWeek.weekId)
    if (currentDate) {
      const nextDate = addDays(currentDate, 7)
      setCurrentWeek(getWeekData(nextDate))
    }
  }

  const goToWeek = (weekId: string) => {
    const date = parseWeekId(weekId)
    if (date) {
      setCurrentWeek(getWeekData(date))
    }
  }

  const formatWeekDisplay = (): string => {
    if (!currentWeek) return ""
    
    const monthNames = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ]
    
    const startDay = parseInt(currentWeek.startDate.split('/')[0], 10)
    const endDay = parseInt(currentWeek.endDate.split('/')[0], 10)
    const month = parseInt(currentWeek.startDate.split('/')[1], 10) - 1
    const year = parseInt(currentWeek.startDate.split('/')[2], 10)
    
    if (month === parseInt(currentWeek.endDate.split('/')[1], 10) - 1) {
      // Mismo mes
      return `${startDay} al ${endDay} de ${monthNames[month]} de ${year}`
    } else {
      // Diferente mes (ej: 28/12 al 03/01)
      const endMonth = parseInt(currentWeek.endDate.split('/')[1], 10) - 1
      return `${startDay} de ${monthNames[month]} al ${endDay} de ${monthNames[endMonth]} de ${year}`
    }
  }

  const getAllWeeksOfYear = (year: number): WeekData[] => {
    const weeks: WeekData[] = []
    const firstDay = new Date(year, 0, 1)
    
    // Encontrar el primer lunes del año
    let currentMonday = startOfWeek(firstDay, { weekStartsOn: 1 })
    
    // Si el primer lunes es del año anterior, ir a la siguiente semana
    if (currentMonday.getFullYear() < year) {
      currentMonday = addDays(currentMonday, 7)
    }
    
    // Generar todas las semanas del año
    while (currentMonday.getFullYear() === year) {
      weeks.push(getWeekData(currentMonday))
      currentMonday = addDays(currentMonday, 7)
    }
    
    return weeks
  }

  return {
    currentWeek,
    isLoading,
    goToPreviousWeek,
    goToNextWeek,
    goToWeek,
    formatWeekDisplay,
    getAllWeeksOfYear
  }
}
