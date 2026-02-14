"use client"

import { useState, useCallback, forwardRef } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ScheduleGrid, type EmployeeMonthlyStats } from "@/components/schedule-grid"
import { Empleado, Turno, Horario, MedioTurno, ShiftAssignment } from "@/lib/types"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
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
import { useWeekActions } from "@/hooks/use-week-actions"
import { WeekScheduleHeader } from "./week-schedule-header"
import { WeekScheduleActions } from "./week-schedule-actions"
import { SchedulingWarnings } from "@/components/calendar/scheduling-warnings"
import { isScheduleCompleted, shouldRequestConfirmation } from "@/lib/schedule-utils"
import { logger } from "@/lib/logger"

interface WeekScheduleProps {
  weekDays: Date[]
  weekIndex: number
  weekSchedule: Horario | null
  employees: Empleado[]
  allEmployees: Empleado[]
  shifts: Turno[]
  monthRange: { start: Date; end: Date }
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: ShiftAssignment[], options?: { scheduleId?: string }) => void
  onExportImage?: (weekStartDate: Date, weekEndDate: Date) => void
  onExportPDF?: (weekStartDate: Date, weekEndDate: Date) => void
  onExportExcel?: (weekStartDate: Date, weekEndDate: Date) => void
  onExportEmployeeImage?: (employeeId: string, weekStartDate: Date, weekEndDate: Date) => void
  exporting?: boolean
  mediosTurnos?: MedioTurno[]
  employeeStats?: EmployeeMonthlyStats[]
  readonly?: boolean
  showActions?: boolean
  title?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  user?: any
  onMarkComplete?: (weekId: string) => void
  lastCompletedWeekStart?: Date | null
  getWeekSchedule?: (weekStartDate: Date) => Horario | null
  allSchedules?: Horario[]
  onPublishSchedule?: (weekStartDate: Date, weekEndDate: Date) => Promise<void> | void
  isPublishingSchedule?: boolean
  copiedWeekData?: {
    assignments: Horario["assignments"]
    dayStatus: Horario["dayStatus"]
    weekStartDate: string
    copiedAt: string
  } | null
  onCopyCurrentWeek?: (weekStartDate: Date) => void
  onPasteCopiedWeek?: (targetWeekStartDate: Date) => Promise<void>
  isPastingWeek?: boolean
  /** En móvil mostrar solo vista individual (sin Grilla completa). Usado en vista mensual. */
  mobileIndividualOnly?: boolean
}

