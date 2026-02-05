"use client"

import React, { useMemo } from "react"
import { format, getDay, parseISO } from "date-fns"
import { Empleado, ShiftAssignment, MedioTurno, Turno, Configuracion } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/types/employee-stats"
import { Button } from "@/components/ui/button"
import { GripVertical, Plus } from "lucide-react"
import { hexToRgba, formatStatValue } from "../utils/schedule-grid-utils"
import { ScheduleCell } from "./schedule-cell"

interface EmployeeRowProps {
  employee: Empleado
  weekDays: Date[]
  monthRange?: { startDate: Date; endDate: Date }
  readonly: boolean
  employeeIndex: number
  separatorColor?: string
  showAddButton: boolean
  employeeStats?: Record<string, EmployeeMonthlyStats>
  getEmployeeAssignments: (employeeId: string, date: string) => ShiftAssignment[]
  getEmployeeDayStatus: (employeeId: string, date: string) => "normal" | "franco" | "medio_franco"
  getCellBackgroundStyle: (employeeId: string, date: string) => React.CSSProperties | undefined
  getShiftInfo: (shiftId: string) => any
  selectedCell: { date: string; employeeId: string } | null
  isClickable: boolean
  onCellClick: (date: string, employeeId: string) => void
  onAddSeparator: (position: number) => void
  // Drag and drop props
  draggedEmployeeId: string | null
  dragOverEmployeeId: string | null
  onDragStart: (e: React.DragEvent, employeeId: string) => void
  onDragEnd: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent, employeeId: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, targetId: string) => void
  onAssignmentUpdate?: (
    date: string,
    employeeId: string,
    assignments: ShiftAssignment[],
    options?: { scheduleId?: string }
  ) => void
  scheduleId?: string
  shifts: Turno[]
  mediosTurnos?: MedioTurno[]
  onQuickAssignments?: (date: string, employeeId: string, assignments: ShiftAssignment[]) => void
  // Undo props
  cellUndoHistory: Map<string, ShiftAssignment[]>
  handleCellUndo: (date: string, employeeId: string) => void
  // Clear employee row
  onClearEmployeeRow?: (employeeId: string) => Promise<boolean>
  // Pattern suggestions
  getSuggestion?: (employeeId: string, dayOfWeek: number) => any
  // Manual fixed schedules
  isManuallyFixed?: (employeeId: string, dayOfWeek: number) => boolean
  onToggleFixed?: (date: string, employeeId: string, dayOfWeek: number) => void
  // Close selector
  onCloseSelector?: () => void
  config?: Configuracion | null
  hasIncompleteAssignments?: (employeeId: string, date: string) => boolean
  updateEmployeeRequestCache?: (key: string, request: any) => void
}

