import { useState, useEffect } from "react"
import { addWeeks, subWeeks, format, startOfWeek, addDays, getWeek } from "date-fns"
import { es } from "date-fns/locale"

export interface PublicWeekData {
  weekId: string
  startDate: string
  endDate: string
  weekNumber: number
  year: number
  month: number
}

export interface UsePublicWeekNavigationReturn {
  currentWeek: PublicWeekData | null
  isLoading: boolean
  goToPreviousWeek: () => void
  goToNextWeek: () => void
  formatWeekDisplay: () => string
  formatWeekRange: () => string
}

export function usePublicWeekNavigation(publishedWeekId: string): UsePublicWeekNavigationReturn {
  const [currentWeek, setCurrentWeek] = useState<PublicWeekData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Parse weekId to get initial date
  const parseWeekId = (weekId: string): Date | null => {
    try {
      const [monthYear, weekNum] = weekId.split('-W')
      const [month, year] = monthYear.split('/')
      
      if (!month || !year || !weekNum) return null
      
      // Find first week of the month
      const firstDayOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1)
      const firstMonday = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 })
      
      // Add week number - 1 weeks to get to the target week
      const targetWeek = addWeeks(firstMonday, parseInt(weekNum) - 1)
      
      return targetWeek
    } catch (error) {
      console.error("Error parsing weekId:", error)
      return null
    }
  }

  useEffect(() => {
    if (!publishedWeekId) {
      setIsLoading(false)
      return
    }

    const weekStart = parseWeekId(publishedWeekId)
    if (!weekStart) {
      setIsLoading(false)
      return
    }

    const weekEnd = addDays(weekStart, 6)
    const weekData: PublicWeekData = {
      weekId: publishedWeekId,
      startDate: format(weekStart, "dd/MM/yyyy", { locale: es }),
      endDate: format(weekEnd, "dd/MM/yyyy", { locale: es }),
      weekNumber: getWeek(weekStart, { weekStartsOn: 1, locale: es }),
      year: weekStart.getFullYear(),
      month: weekStart.getMonth()
    }

    setCurrentWeek(weekData)
    setIsLoading(false)
  }, [publishedWeekId])

  const goToPreviousWeek = () => {
    if (!currentWeek) return
    
    const weekStart = parseWeekId(currentWeek.weekId)
    if (!weekStart) return
    
    const prevWeekStart = subWeeks(weekStart, 1)
    const weekNumber = getWeek(prevWeekStart, { weekStartsOn: 1, locale: es })
    const prevWeekId = `${format(prevWeekStart, "MM/yyyy", { locale: es })}-W${weekNumber}`
    
    const weekEnd = addDays(prevWeekStart, 6)
    setCurrentWeek({
      weekId: prevWeekId,
      startDate: format(prevWeekStart, "dd/MM/yyyy", { locale: es }),
      endDate: format(weekEnd, "dd/MM/yyyy", { locale: es }),
      weekNumber,
      year: prevWeekStart.getFullYear(),
      month: prevWeekStart.getMonth()
    })
  }

  const goToNextWeek = () => {
    if (!currentWeek) return
    
    const weekStart = parseWeekId(currentWeek.weekId)
    if (!weekStart) return
    
    const nextWeekStart = addWeeks(weekStart, 1)
    const weekNumber = getWeek(nextWeekStart, { weekStartsOn: 1, locale: es })
    const nextWeekId = `${format(nextWeekStart, "MM/yyyy", { locale: es })}-W${weekNumber}`
    
    const weekEnd = addDays(nextWeekStart, 6)
    setCurrentWeek({
      weekId: nextWeekId,
      startDate: format(nextWeekStart, "dd/MM/yyyy", { locale: es }),
      endDate: format(weekEnd, "dd/MM/yyyy", { locale: es }),
      weekNumber,
      year: nextWeekStart.getFullYear(),
      month: nextWeekStart.getMonth()
    })
  }

  const formatWeekDisplay = () => {
    if (!currentWeek) return ""
    return `Semana ${currentWeek.weekNumber} de ${format(new Date(currentWeek.year, currentWeek.month), "MMMM", { locale: es })}`
  }

  const formatWeekRange = () => {
    if (!currentWeek) return ""
    return `${currentWeek.startDate} - ${currentWeek.endDate}`
  }

  return {
    currentWeek,
    isLoading,
    goToPreviousWeek,
    goToNextWeek,
    formatWeekDisplay,
    formatWeekRange
  }
}
