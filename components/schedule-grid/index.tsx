"use client"

import React, { memo, useMemo, useCallback, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Card } from "@/components/ui/card"
import { Empleado, Turno, Horario, HistorialItem, ShiftAssignment, MedioTurno } from "@/lib/types"
import { ShiftSelectorPopover } from "../shift-selector-popover"
import { adjustTime } from "@/lib/utils"
import { useConfig } from "@/hooks/use-config"
import { useEmployeeOrder } from "@/hooks/use-employee-order"
import { useToast } from "@/hooks/use-toast"
import { useContext } from "react"
import { DataContext } from "@/contexts/data-context"
import { useScheduleGridData } from "./hooks/use-schedule-grid-data"
import { useCellBackgroundStyles } from "./hooks/use-cell-background-styles"
import { useDragAndDrop } from "./hooks/use-drag-and-drop"
import { useSeparators } from "./hooks/use-separators"
import { GridHeader } from "./components/grid-header"
import { SeparatorRow } from "./components/separator-row"
import { EmployeeRow } from "./components/employee-row"
import { ScheduleGridMobile } from "./components/schedule-grid-mobile"
import { hexToRgba } from "./utils/schedule-grid-utils"
import type { GridItem } from "./hooks/use-schedule-grid-data"
import { usePatternSuggestions } from "@/hooks/use-pattern-suggestions"
import { useIsMobile } from "@/hooks/use-mobile"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"

export interface EmployeeMonthlyStats {
  francos: number
  horasExtrasSemana: number
  horasExtrasMes: number
}

interface ScheduleGridProps {
  weekDays: Date[]
  employees: Empleado[]
  allEmployees?: Empleado[]
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
  isScheduleCompleted?: boolean // Indica si el horario está completado
  lastCompletedWeekStart?: string | null // Fecha de inicio de la última semana completada (formato yyyy-MM-dd)
  onClearEmployeeRow?: (employeeId: string) => Promise<boolean> // Función optimizada para limpiar fila del empleado
  allSchedules?: Horario[] // Todos los horarios para análisis de patrones
  user?: any // Usuario opcional (para páginas públicas sin DataProvider)
}

