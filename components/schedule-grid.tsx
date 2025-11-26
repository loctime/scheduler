"use client"

import { memo, useMemo, useCallback, useState } from "react"
import type { CSSProperties } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Empleado, Turno, Horario, HistorialItem, ShiftAssignment, ShiftAssignmentValue, MedioTurno } from "@/lib/types"
import { ShiftSelectorPopover } from "./shift-selector-popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Check } from "lucide-react"
import { adjustTime } from "@/lib/utils"

export interface EmployeeMonthlyStats {
  francos: number
  horasExtras: number
}

interface ScheduleGridProps {
  weekDays: Date[]
  employees: Empleado[]
  shifts: Turno[]
  schedule: Horario | HistorialItem | null
  onShiftUpdate?: (date: string, employeeId: string, shiftIds: string[]) => void // formato antiguo (compatibilidad)
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: ShiftAssignment[]) => void // nuevo formato
  readonly?: boolean
  monthRange?: { startDate: Date; endDate: Date } // Rango del mes para deshabilitar días fuera del rango
  mediosTurnos?: MedioTurno[] // Medios turnos configurados
  employeeStats?: Record<string, EmployeeMonthlyStats>
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
}: ScheduleGridProps) {
  const [selectedCell, setSelectedCell] = useState<{ date: string; employeeId: string } | null>(null)
  const [extraMenuOpenKey, setExtraMenuOpenKey] = useState<string | null>(null)

  // Memoizar mapa de turnos para búsqueda O(1)
  const shiftMap = useMemo(() => {
    return new Map(shifts.map((s) => [s.id, s]))
  }, [shifts])

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
  const hexToRgba = useCallback((hex: string, opacity: number = 0.15): string => {
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
    return hexToRgba(colorHex, 0.15)
  }, [mediosTurnos, hexToRgba])

  // Obtener el color de fondo para una celda basado en las asignaciones
  const getCellBackgroundStyle = useCallback(
    (employeeId: string, date: string): CSSProperties | undefined => {
      const assignments = getEmployeeAssignments(employeeId, date)
      
      // Si no hay asignaciones, no aplicar color
      if (assignments.length === 0) return undefined
      
      // Color verde para franco (opacidad 0.15) - por defecto
      const defaultGreenColor = 'rgba(34, 197, 94, 0.15)' // green-500 con opacidad
      
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
      
      // Si solo hay medio franco (sin turnos), usar color configurado o verde por defecto
      if (medioFranco && shiftAssignments.length === 0) {
        if (medioFranco.startTime && medioFranco.endTime) {
          const medioColor = getMedioTurnoColor(medioFranco.startTime, medioFranco.endTime)
          return { backgroundColor: medioColor }
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
        
        const shiftColor = hexToRgba(firstShift.color, 0.15)
        
        // Obtener color del medio franco (configurado o por defecto)
        const medioColor = medioFranco.startTime && medioFranco.endTime
          ? getMedioTurnoColor(medioFranco.startTime, medioFranco.endTime)
          : defaultGreenColor
        
        // Determinar la posición del medio franco basándose en su horario
        let isMedioFrancoEarly = true // Por defecto, asumir que es temprano
        
        if (medioFranco.startTime && medioFranco.endTime) {
          const medioStart = timeToMinutes(medioFranco.startTime)
          const medioEnd = timeToMinutes(medioFranco.endTime)
          
          // Comparar con los turnos para determinar si el medio franco es temprano o tarde
          let earliestShiftStart = Infinity
          let latestShiftEnd = -Infinity
          
          shiftAssignments.forEach(assignment => {
            const shift = getShiftInfo(assignment.shiftId || "")
            if (shift) {
              // Usar horarios ajustados si existen, sino los del turno base
              const startTime = assignment.startTime || shift.startTime || ""
              const endTime = assignment.endTime || shift.endTime || ""
              const startTime2 = assignment.startTime2 || shift.startTime2 || ""
              const endTime2 = assignment.endTime2 || shift.endTime2 || ""
              
              if (startTime) {
                const start = timeToMinutes(startTime)
                earliestShiftStart = Math.min(earliestShiftStart, start)
              }
              if (endTime) {
                const end = timeToMinutes(endTime)
                latestShiftEnd = Math.max(latestShiftEnd, end)
              }
              if (startTime2) {
                const start2 = timeToMinutes(startTime2)
                earliestShiftStart = Math.min(earliestShiftStart, start2)
              }
              if (endTime2) {
                const end2 = timeToMinutes(endTime2)
                latestShiftEnd = Math.max(latestShiftEnd, end2)
              }
            }
          })
          
          // Si el medio franco termina antes de que empiece el turno, es temprano
          // Si el medio franco empieza después de que termine el turno, es tarde
          if (earliestShiftStart !== Infinity && medioEnd < earliestShiftStart) {
            isMedioFrancoEarly = true
          } else if (latestShiftEnd !== -Infinity && medioStart > latestShiftEnd) {
            isMedioFrancoEarly = false
          } else {
            // Si hay solapamiento o no podemos determinar, usar la hora del día
            // Si el medio franco empieza antes de las 12:00, es temprano
            isMedioFrancoEarly = medioStart < 12 * 60
          }
        }
        
        // Crear gradiente: color del medio franco en una mitad, color del turno en la otra
        if (isMedioFrancoEarly) {
          // Medio franco temprano: color del medio franco a la izquierda, color del turno a la derecha
          return {
            background: `linear-gradient(to right, ${medioColor} 50%, ${shiftColor} 50%)`
          }
        } else {
          // Medio franco tarde: color del turno a la izquierda, color del medio franco a la derecha
          return {
            background: `linear-gradient(to right, ${shiftColor} 50%, ${medioColor} 50%)`
          }
        }
      }
      
      // Si solo hay turnos normales, aplicar color del primer turno
      if (shiftAssignments.length > 0) {
        const firstShift = getShiftInfo(shiftAssignments[0].shiftId || "")
        if (firstShift && firstShift.color) {
          return { backgroundColor: hexToRgba(firstShift.color, 0.15) }
        }
      }
      
      return undefined
    },
    [getEmployeeAssignments, getShiftInfo, hexToRgba, timeToMinutes, getMedioTurnoColor],
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
        onAssignmentUpdate(selectedCell.date, selectedCell.employeeId, assignments)
      }
      setSelectedCell(null)
    },
    [selectedCell, onAssignmentUpdate],
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

      onAssignmentUpdate(date, employeeId, updatedAssignments)
    },
    [getEmployeeAssignments, getShiftInfo, onAssignmentUpdate],
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
            {employees.map((employee) => (
              <tr key={employee.id} className="border-b border-border last:border-b-0">
                <td className="border-r border-border bg-muted/30 px-6 py-4 text-lg font-medium text-foreground align-top">
                  <div className="space-y-1">
                    <p>{employee.name}</p>
                    {employeeStats && employeeStats[employee.id] && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground">Francos:</span>
                          <span>{formatStatValue(employeeStats[employee.id].francos)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground">Horas extra:</span>
                          <span>{formatStatValue(employeeStats[employee.id].horasExtras)}h</span>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                {weekDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd")
                  const employeeShifts = getEmployeeShifts(employee.id, dateStr)
                  const isSelected = selectedCell?.date === dateStr && selectedCell?.employeeId === employee.id
                  // Verificar si el día está fuera del rango del mes
                  const isOutOfRange = monthRange 
                    ? (day < monthRange.startDate || day > monthRange.endDate)
                    : false
                  
                  // Obtener estilo de fondo del turno (puede incluir gradientes)
                  const backgroundStyle = !isOutOfRange 
                    ? getCellBackgroundStyle(employee.id, dateStr)
                    : undefined
                  
                  // Determinar clases para hover y selected cuando hay color de fondo
                  const hasBackgroundStyle = !!backgroundStyle
                  const hoverClass = hasBackgroundStyle
                    ? "hover:brightness-95"
                    : !readonly && (onShiftUpdate || onAssignmentUpdate)
                    ? "hover:bg-muted/50"
                    : ""
                  const selectedClass = hasBackgroundStyle
                    ? "ring-2 ring-primary/30"
                    : isSelected
                    ? "bg-primary/10"
                    : ""
                  const assignments = getEmployeeAssignments(employee.id, dateStr)
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
                    !readonly &&
                    !!onAssignmentUpdate &&
                    !isOutOfRange &&
                    !!primaryShiftAssignment &&
                    !!primaryShift?.startTime &&
                    !!primaryShift?.endTime
                  const cellKey = `${employee.id}-${dateStr}`

                  return (
                    <td
                      key={day.toISOString()}
                      className={`border-r border-border px-4 py-4 last:border-r-0 relative ${
                        isOutOfRange 
                          ? "bg-muted/20 opacity-50"
                          : !readonly && (onShiftUpdate || onAssignmentUpdate)
                          ? `cursor-pointer transition-all ${hoverClass} active:brightness-90`
                          : ""
                      } ${selectedClass}`}
                      style={backgroundStyle}
                      onClick={() => !isOutOfRange && handleCellClick(dateStr, employee.id)}
                    >
                      {showExtraActions && (
                        <div className="absolute top-2 right-2" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu
                            open={extraMenuOpenKey === cellKey}
                            onOpenChange={(open) => setExtraMenuOpenKey(open ? cellKey : null)}
                          >
                            <DropdownMenuTrigger asChild>
                              <Button variant="secondary" size="sm" className="h-7 px-2 text-xs">
                                +Extra
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 text-xs">
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault()
                                  handleToggleExtra(employee.id, dateStr, "before")
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
                                  handleToggleExtra(employee.id, dateStr, "after")
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

                          // Ordenar asignaciones: medio franco temprano arriba, medio franco tarde abajo
                          const hasMedioFranco = assignments.some((a) => a.type === "medio_franco")
                          const hasShifts = assignments.some((a) => a.type === "shift" && a.shiftId)

                          if (hasMedioFranco && hasShifts) {
                            orderedAssignments = [...assignments].sort((a, b) => {
                              if (a.type === "medio_franco" && b.type !== "medio_franco") {
                                const isEarly = a.startTime ? timeToMinutes(a.startTime) < 15 * 60 : true
                                return isEarly ? -1 : 1
                              }
                              if (b.type === "medio_franco" && a.type !== "medio_franco") {
                                const isEarly = b.startTime ? timeToMinutes(b.startTime) < 15 * 60 : true
                                return isEarly ? 1 : -1
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
                              return (
                                <div key={`medio-franco-${idx}`} className="text-center text-base">
                                  {hasTime ? (
                                    <>
                                      <span className="block">{displayTimeLines[0]}</span>
                                      <span className="block text-xs">(1/2 Franco)</span>
                                    </>
                                  ) : (
                                    <span className="block">1/2 Franco</span>
                                  )}
                                </div>
                              )
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
            ))}
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
