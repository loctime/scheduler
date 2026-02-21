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
import { useSectorCoverage } from "./hooks/use-sector-coverage"
import { GridHeader } from "./components/grid-header"
import { SeparatorRow } from "./components/separator-row"
import { EmployeeRow } from "./components/employee-row"
import { ScheduleGridMobile } from "./components/schedule-grid-mobile"
import { hexToRgba, formatStatValue } from "./utils/schedule-grid-utils"
import { ScheduleCell } from "./components/schedule-cell"
import type { EmployeeMonthlyStats } from "@/types/employee-stats"
import { usePatternSuggestions } from "@/hooks/use-pattern-suggestions"
import { useEmployeeFixedRules } from "@/hooks/use-employee-fixed-rules"
import { FixedRuleModal } from "./components/fixed-rule-modal"
import { useIsMobile } from "@/hooks/use-mobile"
import { useScheduleGridImage } from "@/hooks/useScheduleGridImage"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { isAssignmentIncomplete } from "@/lib/assignment-utils"
import { Grid, User } from "lucide-react"
import { forwardRef, useRef, useEffect } from "react"

interface ScheduleGridProps {
  weekDays: Date[]
  employees: Empleado[]
  allEmployees?: Empleado[]
  shifts: Turno[]
  schedule: Horario | HistorialItem | null
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
  /** En móvil mostrar solo vista individual (sin toggle Grilla completa). Usado en vista mensual. */
  mobileIndividualOnly?: boolean
  /** ID del empleado a mostrar primero en vista individual (p. ej. el de "¿Quién sos?"). */
  preferredEmployeeId?: string | null
}

