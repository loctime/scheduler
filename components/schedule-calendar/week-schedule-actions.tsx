"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Copy, Trash2, CheckCircle2, Circle, Download, Sparkles, ChevronDown, Clipboard, Smartphone, Upload } from "lucide-react"
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
import { format } from "date-fns"
import { es } from "date-fns/locale"

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
  weekActions: WeekActionsReturn
  copiedWeekData?: any
  onCopyCurrentWeek?: (weekStartDate: Date) => void
  onPasteCopiedWeek?: (targetWeekStartDate: Date) => Promise<void>
  weekStartDate: Date
  onPublishSchedule?: () => Promise<void> | void
  isPublishingSchedule?: boolean
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
  copiedWeekData,
  onCopyCurrentWeek,
  onPasteCopiedWeek,
  weekStartDate,
  onPublishSchedule,
  isPublishingSchedule = false,
}: WeekScheduleActionsProps) {
  const [confirmCopyDialogOpen, setConfirmCopyDialogOpen] = useState(false)
  const [confirmClearDialogOpen, setConfirmClearDialogOpen] = useState(false)
  const [confirmSuggestDialogOpen, setConfirmSuggestDialogOpen] = useState(false)
  const [confirmPasteDialogOpen, setConfirmPasteDialogOpen] = useState(false)

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

  const handleSuggestSchedules = useCallback(async () => {
    try {
      await weekActions.handleSuggestSchedules()
    } catch (error: any) {
      if (error.message === "NEEDS_CONFIRMATION") {
        setConfirmSuggestDialogOpen(true)
      }
    }
  }, [weekActions])

  const handleConfirmSuggest = useCallback(async () => {
    setConfirmSuggestDialogOpen(false)
    await weekActions.executeSuggestSchedules()
  }, [weekActions])

  const handleCopyCurrentWeek = useCallback(() => {
    if (onCopyCurrentWeek) {
      onCopyCurrentWeek(weekStartDate)
    }
  }, [onCopyCurrentWeek, weekStartDate])

  const handlePasteCopiedWeek = useCallback(async () => {
    if (onPasteCopiedWeek && copiedWeekData) {
      // Usar la función atómica de weekActions si está disponible
      if (weekActions.executeReplaceWeekAssignments) {
        try {
          await weekActions.executeReplaceWeekAssignments(weekStartDate, copiedWeekData)
        } catch (error: any) {
          if (error.message === "NEEDS_CONFIRMATION") {
            // Si necesita confirmación, mostrar diálogo
            setConfirmPasteDialogOpen(true)
          } else {
            throw error
          }
        }
      } else {
        // Fallback al método original
        await onPasteCopiedWeek(weekStartDate)
      }
    }
  }, [onPasteCopiedWeek, copiedWeekData, weekActions, weekStartDate])

  const handleConfirmPaste = useCallback(async () => {
    setConfirmPasteDialogOpen(false)
    if (copiedWeekData && weekActions.executeReplaceWeekAssignments) {
      await weekActions.executeReplaceWeekAssignments(weekStartDate, copiedWeekData)
    }
  }, [copiedWeekData, weekActions, weekStartDate])

  const handlePublishSchedule = useCallback(() => {
    if (onPublishSchedule) {
      onPublishSchedule()
    }
  }, [onPublishSchedule])


  return (
    <>
      <div className="flex flex-wrap gap-1 sm:gap-2 ml-2 sm:ml-4" onClick={(e) => e.stopPropagation()}>
        {!readonly && getWeekSchedule && onAssignmentUpdate && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCurrentWeek}
              disabled={exporting || weekActions.isCopying || weekActions.isClearing || weekActions.isSuggesting || weekActions.isPasting}
              aria-label="Copiar semana actual"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmPasteDialogOpen(true)}
              disabled={!copiedWeekData || exporting || weekActions.isCopying || weekActions.isClearing || weekActions.isSuggesting || weekActions.isPasting}
              aria-label="Pegar semana copiada"
            >
              {weekActions.isPasting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pegando...
                </>
              ) : (
                <>
                  <Clipboard className="mr-2 h-4 w-4" />
                  Pegar
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSuggestSchedules}
              disabled={weekActions.isSuggesting || exporting || weekActions.isCopying || weekActions.isClearing || weekActions.isPasting}
              aria-label="Aplicar horarios fijos"
            >
              {weekActions.isSuggesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Aplicar Fijos
                </>
              )}
            </Button>
          </>
        )}
        {!readonly && onAssignmentUpdate && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearWeek}
            disabled={weekActions.isClearing || exporting || weekActions.isCopying || weekActions.isSuggesting || weekActions.isPasting}
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
            disabled={isPublishingSchedule || exporting || weekActions.isCopying || weekActions.isClearing || weekActions.isSuggesting || weekActions.isPasting}
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

        {/* Menú secundario para acciones técnicas */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Más acciones"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleCopyPreviousWeek}
              disabled={weekActions.isCopying || exporting || weekActions.isClearing || weekActions.isSuggesting || weekActions.isPasting}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar semana anterior
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmClearDialogOpen(true)}
              disabled={weekActions.isClearing || exporting || weekActions.isCopying || weekActions.isSuggesting || weekActions.isPasting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpiar semana
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

      <AlertDialog open={confirmSuggestDialogOpen} onOpenChange={setConfirmSuggestDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar aplicación de sugerencias?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta semana está marcada como completada. Al aplicar las sugerencias, se modificarán las asignaciones actuales.
              ¿Estás seguro de que deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSuggest}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmPasteDialogOpen} onOpenChange={setConfirmPasteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar pegado de semana?</AlertDialogTitle>
            <AlertDialogDescription>
              Al pegar la semana copiada, se reemplazarán todas las asignaciones actuales de esta semana.
              {copiedWeekData && (
                <span className="block mt-2 text-sm">
                  Semana a pegar: {format(new Date(copiedWeekData.weekStartDate), "d 'de' MMMM, yyyy", { locale: es })}
                </span>
              )}
              ¿Estás seguro de que deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPaste}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  )
}
