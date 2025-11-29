"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ScheduleGrid, type EmployeeMonthlyStats } from "@/components/schedule-grid"
import { Empleado, Turno, Horario, MedioTurno } from "@/lib/types"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface WeekScheduleProps {
  weekDays: Date[]
  weekIndex: number
  weekSchedule: Horario | null
  employees: Empleado[]
  shifts: Turno[]
  monthRange: { startDate: Date; endDate: Date }
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: any[]) => void
  onExportImage?: (weekStartDate: Date, weekEndDate: Date) => void
  onExportPDF?: (weekStartDate: Date, weekEndDate: Date) => void
  onExportExcel?: () => void
  exporting: boolean
  mediosTurnos?: MedioTurno[]
  employeeStats?: Record<string, EmployeeMonthlyStats>
  readonly?: boolean
  showActions?: boolean
  title?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function WeekSchedule({
  weekDays,
  weekIndex,
  weekSchedule,
  employees,
  shifts,
  monthRange,
  onAssignmentUpdate,
  onExportImage,
  onExportPDF,
  onExportExcel,
  exporting,
  mediosTurnos = [],
  employeeStats,
  readonly = false,
  showActions = true,
  title,
  open,
  onOpenChange,
}: WeekScheduleProps) {
  const weekStartDate = weekDays[0]
  const weekEndDate = weekDays[weekDays.length - 1]
  const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
  const headerTitle =
    title ||
    `Semana del ${format(weekDays[0], "d", { locale: es })} - ${format(
      weekDays[weekDays.length - 1],
      "d 'de' MMMM",
      { locale: es },
    )}`
  const hasExportHandlers = Boolean(onExportImage && onExportPDF)
  const canShowActions = showActions && hasExportHandlers

  // Si no se proporciona open/onOpenChange, usar estado interno
  const [internalOpen, setInternalOpen] = useState(true)
  const isOpen = open !== undefined ? open : internalOpen
  const handleOpenChange = onOpenChange || setInternalOpen

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className="space-y-2"
    >
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm hover:bg-accent/50 transition-colors">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto p-0 hover:bg-transparent flex-1 justify-start"
            aria-label={isOpen ? "Contraer semana" : "Expandir semana"}
          >
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
              )}
              <h3 className="text-2xl font-semibold text-foreground">{headerTitle}</h3>
            </div>
          </Button>
        </CollapsibleTrigger>
        {canShowActions && (
          <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExportImage?.(weekStartDate, weekEndDate)}
              disabled={exporting}
              aria-label="Exportar semana como imagen"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Imagen
                </>
              )}
            </Button>
            {onExportExcel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportExcel}
                disabled={exporting}
                aria-label="Exportar semana como Excel"
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Excel
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExportPDF?.(weekStartDate, weekEndDate)}
              disabled={exporting}
              aria-label="Exportar semana como PDF"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      <CollapsibleContent 
        id={weekId} 
        className="overflow-hidden transition-all duration-300 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      >
        <div className="pt-2">
          <ScheduleGrid
            weekDays={weekDays}
            employees={employees}
            shifts={shifts}
            schedule={weekSchedule}
            onAssignmentUpdate={onAssignmentUpdate}
            monthRange={monthRange}
            mediosTurnos={mediosTurnos}
            employeeStats={employeeStats}
            readonly={readonly}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

