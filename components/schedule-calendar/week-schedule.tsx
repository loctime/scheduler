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
import { isScheduleCompleted, shouldRequestConfirmation } from "@/lib/schedule-utils"
import { logger } from "@/lib/logger"
import { useConfig } from "@/hooks/use-config"

interface WeekScheduleProps {
  weekDays: Date[]
  weekIndex: number
  weekSchedule: Horario | null
  employees: Empleado[]
  allEmployees: Empleado[]
  shifts: Turno[]
  monthRange: { start: Date; end: Date }
  onAssignmentUpdate?: (date: string, employeeId: string, shiftId: string, value: string | null) => void
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
  config?: any
  onCopyCurrentWeek?: () => void
  onPasteCopiedWeek?: () => void
  onPublishSchedule?: (weekStartDate: Date, weekEndDate: Date) => Promise<void> | void
  isPublishingSchedule?: boolean
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
  onCopyCurrentWeek,
  onPasteCopiedWeek,
  onPublishSchedule,
  isPublishingSchedule = false,
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
      await onMarkComplete(weekId)
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
          exporting={exporting || false}
          isCompleted={isCompleted}
          isMarkingComplete={isMarkingComplete}
          user={user}
          getWeekSchedule={getWeekSchedule}
          onAssignmentUpdate={onAssignmentUpdate ? (date: string, employeeId: string, assignments: ShiftAssignment[], options?: { scheduleId?: string }) => {
                // Convertir de firma ScheduleGrid a firma WeekSchedule
                const assignment = assignments[0]
                if (assignment && assignment.shiftId) {
                  onAssignmentUpdate(date, employeeId, assignment.shiftId, assignment.shiftId)
                } else {
                  onAssignmentUpdate(date, employeeId, '', null)
                }
              } : undefined}
          onMarkComplete={handleMarkComplete}
          onExportImage={handleExportImage}
          onExportPDF={handleExportPDF}
          onExportExcel={undefined}
          weekActions={weekActions}
          onCopyCurrentWeek={onCopyCurrentWeek}
          onPasteCopiedWeek={undefined}
          weekStartDate={weekStartDate}
          onPublishSchedule={onPublishSchedule ? () => onPublishSchedule(weekStartDate, weekEndDate) : undefined}
          isPublishingSchedule={isPublishingSchedule}
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
            onAssignmentUpdate={onAssignmentUpdate ? (date: string, employeeId: string, assignments: ShiftAssignment[], options?: { scheduleId?: string }) => {
                // Adaptador: Convertir firma ScheduleGrid -> Firma WeekSchedule
                console.log("🔧 [WeekSchedule Adaptador] Recibido:", {
                  date,
                  employeeId,
                  assignments,
                  options,
                  firstAssignment: assignments[0]
                })
                
                const assignment = assignments[0] // Tomar primer assignment (edición simple)
                
                // Si es Franco o Medio Franco: crear un handler especializado
                if (assignment && (assignment.type === "franco" || assignment.type === "medio_franco")) {
                  console.log("🔧 [WeekSchedule Adaptador] Detectado assignment especial:", assignment.type)
                  
                  // Llamar directamente use-schedule-updates saltando adaptadores
                  // Necesitamos acceder al handler real de use-schedule-updates
                  // Por ahora, vamos a simularlo pasando un valor especial que el padre reconozca
                  const specialValue = `DAY_STATUS_${assignment.type}_${assignment.startTime || ''}_${assignment.endTime || ''}`
                  onAssignmentUpdate(date, employeeId, specialValue, specialValue)
                  return
                }
                
                // Si es turno normal: comportamiento original del adaptador legacy
                if (assignment && assignment.shiftId) {
                  console.log("🔧 [WeekSchedule Adaptador] Turno normal, usando adaptador legacy")
                  // Hay asignación: pasar shiftId como valor
                  onAssignmentUpdate(date, employeeId, assignment.shiftId, assignment.shiftId)
                } else {
                  console.log("🔧 [WeekSchedule Adaptador] Limpiando celda")
                  // No hay asignación: limpiar celda
                  onAssignmentUpdate(date, employeeId, '', null)
                }
              } : undefined}
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
})

WeekSchedule.displayName = 'WeekSchedule'
