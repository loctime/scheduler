"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"

interface WeekNavigationProps {
  weekLabel: string
  weekType: "past" | "current" | "future"
  canGoToPrevious: boolean
  canGoToNext: boolean
  onPreviousWeek: () => void
  onNextWeek: () => void
  onCurrentWeek: () => void
  isCurrentWeek?: boolean
}

export function WeekNavigation({
  weekLabel,
  weekType,
  canGoToPrevious,
  canGoToNext,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  isCurrentWeek = false
}: WeekNavigationProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <Button
        variant="outline"
        size="sm"
        onClick={onPreviousWeek}
        disabled={!canGoToPrevious}
      >
        <ChevronLeft className="h-4 w-4" />
        Semana anterior
      </Button>

      <div className="text-center">
        <div className="font-medium text-lg">{weekLabel}</div>
        {weekType === "current" && (
          <div className="text-sm text-blue-600 font-medium">Semana actual</div>
        )}
        {weekType === "past" && (
          <div className="text-sm text-gray-500">Semana pasada</div>
        )}
        {weekType === "future" && (
          <div className="text-sm text-amber-600 font-medium">Semana futura</div>
        )}
      </div>

      <div className="flex gap-2">
        {!isCurrentWeek && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCurrentWeek}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Hoy
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onNextWeek}
          disabled={!canGoToNext}
        >
          Semana siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
