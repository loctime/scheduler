"use client"

import { Button } from "@/components/ui/button"
import { Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface MonthHeaderProps {
  monthRange: { startDate: Date; endDate: Date }
  onPreviousMonth: () => void
  onNextMonth: () => void
  onExportImage: () => void
  onExportPDF: () => void
  exporting: boolean
}

export function MonthHeader({
  monthRange,
  onPreviousMonth,
  onNextMonth,
  onExportImage,
  onExportPDF,
  exporting,
}: MonthHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onPreviousMonth} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-3xl font-bold text-foreground">
          {format(monthRange.startDate, "d 'de' MMMM", { locale: es })} -{" "}
          {format(monthRange.endDate, "d 'de' MMMM, yyyy", { locale: es })}
        </h2>
        <Button variant="outline" size="icon" onClick={onNextMonth} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onExportImage} disabled={exporting} aria-label="Exportar mes completo como imagen">
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Imagen (Mes completo)
            </>
          )}
        </Button>
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


