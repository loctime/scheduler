"use client"

import { Button } from "@/components/ui/button"
import { Download, ChevronLeft, ChevronRight, Loader2, ExternalLink } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useMemo } from "react"
import { useCompanySlug } from "@/hooks/use-company-slug"
import { getMainMonth } from "@/lib/utils"

interface MonthHeaderProps {
  monthRange: { startDate: Date; endDate: Date }
  currentMonth: Date
  onPreviousMonth: () => void
  onNextMonth: () => void
  onExportPDF: () => void
  exporting: boolean
  user?: any
}

export function MonthHeader({
  monthRange,
  currentMonth,
  onPreviousMonth,
  onNextMonth,
  onExportPDF,
  exporting,
  user,
}: MonthHeaderProps) {
  const { companySlug, isLoading: slugLoading } = useCompanySlug()
  const mainMonth = useMemo(() => {
    return getMainMonth(monthRange.startDate, monthRange.endDate)
  }, [monthRange.startDate, monthRange.endDate])

  const handleOpenPwa = () => {
    if (!user?.uid) return
    
    // Usar companySlug si está disponible, sino mostrar mensaje de que debe publicar primero
    if (!slugLoading && companySlug) {
      const pwaUrl = `/pwa/horario/${companySlug}`
      window.open(pwaUrl, '_blank')
    } else {
      // Mostrar mensaje informativo si no hay companySlug
      alert('Para ver la versión PWA, primero publica el horario usando el botón "Publicar Horario"')
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
        <Button variant="outline" size="icon" onClick={onPreviousMonth} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 flex-1 sm:flex-initial min-w-0">
          <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground truncate">
            <span className="hidden sm:inline">
              {format(monthRange.startDate, "d 'de' MMMM", { locale: es })} -{" "}
              {format(monthRange.endDate, "d 'de' MMMM, yyyy", { locale: es })}
            </span>
            <span className="sm:hidden">
              {format(monthRange.startDate, "d MMM", { locale: es })} -{" "}
              {format(monthRange.endDate, "d MMM yyyy", { locale: es })}
            </span>
          </h2>
          <span className="text-sm sm:text-base md:text-lg lg:text-2xl font-semibold text-muted-foreground">
            {format(mainMonth, "MMMM", { locale: es }).toUpperCase()}
          </span>
        </div>
        <Button variant="outline" size="icon" onClick={onNextMonth} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 w-full sm:w-auto">
        {user?.uid && (
          <Button variant="outline" onClick={handleOpenPwa} aria-label="Abrir PWA de horarios" className="flex-1 sm:flex-initial">
            <ExternalLink className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Ver horario publicado</span>
            <span className="sm:hidden">PWA</span>
          </Button>
        )}
        <Button variant="outline" onClick={onExportPDF} disabled={exporting} aria-label="Exportar mes completo como PDF" className="flex-1 sm:flex-initial">
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">Exportando...</span>
              <span className="sm:hidden">Exportando</span>
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">PDF (Mes completo)</span>
              <span className="sm:hidden">PDF</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}