function EmployeeRowComponent({
  employee,
  weekDays,
  monthRange,
  readonly,
  employeeIndex,
  separatorColor,
  showAddButton,
  employeeStats,
  getEmployeeAssignments,
  getEmployeeDayStatus,
  getCellBackgroundStyle,
  getShiftInfo,
  selectedCell,
  isClickable,
  onCellClick,
  onAddSeparator,
  draggedEmployeeId,
  dragOverEmployeeId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onAssignmentUpdate,
  scheduleId,
  shifts,
  mediosTurnos,
  onQuickAssignments,
  cellUndoHistory,
  handleCellUndo,
  onClearEmployeeRow,
  getSuggestion,
  isManuallyFixed,
  onToggleFixed,
  onCloseSelector,
  config,
  hasIncompleteAssignments,
  updateEmployeeRequestCache,
}: EmployeeRowProps) {
  const cellHandlers = useMemo(() => {
    const handlers = new Map<
      string,
      {
        onQuickAssignments?: (assignments: ShiftAssignment[]) => void
        onCellUndo: () => void
        onToggleFixed?: (date: string, employeeId: string, dayOfWeek: number) => void
      }
    >()

    weekDays.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd")
      const dayOfWeek = getDay(parseISO(dateStr))

      handlers.set(dateStr, {
        onQuickAssignments: onQuickAssignments
          ? (assignments) => onQuickAssignments(dateStr, employee.id, assignments)
          : undefined,
        onCellUndo: () => handleCellUndo(dateStr, employee.id),
        onToggleFixed: onToggleFixed
          ? (_date, _employeeId, _dayOfWeek) => onToggleFixed(dateStr, employee.id, dayOfWeek)
          : undefined,
      })
    })

    return handlers
  }, [weekDays, onQuickAssignments, handleCellUndo, onToggleFixed, employee.id])

  return (
    <tr
      key={employee.id}
      className={`border-b-2 border-black last:border-b-0 ${
        dragOverEmployeeId === employee.id ? "bg-primary/5" : ""
      } ${draggedEmployeeId === employee.id ? "opacity-50" : ""}`}
      draggable={!readonly}
      onDragStart={(e) => onDragStart(e, employee.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, employee.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, employee.id)}
    >
      <td
        className="border-r-2 border-black px-0.5 sm:px-0.5 md:px-1 py-1 sm:py-1.5 md:py-2 text-xs sm:text-sm md:text-base font-medium text-foreground align-top"
        style={
          separatorColor
            ? { backgroundColor: hexToRgba(separatorColor, 0.1) }
            : { backgroundColor: "rgb(var(--muted) / 0.3)" }
        }
        onClick={(e) => {
          // Cerrar el selector si está abierto al hacer click en la celda de nombres
          if (selectedCell && onCloseSelector) {
            e.stopPropagation()
            onCloseSelector()
          }
        }}
      >
        <div className="flex flex-col gap-2">
          {/* FILA 1: Header con botón + y nombre */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Botón de acción: agregar separador */}
              {showAddButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddSeparator(employeeIndex)
                  }}
                  title="Agregar separador"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
              <p className="text-base sm:text-lg font-bold truncate">{employee.name}</p>
            </div>
            
          </div>
          
          {/* FILA 2: Tabla de estadísticas */}
          {employeeStats && employeeStats[employee.id] && (
            <div className="text-sm text-muted-foreground">
              <div className="grid grid-cols-[max-content_auto_auto] divide-x divide-border gap-0">
                {/* Francos row */}
                <div className="font-bold text-foreground">Francos</div>
                <div className="font-semibold text-right border-t border-border">{formatStatValue(employeeStats[employee.id].francosSemana)}</div>
                <div className="font-semibold text-right border-t border-border">{formatStatValue(employeeStats[employee.id].francos)}</div>
                
                {/* Horas row */}
                <div className="font-bold text-foreground border-t border-border">Horas</div>
                <div className="font-semibold text-right border-t border-border">{formatStatValue(employeeStats[employee.id].horasSemana)}h</div>
                <div className="font-semibold text-right border-t border-border">{formatStatValue(employeeStats[employee.id].horasComputablesMes)}h</div>
                
                {/* Extras row */}
                <div className="font-bold text-foreground border-t border-border">Extras</div>
                <div className="font-semibold text-right border-t border-border">{formatStatValue(employeeStats[employee.id].horasExtrasSemana)}h</div>
                <div className="font-semibold text-right border-t border-border">{formatStatValue(employeeStats[employee.id].horasExtrasMes)}h</div>
              </div>
            </div>
          )}
        </div>
      </td>
      {weekDays.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd")
        const isSelected = selectedCell?.date === dateStr && selectedCell?.employeeId === employee.id
        const isOutOfRange = monthRange ? day < monthRange.startDate || day > monthRange.endDate : false
        const backgroundStyle = getCellBackgroundStyle(employee.id, dateStr)
        const assignments = getEmployeeAssignments(employee.id, dateStr)
        const dayStatus = getEmployeeDayStatus(employee.id, dateStr)

        const cellKey = `${employee.id}-${dateStr}`

        const undoCellKey = `${dateStr}-${employee.id}`
        const hasCellHistory = cellUndoHistory.has(undoCellKey)

        const handlers = cellHandlers.get(dateStr)
        
        // Obtener sugerencia de patrón para este día
        const dayOfWeek = getDay(parseISO(dateStr))
        const suggestion = getSuggestion ? getSuggestion(employee.id, dayOfWeek) : null
        const hasFixedSchedule = suggestion?.isFixed === true
        const isManuallyFixedCell = isManuallyFixed ? isManuallyFixed(employee.id, dayOfWeek) : false
        
        // Verificar si tiene una regla fija nueva
        const hasNewFixedRule = false // Se implementará con el nuevo sistema

        return (
          <ScheduleCell
            key={day.toISOString()}
            date={dateStr}
            employeeId={employee.id}
            assignments={assignments}
            dayStatus={dayStatus}
            backgroundStyle={backgroundStyle}
            isSelected={isSelected}
            isClickable={isClickable}
            getShiftInfo={getShiftInfo}
            onCellClick={onCellClick}
            cellKey={cellKey}
            quickShifts={shifts}
            mediosTurnos={mediosTurnos}
            onQuickAssignments={handlers?.onQuickAssignments}
            onAssignmentUpdate={onAssignmentUpdate}
            scheduleId={scheduleId}
            readonly={readonly}
            hasCellHistory={hasCellHistory}
            onCellUndo={handlers?.onCellUndo}
            hasFixedSchedule={hasFixedSchedule}
            suggestionWeeks={suggestion?.weeksMatched}
            isManuallyFixed={isManuallyFixedCell}
            onToggleFixed={handlers?.onToggleFixed}
            suggestion={suggestion}
            config={config}
            hasIncompleteAssignments={hasIncompleteAssignments ? hasIncompleteAssignments(employee.id, dateStr) : false}
            updateEmployeeRequestCache={updateEmployeeRequestCache}
          />
        )
      })}
    </tr>
  )
}

