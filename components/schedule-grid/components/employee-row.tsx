"use client"

import React from "react"
import { format } from "date-fns"
import { Empleado, ShiftAssignment, MedioTurno, Turno } from "@/lib/types"
import type { EmployeeMonthlyStats } from "../index"
import { Button } from "@/components/ui/button"
import { GripVertical, Plus, X } from "lucide-react"
import { hexToRgba, formatStatValue } from "../utils/schedule-grid-utils"
import { ScheduleCell } from "./schedule-cell"
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
  // Extra actions props
  extraMenuOpenKey: string | null
  handleToggleExtra: (employeeId: string, date: string, type: "before" | "after") => void
  setExtraMenuOpenKey: (key: string | null) => void
  adjustTime: (time: string, minutes: number) => string | null
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
  // Remove employee props
  onRemoveEmployeeFromWeek?: (employeeId: string) => void
  canRemoveEmployee?: boolean
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
  extraMenuOpenKey,
  handleToggleExtra,
  setExtraMenuOpenKey,
  adjustTime,
  onAssignmentUpdate,
  scheduleId,
  shifts,
  mediosTurnos,
  onQuickAssignments,
  cellUndoHistory,
  handleCellUndo,
  onRemoveEmployeeFromWeek,
  canRemoveEmployee = false,
}: EmployeeRowProps) {
  const [showRemoveDialog, setShowRemoveDialog] = React.useState(false)

  const handleRemoveClick = () => {
    setShowRemoveDialog(true)
  }

  const handleConfirmRemove = () => {
    if (onRemoveEmployeeFromWeek) {
      onRemoveEmployeeFromWeek(employee.id)
    }
    setShowRemoveDialog(false)
  }
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
        className="border-r-2 border-black px-6 py-4 text-lg font-medium text-foreground align-top"
        style={
          separatorColor
            ? { backgroundColor: hexToRgba(separatorColor, 0.1) }
            : { backgroundColor: "rgb(var(--muted) / 0.3)" }
        }
      >
        <div className="flex flex-col gap-1">
          {/* Botones de acción: agregar separador y eliminar empleado */}
          {(showAddButton || (canRemoveEmployee && onRemoveEmployeeFromWeek)) && (
            <div className="flex items-center justify-between -mt-1 mb-1">
              {showAddButton && (
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
              )}
              {!showAddButton && <div />}
              {canRemoveEmployee && onRemoveEmployeeFromWeek && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveClick()
                    }}
                    title="Eliminar de esta semana"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar empleado de esta semana</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Estás seguro de que quieres eliminar a <strong>{employee.name}</strong> de esta semana?
                          <br />
                          <br />
                          Se eliminarán todas sus asignaciones de esta semana. Esta acción no afectará otras semanas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          )}
          <div className="flex items-start gap-2">
            {!readonly && (
              <button
                type="button"
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors touch-none"
                draggable={false}
                aria-label="Arrastrar para reordenar"
              >
                <GripVertical className="h-5 w-5" />
              </button>
            )}
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{employee.name}</p>
              </div>
              {employeeStats && employeeStats[employee.id] && (
                <div className="employee-stats text-base text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-foreground">Francos:</span>
                    <span className="font-semibold">{formatStatValue(employeeStats[employee.id].francos)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-foreground">Horas extra semana:</span>
                    <span className="font-semibold">{formatStatValue(employeeStats[employee.id].horasExtrasSemana)}h</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-foreground">Horas extra mes:</span>
                    <span className="font-semibold">{formatStatValue(employeeStats[employee.id].horasExtrasMes)}h</span>
                  </div>
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

        const primaryShiftAssignment = assignments.find(
          (assignment) => assignment.type !== "franco" && assignment.type !== "medio_franco" && assignment.shiftId
        )
        const primaryShift = primaryShiftAssignment && primaryShiftAssignment.shiftId ? getShiftInfo(primaryShiftAssignment.shiftId) : undefined
        const extendedStart = primaryShift?.startTime ? adjustTime(primaryShift.startTime, -30) : undefined
        const extendedEnd = primaryShift?.endTime ? adjustTime(primaryShift.endTime, 30) : undefined
        // Verificar si tiene horas extras comparando con el horario base del turno
        const hasExtraBefore = Boolean(
          extendedStart && 
          primaryShiftAssignment?.startTime && 
          primaryShiftAssignment.startTime === extendedStart &&
          primaryShiftAssignment.startTime !== primaryShift?.startTime
        )
        const hasExtraAfter = Boolean(
          extendedEnd && 
          primaryShiftAssignment?.endTime && 
          primaryShiftAssignment.endTime === extendedEnd &&
          primaryShiftAssignment.endTime !== primaryShift?.endTime
        )
        const showExtraActions =
          isClickable &&
          !!onAssignmentUpdate &&
          !!primaryShiftAssignment &&
          !!primaryShift?.startTime &&
          !!primaryShift?.endTime
        const cellKey = `${employee.id}-${dateStr}`

        const undoCellKey = `${dateStr}-${employee.id}`
        const hasCellHistory = cellUndoHistory.has(undoCellKey)

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
            showExtraActions={showExtraActions}
            extraMenuOpenKey={extraMenuOpenKey}
            cellKey={cellKey}
            hasExtraBefore={hasExtraBefore}
            hasExtraAfter={hasExtraAfter}
            onToggleExtra={(type) => handleToggleExtra(employee.id, dateStr, type)}
            onExtraMenuOpenChange={(open) => setExtraMenuOpenKey(open ? cellKey : null)}
            quickShifts={shifts}
            mediosTurnos={mediosTurnos}
            onQuickAssignments={
              onQuickAssignments
                ? (assignments) => onQuickAssignments(dateStr, employee.id, assignments)
                : undefined
            }
            readonly={readonly}
            hasCellHistory={hasCellHistory}
            onCellUndo={() => handleCellUndo(dateStr, employee.id)}
          />
        )
      })}
    </tr>
  )
}

