"use client"

import React, { memo, useMemo, useCallback, useState, useEffect } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Undo2 } from "lucide-react"
import { Empleado, Turno, Horario, HistorialItem, ShiftAssignment, MedioTurno } from "@/lib/types"
import { ShiftSelectorPopover } from "../shift-selector-popover"
import { adjustTime } from "@/lib/utils"
import { useConfig } from "@/hooks/use-config"
import { useEmployeeOrder } from "@/hooks/use-employee-order"
import { useUndoRedo } from "@/hooks/use-undo-redo"
import { useScheduleGridData } from "./hooks/use-schedule-grid-data"
import { useCellBackgroundStyles } from "./hooks/use-cell-background-styles"
import { useDragAndDrop } from "./hooks/use-drag-and-drop"
import { useSeparators } from "./hooks/use-separators"
import { GridHeader } from "./components/grid-header"
import { SeparatorRow } from "./components/separator-row"
import { EmployeeRow } from "./components/employee-row"
import { hexToRgba } from "./utils/schedule-grid-utils"
import type { GridItem } from "./hooks/use-schedule-grid-data"

export interface EmployeeMonthlyStats {
  francos: number
  horasExtrasSemana: number
  horasExtrasMes: number
}

interface ScheduleGridProps {
  weekDays: Date[]
  employees: Empleado[]
  shifts: Turno[]
  schedule: Horario | HistorialItem | null
  onShiftUpdate?: (date: string, employeeId: string, shiftIds: string[]) => void // formato antiguo (compatibilidad)
  onAssignmentUpdate?: (
    date: string,
    employeeId: string,
    assignments: ShiftAssignment[],
    options?: { scheduleId?: string }
  ) => void // nuevo formato
  readonly?: boolean
  monthRange?: { startDate: Date; endDate: Date } // Rango del mes para deshabilitar días fuera del rango
  mediosTurnos?: MedioTurno[] // Medios turnos configurados
  employeeStats?: Record<string, EmployeeMonthlyStats>
  isFirstWeek?: boolean // Indica si es la primera semana del mes
}

