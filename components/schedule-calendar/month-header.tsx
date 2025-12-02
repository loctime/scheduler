"use client"

import { Button } from "@/components/ui/button"
import { Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { format, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { useMemo } from "react"

interface MonthHeaderProps {
  monthRange: { startDate: Date; endDate: Date }
  currentMonth: Date
  onPreviousMonth: () => void
  onNextMonth: () => void
  onExportPDF: () => void
  exporting: boolean
}

/**
 * Determina el mes principal basándose en qué mes tiene más días en el rango
 */
function getMainMonth(startDate: Date, endDate: Date): Date {
  const monthDays: Map<string, number> = new Map()
  
  let currentDate = new Date(startDate)
  const end = new Date(endDate)
  
  // Contar días por mes
  while (currentDate <= end) {
    const monthKey = format(currentDate, "yyyy-MM")
    monthDays.set(monthKey, (monthDays.get(monthKey) || 0) + 1)
    currentDate = addDays(currentDate, 1)
  }
  
  // Encontrar el mes con más días
  let maxDays = 0
  let mainMonthKey = ""
  
  monthDays.forEach((days, monthKey) => {
    if (days > maxDays) {
      maxDays = days
      mainMonthKey = monthKey
    }
  })
  
  // Si hay empate (mismo número de días), preferir el mes que viene después (el segundo mes del rango)
  if (maxDays > 0) {
    // Obtener todas las claves de mes y encontrar los que tienen el máximo de días
    const allMonthKeys = Array.from(monthDays.keys()).sort()
    const candidatesWithMaxDays = allMonthKeys.filter(key => monthDays.get(key) === maxDays)
    
    // Si hay empate, usar el último mes (el que viene después)
    const selectedMonthKey = candidatesWithMaxDays.length > 1 
      ? candidatesWithMaxDays[candidatesWithMaxDays.length - 1]
      : mainMonthKey
    
    const [year, month] = selectedMonthKey.split("-").map(Number)
    return new Date(year, month - 1, 15) // Usar día 15 para evitar problemas con días de fin de mes
  }
  
  // Fallback: usar el mes de la fecha de fin
  return new Date(endDate)
}

export function MonthHeader({
  monthRange,
  currentMonth,
  onPreviousMonth,
  onNextMonth,
  onExportPDF,
  exporting,
}: MonthHeaderProps) {
  const mainMonth = useMemo(() => {
    return getMainMonth(monthRange.startDate, monthRange.endDate)
  }, [monthRange.startDate, monthRange.endDate])

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onPreviousMonth} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold text-foreground">
            {format(monthRange.startDate, "d 'de' MMMM", { locale: es })} -{" "}
            {format(monthRange.endDate, "d 'de' MMMM, yyyy", { locale: es })}
          </h2>
          <span className="text-2xl font-semibold text-muted-foreground">
            {format(mainMonth, "MMMM", { locale: es }).toUpperCase()}
          </span>
        </div>
        <Button variant="outline" size="icon" onClick={onNextMonth} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onExportPDF} disabled={exporting} aria-label="Exportar mes completo como PDF">
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              PDF (Mes completo)
            </>
          )}
        </Button>
      </div>
    </div>
  )
}





