"use client"

import React, { memo, useMemo, useCallback, useState } from "react"
import type { CSSProperties } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Empleado, Turno, Horario, HistorialItem, ShiftAssignment, ShiftAssignmentValue, MedioTurno, Separador } from "@/lib/types"
import { ShiftSelectorPopover } from "./shift-selector-popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Check, GripVertical, Plus, Trash2, Edit2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { adjustTime } from "@/lib/utils"
import { useConfig } from "@/hooks/use-config"
import { useEmployeeOrder } from "@/hooks/use-employee-order"

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
    options?: { scheduleId?: string },
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
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null)
  const [dragOverEmployeeId, setDragOverEmployeeId] = useState<string | null>(null)
  const [editingSeparatorId, setEditingSeparatorId] = useState<string | null>(null)
  const [separatorEditName, setSeparatorEditName] = useState("")
  const [hoveredGapIndex, setHoveredGapIndex] = useState<number | null>(null)
  
  const { config } = useConfig()
  const { updateEmployeeOrder, addSeparator, updateSeparator, deleteSeparator } = useEmployeeOrder()

  // Memoizar mapa de turnos para búsqueda O(1)
  const shiftMap = useMemo(() => {
    return new Map(shifts.map((s) => [s.id, s]))
  }, [shifts])

  // Memoizar mapa de puestos para búsqueda O(1)
  const puestoMap = useMemo(() => {
    if (!config?.puestos) return new Map()
    return new Map(config.puestos.map((p) => [p.id, p]))
  }, [config?.puestos])

  // Memoizar mapa de separadores para búsqueda O(1)
  const separadorMap = useMemo(() => {
    if (!config?.separadores) return new Map()
    return new Map(config.separadores.map((s) => [s.id, s]))
  }, [config?.separadores])

  // Obtener orden de elementos (empleados y separadores) desde configuración o usar orden por defecto
  const orderedItemIds = useMemo(() => {
    if (config?.ordenEmpleados && config.ordenEmpleados.length > 0) {
      const employeeIds = new Set(employees.map(emp => emp.id))
      const separatorIds = new Set(config.separadores?.map(s => s.id) || [])
      
      // Filtrar solo IDs válidos (empleados o separadores)
      const validOrder = config.ordenEmpleados.filter(id => 
        employeeIds.has(id) || separatorIds.has(id)
      )
      
      // Agregar empleados nuevos que no estén en el orden
      const newEmployees = employees
        .filter(emp => !validOrder.includes(emp.id))
        .map(emp => emp.id)
      
      return [...validOrder, ...newEmployees]
    }
    // Si no hay orden guardado, usar el orden por defecto (por nombre)
    return employees.map(emp => emp.id)
  }, [config?.ordenEmpleados, config?.separadores, employees])

  // Tipo para elementos del grid (empleado o separador)
  type GridItem = { type: "employee"; data: Empleado } | { type: "separator"; data: Separador }

  // Obtener elementos ordenados (empleados y separadores) según el orden guardado
  const orderedItems = useMemo(() => {
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]))
    const items: GridItem[] = []
    
    orderedItemIds.forEach(id => {
      // Verificar si es un separador
      if (separadorMap.has(id)) {
        const separator = separadorMap.get(id)
        if (separator) {
          items.push({ type: "separator", data: separator })
        }
      } 
      // Verificar si es un empleado
      else if (employeeMap.has(id)) {
        const employee = employeeMap.get(id)
        if (employee) {
          items.push({ type: "employee", data: employee })
        }
      }
    })
    
    return items
  }, [orderedItemIds, employees, separadorMap])

  // Helper: convertir ShiftAssignmentValue a string[] (IDs)
  const toShiftIds = useCallback((value: ShiftAssignmentValue | undefined): string[] => {
    if (!value || !Array.isArray(value)) return []
    if (value.length === 0) return []
    // Si es string[] (formato antiguo)
    if (typeof value[0] === "string") {
      return value as string[]
    }
    // Si es ShiftAssignment[] (formato nuevo), extraer shiftId y filtrar undefined
    return (value as ShiftAssignment[])
      .map((a) => a.shiftId)
      .filter((id): id is string => id !== undefined)
  }, [])

  // Helper: convertir ShiftAssignmentValue a ShiftAssignment[]
  const toAssignments = useCallback((value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
    if (!value || !Array.isArray(value)) return []
    if (value.length === 0) return []
    // Si es string[] (formato antiguo), convertir
    if (typeof value[0] === "string") {
      return (value as string[]).map((shiftId) => ({ shiftId, type: "shift" as const }))
    }
    // Si es ShiftAssignment[] (formato nuevo)
    return (value as ShiftAssignment[]).map((a) => ({
      ...a,
      type: a.type || "shift" as const,
    }))
  }, [])

  // Memoizar función de obtener turnos de empleado (IDs)
  const getEmployeeShifts = useCallback(
    (employeeId: string, date: string): string[] => {
      if (!schedule?.assignments) return []
      const dateAssignments = schedule.assignments[date] || {}
      const employeeShifts = dateAssignments[employeeId]
      return toShiftIds(employeeShifts)
    },
    [schedule?.assignments, toShiftIds],
  )

  // Nueva función para obtener asignaciones completas
  const getEmployeeAssignments = useCallback(
    (employeeId: string, date: string): ShiftAssignment[] => {
      if (!schedule?.assignments) return []
      const dateAssignments = schedule.assignments[date] || {}
      const employeeShifts = dateAssignments[employeeId]
      return toAssignments(employeeShifts)
    },
    [schedule?.assignments, toAssignments],
  )

  // Memoizar función de obtener info de turno
  const getShiftInfo = useCallback(
    (shiftId: string): Turno | undefined => {
      return shiftMap.get(shiftId)
    },
    [shiftMap],
  )

  // Obtener horario para mostrar (ajustado o base) - retorna array de líneas
  const getShiftDisplayTime = useCallback(
    (shiftId: string, assignment?: ShiftAssignment): string[] => {
      // Si es medio franco, usar sus horarios directamente
      if (assignment?.type === "medio_franco") {
        if (assignment.startTime && assignment.endTime) {
          return [`${assignment.startTime} - ${assignment.endTime}`]
        }
        return ["1/2 Franco"]
      }
      
      // Si es franco, no debería llegar aquí, pero por seguridad:
      if (assignment?.type === "franco") {
        return ["FRANCO"]
      }
      
      // Comportamiento normal para turnos
      const shift = getShiftInfo(shiftId)
      if (!shift) return [""]

      // Si hay asignación con horarios ajustados, usar esos
      if (assignment) {
        const start = assignment.startTime || shift.startTime
        const end = assignment.endTime || shift.endTime
        const start2 = assignment.startTime2 || shift.startTime2
        const end2 = assignment.endTime2 || shift.endTime2

        if (start && end) {
          const first = `${start} - ${end}`
          if (start2 && end2) {
            // Retornar en dos líneas separadas
            return [first, `${start2} - ${end2}`]
          }
          return [first]
        }
      }

      // Usar horarios del turno base
      if (shift.startTime && shift.endTime) {
        const first = `${shift.startTime} - ${shift.endTime}`
        if (shift.startTime2 && shift.endTime2) {
          // Retornar en dos líneas separadas
          return [first, `${shift.startTime2} - ${shift.endTime2}`]
        }
        return [first]
      }

      return [""]
    },
    [getShiftInfo],
  )

  // Verificar si un turno tiene horarios ajustados
  const hasAdjustedTimes = useCallback((assignment: ShiftAssignment, shift: Turno): boolean => {
    if (!assignment) return false
    return !!(
      (assignment.startTime && assignment.startTime !== shift.startTime) ||
      (assignment.endTime && assignment.endTime !== shift.endTime) ||
      (assignment.startTime2 && assignment.startTime2 !== shift.startTime2) ||
      (assignment.endTime2 && assignment.endTime2 !== shift.endTime2)
    )
  }, [])

  // Helper: convertir color hex a rgba
  const hexToRgba = useCallback((hex: string, opacity: number = 0.35): string => {
    const cleanHex = hex.replace('#', '')
    const r = parseInt(cleanHex.substring(0, 2), 16)
    const g = parseInt(cleanHex.substring(2, 4), 16)
    const b = parseInt(cleanHex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }, [])

  // Helper: convertir hora "HH:mm" a minutos desde medianoche
  const timeToMinutes = useCallback((time: string): number => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }, [])

  // Helper: obtener color del medio turno configurado
  const getMedioTurnoColor = useCallback((startTime: string, endTime: string): string => {
    // Buscar el medio turno configurado que coincida con el horario
    const medioTurno = mediosTurnos.find(
      mt => mt.startTime === startTime && mt.endTime === endTime
    )
    
    // Si se encuentra y tiene color configurado, usarlo; sino usar verde por defecto
    const colorHex = medioTurno?.color || "#22c55e"
    return hexToRgba(colorHex, 0.35)
  }, [mediosTurnos, hexToRgba])

  // Helper: buscar un turno que coincida con un horario dado (para obtener su color)
  const findMatchingShift = useCallback(
    (startTime: string, endTime: string, excludeShiftId?: string): Turno | undefined => {
      if (!startTime || !endTime) return undefined
      
      const startMinutes = timeToMinutes(startTime)
      const endMinutes = timeToMinutes(endTime)
      
      // Primero intentar buscar por nombre (palabras clave)
      const nameLowerStart = startMinutes < 14 * 60 ? ["mañana", "morning", "matutino"] : 
                            startMinutes >= 18 * 60 ? ["noche", "night", "nocturno"] : []
      
      const nameMatch = shifts.find((shift) => {
        if (shift.id === excludeShiftId || shift.startTime2 || shift.endTime2) return false
        const nameLower = shift.name.toLowerCase()
        return nameLowerStart.some(keyword => nameLower.includes(keyword))
      })
      
      if (nameMatch) return nameMatch
      
      // Si no se encuentra por nombre, buscar por horarios similares
      // Priorizar turnos simples (sin segunda franja) que tengan horarios similares
      const matchingShift = shifts.find((shift) => {
        if (shift.id === excludeShiftId || shift.startTime2 || shift.endTime2) return false
        
        // Solo considerar turnos simples (sin segunda franja)
        if (shift.startTime && shift.endTime) {
          const shiftStart = timeToMinutes(shift.startTime)
          const shiftEnd = timeToMinutes(shift.endTime)
          
          // Verificar si el rango de horarios se solapa o es muy similar
          // Coincidencia si la diferencia en inicio y fin es menor a 60 minutos
          const startDiff = Math.abs(shiftStart - startMinutes)
          const endDiff = Math.abs(shiftEnd - endMinutes)
          
          if (startDiff <= 60 && endDiff <= 60) {
            return true
          }
        }
        
        return false
      })
      
      return matchingShift
    },
    [shifts, timeToMinutes],
  )

  // Obtener el color de fondo para una celda basado en las asignaciones
  const getCellBackgroundStyle = useCallback(
    (employeeId: string, date: string): CSSProperties | undefined => {
      const assignments = getEmployeeAssignments(employeeId, date)
      
      // Si no hay asignaciones, no aplicar color
      if (assignments.length === 0) return undefined
      
      // Color verde para franco (opacidad 0.35) - por defecto
      const defaultGreenColor = 'rgba(34, 197, 94, 0.35)' // green-500 con opacidad
      
      // Si es franco, aplicar verde
      if (assignments.some(a => a.type === "franco")) {
        return { backgroundColor: defaultGreenColor }
      }
      
      // Buscar medio franco
      const medioFranco = assignments.find(a => a.type === "medio_franco")
      
      // Buscar turnos normales
      const shiftAssignments = assignments.filter(
        a => a.type === "shift" && a.shiftId
      )
      
      // Si solo hay medio franco (sin turnos), crear gradiente vertical como turno cortado
      if (medioFranco && shiftAssignments.length === 0) {
        if (medioFranco.startTime && medioFranco.endTime) {
          // Buscar un turno que coincida con el horario del medio franco para obtener su color
          const matchingShift = findMatchingShift(medioFranco.startTime, medioFranco.endTime)
          
          // Determinar si el medio franco es temprano (mañana) o tarde (noche)
          const medioStart = timeToMinutes(medioFranco.startTime)
          const isEarly = medioStart < 14 * 60 // Antes de las 14:00
          
          if (matchingShift) {
            // Si encontramos un turno que coincide, usar gradiente con su color
            const shiftColor = hexToRgba(matchingShift.color, 0.35)
            if (isEarly) {
              // Medio franco temprano (mañana): arriba color del turno, abajo verde
              return {
                background: `linear-gradient(to bottom, ${shiftColor} 50%, ${defaultGreenColor} 50%)`
              }
            } else {
              // Medio franco tarde (noche): arriba verde, abajo color del turno
              return {
                background: `linear-gradient(to bottom, ${defaultGreenColor} 50%, ${shiftColor} 50%)`
              }
            }
          } else {
            // Si no encontramos turno, usar color configurado del medio turno o verde
            const medioColor = getMedioTurnoColor(medioFranco.startTime, medioFranco.endTime)
            if (isEarly) {
              return {
                background: `linear-gradient(to bottom, ${medioColor} 50%, ${defaultGreenColor} 50%)`
              }
            } else {
              return {
                background: `linear-gradient(to bottom, ${defaultGreenColor} 50%, ${medioColor} 50%)`
              }
            }
          }
        }
        return { backgroundColor: defaultGreenColor }
      }
      
      // Si hay medio franco + turno(s), crear gradiente
      if (medioFranco && shiftAssignments.length > 0) {
        // Obtener el color del primer turno
        const firstShift = getShiftInfo(shiftAssignments[0].shiftId || "")
        if (!firstShift || !firstShift.color) {
          const medioColor = medioFranco.startTime && medioFranco.endTime
            ? getMedioTurnoColor(medioFranco.startTime, medioFranco.endTime)
            : defaultGreenColor
          return { backgroundColor: medioColor }
        }
        
        const shiftColor = hexToRgba(firstShift.color, 0.35)
        
        // Determinar si el medio franco es temprano (mañana) o tarde (noche)
        let isMedioFrancoEarly = true // Por defecto, asumir que es temprano
        
        if (medioFranco.startTime && medioFranco.endTime) {
          const medioStart = timeToMinutes(medioFranco.startTime)
          // Si el medio franco empieza antes de las 14:00, es temprano (mañana)
          isMedioFrancoEarly = medioStart < 14 * 60
        }
        
        // Crear gradiente vertical: verde para medio franco, color del turno para el turno
        if (isMedioFrancoEarly) {
          // Medio franco temprano (mañana): arriba turno, abajo medio franco (verde)
          return {
            background: `linear-gradient(to bottom, ${shiftColor} 50%, ${defaultGreenColor} 50%)`
          }
        } else {
          // Medio franco tarde (noche): arriba medio franco (verde), abajo turno
          return {
            background: `linear-gradient(to bottom, ${defaultGreenColor} 50%, ${shiftColor} 50%)`
          }
        }
      }
      
      // Si solo hay turnos normales, verificar si es un turno cortado
      if (shiftAssignments.length > 0) {
        const firstAssignment = shiftAssignments[0]
        const firstShift = getShiftInfo(firstAssignment.shiftId || "")
        if (!firstShift) return undefined
        
        // Obtener horarios (ajustados o base)
        const startTime = firstAssignment.startTime || firstShift.startTime || ""
        const endTime = firstAssignment.endTime || firstShift.endTime || ""
        const startTime2 = firstAssignment.startTime2 || firstShift.startTime2 || ""
        const endTime2 = firstAssignment.endTime2 || firstShift.endTime2 || ""
        
        // Si es un turno cortado (tiene segunda franja), aplicar gradiente vertical
        if (startTime && endTime && startTime2 && endTime2) {
          // Opacidad más alta para turnos cortados (mejor contraste)
          const cutShiftOpacity = 0.35
          
          // Buscar turnos que coincidan con cada franja para obtener sus colores
          const morningShift = findMatchingShift(startTime, endTime, firstShift.id)
          const nightShift = findMatchingShift(startTime2, endTime2, firstShift.id)
          
          // Si encontramos ambos turnos, usar sus colores
          if (morningShift && nightShift) {
            const morningColor = hexToRgba(morningShift.color, cutShiftOpacity)
            const nightColor = hexToRgba(nightShift.color, cutShiftOpacity)
            return {
              background: `linear-gradient(to bottom, ${morningColor} 50%, ${nightColor} 50%)`
            }
          }
          // Si solo encontramos uno, usar ese color y el del turno actual
          if (morningShift) {
            const morningColor = hexToRgba(morningShift.color, cutShiftOpacity)
            const nightColor = hexToRgba(firstShift.color, cutShiftOpacity)
            return {
              background: `linear-gradient(to bottom, ${morningColor} 50%, ${nightColor} 50%)`
            }
          }
          if (nightShift) {
            const morningColor = hexToRgba(firstShift.color, cutShiftOpacity)
            const nightColor = hexToRgba(nightShift.color, cutShiftOpacity)
            return {
              background: `linear-gradient(to bottom, ${morningColor} 50%, ${nightColor} 50%)`
            }
          }
          // Si no encontramos ninguno, usar el color del turno para ambas partes
          const shiftColor = hexToRgba(firstShift.color, cutShiftOpacity)
          return { backgroundColor: shiftColor }
        }
        
        // Si no es turno cortado, aplicar color del turno normalmente
        if (firstShift && firstShift.color) {
          return { backgroundColor: hexToRgba(firstShift.color, 0.35) }
        }
      }
      
      return undefined
    },
    [getEmployeeAssignments, getShiftInfo, hexToRgba, timeToMinutes, getMedioTurnoColor, findMatchingShift],
  )

  const handleCellClick = useCallback(
    (date: string, employeeId: string) => {
      if (!readonly && (onShiftUpdate || onAssignmentUpdate)) {
        setSelectedCell({ date, employeeId })
      }
    },
    [readonly, onShiftUpdate, onAssignmentUpdate],
  )

  const handleShiftUpdate = useCallback(
    (shiftIds: string[]) => {
      if (selectedCell && onShiftUpdate) {
        onShiftUpdate(selectedCell.date, selectedCell.employeeId, shiftIds)
      }
      setSelectedCell(null)
    },
    [selectedCell, onShiftUpdate],
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
    [selectedCell, onAssignmentUpdate, schedule?.id],
  )

  const handleToggleExtra = useCallback(
    (employeeId: string, date: string, type: "before" | "after") => {
      if (!onAssignmentUpdate) return
      const assignments = getEmployeeAssignments(employeeId, date)
      if (assignments.length === 0) return

      const targetIndex = assignments.findIndex(
        (assignment) => assignment.type !== "franco" && assignment.type !== "medio_franco" && assignment.shiftId,
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
    [getEmployeeAssignments, getShiftInfo, onAssignmentUpdate, schedule?.id],
  )

  const selectedEmployee = selectedCell
    ? employees.find((e) => e.id === selectedCell.employeeId)
    : null
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

  const formatStatValue = useCallback((value: number) => {
    if (!Number.isFinite(value) || value === 0) {
      return "0"
    }
    return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
  }, [])

  // Handlers para drag and drop
  const handleDragStart = useCallback((e: React.DragEvent, employeeId: string) => {
    if (readonly) return
    setDraggedEmployeeId(employeeId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", employeeId)
    // Hacer el elemento semi-transparente mientras se arrastra
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5"
    }
  }, [readonly])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (readonly) return
    setDraggedEmployeeId(null)
    setDragOverEmployeeId(null)
    // Restaurar opacidad
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1"
    }
  }, [readonly])

  const handleDragOver = useCallback((e: React.DragEvent, employeeId: string) => {
    if (readonly || !draggedEmployeeId || draggedEmployeeId === employeeId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverEmployeeId(employeeId)
  }, [readonly, draggedEmployeeId])

  const handleDragLeave = useCallback(() => {
    setDragOverEmployeeId(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    if (readonly || !draggedEmployeeId || draggedEmployeeId === targetId) return
    e.preventDefault()
    
    const draggedIndex = orderedItemIds.indexOf(draggedEmployeeId)
    const targetIndex = orderedItemIds.indexOf(targetId)
    
    if (draggedIndex === -1 || targetIndex === -1) return

    // Reordenar el array
    const newOrder = [...orderedItemIds]
    const [removed] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, removed)
    
    setDraggedEmployeeId(null)
    setDragOverEmployeeId(null)
    
    // Guardar el nuevo orden en Firebase
    updateEmployeeOrder(newOrder)
  }, [readonly, draggedEmployeeId, orderedItemIds, updateEmployeeOrder])

  // Handler para agregar separador en una posición específica
  const handleAddSeparator = useCallback(async (position: number, suggestedPuestoId?: string) => {
    if (readonly || !addSeparator) return
    
    let nombre = "SEPARADOR"
    let puestoId = suggestedPuestoId
    
    // Si hay un puesto sugerido, usar su nombre
    if (suggestedPuestoId && puestoMap.has(suggestedPuestoId)) {
      const puesto = puestoMap.get(suggestedPuestoId)
      nombre = puesto?.nombre.toUpperCase() || "SEPARADOR"
    }
    
    const newSeparator = await addSeparator(nombre, puestoId)
    if (!newSeparator) return
    
    // Insertar el separador en la posición indicada
    const newOrder = [...orderedItemIds]
    newOrder.splice(position, 0, newSeparator.id)
    
    updateEmployeeOrder(newOrder)
  }, [readonly, addSeparator, puestoMap, orderedItemIds, updateEmployeeOrder])

  // Handler para editar separador
  const handleEditSeparator = useCallback((separator: Separador) => {
    setEditingSeparatorId(separator.id)
    setSeparatorEditName(separator.nombre)
  }, [])

  // Handler para guardar edición de separador
  const handleSaveSeparatorEdit = useCallback(async () => {
    if (!editingSeparatorId || !updateSeparator || !separatorEditName.trim()) {
      setEditingSeparatorId(null)
      setSeparatorEditName("")
      return
    }
    
    const separator = separadorMap.get(editingSeparatorId)
    if (!separator) {
      setEditingSeparatorId(null)
      setSeparatorEditName("")
      return
    }
    
    await updateSeparator(editingSeparatorId, {
      ...separator,
      nombre: separatorEditName.trim(),
    })
    
    setEditingSeparatorId(null)
    setSeparatorEditName("")
  }, [editingSeparatorId, separatorEditName, updateSeparator, separadorMap])

  // Handler para eliminar separador
  const handleDeleteSeparator = useCallback(async (separatorId: string) => {
    if (readonly || !deleteSeparator) return
    
    await deleteSeparator(separatorId)
    
    // Remover del orden
    const newOrder = orderedItemIds.filter(id => id !== separatorId)
    updateEmployeeOrder(newOrder)
  }, [readonly, deleteSeparator, orderedItemIds, updateEmployeeOrder])

  // Función para sugerir puesto basado en empleados adyacentes
  const getSuggestedPuestoId = useCallback((position: number): string | undefined => {
    // Buscar el puesto más común entre los empleados que seguirían después de esta posición
    if (position >= orderedItems.length) return undefined
    
    const employeesAfter = orderedItems.slice(position).filter(
      item => item.type === "employee"
    ).slice(0, 3) as Array<{ type: "employee"; data: Empleado }>
    
    if (employeesAfter.length === 0) return undefined
    
    const puestoCounts = new Map<string, number>()
    employeesAfter.forEach(({ data }) => {
      if (data.puestoId) {
        puestoCounts.set(data.puestoId, (puestoCounts.get(data.puestoId) || 0) + 1)
      }
    })
    
    if (puestoCounts.size === 0) return undefined
    
    // Retornar el puesto más común
    let maxCount = 0
    let mostCommonPuesto: string | undefined
    puestoCounts.forEach((count, puestoId) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonPuesto = puestoId
      }
    })
    
    return mostCommonPuesto
  }, [orderedItems, puestoMap])

  return (
    <>
      <Card className="overflow-hidden border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="min-w-[220px] border-r border-border px-6 py-4 text-left text-xl font-semibold text-foreground">
                Empleado
              </th>
              {weekDays.map((day) => (
                <th
                  key={day.toISOString()}
                  className="min-w-[180px] border-r border-border px-6 py-4 text-center text-xl font-semibold text-foreground last:border-r-0"
                >
                  <div className="flex flex-col">
                    <span className="capitalize">{format(day, "EEEE", { locale: es })}</span>
                    <span className="text-base font-normal text-muted-foreground">
                      {format(day, "d MMM", { locale: es })}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Botón para agregar separador al inicio de la primera columna */}
            {!readonly && (
              <tr className="border-b border-border">
                <td className="border-r border-border bg-muted/30 px-6 py-2">
                  <div className="flex items-center justify-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs rounded-full bg-background border border-border shadow-sm hover:bg-primary hover:text-primary-foreground"
                      onClick={() => {
                        const suggestedPuestoId = getSuggestedPuestoId(0)
                        handleAddSeparator(0, suggestedPuestoId)
                      }}
                      title="Agregar separador"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar separador
                    </Button>
                  </div>
                </td>
                {weekDays.map((day) => (
                  <td key={day.toISOString()} className="border-r border-border last:border-r-0"></td>
                ))}
              </tr>
            )}
            {orderedItems.map((item, itemIndex) => {
              return (
                <React.Fragment key={item.type === "employee" ? `emp-${item.data.id}` : `sep-${item.data.id}`}>

                  {/* Renderizar separador o empleado */}
                  {item.type === "separator" ? (
                    <tr key={item.data.id} className="border-b border-border bg-muted/30">
                      <td colSpan={weekDays.length + 1} className="px-6 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="h-px bg-border flex-1"></div>
                            {editingSeparatorId === item.data.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={separatorEditName}
                                  onChange={(e) => setSeparatorEditName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSaveSeparatorEdit()
                                    } else if (e.key === "Escape") {
                                      setEditingSeparatorId(null)
                                      setSeparatorEditName("")
                                    }
                                  }}
                                  className="h-7 text-sm font-semibold text-center min-w-[120px]"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={handleSaveSeparatorEdit}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <h3
                                className="text-sm font-semibold text-foreground uppercase tracking-wide cursor-pointer hover:text-primary transition-colors"
                                onClick={() => !readonly && handleEditSeparator(item.data)}
                                style={
                                  item.data.puestoId && puestoMap.has(item.data.puestoId)
                                    ? { color: puestoMap.get(item.data.puestoId)?.color }
                                    : undefined
                                }
                              >
                                {item.data.nombre}
                              </h3>
                            )}
                            <div className="h-px bg-border flex-1"></div>
                          </div>
                          {!readonly && editingSeparatorId !== item.data.id && (
                            <div className="flex items-center gap-1 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleEditSeparator(item.data)}
                                title="Editar separador"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteSeparator(item.data.id)}
                                title="Eliminar separador"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    // Renderizar empleado (código existente)
                    <tr 
                      key={item.data.id} 
                      className={`border-b border-border last:border-b-0 ${
                        dragOverEmployeeId === item.data.id ? "bg-primary/5" : ""
                      } ${draggedEmployeeId === item.data.id ? "opacity-50" : ""}`}
                      draggable={!readonly}
                      onDragStart={(e) => handleDragStart(e, item.data.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, item.data.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, item.data.id)}
                    >
                      <td className="border-r border-border bg-muted/30 px-6 py-4 text-lg font-medium text-foreground align-top">
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
                              {item.data.puestoId && puestoMap.has(item.data.puestoId) && (
                                <span
                                  className="h-3 w-3 rounded-full border border-border flex-shrink-0"
                                  style={{ backgroundColor: puestoMap.get(item.data.puestoId)?.color }}
                                  title={puestoMap.get(item.data.puestoId)?.nombre}
                                />
                              )}
                              <p style={
                                item.data.puestoId && puestoMap.has(item.data.puestoId)
                                  ? { color: puestoMap.get(item.data.puestoId)?.color }
                                  : undefined
                              }>{item.data.name}</p>
                            </div>
                          {employeeStats && employeeStats[item.data.id] && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-foreground">Francos:</span>
                                <span>{formatStatValue(employeeStats[item.data.id].francos)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-foreground">Horas extra semana:</span>
                                <span>{formatStatValue(employeeStats[item.data.id].horasExtrasSemana)}h</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-foreground">Horas extra mes:</span>
                                <span>{formatStatValue(employeeStats[item.data.id].horasExtrasMes)}h</span>
                              </div>
                            </div>
                          )}
                          </div>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd")
                        const employeeShifts = getEmployeeShifts(item.data.id, dateStr)
                        const isSelected = selectedCell?.date === dateStr && selectedCell?.employeeId === item.data.id
                  // Verificar si el día está fuera del rango del mes
                  const isOutOfRange = monthRange 
                    ? (day < monthRange.startDate || day > monthRange.endDate)
                    : false
                  
                        // Obtener estilo de fondo del turno (puede incluir gradientes)
                        const backgroundStyle = getCellBackgroundStyle(item.data.id, dateStr)
                  
                  // Determinar clases para hover y selected cuando hay color de fondo
                  const hasBackgroundStyle = !!backgroundStyle
                  const isClickable = !readonly && (onShiftUpdate || onAssignmentUpdate)
                  const hoverClass = hasBackgroundStyle
                    ? isClickable ? "hover:brightness-95" : ""
                    : isClickable
                    ? "hover:bg-muted/50"
                    : ""
                  const selectedClass = hasBackgroundStyle
                    ? "ring-2 ring-primary/30"
                    : isSelected
                    ? "bg-primary/10"
                    : ""
                        const assignments = getEmployeeAssignments(item.data.id, dateStr)
                  const primaryShiftAssignment = assignments.find(
                    (assignment) => assignment.type !== "franco" && assignment.type !== "medio_franco" && assignment.shiftId,
                  )
                  const primaryShift =
                    primaryShiftAssignment && primaryShiftAssignment.shiftId
                      ? getShiftInfo(primaryShiftAssignment.shiftId)
                      : undefined
                  const extendedStart =
                    primaryShift?.startTime ? adjustTime(primaryShift.startTime, -30) : undefined
                  const extendedEnd = primaryShift?.endTime ? adjustTime(primaryShift.endTime, 30) : undefined
                  const hasExtraBefore =
                    !!extendedStart && primaryShiftAssignment?.startTime === extendedStart
                  const hasExtraAfter = !!extendedEnd && primaryShiftAssignment?.endTime === extendedEnd
                  const showExtraActions =
                    isClickable &&
                    !!onAssignmentUpdate &&
                    !!primaryShiftAssignment &&
                    !!primaryShift?.startTime &&
                    !!primaryShift?.endTime
                        const cellKey = `${item.data.id}-${dateStr}`

                        return (
                          <td
                      key={day.toISOString()}
                      className={`border-r border-border px-4 py-4 last:border-r-0 relative ${
                        isClickable
                          ? `cursor-pointer transition-all ${hoverClass} active:brightness-90`
                          : ""
                      } ${selectedClass}`}
                      style={backgroundStyle}
                            onClick={() => handleCellClick(dateStr, item.data.id)}
                    >
                      {showExtraActions && (
                        <div className="absolute -top-1 right-1" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu
                            open={extraMenuOpenKey === cellKey}
                            onOpenChange={(open) => setExtraMenuOpenKey(open ? cellKey : null)}
                          >
                            <DropdownMenuTrigger asChild>
                              <Button variant="secondary" size="sm" className="h-6 px-2 text-xs">
                                +Extra
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 text-xs">
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault()
                                  handleToggleExtra(item.data.id, dateStr, "before")
                                  setExtraMenuOpenKey(null)
                                }}
                                className="flex items-center gap-2 text-xs"
                              >
                                <span className="flex-1">+30 min antes</span>
                                {hasExtraBefore && <Check className="h-4 w-4 text-primary" />}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault()
                                  handleToggleExtra(item.data.id, dateStr, "after")
                                  setExtraMenuOpenKey(null)
                                }}
                                className="flex items-center gap-2 text-xs"
                              >
                                <span className="flex-1">+30 min después</span>
                                {hasExtraAfter && <Check className="h-4 w-4 text-primary" />}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        {(() => {
                          if (assignments.length === 0) {
                            return <span className="text-center text-lg text-muted-foreground">-</span>
                          }

                          let orderedAssignments = assignments

                          // Ordenar asignaciones: 
                          // - Medio franco temprano (mañana): turno arriba, medio franco abajo
                          // - Medio franco tarde (noche): medio franco arriba, turno abajo
                          const hasMedioFranco = assignments.some((a) => a.type === "medio_franco")
                          const hasShifts = assignments.some((a) => a.type === "shift" && a.shiftId)

                          if (hasMedioFranco && hasShifts) {
                            orderedAssignments = [...assignments].sort((a, b) => {
                              if (a.type === "medio_franco" && b.type !== "medio_franco") {
                                const isEarly = a.startTime ? timeToMinutes(a.startTime) < 14 * 60 : true
                                // Si es temprano, el turno va arriba (medio franco abajo)
                                // Si es tarde, el medio franco va arriba
                                return isEarly ? 1 : -1
                              }
                              if (b.type === "medio_franco" && a.type !== "medio_franco") {
                                const isEarly = b.startTime ? timeToMinutes(b.startTime) < 14 * 60 : true
                                // Si es temprano, el turno va arriba (medio franco abajo)
                                // Si es tarde, el medio franco va arriba
                                return isEarly ? -1 : 1
                              }
                              return 0
                            })
                          }

                          return orderedAssignments.map((assignment, idx) => {
                            if (assignment.type === "franco") {
                              return (
                                <span key={`franco-${idx}`} className="text-center text-base block">
                                  FRANCO
                                </span>
                              )
                            }

                            if (assignment.type === "medio_franco") {
                              const displayTimeLines = getShiftDisplayTime("", assignment)
                              const hasTime = assignment.startTime && assignment.endTime
                              
                              // Determinar si el medio franco es temprano o tarde
                              const medioStart = assignment.startTime ? timeToMinutes(assignment.startTime) : null
                              const isEarly = medioStart !== null && medioStart < 14 * 60
                              
                              if (hasTime) {
                                if (hasShifts) {
                                  // Cuando hay turno, solo mostrar "(1/2 Franco)" sin horario
                                  return (
                                    <span key={`medio-franco-${idx}`} className="block text-center text-base font-semibold text-[#22c55e]">
                                      (1/2 Franco)
                                    </span>
                                  )
                                } else {
                                  // Cuando es solo medio franco, mostrar como turno cortado
                                  // Si es temprano: arriba el horario, abajo "(1/2 Franco)"
                                  // Si es tarde: arriba "(1/2 Franco)", abajo el horario
                                  if (isEarly) {
                                    return (
                                      <div key={`medio-franco-${idx}`} className="text-center text-base">
                                        <span className="block">{displayTimeLines[0]}</span>
                                        <span className="block text-xs font-semibold text-[#22c55e]">(1/2 Franco)</span>
                                      </div>
                                    )
                                  } else {
                                    return (
                                      <div key={`medio-franco-${idx}`} className="text-center text-base">
                                        <span className="block text-xs font-semibold text-[#22c55e]">(1/2 Franco)</span>
                                        <span className="block">{displayTimeLines[0]}</span>
                                      </div>
                                    )
                                  }
                                }
                              } else {
                                return (
                                  <span key={`medio-franco-${idx}`} className="block text-center text-base">1/2 Franco</span>
                                )
                              }
                            }

                            const shift = getShiftInfo(assignment.shiftId || "")
                            if (!shift) return null
                            const displayTimeLines = getShiftDisplayTime(assignment.shiftId || "", assignment)

                            if (
                              !displayTimeLines ||
                              displayTimeLines.length === 0 ||
                              (displayTimeLines.length === 1 && !displayTimeLines[0])
                            ) {
                              return (
                                <span key={assignment.shiftId} className="text-center text-base block">
                                  {shift.name}
                                </span>
                              )
                            }

                            return (
                              <div key={assignment.shiftId} className="text-center text-base">
                                {displayTimeLines.map((line, lineIdx) => (
                                  <span key={lineIdx} className="block">
                                    {line}
                                  </span>
                                ))}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </td>
                      )
                    })}
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
      {selectedCell && selectedEmployee && selectedDate && (
        <ShiftSelectorPopover
          open={true}
          onOpenChange={(open) => !open && setSelectedCell(null)}
          shifts={shifts}
          selectedShiftIds={selectedShiftIds}
          selectedAssignments={selectedAssignments}
          onShiftChange={onShiftUpdate ? handleShiftUpdate : undefined}
          onAssignmentsChange={onAssignmentUpdate ? handleAssignmentUpdate : undefined}
          employeeName={selectedEmployee.name}
          date={format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
        />
      )}
    </>
  )
})