export const ScheduleGrid = memo(function ScheduleGrid({
  weekDays,
  employees,
  shifts,
  schedule,
  onShiftUpdate,
  onAssignmentUpdate,
  readonly = false,
  monthRange,
  mediosTurnos = [],
  employeeStats,
  isFirstWeek = false,
}: ScheduleGridProps) {
  const [selectedCell, setSelectedCell] = useState<{ date: string; employeeId: string } | null>(null)
  const [extraMenuOpenKey, setExtraMenuOpenKey] = useState<string | null>(null)
  const [cellUndoHistory, setCellUndoHistory] = useState<Map<string, ShiftAssignment[]>>(new Map())

  const { config } = useConfig()
  const { updateEmployeeOrder, addSeparator, updateSeparator, deleteSeparator } = useEmployeeOrder()
  const { saveState, undo, canUndo, lastChangeDescription } = useUndoRedo()

  // Hook para datos del grid
  const {
    shiftMap,
    separadorMap,
    orderedItemIds,
    orderedItems,
    getEmployeeShifts,
    getEmployeeAssignments,
    getShiftInfo,
  } = useScheduleGridData({
    employees,
    shifts,
    separadores: config?.separadores,
    ordenEmpleados: config?.ordenEmpleados,
    schedule,
  })

  // Hook para estilos de celdas
  const { getCellBackgroundStyle } = useCellBackgroundStyles({
    getEmployeeAssignments,
    getShiftInfo,
    shifts,
    mediosTurnos,
  })

  // Hook para drag and drop
  const {
    draggedEmployeeId,
    dragOverEmployeeId,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useDragAndDrop({
    readonly,
    orderedItemIds,
    onOrderUpdate: updateEmployeeOrder,
  })

  // Hook para separadores
  const {
    editingSeparatorId,
    separatorEditName,
    separatorEditColor,
    setSeparatorEditName,
    setSeparatorEditColor,
    handleAddSeparator,
    handleEditSeparator,
    handleSaveSeparatorEdit,
    handleCancelEdit,
    handleDeleteSeparator,
  } = useSeparators({
    readonly,
    orderedItemIds,
    separadorMap,
    addSeparator,
    updateSeparator,
    deleteSeparator,
    onOrderUpdate: updateEmployeeOrder,
  })

  // Guardar estado de celda antes de cambiar
  const saveCellState = useCallback(
    (date: string, employeeId: string) => {
      if (!schedule) return
      const currentAssignments = getEmployeeAssignments(employeeId, date)
      const cellKey = `${date}-${employeeId}`
      
      if (currentAssignments.length > 0) {
        setCellUndoHistory((prev) => {
          const newMap = new Map(prev)
          newMap.set(cellKey, JSON.parse(JSON.stringify(currentAssignments)))
          return newMap
        })
      }
    },
    [schedule, getEmployeeAssignments],
  )

  // Guardar estado global antes de cambiar
  const saveGlobalState = useCallback(
    (date: string, employeeId: string) => {
      if (!schedule || !onAssignmentUpdate) return
      
      const employeeName = employees.find((e) => e.id === employeeId)?.name || employeeId
      const dateObj = new Date(date)
      const dateFormatted = format(dateObj, "d 'de' MMMM", { locale: es })
      const description = `Cambio en ${employeeName} - ${dateFormatted}`
      
      saveState(schedule.id, schedule.assignments, description)
    },
    [schedule, employees, saveState],
  )

  // Deshacer cambio global
  const handleGlobalUndo = useCallback(() => {
    if (!canUndo || !schedule || !onAssignmentUpdate) return

    const restoredState = undo()
    if (!restoredState) return

    const restoredAssignments = restoredState.assignments

    Object.entries(restoredAssignments).forEach(([date, dateAssignments]) => {
      Object.entries(dateAssignments).forEach(([employeeId, assignments]) => {
        const normalizedAssignments = Array.isArray(assignments)
          ? (typeof assignments[0] === "string"
              ? (assignments as string[]).map((shiftId: string) => ({ shiftId, type: "shift" as const }))
              : (assignments as ShiftAssignment[]))
          : []

        onAssignmentUpdate(date, employeeId, normalizedAssignments, {
          scheduleId: schedule.id,
        })
      })
    })
  }, [canUndo, schedule, onAssignmentUpdate, undo])

  // Deshacer cambio de una celda específica
  const handleCellUndo = useCallback(
    (date: string, employeeId: string) => {
      if (!schedule || !onAssignmentUpdate) return

      const cellKey = `${date}-${employeeId}`
      const previousState = cellUndoHistory.get(cellKey)

      if (previousState) {
        onAssignmentUpdate(date, employeeId, previousState, {
          scheduleId: schedule.id,
        })
        setCellUndoHistory((prev) => {
          const newMap = new Map(prev)
          newMap.delete(cellKey)
          return newMap
        })
      }
    },
    [schedule, onAssignmentUpdate, cellUndoHistory],
  )

  // Manejar atajo de teclado Ctrl+Z
  useEffect(() => {
    if (readonly) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        handleGlobalUndo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [readonly, handleGlobalUndo])

  // Handlers
  const handleCellClick = useCallback(
    (date: string, employeeId: string) => {
      if (!readonly && (onShiftUpdate || onAssignmentUpdate)) {
        saveCellState(date, employeeId)
        saveGlobalState(date, employeeId)
        setSelectedCell({ date, employeeId })
      }
    },
    [readonly, onShiftUpdate, onAssignmentUpdate, saveCellState, saveGlobalState]
  )

  const handleShiftUpdate = useCallback(
    (shiftIds: string[]) => {
      if (selectedCell && onShiftUpdate) {
        onShiftUpdate(selectedCell.date, selectedCell.employeeId, shiftIds)
      }
      setSelectedCell(null)
    },
    [selectedCell, onShiftUpdate]
  )

  const handleAssignmentUpdate = useCallback(
    (assignments: ShiftAssignment[]) => {
      if (selectedCell && onAssignmentUpdate) {
        onAssignmentUpdate(selectedCell.date, selectedCell.employeeId, assignments, {
          scheduleId: schedule?.id,
        })
      }
      setSelectedCell(null)
    },
    [selectedCell, onAssignmentUpdate, schedule?.id]
  )

  const handleToggleExtra = useCallback(
    (employeeId: string, date: string, type: "before" | "after") => {
      if (!onAssignmentUpdate) return
      
      saveCellState(date, employeeId)
      saveGlobalState(date, employeeId)
      
      const assignments = getEmployeeAssignments(employeeId, date)
      if (assignments.length === 0) return

      const targetIndex = assignments.findIndex(
        (assignment) => assignment.type !== "franco" && assignment.type !== "medio_franco" && assignment.shiftId
      )
      if (targetIndex === -1) return

      const assignment = { ...assignments[targetIndex] }
      const shift = assignment.shiftId ? getShiftInfo(assignment.shiftId) : undefined
      if (!shift || !shift.startTime || !shift.endTime) return

      const updatedAssignments = assignments.map((item, idx) => (idx === targetIndex ? assignment : item))

      if (type === "before") {
        const extendedStart = adjustTime(shift.startTime, -30)
        if (!extendedStart) return
        if (assignment.startTime === extendedStart) {
          delete assignment.startTime
        } else {
          assignment.startTime = extendedStart
        }
      } else {
        const extendedEnd = adjustTime(shift.endTime, 30)
        if (!extendedEnd) return
        if (assignment.endTime === extendedEnd) {
          delete assignment.endTime
        } else {
          assignment.endTime = extendedEnd
        }
      }

      onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId: schedule?.id })
    },
    [getEmployeeAssignments, getShiftInfo, onAssignmentUpdate, schedule?.id, saveCellState, saveGlobalState]
  )

  const handleQuickAssignments = useCallback(
    (date: string, employeeId: string, assignments: ShiftAssignment[]) => {
      // Guardar estado antes de actualizar
      saveCellState(date, employeeId)
      saveGlobalState(date, employeeId)
      
      // Cerrar la celda inmediatamente antes de actualizar
      setSelectedCell(null)
      
      // Actualizar los assignments después de cerrar
      if (onAssignmentUpdate) {
        onAssignmentUpdate(date, employeeId, assignments, { scheduleId: schedule?.id })
      } else if (onShiftUpdate) {
        const shiftIds = assignments
          .map((a) => a.shiftId)
          .filter((id): id is string => Boolean(id))
        onShiftUpdate(date, employeeId, shiftIds)
      }
    },
    [onAssignmentUpdate, onShiftUpdate, schedule?.id, saveCellState, saveGlobalState]
  )

  // Obtener empleado y fecha seleccionados
  const selectedEmployee = selectedCell ? employees.find((e) => e.id === selectedCell.employeeId) : null
  const selectedDate = selectedCell
    ? weekDays.find((d) => format(d, "yyyy-MM-dd") === selectedCell.date)
    : null

  // Memoizar los valores pasados al diálogo para evitar re-renders infinitos
  const selectedShiftIds = useMemo(() => {
    if (!selectedCell) return []
    return getEmployeeShifts(selectedCell.employeeId, selectedCell.date)
  }, [selectedCell?.employeeId, selectedCell?.date, schedule?.assignments, getEmployeeShifts])

  const selectedAssignments = useMemo(() => {
    if (!selectedCell || !onAssignmentUpdate) return undefined
    return getEmployeeAssignments(selectedCell.employeeId, selectedCell.date)
  }, [selectedCell?.employeeId, selectedCell?.date, schedule?.assignments, onAssignmentUpdate, getEmployeeAssignments])

  // Función para obtener el color del separador que aplica a un empleado
  const getSeparatorColorForEmployee = useCallback(
    (employeeIndex: number): string | undefined => {
      // Buscar el último separador antes de este índice
      for (let i = employeeIndex - 1; i >= 0; i--) {
        const item = orderedItems[i]
        if (item.type === "separator") {
          // Si el separador tiene color, usarlo
          if (item.data.color) {
            return item.data.color
          }
          return undefined
        }
      }
      return undefined
    },
    [orderedItems]
  )

  const isClickable = !readonly && !!(onShiftUpdate || onAssignmentUpdate)

  return (
    <>
      {/* Botón global de deshacer */}
      {!readonly && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGlobalUndo}
            disabled={!canUndo}
            className="gap-2"
            title={lastChangeDescription || "Deshacer último cambio"}
          >
            <Undo2 className="h-4 w-4" />
            Deshacer
            {lastChangeDescription && (
              <span className="ml-2 text-xs text-muted-foreground max-w-[200px] truncate">
                ({lastChangeDescription})
              </span>
            )}
            <span className="ml-2 text-xs text-muted-foreground">Ctrl+Z</span>
          </Button>
        </div>
      )}

      <Card className="overflow-hidden border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <GridHeader weekDays={weekDays} />
            <tbody>
              {orderedItems.map((item, itemIndex) => {
                const showAddButton = !readonly && item.type === "employee"
                const insertIndex = itemIndex

                return (
                  <React.Fragment key={item.type === "employee" ? `emp-${item.data.id}` : `sep-${item.data.id}`}>
                    {item.type === "separator" ? (
                      <SeparatorRow
                        separator={item.data}
                        weekDaysCount={weekDays.length}
                        editingSeparatorId={editingSeparatorId}
                        separatorEditName={separatorEditName}
                        separatorEditColor={separatorEditColor}
                        readonly={readonly}
                        onEditNameChange={setSeparatorEditName}
                        onEditColorChange={setSeparatorEditColor}
                        onSave={handleSaveSeparatorEdit}
                        onCancel={handleCancelEdit}
                        onEdit={handleEditSeparator}
                        onDelete={handleDeleteSeparator}
                      />
                    ) : (
                      <EmployeeRow
                        employee={item.data}
                        weekDays={weekDays}
                        monthRange={monthRange}
                        readonly={readonly}
                        employeeIndex={itemIndex}
                        separatorColor={getSeparatorColorForEmployee(itemIndex)}
                        showAddButton={showAddButton}
                        employeeStats={employeeStats}
                        getEmployeeAssignments={getEmployeeAssignments}
                        getCellBackgroundStyle={getCellBackgroundStyle}
                        getShiftInfo={getShiftInfo}
                        selectedCell={selectedCell}
                        isClickable={isClickable}
                        onCellClick={handleCellClick}
                        onAddSeparator={handleAddSeparator}
                        draggedEmployeeId={draggedEmployeeId}
                        dragOverEmployeeId={dragOverEmployeeId}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        extraMenuOpenKey={extraMenuOpenKey}
                        handleToggleExtra={handleToggleExtra}
                        setExtraMenuOpenKey={setExtraMenuOpenKey}
                        adjustTime={adjustTime}
                        onAssignmentUpdate={onAssignmentUpdate}
                        scheduleId={schedule?.id}
                        shifts={shifts}
                        mediosTurnos={mediosTurnos}
                        onQuickAssignments={handleQuickAssignments}
                        cellUndoHistory={cellUndoHistory}
                        handleCellUndo={handleCellUndo}
                        handleGlobalUndo={handleGlobalUndo}
                        canUndo={canUndo}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {/* El selector de turnos ahora se muestra inline en la celda seleccionada,
          así que ya no usamos el modal ShiftSelectorPopover */}
    </>
  )
})

