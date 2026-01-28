"use client"

import React from "react"
import { format, getDay, parseISO } from "date-fns"
import { Empleado, ShiftAssignment, MedioTurno, Turno, Configuracion } from "@/lib/types"
import type { EmployeeMonthlyStats } from "../index"
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
}

export function EmployeeRow({
  employee,
  weekDays,
  monthRange,
  readonly,
  employeeIndex,
  separatorColor,
  showAddButton,
  employeeStats,
  getEmployeeAssignments,
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
}: EmployeeRowProps) {
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
        className="border-r-2 border-black px-1 sm:px-1.5 md:px-2 py-1 sm:py-1.5 md:py-2 text-xs sm:text-sm md:text-base font-medium text-foreground align-top"
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
              <div className="grid grid-cols-[auto_48px_48px] divide-x divide-border">
                {/* Francos row */}
                <div className="font-bold text-foreground pr-1">Francos</div>
                <div className="font-semibold text-right px-1 border-t border-border">{formatStatValue(employeeStats[employee.id].francosSemana)}</div>
                <div className="font-semibold text-right pl-1 border-t border-border">{formatStatValue(employeeStats[employee.id].francos)}</div>
                
                {/* Horas row */}
                <div className="font-bold text-foreground pr-1 border-t border-border">Horas</div>
                <div className="font-semibold text-right px-1 border-t border-border">{formatStatValue(employeeStats[employee.id].horasSemana)}h</div>
                <div className="font-semibold text-right pl-1 border-t border-border">{formatStatValue(employeeStats[employee.id].horasComputablesMes)}h</div>
                
                {/* Extras row */}
                <div className="font-bold text-foreground pr-1 border-t border-border">Extras</div>
                <div className="font-semibold text-right px-1 border-t border-border">{formatStatValue(employeeStats[employee.id].horasExtrasSemana)}h</div>
                <div className="font-semibold text-right pl-1 border-t border-border">{formatStatValue(employeeStats[employee.id].horasExtrasMes)}h</div>
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

        const cellKey = `${employee.id}-${dateStr}`

        const undoCellKey = `${dateStr}-${employee.id}`
        const hasCellHistory = cellUndoHistory.has(undoCellKey)
        
        // Obtener sugerencia de patrón para este día
        const dayOfWeek = getDay(parseISO(dateStr))
        const suggestion = getSuggestion ? getSuggestion(employee.id, dayOfWeek) : null
        const hasFixedSchedule = suggestion?.isFixed === true
        const isManuallyFixedCell = isManuallyFixed ? isManuallyFixed(employee.id, dayOfWeek) : false

        return (
          <ScheduleCell
            key={day.toISOString()}
            date={dateStr}
            employeeId={employee.id}
            assignments={assignments}
            backgroundStyle={backgroundStyle}
            isSelected={isSelected}
            isClickable={isClickable}
            getShiftInfo={getShiftInfo}
            onCellClick={onCellClick}
            cellKey={cellKey}
            quickShifts={shifts}
            mediosTurnos={mediosTurnos}
            onQuickAssignments={
              onQuickAssignments
                ? (assignments) => onQuickAssignments(dateStr, employee.id, assignments)
                : undefined
            }
            onAssignmentUpdate={onAssignmentUpdate}
            scheduleId={scheduleId}
            readonly={readonly}
            hasCellHistory={hasCellHistory}
            onCellUndo={() => handleCellUndo(dateStr, employee.id)}
            hasFixedSchedule={hasFixedSchedule}
            suggestionWeeks={suggestion?.weeksMatched}
            isManuallyFixed={isManuallyFixedCell}
            onToggleFixed={onToggleFixed}
            suggestion={suggestion}
            config={config}
            hasIncompleteAssignments={hasIncompleteAssignments ? hasIncompleteAssignments(employee.id, dateStr) : false}
          />
        )
      })}
    </tr>
  )
}

