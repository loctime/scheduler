"use client"

import { useState, useMemo } from "react"
import { addWeeks, startOfWeek, format, isSameWeek, isBefore, isAfter } from "date-fns"

interface WeekData {
  weekStartDate: string
  isPublished?: boolean
  publicImageUrl?: string
  publicImageUpdatedAt?: any
}

interface UseWeekNavigationReturn {
  currentWeek: Date
  selectedWeek: Date
  weekData: WeekData | null
  weekType: "past" | "current" | "future"
  goToPreviousWeek: () => void
  goToNextWeek: () => void
  goToCurrentWeek: () => void
  weekLabel: string
  canGoToPrevious: boolean
  canGoToNext: boolean
}

export function useWeekNavigation(
  initialWeekData?: WeekData | null
): UseWeekNavigationReturn {
  const [selectedWeek, setSelectedWeek] = useState<Date>(() => {
    // Si hay datos iniciales, usar esa semana, si no la semana actual
    if (initialWeekData?.weekStartDate) {
      return new Date(initialWeekData.weekStartDate)
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 }) // Lunes como inicio
  })

  const currentWeek = useMemo(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 }), 
    []
  )

  const weekType = useMemo(() => {
    if (isBefore(selectedWeek, currentWeek)) return "past"
    if (isSameWeek(selectedWeek, currentWeek)) return "current"
    return "future"
  }, [selectedWeek, currentWeek])

  const weekLabel = useMemo(() => {
    const weekEnd = addWeeks(selectedWeek, 1)
    const startStr = format(selectedWeek, "d 'de' MMMM", { locale: es })
    const endStr = format(weekEnd, "d 'de' MMMM, yyyy", { locale: es })
    return `${startStr} – ${endStr}`
  }, [selectedWeek])

  const goToPreviousWeek = () => {
    setSelectedWeek(prev => addWeeks(prev, -1))
  }

  const goToNextWeek = () => {
    setSelectedWeek(prev => addWeeks(prev, 1))
  }

  const goToCurrentWeek = () => {
    setSelectedWeek(currentWeek)
  }

  // Limitar navegación (opcional)
  const canGoToPrevious = true // Permitir ir a semanas pasadas
  const canGoToNext = true // Permitir ir a semanas futuras

  return {
    currentWeek,
    selectedWeek,
    weekData: initialWeekData || null,
    weekType,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    weekLabel,
    canGoToPrevious,
    canGoToNext,
  }
}

// Configuración de locale para date-fns
import { es } from "date-fns/locale"
