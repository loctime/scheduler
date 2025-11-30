"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2, ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ScheduleGrid, type EmployeeMonthlyStats } from "@/components/schedule-grid"
import { Empleado, Turno, Horario, MedioTurno } from "@/lib/types"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"

interface WeekScheduleProps {
  weekDays: Date[]
  weekIndex: number
  weekSchedule: Horario | null
  employees: Empleado[]
  shifts: Turno[]
  monthRange: { startDate: Date; endDate: Date }
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: any[], options?: { scheduleId?: string }) => void
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
  user?: any
  onMarkComplete?: (weekStartDate: Date, completed: boolean) => Promise<void>
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
  user,
  onMarkComplete,
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
  const isCompleted = weekSchedule?.completada === true
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)

  // Si no se proporciona open/onOpenChange, usar estado interno
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open !== undefined ? open : internalOpen
  const handleOpenChange = onOpenChange || setInternalOpen

  const handleMarkComplete = async () => {
    if (!onMarkComplete) return
    setIsMarkingComplete(true)
    try {
      await onMarkComplete(weekStartDate, !isCompleted)
    } catch (error) {
      console.error("Error al marcar semana como completada:", error)
    } finally {
      setIsMarkingComplete(false)
    }
  }

  // Handler para eliminar empleado de esta semana
  const handleRemoveEmployeeFromWeek = useCallback(async (employeeId: string) => {
    if (!onAssignmentUpdate || !weekSchedule) return
    
    // Verificar que la semana no esté completada
    if (weekSchedule.completada === true) {
      return
    }
    
    // Eliminar todas las asignaciones del empleado en esta semana
    // Esperar a que todas las actualizaciones se completen
    const updatePromises = weekDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd")
      return onAssignmentUpdate(dateStr, employeeId, [], { scheduleId: weekSchedule.id })
    })
    
    await Promise.all(updatePromises)
  }, [onAssignmentUpdate, weekSchedule, weekDays])

  // Handler para exportar que abre la semana si está cerrada
  const handleExportImage = async () => {
    if (!isOpen && handleOpenChange) {
      // Abrir la semana primero
      handleOpenChange(true)
      // Esperar a que la animación termine (300ms según la duración de la animación)
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    onExportImage?.(weekStartDate, weekEndDate)
  }

  const handleExportPDF = async () => {
    if (!isOpen && handleOpenChange) {
      // Abrir la semana primero
      handleOpenChange(true)
      // Esperar a que la animación termine
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    onExportPDF?.(weekStartDate, weekEndDate)
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className="space-y-2"
    >
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm transition-colors">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="h-auto p-0 hover:bg-accent/50 flex-1 justify-start text-left bg-transparent border-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
            aria-label={isOpen ? "Contraer semana" : "Expandir semana"}
          >
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
              )}
              <h3 className="text-2xl font-semibold text-foreground">{headerTitle}</h3>
              {isCompleted && (
                <Badge variant="default" className="ml-2 bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completada
                </Badge>
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
          {!readonly && user && onMarkComplete && (
            <Button
              variant={isCompleted ? "default" : "outline"}
              size="sm"
              onClick={handleMarkComplete}
              disabled={isMarkingComplete}
              aria-label={isCompleted ? "Desmarcar semana como completada" : "Marcar semana como completada"}
              className={isCompleted ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {isMarkingComplete ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isCompleted ? "Desmarcando..." : "Marcando..."}
                </>
              ) : (
                <>
                  {isCompleted ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Listo
                    </>
                  ) : (
                    <>
                      <Circle className="mr-2 h-4 w-4" />
                      Marcar como listo
                    </>
                  )}
                </>
              )}
            </Button>
          )}
          {canShowActions && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportImage}
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
                onClick={handleExportPDF}
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
            </>
          )}
        </div>
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
            isScheduleCompleted={isCompleted}
            onRemoveEmployeeFromWeek={handleRemoveEmployeeFromWeek}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

