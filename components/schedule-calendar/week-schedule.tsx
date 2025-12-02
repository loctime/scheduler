"use client"

import { useState, useCallback } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ScheduleGrid, type EmployeeMonthlyStats } from "@/components/schedule-grid"
import { Empleado, Turno, Horario, MedioTurno } from "@/lib/types"
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
import { isScheduleCompleted, shouldRequestConfirmation } from "@/lib/schedule-utils"
import { logger } from "@/lib/logger"
import { useConfig } from "@/hooks/use-config"

interface WeekScheduleProps {
  weekDays: Date[]
  weekIndex: number
  weekSchedule: Horario | null
  employees: Empleado[]
  allEmployees?: Empleado[]
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
  lastCompletedWeekStart?: string | null
  getWeekSchedule?: (weekStartDate: Date) => Horario | null
  allSchedules?: Horario[]
}

export function WeekSchedule({
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
  const isCompleted = isScheduleCompleted(weekSchedule)
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)
  const [confirmClearRowDialogOpen, setConfirmClearRowDialogOpen] = useState(false)
  const [pendingClearRowEmployeeId, setPendingClearRowEmployeeId] = useState<string | null>(null)

  // Si no se proporciona open/onOpenChange, usar estado interno
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open !== undefined ? open : internalOpen
  const handleOpenChange = onOpenChange || setInternalOpen

  // Obtener configuración
  const { config } = useConfig(user)
  const weekStartsOn = (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6

  // Hook para acciones de semana
  const weekActions = useWeekActions({
    weekDays,
    weekStartDate,
    weekSchedule,
    employees,
    user: user || null,
    readonly,
    getWeekSchedule,
    config,
    allSchedules,
    weekStartsOn,
  })

  const handleMarkComplete = useCallback(async () => {
    if (!onMarkComplete) return
    setIsMarkingComplete(true)
    try {
      await onMarkComplete(weekStartDate, !isCompleted)
    } catch (error) {
      logger.error("Error al marcar semana como completada:", error)
    } finally {
      setIsMarkingComplete(false)
    }
  }, [onMarkComplete, weekStartDate, isCompleted])

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
      if (shouldRequestConfirmation(weekSchedule, "clear")) {
        setPendingClearRowEmployeeId(employeeId)
        setConfirmClearRowDialogOpen(true)
        return false
      }
      return await weekActions.executeClearEmployeeRow(employeeId)
    },
    [weekSchedule, weekActions]
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
          exporting={exporting}
          isCompleted={isCompleted}
          isMarkingComplete={isMarkingComplete}
          user={user}
          getWeekSchedule={getWeekSchedule}
          onAssignmentUpdate={onAssignmentUpdate}
          onMarkComplete={handleMarkComplete}
          onExportImage={handleExportImage}
          onExportPDF={handleExportPDF}
          onExportExcel={onExportExcel}
          weekActions={weekActions}
        />
      </div>
      <CollapsibleContent
        id={weekId}
        className="overflow-hidden transition-all duration-300 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      >
        <div className="pt-2">
          <ScheduleGrid
            weekDays={weekDays}
            employees={employees}
            allEmployees={allEmployees || employees}
            shifts={shifts}
            schedule={weekSchedule}
            onAssignmentUpdate={onAssignmentUpdate}
            monthRange={monthRange}
            mediosTurnos={mediosTurnos}
            employeeStats={employeeStats}
            readonly={readonly}
            allSchedules={allSchedules}
            isScheduleCompleted={isCompleted}
            lastCompletedWeekStart={lastCompletedWeekStart}
            onClearEmployeeRow={!readonly && user ? handleClearEmployeeRow : undefined}
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
    </Collapsible>
  )
}
