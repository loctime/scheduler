"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Copy, Trash2, CheckCircle2, Circle, Download } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { UseWeekActionsReturn } from "@/hooks/use-week-actions"

interface WeekScheduleActionsProps {
  readonly: boolean
  canShowExportActions: boolean
  exporting: boolean
  isCompleted: boolean
  isMarkingComplete: boolean
  user?: any
  getWeekSchedule?: (weekStartDate: Date) => any
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: any[], options?: { scheduleId?: string }) => void
  onMarkComplete?: () => void
  onExportImage?: () => void
  onExportPDF?: () => void
  onExportExcel?: () => void
  weekActions: UseWeekActionsReturn
}

export function WeekScheduleActions({
  readonly,
  canShowExportActions,
  exporting,
  isCompleted,
  isMarkingComplete,
  user,
  getWeekSchedule,
  onAssignmentUpdate,
  onMarkComplete,
  onExportImage,
  onExportPDF,
  onExportExcel,
  weekActions,
}: WeekScheduleActionsProps) {
  const [confirmCopyDialogOpen, setConfirmCopyDialogOpen] = useState(false)
  const [confirmClearDialogOpen, setConfirmClearDialogOpen] = useState(false)

  const handleCopyPreviousWeek = useCallback(async () => {
    try {
      await weekActions.handleCopyPreviousWeek()
    } catch (error: any) {
      if (error.message === "NEEDS_CONFIRMATION") {
        setConfirmCopyDialogOpen(true)
      }
    }
  }, [weekActions])

  const handleClearWeek = useCallback(async () => {
    try {
      await weekActions.handleClearWeek()
    } catch (error: any) {
      if (error.message === "NEEDS_CONFIRMATION") {
        setConfirmClearDialogOpen(true)
      }
    }
  }, [weekActions])

  const handleConfirmCopy = useCallback(async () => {
    setConfirmCopyDialogOpen(false)
    await weekActions.executeCopyPreviousWeek()
  }, [weekActions])

  const handleConfirmClear = useCallback(async () => {
    setConfirmClearDialogOpen(false)
    await weekActions.executeClearWeek()
  }, [weekActions])


  return (
    <>
      <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
        {!readonly && getWeekSchedule && onAssignmentUpdate && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyPreviousWeek}
            disabled={weekActions.isCopying || exporting || weekActions.isClearing}
            aria-label="Copiar semana anterior"
          >
            {weekActions.isCopying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Copiando...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copiar semana anterior
              </>
            )}
          </Button>
        )}
        {!readonly && onAssignmentUpdate && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearWeek}
            disabled={weekActions.isClearing || exporting || weekActions.isCopying}
            aria-label="Limpiar semana"
          >
            {weekActions.isClearing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Limpiando...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Limpiar semana
              </>
            )}
          </Button>
        )}
        {!readonly && user && onMarkComplete && (
          <Button
            variant={isCompleted ? "default" : "outline"}
            size="sm"
            onClick={onMarkComplete}
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
        {canShowExportActions && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportImage}
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
              onClick={onExportPDF}
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

      {/* Diálogos de confirmación para semanas completadas */}
      <AlertDialog open={confirmCopyDialogOpen} onOpenChange={setConfirmCopyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar copia de semana anterior?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta semana está marcada como completada. Al copiar la semana anterior, se modificarán las asignaciones actuales.
              ¿Estás seguro de que deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCopy}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClearDialogOpen} onOpenChange={setConfirmClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar limpieza de semana?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta semana está marcada como completada. Al limpiar la semana, se eliminarán todas las asignaciones.
              ¿Estás seguro de que deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClear}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  )
}

