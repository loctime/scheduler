"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Copy, Trash2, CheckCircle2, Circle, Download, ChevronDown, Upload, Clipboard } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { WeekActionsReturn } from "@/hooks/use-week-actions"
import type { Horario } from "@/lib/types"

interface WeekScheduleActionsProps {
  readonly: boolean
  canShowExportActions: boolean
  exporting: boolean
  isCompleted: boolean
  isMarkingComplete: boolean
  user?: any
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: any[], options?: { scheduleId?: string }) => void
  onMarkComplete?: () => void
  onExportImage?: () => void
  onExportPDF?: () => void
  onExportExcel?: () => void
  weekActions: WeekActionsReturn
  onPublishSchedule?: () => Promise<void> | void
  isPublishingSchedule?: boolean
  copiedWeekData?: {
    assignments: Horario["assignments"]
    dayStatus: Horario["dayStatus"]
    weekStartDate: string
    copiedAt: string
  } | null
  onCopyCurrentWeek?: (weekStartDate: Date) => void
  onPasteCopiedWeek?: (targetWeekStartDate: Date) => Promise<void>
  weekStartDate: Date
  isPastingWeek?: boolean
}

export function WeekScheduleActions({
  readonly,
  canShowExportActions,
  exporting,
  isCompleted,
  isMarkingComplete,
  user,
  onAssignmentUpdate,
  onMarkComplete,
  onExportImage,
  onExportPDF,
  onExportExcel,
  weekActions,
  onPublishSchedule,
  isPublishingSchedule = false,
  copiedWeekData,
  onCopyCurrentWeek,
  onPasteCopiedWeek,
  weekStartDate,
  isPastingWeek = false,
}: WeekScheduleActionsProps) {
  const [confirmClearDialogOpen, setConfirmClearDialogOpen] = useState(false)
  const [confirmPasteDialogOpen, setConfirmPasteDialogOpen] = useState(false)

  const handleClearWeek = useCallback(async () => {
    try {
      await weekActions.handleClearWeek()
    } catch (error: any) {
      if (error.message === "NEEDS_CONFIRMATION") {
        setConfirmClearDialogOpen(true)
      }
    }
  }, [weekActions])

  const handleConfirmClear = useCallback(async () => {
    setConfirmClearDialogOpen(false)
    await weekActions.executeClearWeek()
  }, [weekActions])

  const handleCopyCurrentWeek = useCallback(() => {
    if (onCopyCurrentWeek) {
      onCopyCurrentWeek(weekStartDate)
    }
  }, [onCopyCurrentWeek, weekStartDate])

  const handlePasteCopiedWeek = useCallback(async () => {
    if (onPasteCopiedWeek) {
      await onPasteCopiedWeek(weekStartDate)
    }
  }, [onPasteCopiedWeek, weekStartDate])

  const handleConfirmPaste = useCallback(async () => {
    setConfirmPasteDialogOpen(false)
    await handlePasteCopiedWeek()
  }, [handlePasteCopiedWeek])

  const handlePublishSchedule = useCallback(() => {
    if (onPublishSchedule) {
      onPublishSchedule()
    }
  }, [onPublishSchedule])


  return (
    <>
      <div className="flex flex-wrap gap-1 sm:gap-2 ml-2 sm:ml-4" onClick={(e) => e.stopPropagation()}>
        {!readonly && onAssignmentUpdate && onCopyCurrentWeek && onPasteCopiedWeek && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCurrentWeek}
              disabled={exporting || weekActions.isClearing || isPastingWeek}
              aria-label="Copiar semana"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmPasteDialogOpen(true)}
              disabled={!copiedWeekData || exporting || weekActions.isClearing || isPastingWeek}
              aria-label="Pegar semana"
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Pegar
            </Button>
          </>
        )}
        {!readonly && onAssignmentUpdate && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearWeek}
            disabled={weekActions.isClearing || exporting || isPastingWeek}
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
                    LISTO
                  </>
                ) : (
                  <>
                    <Circle className="mr-2 h-4 w-4" />
                    LISTO
                  </>
                )}
              </>
            )}
          </Button>
        )}
        {canShowExportActions && (
          <div className="flex items-center border rounded-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportImage}
              disabled={exporting}
              aria-label="Exportar semana como imagen"
              className="rounded-none border-0 border-r"
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exporting}
                  className="rounded-none border-0 px-2"
                  aria-label="Más opciones de exportación"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onExportExcel && (
                  <DropdownMenuItem
                    onClick={onExportExcel}
                    disabled={exporting}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Excel
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={onExportPDF}
                  disabled={exporting}
                >
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {onPublishSchedule && (
          <Button
            variant="default"
            size="sm"
            onClick={handlePublishSchedule}
            disabled={isPublishingSchedule || exporting || weekActions.isClearing || isPastingWeek}
            aria-label="Publicar horario"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isPublishingSchedule ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publicando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Publicar horario
              </>
            )}
          </Button>
        )}

      </div>

      {/* Diálogos de confirmación para semanas completadas */}
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

      <AlertDialog open={confirmPasteDialogOpen} onOpenChange={setConfirmPasteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar pegado de semana?</AlertDialogTitle>
            <AlertDialogDescription>
              Al pegar la semana copiada, se reemplazarán las asignaciones actuales de esta semana.
              {copiedWeekData && (
                <span className="block mt-2 text-sm">
                  Semana a pegar: {new Date(copiedWeekData.weekStartDate).toLocaleDateString("es-AR")}
                </span>
              )}
              ¿Estás seguro de que deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPaste} disabled={isPastingWeek}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  )
}