const areEmployeeStatsEqual = (
  prevStats: EmployeeMonthlyStats | undefined,
  nextStats: EmployeeMonthlyStats | undefined,
) => {
  if (prevStats === nextStats) return true
  if (!prevStats || !nextStats) return false
  return (
    prevStats.francos === nextStats.francos &&
    prevStats.francosSemana === nextStats.francosSemana &&
    prevStats.horasExtrasSemana === nextStats.horasExtrasSemana &&
    prevStats.horasExtrasMes === nextStats.horasExtrasMes &&
    prevStats.horasComputablesMes === nextStats.horasComputablesMes &&
    prevStats.horasSemana === nextStats.horasSemana &&
    prevStats.horasLicenciaEmbarazo === nextStats.horasLicenciaEmbarazo &&
    prevStats.horasMedioFranco === nextStats.horasMedioFranco
  )
}

const areWeekDaysEqual = (prev: Date[], next: Date[]) => {
  if (prev === next) return true
  if (prev.length !== next.length) return false
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i].getTime() !== next[i].getTime()) return false
  }
  return true
}

const getSelectedDateForRow = (selectedCell: EmployeeRowProps["selectedCell"], employeeId: string) => {
  if (!selectedCell || selectedCell.employeeId !== employeeId) return null
  return selectedCell.date
}

const getUndoKeysForEmployee = (undoHistory: Map<string, ShiftAssignment[]>, employeeId: string) => {
  const keys: string[] = []
  undoHistory.forEach((_value, key) => {
    if (key.endsWith(`-${employeeId}`)) {
      keys.push(key)
    }
  })
  keys.sort()
  return keys.join("|")
}

const areEmployeeRowPropsEqual = (prev: EmployeeRowProps, next: EmployeeRowProps) => {
  if (prev.employee.id !== next.employee.id) return false
  if (prev.employee.name !== next.employee.name) return false
  if (!areWeekDaysEqual(prev.weekDays, next.weekDays)) return false
  if (prev.monthRange?.startDate?.getTime() !== next.monthRange?.startDate?.getTime()) return false
  if (prev.monthRange?.endDate?.getTime() !== next.monthRange?.endDate?.getTime()) return false
  if (prev.readonly !== next.readonly) return false
  if (prev.employeeIndex !== next.employeeIndex) return false
  if (prev.separatorColor !== next.separatorColor) return false
  if (prev.showAddButton !== next.showAddButton) return false
  if (!areEmployeeStatsEqual(prev.employeeStats?.[prev.employee.id], next.employeeStats?.[next.employee.id])) return false
  if (prev.getEmployeeAssignments !== next.getEmployeeAssignments) return false
  if (prev.getEmployeeDayStatus !== next.getEmployeeDayStatus) return false
  if (prev.getCellBackgroundStyle !== next.getCellBackgroundStyle) return false
  if (prev.getShiftInfo !== next.getShiftInfo) return false
  if (prev.isClickable !== next.isClickable) return false
  if (prev.onCellClick !== next.onCellClick) return false
  if (prev.onAddSeparator !== next.onAddSeparator) return false
  if (prev.onAssignmentUpdate !== next.onAssignmentUpdate) return false
  if (prev.scheduleId !== next.scheduleId) return false
  if (prev.shifts !== next.shifts) return false
  if (prev.mediosTurnos !== next.mediosTurnos) return false
  if (prev.onQuickAssignments !== next.onQuickAssignments) return false
  if (prev.handleCellUndo !== next.handleCellUndo) return false
  if (prev.onClearEmployeeRow !== next.onClearEmployeeRow) return false
  if (prev.getSuggestion !== next.getSuggestion) return false
  if (prev.isManuallyFixed !== next.isManuallyFixed) return false
  if (prev.onToggleFixed !== next.onToggleFixed) return false
  if (prev.onCloseSelector !== next.onCloseSelector) return false
  if (prev.config !== next.config) return false
  if (prev.hasIncompleteAssignments !== next.hasIncompleteAssignments) return false
  if (prev.updateEmployeeRequestCache !== next.updateEmployeeRequestCache) return false

  const prevSelectedDate = getSelectedDateForRow(prev.selectedCell, prev.employee.id)
  const nextSelectedDate = getSelectedDateForRow(next.selectedCell, next.employee.id)
  if (prevSelectedDate !== nextSelectedDate) return false

  const prevIsDragging = prev.draggedEmployeeId === prev.employee.id
  const nextIsDragging = next.draggedEmployeeId === next.employee.id
  if (prevIsDragging !== nextIsDragging) return false

  const prevIsDragOver = prev.dragOverEmployeeId === prev.employee.id
  const nextIsDragOver = next.dragOverEmployeeId === next.employee.id
  if (prevIsDragOver !== nextIsDragOver) return false

  if (prev.draggedEmployeeId !== next.draggedEmployeeId && (prevIsDragging || nextIsDragging)) return false
  if (prev.dragOverEmployeeId !== next.dragOverEmployeeId && (prevIsDragOver || nextIsDragOver)) return false

  const prevUndoKeys = getUndoKeysForEmployee(prev.cellUndoHistory, prev.employee.id)
  const nextUndoKeys = getUndoKeysForEmployee(next.cellUndoHistory, next.employee.id)
  if (prevUndoKeys !== nextUndoKeys) return false

  return true
}

export const EmployeeRow = React.memo(EmployeeRowComponent, areEmployeeRowPropsEqual)