export const WeekSchedule = forwardRef<HTMLDivElement, WeekScheduleProps>(({
  weekDays,
  weekIndex,
  weekSchedule,
  employees,
  allEmployees,
  shifts,
  monthRange,
  onAssignmentUpdate,
  onExportImage,
  onExportPDF,
  onExportExcel,
  onExportEmployeeImage,
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
  lastCompletedWeekStart,
  getWeekSchedule,
  allSchedules = [],
  onPublishSchedule,
  isPublishingSchedule = false,
  copiedWeekData,
  onCopyCurrentWeek,
  onPasteCopiedWeek,
  isPastingWeek = false,
  mobileIndividualOnly = false,
}, ref) => {
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
  const isCompleted = isScheduleCompleted(weekSchedule)
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)
  const [confirmClearRowDialogOpen, setConfirmClearRowDialogOpen] = useState(false)
  const [pendingClearRowEmployeeId, setPendingClearRowEmployeeId] = useState<string | null>(null)
  const [confirmEditDialogOpen, setConfirmEditDialogOpen] = useState(false)
  const [pendingEditAction, setPendingEditAction] = useState<{
    type: 'assignment' | 'clear'
    data?: any
  } | null>(null)

  // Si no se proporciona open/onOpenChange, usar estado interno
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open !== undefined ? open : internalOpen
  const handleOpenChange = onOpenChange || setInternalOpen

  // Hook para acciones de semana
  const weekActions = useWeekActions({
    weekDays,
    weekStartDate,
    weekSchedule,
    employees,
    user: user || null,
    readonly,
    getWeekSchedule,
  })

  const handleMarkComplete = useCallback(async () => {
    if (!onMarkComplete) return
    
    // Marcar directamente como completada sin mostrar advertencias
    setIsMarkingComplete(true)
    try {
      await onMarkComplete(weekId)
    } catch (error) {
      logger.error("Error al marcar semana como completada:", error)
    } finally {
      setIsMarkingComplete(false)
    }
  }, [onMarkComplete, weekId])

  // Handler para cuando se intenta editar una semana completada
  const handleEditAttempt = useCallback((action: { type: 'assignment' | 'clear', data?: any }) => {
    if (isCompleted) {
      setPendingEditAction(action)
      setConfirmEditDialogOpen(true)
      return false // Bloquear la acción
    }
    return true // Permitir la acción
  }, [isCompleted])

  // Handler para confirmar edición de semana completada
  const handleConfirmEdit = useCallback(async () => {
    if (!pendingEditAction || !onMarkComplete) return
    
    setConfirmEditDialogOpen(false)
    
    try {
      // Primero desmarcar como completada
      await onMarkComplete(weekId)
      
      // Luego ejecutar la acción pendiente si existe
      if (pendingEditAction.type === 'clear' && pendingEditAction.data?.employeeId) {
        await weekActions.executeClearEmployeeRow(pendingEditAction.data.employeeId)
      }
      // Las acciones de assignment se manejarán en el componente correspondiente
    } catch (error) {
      logger.error("Error al desmarcar semana como completada:", error)
    } finally {
      setPendingEditAction(null)
    }
  }, [pendingEditAction, onMarkComplete, weekId, weekActions])

  // Handler para cancelar edición
  const handleCancelEdit = useCallback(() => {
    setConfirmEditDialogOpen(false)
    setPendingEditAction(null)
  }, [])

  // Handler para exportar que abre la semana si está cerrada
  const handleExportImage = useCallback(async () => {
    if (!isOpen && handleOpenChange) {
      handleOpenChange(true)
      // Esperar a que termine la animación (300ms) + tiempo adicional para renderizado completo
      await new Promise((resolve) => setTimeout(resolve, 600))
      // Esperar múltiples frames para asegurar que todos los estilos se hayan aplicado
      await new Promise((resolve) => requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve)
        })
      }))
    }
    onExportImage?.(weekStartDate, weekEndDate)
  }, [isOpen, handleOpenChange, onExportImage, weekStartDate, weekEndDate])

  const handleExportPDF = useCallback(async () => {
    if (!isOpen && handleOpenChange) {
      handleOpenChange(true)
      // Esperar a que termine la animación (300ms) + tiempo adicional para renderizado completo
      await new Promise((resolve) => setTimeout(resolve, 600))
      // Esperar múltiples frames para asegurar que todos los estilos se hayan aplicado
      await new Promise((resolve) => requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve)
        })
      }))
    }
    onExportPDF?.(weekStartDate, weekEndDate)
  }, [isOpen, handleOpenChange, onExportPDF, weekStartDate, weekEndDate])

  // Handler para limpiar fila de empleado que maneja confirmaciones
  const handleClearEmployeeRow = useCallback(
    async (employeeId: string): Promise<boolean> => {
      // Verificar si es una semana completada
      if (!handleEditAttempt({ type: 'clear', data: { employeeId } })) {
        return false
      }
      
      // Si no está completada, proceder con la lógica normal
      if (shouldRequestConfirmation(weekSchedule, "clear")) {
        setPendingClearRowEmployeeId(employeeId)
        setConfirmClearRowDialogOpen(true)
        return false
      }
      return await weekActions.executeClearEmployeeRow(employeeId)
    },
    [weekSchedule, weekActions, handleEditAttempt]
  )

  const handleConfirmClearRow = useCallback(async () => {
    const employeeId = pendingClearRowEmployeeId
    setConfirmClearRowDialogOpen(false)
    setPendingClearRowEmployeeId(null)
    if (employeeId) {
      await weekActions.executeClearEmployeeRow(employeeId)
    }
  }, [pendingClearRowEmployeeId, weekActions])

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange} className="space-y-2">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 rounded-lg border border-border bg-card p-3 sm:p-4 shadow-sm transition-colors">
        <WeekScheduleHeader title={headerTitle} isOpen={isOpen} isCompleted={isCompleted} />
        <WeekScheduleActions
          readonly={readonly}
          canShowExportActions={canShowActions}
          exporting={exporting || false}
          isCompleted={isCompleted}
          isMarkingComplete={isMarkingComplete}
          user={user}
          onAssignmentUpdate={onAssignmentUpdate}
          onMarkComplete={handleMarkComplete}
          onExportImage={handleExportImage}
          onExportPDF={handleExportPDF}
          onExportExcel={undefined}
          weekActions={weekActions}
          onPublishSchedule={onPublishSchedule ? () => onPublishSchedule(weekStartDate, weekEndDate) : undefined}
          isPublishingSchedule={isPublishingSchedule}
          copiedWeekData={copiedWeekData}
          onCopyCurrentWeek={onCopyCurrentWeek}
          onPasteCopiedWeek={onPasteCopiedWeek}
          weekStartDate={weekStartDate}
          isPastingWeek={isPastingWeek}
        />
      </div>
      <CollapsibleContent
        id={weekId}
        className="overflow-hidden transition-all duration-300 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      >
        <div className="pt-2">
          <ScheduleGrid
            ref={ref}
            weekDays={weekDays}
            employees={employees}
            allEmployees={allEmployees || employees}
            shifts={shifts}
            schedule={weekSchedule}
            onAssignmentUpdate={onAssignmentUpdate}
            monthRange={{ startDate: monthRange.start, endDate: monthRange.end }}
            mediosTurnos={mediosTurnos}
            employeeStats={employeeStats && employees ? Object.fromEntries(employees.map((emp, index) => [emp.id, employeeStats[index] || {}])) : undefined}
            readonly={readonly}
            allSchedules={allSchedules}
            isScheduleCompleted={isCompleted}
            lastCompletedWeekStart={lastCompletedWeekStart ? format(lastCompletedWeekStart, "yyyy-MM-dd") : null}
            onClearEmployeeRow={!readonly && user ? handleClearEmployeeRow : undefined}
            user={user}
            onExportEmployeeImage={undefined}
            mobileIndividualOnly={mobileIndividualOnly}
          />
        </div>
      </CollapsibleContent>

      {/* Diálogo de confirmación para limpiar fila de empleado */}
      <AlertDialog open={confirmClearRowDialogOpen} onOpenChange={setConfirmClearRowDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar limpieza de fila?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta semana está marcada como completada. Al limpiar la fila del empleado, se eliminarán todas sus asignaciones de la semana.
              ¿Estás seguro de que deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingClearRowEmployeeId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClearRow}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación para edición de semana completada */}
      <AlertDialog open={confirmEditDialogOpen} onOpenChange={setConfirmEditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Editar semana completada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta semana está marcada como lista. Si la editas, dejará de estar completada.
              ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelEdit}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEdit}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  )
})

WeekSchedule.displayName = 'WeekSchedule'