export const ScheduleGrid = forwardRef<HTMLDivElement, ScheduleGridProps>(({
  weekDays,
  employees,
  allEmployees,
  shifts,
  schedule,
  onAssignmentUpdate,
  readonly = false,
  monthRange,
  mediosTurnos = [],
  employeeStats,
  isFirstWeek = false,
  isScheduleCompleted = false,
  lastCompletedWeekStart = null,
  onClearEmployeeRow: externalOnClearEmployeeRow,
  allSchedules = [],
  user: userProp,
  onExportEmployeeImage,
  mobileIndividualOnly = false,
  preferredEmployeeId = null,
}, ref) => {
  const [selectedCell, setSelectedCell] = useState<{ date: string; employeeId: string } | null>(null)
  const [cellUndoHistory, setCellUndoHistory] = useState<Map<string, ShiftAssignment[]>>(new Map())
  const [fixedRuleModalOpen, setFixedRuleModalOpen] = useState(false)
  const [fixedRuleModalData, setFixedRuleModalData] = useState<{
    employeeId: string
    employeeName: string
    date: Date
  } | null>(null)

  // Estado para controlar vista en móvil (si mobileIndividualOnly, siempre individual)
  const [isIndividualView, setIsIndividualView] = useState(false)
  
  // Refs para generación de imagen
  const gridRef = useRef<HTMLDivElement>(null)
  const hiddenGridRef = useRef<HTMLDivElement>(null)
  
  // Hook para generar imagen de la grilla
  const { imageUrl, generateImage, loading } = useScheduleGridImage()

  // Intentar obtener user del contexto si no se proporciona como prop
  // Usar useContext directamente para evitar el error si no hay DataProvider
  const dataContext = useContext(DataContext)
  const contextUser = dataContext?.user || null
  const user = userProp || contextUser
  
  const { config } = useConfig(user)
  // Usar mediosTurnos de config cuando esté disponible (evita que llegue vacío por timing o prop no pasada)
  const effectiveMediosTurnos = (config?.mediosTurnos ?? mediosTurnos) ?? []
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const { updateEmployeeOrder, addSeparator, updateSeparator, deleteSeparator } = useEmployeeOrder()


  // Hook para reglas fijas
  const { hasFixedRule, getRuleForDay } = useEmployeeFixedRules({ 
    ownerId: readonly ? undefined : user?.uid 
  })

  const employeesToUse = employees

  // Obtener la fecha de inicio de la semana actual
  const currentWeekStart = useMemo(() => {
    return weekDays[0]
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
    getEmployeeAssignments,
    getEmployeeDayStatus,
    getShiftInfo,
    updateEmployeeRequestCache,
  } = useScheduleGridData({
    employees: employeesToUse,
    shifts,
    separadores: config?.separadores || [],
    ordenEmpleados: config?.ordenEmpleados,
    schedule: schedule && !('horarioId' in schedule) ? schedule as Horario : null,
    scheduleId: schedule?.id,
    isScheduleCompleted,
    currentWeekStart,
    lastCompletedWeekStart: lastCompletedWeekStart ? new Date(lastCompletedWeekStart) : undefined,
    allEmployees: allEmployees || employees, // Todos los empleados (sin filtrar) para el filtrado correcto
  })

  // Efecto para generar imagen de la grilla en móvil solo cuando hay datos (evita grilla en blanco en PWA/mensual)
  useEffect(() => {
    if (!isMobile || (orderedItems?.length ?? 0) === 0) return
    const id = requestAnimationFrame(() => {
      setTimeout(() => {
        if (hiddenGridRef.current) {
          generateImage(hiddenGridRef.current)
        }
      }, 300)
    })
    return () => cancelAnimationFrame(id)
  }, [isMobile, generateImage, orderedItems?.length])

  // Hook para estilos de celdas
  const { getCellBackgroundStyle } = useCellBackgroundStyles({
    getEmployeeAssignments,
    getEmployeeDayStatus,
    getShiftInfo,
    shifts,
    mediosTurnos: effectiveMediosTurnos,
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
    separatorEditMinimoCobertura,
    setSeparatorEditName,
    setSeparatorEditColor,
    setSeparatorEditMinimoCobertura,
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

  // Análisis de cobertura mínima por sector (solo cuando cambian assignments, orden o separadores)
  const sectorCoverage = useSectorCoverage({
    orderedItems: orderedItems ?? [],
    assignments: schedule?.assignments ?? {},
    separadores: config?.separadores ?? [],
    weekDays,
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
      if (!readonly && onAssignmentUpdate) {
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
    [readonly, onAssignmentUpdate, saveCellState, hasIncompleteAssignments, toast]
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
      }
    },
    [onAssignmentUpdate, schedule?.id, saveCellState]
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

  // Memoizar los valores pasados al diálogo para evitar re-renders infinitos
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

  const isClickable = !readonly && !isScheduleCompleted && !!onAssignmentUpdate

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

  // Filtrar solo empleados (sin separadores) para vista móvil; si hay preferredEmployeeId, ponerlo primero
  const employeesForMobile = useMemo(() => {
    const list = (orderedItems || [])
      .filter((item) => item.type === "employee")
      .map((item) => item.data as Empleado)
    if (preferredEmployeeId && list.some((e) => e.id === preferredEmployeeId)) {
      const preferred = list.find((e) => e.id === preferredEmployeeId)!
      const rest = list.filter((e) => e.id !== preferredEmployeeId)
      return [preferred, ...rest]
    }
    return list
  }, [orderedItems, preferredEmployeeId])

  // Función para renderizar la grilla desktop (reutilizable)
  const renderDesktopGrid = ({ 
    containerRef 
  }: { 
    containerRef?: React.RefObject<HTMLDivElement | null>
  } = {}) => {
    const isHiddenContainer = !!containerRef
    
    return (
      <Card 
        ref={containerRef}
        className="overflow-hidden border border-border bg-card"
        style={isHiddenContainer ? {
          position: "absolute",
          top: "-9999px",
          left: "-9999px",
          width: "1400px",
        } : undefined}
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
            <GridHeader 
              weekDays={weekDays} 
              user={user} 
              readonly={readonly}
              onCloseSelector={() => setSelectedCell(null)} 
            />
            <tbody>
              {(orderedItems || []).map((item, itemIndex) => {
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
                        separatorEditMinimoCobertura={separatorEditMinimoCobertura}
                        onEditMinimoCoberturaChange={setSeparatorEditMinimoCobertura}
                        readonly={readonly}
                        onEditNameChange={setSeparatorEditName}
                        onEditColorChange={setSeparatorEditColor}
                        onSave={handleSaveSeparatorEdit}
                        onCancel={handleCancelEdit}
                        onEdit={handleEditSeparator}
                        onDelete={handleDeleteSeparator}
                        isFirstSeparator={isFirstSeparator}
                        onCloseSelector={() => setSelectedCell(null)}
                        coverageAlertByDay={
                          sectorCoverage[item.data.id]
                            ? Object.fromEntries(
                                Object.entries(sectorCoverage[item.data.id]).map(([k, v]) => [k, v.hasAlert])
                              )
                            : {}
                        }
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
                        getEmployeeDayStatus={getEmployeeDayStatus}
                        getCellBackgroundStyle={getCellBackgroundStyle}
                        getShiftInfo={getShiftInfo}
                        selectedCell={selectedCell}
                        isClickable={isClickable}
                        onCellClick={handleCellClick}
                        onAssignmentUpdate={onAssignmentUpdate}
                        scheduleId={schedule?.id}
                        shifts={shifts}
                        mediosTurnos={effectiveMediosTurnos}
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
                        updateEmployeeRequestCache={updateEmployeeRequestCache}
                        draggedEmployeeId={draggedEmployeeId}
                        dragOverEmployeeId={dragOverEmployeeId}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onAddSeparator={handleAddSeparator}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  // Vista móvil
  if (isMobile) {
    const weekStartDate = weekDays[0]
    const showOnlyIndividual = mobileIndividualOnly || isIndividualView

    // Renderizar vista individual (o siempre si mobileIndividualOnly, p. ej. mensual)
    if (showOnlyIndividual) {
      return (
        <>
          <ScheduleGridMobile
            weekDays={weekDays}
            employees={employeesForMobile}
            weekDaysData={weekDaysData}
            getEmployeeAssignments={getEmployeeAssignments}
            getEmployeeDayStatus={getEmployeeDayStatus}
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
            mediosTurnos={effectiveMediosTurnos}
            cellUndoHistory={cellUndoHistory}
            handleCellUndo={handleCellUndo}
            getSuggestion={getSuggestion}
            isManuallyFixed={isManuallyFixed}
            onToggleFixed={handleToggleFixed}
            onExportEmployeeImage={onExportEmployeeImage}
            weekStartDate={weekStartDate}
            updateEmployeeRequestCache={updateEmployeeRequestCache}
          />
        </>
      )
    }
    
    // Renderizar vista completa con imagen generada (ocultar toggle si mobileIndividualOnly)
    return (
      <>
        {!mobileIndividualOnly && (
          <div className="flex justify-center mb-4 gap-2">
            <button
              onClick={() => setIsIndividualView(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                !isIndividualView
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Grid className="h-4 w-4" />
              Grilla completa
            </button>
            <button
              onClick={() => setIsIndividualView(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isIndividualView
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <User className="h-4 w-4" />
              Vista individual
            </button>
          </div>
        )}
        
        {/* Contenedor oculto para generar imagen - ref directo al Card */}
        {renderDesktopGrid({ containerRef: hiddenGridRef })}
        
        {/* Vista de imagen generada o fallback a grilla real si falla (p. ej. PWA/Safari) */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Generando vista del horario...</div>
          </div>
        ) : imageUrl ? (
          <div className="w-full overflow-x-auto">
            <img
              src={imageUrl}
              alt="Horario completo"
              style={{
                width: '1400px',
                maxWidth: 'none',
                height: 'auto',
              }}
            />
          </div>
        ) : (orderedItems?.length ?? 0) > 0 ? (
          <div className="w-full overflow-x-auto">
            {renderDesktopGrid()}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Preparando vista del horario...</div>
          </div>
        )}
      </>
    )
  }

  // Vista desktop (tabla)
  return (
    <div ref={ref} className="schedule-grid-container">
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
            <GridHeader weekDays={weekDays} user={user} readonly={readonly} onCloseSelector={() => setSelectedCell(null)} />
            <tbody>
              {(orderedItems || []).map((item, itemIndex) => {
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
                        separatorEditMinimoCobertura={separatorEditMinimoCobertura}
                        onEditMinimoCoberturaChange={setSeparatorEditMinimoCobertura}
                        readonly={readonly}
                        onEditNameChange={setSeparatorEditName}
                        onEditColorChange={setSeparatorEditColor}
                        onSave={handleSaveSeparatorEdit}
                        onCancel={handleCancelEdit}
                        onEdit={handleEditSeparator}
                        onDelete={handleDeleteSeparator}
                        isFirstSeparator={isFirstSeparator}
                        onCloseSelector={() => setSelectedCell(null)}
                        coverageAlertByDay={
                          sectorCoverage[item.data.id]
                            ? Object.fromEntries(
                                Object.entries(sectorCoverage[item.data.id]).map(([k, v]) => [k, v.hasAlert])
                              )
                            : {}
                        }
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
                        getEmployeeDayStatus={getEmployeeDayStatus}
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
                        mediosTurnos={effectiveMediosTurnos}
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
    </div>
  )
})

ScheduleGrid.displayName = 'ScheduleGrid'