export const ScheduleGrid = memo(function ScheduleGrid({
  weekDays,
  employees,
  allEmployees,
  shifts,
  schedule,
  onShiftUpdate,
  onAssignmentUpdate,
  readonly = false,
  monthRange,
  mediosTurnos = [],
  employeeStats,
  isFirstWeek = false,
  isScheduleCompleted = false,
  lastCompletedWeekStart,
  onClearEmployeeRow: externalOnClearEmployeeRow,
  allSchedules = [],
  user: userProp,
}: ScheduleGridProps) {
  const [selectedCell, setSelectedCell] = useState<{ date: string; employeeId: string } | null>(null)
  const [extraMenuOpenKey, setExtraMenuOpenKey] = useState<string | null>(null)
  const [cellUndoHistory, setCellUndoHistory] = useState<Map<string, ShiftAssignment[]>>(new Map())

  // Intentar obtener user del contexto si no se proporciona como prop
  // Usar useContext directamente para evitar el error si no hay DataProvider
  const dataContext = useContext(DataContext)
  const contextUser = dataContext?.user || null
  const user = userProp || contextUser
  
  const { config } = useConfig(user)
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const { updateEmployeeOrder, addSeparator, updateSeparator, deleteSeparator } = useEmployeeOrder()

  // Combinar empleados actuales con snapshot cuando el horario está completado
  const employeesToUse = useMemo(() => {
    // Verificar que es un Horario (no HistorialItem) y tiene snapshot
    // HistorialItem tiene 'horarioId', Horario no
    if (isScheduleCompleted && schedule && !('horarioId' in schedule)) {
      const horarioSchedule = schedule as Horario
      if (horarioSchedule.empleadosSnapshot) {
        // Crear un mapa de empleados actuales
        const currentEmployeesMap = new Map(employees.map((emp) => [emp.id, emp]))
        const combined: Empleado[] = []
        
        // Primero agregar empleados del snapshot (mantener orden y datos históricos)
        horarioSchedule.empleadosSnapshot.forEach((snapshotEmp) => {
          const currentEmp = currentEmployeesMap.get(snapshotEmp.id)
          if (currentEmp) {
            // Si el empleado existe actualmente, usar datos actuales pero mantener estructura
            combined.push(currentEmp)
          } else {
            // Si el empleado fue eliminado, usar datos del snapshot
            combined.push({
              id: snapshotEmp.id,
              name: snapshotEmp.name,
              email: snapshotEmp.email,
              phone: snapshotEmp.phone,
              userId: '', // No disponible en snapshot, pero necesario para el tipo
            } as Empleado)
          }
        })
        
        return combined
      }
    }
    return employees
  }, [employees, schedule, isScheduleCompleted])

  // Obtener la fecha de inicio de la semana actual
  const currentWeekStart = useMemo(() => {
    return format(weekDays[0], "yyyy-MM-dd")
  }, [weekDays])

  // Hook para sugerencias de patrones (después de employeesToUse)
  const weekStartDate = weekDays[0]
  const { getSuggestion } = usePatternSuggestions({
    employees: employeesToUse,
    schedules: allSchedules,
    targetWeekStart: weekStartDate,
    config,
  })

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
    employees: employeesToUse,
    shifts,
    separadores: config?.separadores,
    ordenEmpleados: isScheduleCompleted && schedule && !('horarioId' in schedule) && (schedule as Horario).ordenEmpleadosSnapshot
      ? (schedule as Horario).ordenEmpleadosSnapshot
      : config?.ordenEmpleados,
    schedule,
    isScheduleCompleted,
    currentWeekStart,
    lastCompletedWeekStart,
    allEmployees: allEmployees || employees, // Todos los empleados (sin filtrar) para el filtrado correcto
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

  // Handlers
  const handleCellClick = useCallback(
    (date: string, employeeId: string) => {
      if (!readonly && (onShiftUpdate || onAssignmentUpdate)) {
        saveCellState(date, employeeId)
        setSelectedCell({ date, employeeId })
      }
    },
    [readonly, onShiftUpdate, onAssignmentUpdate, saveCellState]
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
      
      const assignments = getEmployeeAssignments(employeeId, date)
      if (assignments.length === 0) return

      const targetIndex = assignments.findIndex(
        (assignment) => assignment.type !== "franco" && assignment.type !== "medio_franco" && assignment.shiftId
      )
      if (targetIndex === -1) return

      const assignment = { ...assignments[targetIndex] }
      const shift = assignment.shiftId ? getShiftInfo(assignment.shiftId) : undefined
      if (!shift || !shift.startTime || !shift.endTime) return

      // Usar los valores actuales del assignment (si existen) o los del turno base
      const currentStartTime = assignment.startTime || shift.startTime
      const currentEndTime = assignment.endTime || shift.endTime

      // Calcular los horarios extendidos desde los valores actuales
      const extendedStart = adjustTime(currentStartTime, -30)
      const extendedEnd = adjustTime(currentEndTime, 30)

      // Calcular los horarios extendidos desde el turno base (para comparar)
      const baseExtendedStart = adjustTime(shift.startTime, -30)
      const baseExtendedEnd = adjustTime(shift.endTime, 30)

      if (type === "before") {
        if (!extendedStart || !baseExtendedStart) return
        // Si ya tiene el horario extendido (30 min antes del turno base), eliminarlo
        // Si el valor actual es igual al extendido desde el turno base, significa que ya tiene la hora extra
        if (assignment.startTime === baseExtendedStart) {
          // Ya tiene la hora extra, eliminarla para restaurar al horario base
          delete assignment.startTime
        } else {
          // No tiene la hora extra o tiene un valor diferente, aplicar el extendido desde el turno base
          assignment.startTime = baseExtendedStart
        }
      } else {
        if (!extendedEnd || !baseExtendedEnd) return
        // Si ya tiene el horario extendido (30 min después del turno base), eliminarlo
        // Si el valor actual es igual al extendido desde el turno base, significa que ya tiene la hora extra
        if (assignment.endTime === baseExtendedEnd) {
          // Ya tiene la hora extra, eliminarla para restaurar al horario base
          delete assignment.endTime
        } else {
          // No tiene la hora extra o tiene un valor diferente, aplicar el extendido desde el turno base
          assignment.endTime = baseExtendedEnd
        }
      }

      const updatedAssignments = assignments.map((item, idx) => (idx === targetIndex ? assignment : item))

      onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId: schedule?.id })
    },
    [getEmployeeAssignments, getShiftInfo, onAssignmentUpdate, schedule?.id, saveCellState]
  )

  const handleQuickAssignments = useCallback(
    (date: string, employeeId: string, assignments: ShiftAssignment[]) => {
      // Guardar estado antes de actualizar
      saveCellState(date, employeeId)
      
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
    [onAssignmentUpdate, onShiftUpdate, schedule?.id, saveCellState]
  )

  // Función para limpiar todas las asignaciones de un empleado para toda la semana
  const handleClearEmployeeRow = useCallback(
    async (employeeId: string) => {
      // Si hay una función externa optimizada, usarla
      if (externalOnClearEmployeeRow) {
        return await externalOnClearEmployeeRow(employeeId)
      }

      // Fallback a la implementación anterior si no hay función externa
      if (!onAssignmentUpdate || readonly || !schedule) return false

      try {
        const employee = employeesToUse.find((emp) => emp.id === employeeId)
        const employeeName = employee?.name || "empleado"

        let clearedCount = 0

        // Limpiar asignaciones del empleado para todos los días de la semana
        for (const day of weekDays) {
          const dateStr = format(day, "yyyy-MM-dd")
          
          // Verificar si el empleado tiene asignaciones en este día
          const hasAssignments = schedule.assignments?.[dateStr]?.[employeeId]
          
          if (hasAssignments) {
            // Limpiar las asignaciones (pasar array vacío)
            await onAssignmentUpdate(
              dateStr,
              employeeId,
              [],
              { scheduleId: schedule.id }
            )
            clearedCount++
          }
        }

        if (clearedCount > 0) {
          toast({
            title: "Fila limpiada",
            description: `Se limpiaron todas las asignaciones de ${employeeName}.`,
          })
        } else {
          toast({
            title: "No hay asignaciones",
            description: `${employeeName} no tiene asignaciones para limpiar.`,
            variant: "default",
          })
        }

        return clearedCount > 0
      } catch (error: any) {
        console.error("Error al limpiar fila del empleado:", error)
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al limpiar la fila del empleado",
          variant: "destructive",
        })
        return false
      }
    },
    [externalOnClearEmployeeRow, onAssignmentUpdate, weekDays, schedule, readonly, employeesToUse, toast]
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

  // Funciones para manejar horarios fijos manuales
  const isManuallyFixed = useCallback(
    (employeeId: string, dayOfWeek: number): boolean => {
      if (!config?.fixedSchedules) return false
      return config.fixedSchedules.some(
        (fixed) => fixed.employeeId === employeeId && fixed.dayOfWeek === dayOfWeek
      )
    },
    [config?.fixedSchedules]
  )

  const handleToggleFixed = useCallback(
    async (date: string, employeeId: string, dayOfWeek: number) => {
      if (!user || !db || readonly) return

      try {
        const configRef = doc(db, COLLECTIONS.CONFIG, user.uid)
        const currentFixed = config?.fixedSchedules || []
        const existingIndex = currentFixed.findIndex(
          (fixed) => fixed.employeeId === employeeId && fixed.dayOfWeek === dayOfWeek
        )

        // Obtener las asignaciones actuales de esta celda
        const currentAssignments = getEmployeeAssignments(employeeId, date)

        let newFixed: Array<{ employeeId: string; dayOfWeek: number; assignments?: ShiftAssignment[] }>
        if (existingIndex >= 0) {
          // Remover si ya existe
          newFixed = currentFixed.filter((_, index) => index !== existingIndex)
          toast({
            title: "Horario fijo desmarcado",
            description: "Este horario ya no se recordará automáticamente.",
          })
        } else {
          // Agregar si no existe, guardando las asignaciones actuales
          newFixed = [...currentFixed, { 
            employeeId, 
            dayOfWeek,
            assignments: currentAssignments.length > 0 ? currentAssignments : undefined
          }]
          toast({
            title: "Horario fijo marcado",
            description: currentAssignments.length > 0 
              ? "Este horario se recordará para futuras semanas."
              : "Este horario se recordará cuando tenga asignaciones.",
          })
        }

        await updateDoc(configRef, {
          fixedSchedules: newFixed,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email || "Usuario",
        })
      } catch (error: any) {
        console.error("Error al actualizar horario fijo:", error)
        toast({
          title: "Error",
          description: "No se pudo actualizar el horario fijo",
          variant: "destructive",
        })
      }
    },
    [user, db, readonly, config?.fixedSchedules, toast, getEmployeeAssignments]
  )

  // Preparar datos de días para vista móvil
  const weekDaysData = useMemo(() => {
    return weekDays.map((day) => ({
      date: day,
      dateStr: format(day, "yyyy-MM-dd"),
      dayName: format(day, "EEEE", { locale: es }),
      dayNumber: format(day, "d MMM", { locale: es }),
    }))
  }, [weekDays])

  // Filtrar solo empleados (sin separadores) para vista móvil
  const employeesForMobile = useMemo(() => {
    return orderedItems
      .filter((item) => item.type === "employee")
      .map((item) => item.data as Empleado)
  }, [orderedItems])

  // Vista móvil
  if (isMobile) {
    return (
      <>
        <ScheduleGridMobile
          weekDays={weekDays}
          employees={employeesForMobile}
          weekDaysData={weekDaysData}
          getEmployeeAssignments={getEmployeeAssignments}
          getCellBackgroundStyle={getCellBackgroundStyle}
          getShiftInfo={getShiftInfo}
          selectedCell={selectedCell}
          isClickable={isClickable}
          onCellClick={handleCellClick}
          onQuickAssignments={handleQuickAssignments}
          readonly={readonly}
          employeeStats={employeeStats}
          shifts={shifts}
          mediosTurnos={mediosTurnos}
          cellUndoHistory={cellUndoHistory}
          handleCellUndo={handleCellUndo}
          getSuggestion={getSuggestion}
          isManuallyFixed={isManuallyFixed}
          onToggleFixed={handleToggleFixed}
        />
      </>
    )
  }

  // Vista desktop (tabla)
  return (
    <>
      <Card className="overflow-hidden border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <GridHeader weekDays={weekDays} user={user} />
            <tbody>
              {orderedItems.map((item, itemIndex) => {
                const showAddButton = !readonly && item.type === "employee"
                const insertIndex = itemIndex
                // Detectar si es el primer separador (está en el índice 0)
                const isFirstSeparator = item.type === "separator" && itemIndex === 0

                return (
                  <React.Fragment key={item.type === "employee" ? `emp-${item.data.id}` : `sep-${item.data.id}`}>
                    {item.type === "separator" ? (
                      <SeparatorRow
                        separator={item.data}
                        weekDays={weekDays}
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
                        isFirstSeparator={isFirstSeparator}
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
                        onClearEmployeeRow={handleClearEmployeeRow}
                        getSuggestion={getSuggestion}
                        isManuallyFixed={isManuallyFixed}
                        onToggleFixed={handleToggleFixed}
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

