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
  // Close selector
  onCloseSelector?: () => void
  config?: Configuracion | null
  hasIncompleteAssignments?: (employeeId: string, date: string) => boolean
  ownerId?: string
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
  onCloseSelector,
  config,
  hasIncompleteAssignments,
  ownerId,
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
        <div className="flex flex-col gap-1">
          {/* Botón de acción: agregar separador */}
          {showAddButton && (
            <div className="flex items-center justify-start -mt-1 mb-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddSeparator(employeeIndex)
                }}
                title="Agregar separador"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-start gap-1 sm:gap-2">
            {!readonly && (
              <button
                type="button"
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors touch-none shrink-0"
                draggable={false}
                aria-label="Arrastrar para reordenar"
              >
                <GripVertical className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}
            <div className="space-y-0.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm sm:text-base md:text-lg font-bold truncate">{employee.name}</p>
              </div>
              {employeeStats && employeeStats[employee.id] && (
                <div className="employee-stats text-[10px] sm:text-xs md:text-sm text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-foreground">Francos:</span>
                    <span className="font-semibold">{formatStatValue(employeeStats[employee.id].francos)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-foreground">Horas mes:</span>
                    <span className="font-semibold">{formatStatValue(employeeStats[employee.id].horasComputablesMes)}h</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-foreground">Horas extra semana:</span>
                    <span className="font-semibold">{formatStatValue(employeeStats[employee.id].horasExtrasSemana)}h</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-foreground">Horas extra mes:</span>
                    <span className="font-semibold">{formatStatValue(employeeStats[employee.id].horasExtrasMes)}h</span>
                  </div>
                  {(employeeStats[employee.id].horasLicenciaEmbarazo ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-foreground">Lic. Embarazo:</span>
                      <span className="font-semibold">{formatStatValue(employeeStats[employee.id].horasLicenciaEmbarazo!)}h</span>
                    </div>
                  )}
                  {(employeeStats[employee.id].horasMedioFranco ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-foreground">Medio Franco:</span>
                      <span className="font-semibold">{formatStatValue(employeeStats[employee.id].horasMedioFranco!)}h</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
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
            suggestion={suggestion}
            config={config}
            hasIncompleteAssignments={hasIncompleteAssignments ? hasIncompleteAssignments(employee.id, dateStr) : false}
            ownerId={ownerId}
          />
        )
      })}
    </tr>
  )
}

