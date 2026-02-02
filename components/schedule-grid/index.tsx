"use client"

import React, { memo, useMemo, useCallback, useState } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Card } from "@/components/ui/card"
import { Empleado, Turno, Horario, HistorialItem, ShiftAssignment, MedioTurno } from "@/lib/types"
import { ShiftSelectorPopover } from "../shift-selector-popover"
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
import { useEmployeeFixedRules } from "@/hooks/use-employee-fixed-rules"
import { FixedRuleModal } from "./components/fixed-rule-modal"
import { useIsMobile } from "@/hooks/use-mobile"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { isAssignmentIncomplete } from "@/lib/assignment-utils"

export interface EmployeeMonthlyStats {
  francos: number
  francosSemana: number
  horasExtrasSemana: number
  horasExtrasMes: number
  horasComputablesMes: number
  horasSemana: number
  horasLicenciaEmbarazo?: number
  horasMedioFranco?: number
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
  onExportEmployeeImage?: (employeeId: string, employeeName: string, weekStartDate: Date) => void // Función para exportar imagen de un empleado
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
  onExportEmployeeImage,
}: ScheduleGridProps) {
  const [selectedCell, setSelectedCell] = useState<{ date: string; employeeId: string } | null>(null)
  const [cellUndoHistory, setCellUndoHistory] = useState<Map<string, ShiftAssignment[]>>(new Map())
  const [fixedRuleModalOpen, setFixedRuleModalOpen] = useState(false)
  const [fixedRuleModalData, setFixedRuleModalData] = useState<{
    employeeId: string
    employeeName: string
    date: Date
  } | null>(null)

  // Intentar obtener user del contexto si no se proporciona como prop
  // Usar useContext directamente para evitar el error si no hay DataProvider
  const dataContext = useContext(DataContext)
  const contextUser = dataContext?.user || null
  const user = userProp || contextUser
  
  const { config } = useConfig(user)
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const { updateEmployeeOrder, addSeparator, updateSeparator, deleteSeparator } = useEmployeeOrder()

  // Hook para reglas fijas
  const { hasFixedRule, getRuleForDay } = useEmployeeFixedRules({ 
    ownerId: readonly ? undefined : user?.uid 
  })

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

  // Función para verificar si una celda tiene assignments incompletos
  const hasIncompleteAssignments = useCallback(
    (employeeId: string, date: string): boolean => {
      const assignments = getEmployeeAssignments(employeeId, date)
      return assignments.some(a => isAssignmentIncomplete(a))
    },
    [getEmployeeAssignments]
  )

  // Handlers
  const handleCellClick = useCallback(
    (date: string, employeeId: string) => {
      if (!readonly && (onShiftUpdate || onAssignmentUpdate)) {
        // Verificar si hay assignments incompletos antes de permitir edición
        if (hasIncompleteAssignments(employeeId, date)) {
          toast({
            title: "Edición bloqueada",
            description: "Esta celda contiene assignments incompletos. Debe normalizarlos antes de editar.",
            variant: "destructive",
          })
          return
        }
        saveCellState(date, employeeId)
        setSelectedCell({ date, employeeId })
      }
    },
    [readonly, onShiftUpdate, onAssignmentUpdate, saveCellState, hasIncompleteAssignments, toast]
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

  // Función para manejar el toggle de reglas fijas
  const handleToggleFixed = useCallback(
    (date: string, employeeId: string, dayOfWeek: number) => {
      const employee = employeesToUse.find((emp) => emp.id === employeeId)
      if (!employee) return

      const dateObj = parseISO(date)
      
      setFixedRuleModalData({
        employeeId,
        employeeName: employee.name,
        date: dateObj
      })
      setFixedRuleModalOpen(true)
    },
    [employeesToUse]
  )

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
    const weekStartDate = weekDays[0]
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
          onAssignmentUpdate={onAssignmentUpdate}
          scheduleId={schedule?.id}
          readonly={readonly}
          employeeStats={employeeStats}
          shifts={shifts}
          mediosTurnos={mediosTurnos}
          cellUndoHistory={cellUndoHistory}
          handleCellUndo={handleCellUndo}
          getSuggestion={getSuggestion}
          isManuallyFixed={isManuallyFixed}
          onToggleFixed={handleToggleFixed}
          onExportEmployeeImage={onExportEmployeeImage}
          weekStartDate={weekStartDate}
        />
      </>
    )
  }

  // Vista desktop (tabla)
  return (
    <>
      <Card 
        className="overflow-hidden border border-border bg-card"
        onClick={(e) => {
          // Detectar si el click fue dentro de la tabla
          const target = e.target as HTMLElement
          const isInsideTable = target.closest('table')
          // Detectar si el click fue en el selector inline
          const isInlineSelector = target.closest('[data-inline-selector]')
          
          // Si hay un selector abierto y el click no fue dentro de la tabla ni en el selector
          if (selectedCell && !isInsideTable && !isInlineSelector) {
            setSelectedCell(null)
          }
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <GridHeader weekDays={weekDays} user={user} onCloseSelector={() => setSelectedCell(null)} />
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
                        onCloseSelector={() => setSelectedCell(null)}
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
                        onCloseSelector={() => setSelectedCell(null)}
                        config={config}
                        hasIncompleteAssignments={hasIncompleteAssignments}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Modal para reglas fijas */}
      {fixedRuleModalOpen && fixedRuleModalData && (
        <FixedRuleModal
          isOpen={fixedRuleModalOpen}
          onClose={() => {
            setFixedRuleModalOpen(false)
            setFixedRuleModalData(null)
          }}
          employeeId={fixedRuleModalData.employeeId}
          employeeName={fixedRuleModalData.employeeName}
          date={fixedRuleModalData.date}
          shifts={shifts}
          user={user}
        />
      )}
      
      {/* El selector de turnos ahora se muestra inline en la celda seleccionada,
          así que ya no usamos el modal ShiftSelectorPopover */}
    </>
  )
})
