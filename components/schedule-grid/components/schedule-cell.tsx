"use client"

import React, { useState } from "react"
import type { CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, RotateCcw, Undo2, Lock, FileText, X, Clock, Baby } from "lucide-react"
import { ShiftAssignment, Turno, MedioTurno, Configuracion } from "@/lib/types"
import { CellAssignments } from "./cell-assignments"
import { QuickShiftSelector } from "./quick-shift-selector"
import { getDay, parseISO } from "date-fns"
import type { PatternSuggestion } from "@/lib/pattern-learning"

interface ScheduleCellProps {
  date: string
  employeeId: string
  assignments: ShiftAssignment[]
  backgroundStyle?: CSSProperties
  isSelected: boolean
  isClickable: boolean
  getShiftInfo: (shiftId: string) => Turno | undefined
  onCellClick: (date: string, employeeId: string) => void
  showExtraActions: boolean
  extraMenuOpenKey: string | null
  cellKey: string
  hasExtraBefore: boolean
  hasExtraAfter: boolean
  onToggleExtra: (type: "before" | "after") => void
  onExtraMenuOpenChange: (open: boolean) => void
  quickShifts: Turno[]
  mediosTurnos?: MedioTurno[]
  onQuickAssignments?: (assignments: ShiftAssignment[]) => void
  onAssignmentUpdate?: (
    date: string,
    employeeId: string,
    assignments: ShiftAssignment[],
    options?: { scheduleId?: string }
  ) => void
  scheduleId?: string
  readonly?: boolean
  hasCellHistory?: boolean
  onCellUndo?: () => void
  hasFixedSchedule?: boolean
  suggestionWeeks?: number
  isManuallyFixed?: boolean
  onToggleFixed?: (date: string, employeeId: string, dayOfWeek: number) => void
  suggestion?: PatternSuggestion | null
  config?: Configuracion | null
}

export function ScheduleCell({
  date,
  employeeId,
  assignments,
  backgroundStyle,
  isSelected,
  isClickable,
  getShiftInfo,
  onCellClick,
  showExtraActions,
  extraMenuOpenKey,
  cellKey,
  hasExtraBefore,
  hasExtraAfter,
  onToggleExtra,
  onExtraMenuOpenChange,
  quickShifts,
  mediosTurnos,
  onQuickAssignments,
  onAssignmentUpdate,
  scheduleId,
  readonly = false,
  hasCellHistory = false,
  onCellUndo,
  hasFixedSchedule = false,
  suggestionWeeks,
  isManuallyFixed = false,
  onToggleFixed,
  suggestion,
  config,
}: ScheduleCellProps) {
  const [notaDialogOpen, setNotaDialogOpen] = useState(false)
  const [notaTexto, setNotaTexto] = useState("")
  const [horarioEspecialDialogOpen, setHorarioEspecialDialogOpen] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [textoEspecial, setTextoEspecial] = useState("")
  const [colorEspecial, setColorEspecial] = useState<string>("")
  const [licenciaEmbarazoDialogOpen, setLicenciaEmbarazoDialogOpen] = useState(false)
  const [licenciaStartTime, setLicenciaStartTime] = useState("")
  const [licenciaEndTime, setLicenciaEndTime] = useState("")
  const [selectedShiftForLicencia, setSelectedShiftForLicencia] = useState<{ assignment: ShiftAssignment; shift: Turno } | null>(null)
  
  const hasBackgroundStyle = !!backgroundStyle
  const dayOfWeek = getDay(parseISO(date))
  const hoverClass = hasBackgroundStyle
    ? isClickable
      ? "hover:brightness-95"
      : ""
    : isClickable
    ? "hover:bg-muted/50"
    : ""
  const selectedClass = hasBackgroundStyle ? "ring-2 ring-primary/30" : isSelected ? "bg-primary/10" : ""

  // Verificar si ya hay una nota en esta celda
  const existingNota = assignments.find((a) => a.type === "nota")
  
  // Verificar si ya hay un horario especial en esta celda
  const existingHorarioEspecial = assignments.find(
    (a) => a.type === "shift" && !a.shiftId && (a.startTime || a.endTime)
  )

  // Encontrar turnos (shifts) disponibles para asignar licencia
  const availableShifts = React.useMemo(() => {
    return assignments
      .filter((a) => a.type === "shift" && a.shiftId)
      .map((a) => {
        const shift = getShiftInfo(a.shiftId!)
        return shift ? { assignment: a, shift } : null
      })
      .filter((item): item is { assignment: ShiftAssignment; shift: Turno } => item !== null)
  }, [assignments, getShiftInfo])

  // Obtener colores únicos de los turnos disponibles
  const availableColors = React.useMemo(() => {
    const colorSet = new Set<string>()
    quickShifts.forEach((shift) => {
      if (shift.color) {
        colorSet.add(shift.color)
      }
    })
    return Array.from(colorSet)
  }, [quickShifts])
  
  const handleOpenNotaDialog = () => {
    if (existingNota?.texto) {
      setNotaTexto(existingNota.texto)
    } else {
      setNotaTexto("")
    }
    setNotaDialogOpen(true)
  }

  const handleOpenHorarioEspecialDialog = () => {
    if (existingHorarioEspecial) {
      setStartTime(existingHorarioEspecial.startTime || "")
      setEndTime(existingHorarioEspecial.endTime || "")
      setTextoEspecial(existingHorarioEspecial.texto || "")
      // Obtener el color del horario especial (puede estar en el objeto como propiedad adicional)
      setColorEspecial((existingHorarioEspecial as any).color || "")
    } else {
      setStartTime("")
      setEndTime("")
      setTextoEspecial("")
      setColorEspecial("")
    }
    setHorarioEspecialDialogOpen(true)
  }

  const handleSaveHorarioEspecial = () => {
    if (!onAssignmentUpdate) return
    
    const trimmedStartTime = startTime.trim()
    const trimmedEndTime = endTime.trim()
    const trimmedTexto = textoEspecial.trim()
    
    // Si no hay horas ni texto, eliminar el horario especial
    if (!trimmedStartTime && !trimmedEndTime && !trimmedTexto) {
      const updatedAssignments = assignments.filter(
        (a) => !(a.type === "shift" && !a.shiftId && (a.startTime || a.endTime))
      )
      onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })
    } else {
      // Crear o actualizar el horario especial
      const horarioEspecialAssignment: ShiftAssignment & { color?: string } = {
        type: "shift",
        startTime: trimmedStartTime || undefined,
        endTime: trimmedEndTime || undefined,
        texto: trimmedTexto || undefined,
        color: colorEspecial.trim() || undefined,
      }
      
      // Eliminar horarios especiales existentes y agregar el nuevo
      const otherAssignments = assignments.filter(
        (a) => !(a.type === "shift" && !a.shiftId && (a.startTime || a.endTime))
      )
      const updatedAssignments = [...otherAssignments, horarioEspecialAssignment]
      
      onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })
    }
    
    setHorarioEspecialDialogOpen(false)
    setStartTime("")
    setEndTime("")
    setTextoEspecial("")
    setColorEspecial("")
  }

  const handleDeleteHorarioEspecial = () => {
    if (!onAssignmentUpdate) return
    
    const updatedAssignments = assignments.filter(
      (a) => !(a.type === "shift" && !a.shiftId && (a.startTime || a.endTime))
    )
    onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })
    setHorarioEspecialDialogOpen(false)
    setStartTime("")
    setEndTime("")
    setTextoEspecial("")
    setColorEspecial("")
  }

  const handleSaveNota = () => {
    if (!onAssignmentUpdate) return
    
    const trimmedTexto = notaTexto.trim()
    
    if (trimmedTexto === "") {
      // Si el texto está vacío, eliminar la nota
      const updatedAssignments = assignments.filter((a) => a.type !== "nota")
      onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })
    } else {
      // Crear o actualizar la nota
      const notaAssignment: ShiftAssignment = {
        type: "nota",
        texto: trimmedTexto,
      }
      
      // Si ya existe una nota, reemplazarla; si no, agregarla
      const otherAssignments = assignments.filter((a) => a.type !== "nota")
      const updatedAssignments = [...otherAssignments, notaAssignment]
      
      onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })
    }
    
    setNotaDialogOpen(false)
    setNotaTexto("")
  }

  const handleDeleteNota = () => {
    if (!onAssignmentUpdate) return
    
    const updatedAssignments = assignments.filter((a) => a.type !== "nota")
    onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })
    setNotaDialogOpen(false)
    setNotaTexto("")
  }

  const handleClearCell = () => {
    if (!onAssignmentUpdate) return
    
    // Limpiar todas las asignaciones de la celda
    onAssignmentUpdate(date, employeeId, [], { scheduleId })
  }

  const handleOpenLicenciaEmbarazoDialog = (shiftAssignment: ShiftAssignment, shift: Turno) => {
    setSelectedShiftForLicencia({ assignment: shiftAssignment, shift })
    setLicenciaStartTime("")
    setLicenciaEndTime("")
    setLicenciaEmbarazoDialogOpen(true)
  }

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number)
    return hours * 60 + minutes
  }

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
  }

  const handleSaveLicenciaEmbarazo = () => {
    if (!onAssignmentUpdate || !selectedShiftForLicencia) return

    const trimmedStartTime = licenciaStartTime.trim()
    const trimmedEndTime = licenciaEndTime.trim()

    if (!trimmedStartTime || !trimmedEndTime) {
      return // Validación básica - el diálogo debe validar antes
    }

    const { assignment: shiftAssignment, shift } = selectedShiftForLicencia

    // Obtener el horario base del turno (considerando ajustes)
    const shiftStartTime = shiftAssignment.startTime || shift.startTime || ""
    const shiftEndTime = shiftAssignment.endTime || shift.endTime || ""
    const shiftStartTime2 = shiftAssignment.startTime2 || shift.startTime2
    const shiftEndTime2 = shiftAssignment.endTime2 || shift.endTime2

    // Validar que el rango esté dentro del turno
    const licenciaStart = timeToMinutes(trimmedStartTime)
    const licenciaEnd = timeToMinutes(trimmedEndTime)
    const shiftStart = timeToMinutes(shiftStartTime)
    const shiftEnd = timeToMinutes(shiftEndTime)

    // Validar que el rango esté contenido en el turno
    if (licenciaStart < shiftStart || licenciaEnd > shiftEnd) {
      // Si el turno tiene segunda franja, también validar ahí
      if (shiftStartTime2 && shiftEndTime2) {
        const shiftStart2 = timeToMinutes(shiftStartTime2)
        const shiftEnd2 = timeToMinutes(shiftEndTime2)
        if (!(licenciaStart >= shiftStart2 && licenciaEnd <= shiftEnd2)) {
          return // Fuera de rango
        }
      } else {
        return // Fuera de rango
      }
    }

    if (licenciaStart >= licenciaEnd) {
      return // Rango inválido
    }

    // Crear los tramos divididos
    const newAssignments: ShiftAssignment[] = []

    // Si el turno tiene segunda franja (turno cortado)
    if (shiftStartTime2 && shiftEndTime2) {
      const shiftStart2 = timeToMinutes(shiftStartTime2)
      const shiftEnd2 = timeToMinutes(shiftEndTime2)

      // Determinar en qué franja está la licencia
      if (licenciaStart >= shiftStart2 && licenciaEnd <= shiftEnd2) {
        // Licencia está en la segunda franja
        // Mantener primera franja completa
        const firstPart: ShiftAssignment = {
          shiftId: shiftAssignment.shiftId,
          type: "shift",
          startTime: shiftStartTime,
          endTime: shiftEndTime,
        }
        newAssignments.push(firstPart)

        // Tramo antes de licencia en segunda franja (si existe)
        if (licenciaStart > shiftStart2) {
          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime2: shiftStartTime2,
            endTime2: trimmedStartTime,
          })
        }

        // Tramo de licencia
        newAssignments.push({
          type: "licencia_embarazo",
          startTime: trimmedStartTime,
          endTime: trimmedEndTime,
        })

        // Tramo después de licencia en segunda franja (si existe)
        if (licenciaEnd < shiftEnd2) {
          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime2: trimmedEndTime,
            endTime2: shiftEndTime2,
          })
        }
      } else if (licenciaStart >= shiftStart && licenciaEnd <= shiftEnd) {
        // Licencia está en la primera franja
        // Tramo antes de licencia en primera franja (si existe)
        if (licenciaStart > shiftStart) {
          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime: shiftStartTime,
            endTime: trimmedStartTime,
          })
        }

        // Tramo de licencia
        newAssignments.push({
          type: "licencia_embarazo",
          startTime: trimmedStartTime,
          endTime: trimmedEndTime,
        })

        // Tramo después de licencia en primera franja (si existe)
        if (licenciaEnd < shiftEnd) {
          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime: trimmedEndTime,
            endTime: shiftEndTime,
          })
        }

        // Mantener segunda franja completa
        newAssignments.push({
          shiftId: shiftAssignment.shiftId,
          type: "shift",
          startTime2: shiftStartTime2,
          endTime2: shiftEndTime2,
        })
      }
    } else {
      // Turno continuo (una sola franja)
      // Tramo antes de licencia (si existe)
      if (licenciaStart > shiftStart) {
        newAssignments.push({
          shiftId: shiftAssignment.shiftId,
          type: "shift",
          startTime: shiftStartTime,
          endTime: trimmedStartTime,
        })
      }

      // Tramo de licencia
      newAssignments.push({
        type: "licencia_embarazo",
        startTime: trimmedStartTime,
        endTime: trimmedEndTime,
      })

      // Tramo después de licencia (si existe)
      if (licenciaEnd < shiftEnd) {
        newAssignments.push({
          shiftId: shiftAssignment.shiftId,
          type: "shift",
          startTime: trimmedEndTime,
          endTime: shiftEndTime,
        })
      }
    }

    // Mantener todas las demás asignaciones (francos, notas, otros turnos, etc.)
    const otherAssignments = assignments.filter(
      (a) => !(a.type === "shift" && a.shiftId === shiftAssignment.shiftId)
    )

    // Separar por tipo para ordenar correctamente
    const turnAssignments = newAssignments.filter((a) => a.type === "shift")
    const licenciaAssignments = newAssignments.filter((a) => a.type === "licencia_embarazo")
    const otherTurnAssignments = otherAssignments.filter((a) => a.type === "shift")
    const otherSpecialAssignments = otherAssignments.filter((a) => a.type !== "shift")

    // Ordenar: turnos (del mismo shift, otros shifts), licencia, otros (francos, notas, etc.)
    const finalAssignments = [
      ...turnAssignments,
      ...otherTurnAssignments,
      ...licenciaAssignments,
      ...otherSpecialAssignments,
    ]

    onAssignmentUpdate(date, employeeId, finalAssignments, { scheduleId })

    setLicenciaEmbarazoDialogOpen(false)
    setLicenciaStartTime("")
    setLicenciaEndTime("")
    setSelectedShiftForLicencia(null)
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <td
            className={`border-r-2 border-black px-1 sm:px-1.5 md:px-2 py-1 sm:py-1.5 md:py-2 last:border-r-0 relative group ${
              isClickable ? `cursor-pointer transition-all ${hoverClass} active:brightness-90 touch-manipulation` : ""
            } ${selectedClass} ${
              isSelected && isClickable && onQuickAssignments ? "min-h-[140px] py-2 sm:py-2.5 md:py-3" : ""
            }`}
            style={backgroundStyle}
            onClick={() => onCellClick(date, employeeId)}
          >
            {/* Botón pequeño de deshacer en celda (arriba a la izquierda) */}
            {!readonly && hasCellHistory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCellUndo?.()
                }}
                className="absolute top-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-primary/90 text-primary-foreground opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100 hover:bg-primary shadow-sm"
                title="Deshacer cambio en esta celda"
                aria-label="Deshacer cambio en esta celda"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
            {/* Indicador de horario modificado (puntito) - solo visible en exportación */}
            {(hasExtraBefore || hasExtraAfter) && (
              <div
                className="schedule-cell-indicator absolute bottom-1 right-1 z-10 h-2 w-2 rounded-full bg-primary shadow-sm hidden"
                title={hasExtraBefore && hasExtraAfter ? "Horario modificado (+30 min antes y después)" : hasExtraBefore ? "Horario modificado (+30 min antes)" : "Horario modificado (+30 min después)"}
                aria-label="Horario modificado"
              />
            )}
            {/* Indicador de horario fijo - oculto en exportaciones */}
            {hasFixedSchedule && (
              <div
                className="schedule-fixed-indicator absolute top-1 left-1 z-10 flex items-center gap-1 bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Horario fijo detectado (${suggestionWeeks || 0} semanas consecutivas)`}
                aria-label="Horario fijo"
              >
                <Lock className="h-3 w-3 text-primary" />
                <span className="text-xs font-semibold text-primary">{suggestionWeeks}</span>
              </div>
            )}
        {showExtraActions && (
          <div className="absolute -top-1 right-1" onClick={(event) => event.stopPropagation()}>
            <DropdownMenu open={extraMenuOpenKey === cellKey} onOpenChange={onExtraMenuOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-6 px-2 text-xs">
                  +Extra
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-xs">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    onToggleExtra("before")
                    onExtraMenuOpenChange(false)
                  }}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="flex-1">+30 min antes</span>
                  {hasExtraBefore && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    onToggleExtra("after")
                    onExtraMenuOpenChange(false)
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
        <div className="flex flex-col gap-1.5">
          {isSelected && isClickable && onQuickAssignments ? (
            <QuickShiftSelector
              shifts={quickShifts}
              mediosTurnos={mediosTurnos}
              onSelectAssignments={onQuickAssignments}
              onUndo={hasCellHistory ? onCellUndo : undefined}
              onToggleFixed={
                onToggleFixed
                  ? () => {
                      const dayOfWeek = getDay(parseISO(date))
                      onToggleFixed(date, employeeId, dayOfWeek)
                    }
                  : undefined
              }
              isManuallyFixed={isManuallyFixed}
              hasCellHistory={hasCellHistory}
              readonly={readonly}
              config={config}
              employeeId={employeeId}
              dayOfWeek={dayOfWeek}
            />
          ) : (
            <CellAssignments assignments={assignments} getShiftInfo={getShiftInfo} />
          )}
        </div>
        {/* Botón de candado para marcar como fijo (abajo al centro) - oculto en exportaciones */}
        {!readonly && isClickable && onToggleFixed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              const dayOfWeek = getDay(parseISO(date))
              onToggleFixed(date, employeeId, dayOfWeek)
            }}
            className={`schedule-lock-button absolute bottom-1 left-1/2 -translate-x-1/2 z-10 flex h-5 w-5 items-center justify-center rounded transition-all ${
              isManuallyFixed
                ? "bg-primary text-primary-foreground opacity-100"
                : "bg-muted/50 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground"
            }`}
            title={isManuallyFixed ? "Desmarcar como horario fijo" : "Marcar como horario fijo"}
            aria-label={isManuallyFixed ? "Desmarcar como horario fijo" : "Marcar como horario fijo"}
          >
            <Lock className={`h-3 w-3 ${isManuallyFixed ? "" : "opacity-60"}`} />
          </button>
        )}
      </td>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {!readonly && (
            <>
              <ContextMenuItem onClick={() => onCellClick(date, employeeId)}>
                Editar turno
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleOpenNotaDialog}>
                <FileText className="mr-2 h-4 w-4" />
                {existingNota ? "Editar nota" : "Agregar nota"}
              </ContextMenuItem>
              <ContextMenuItem onClick={handleOpenHorarioEspecialDialog}>
                <Clock className="mr-2 h-4 w-4" />
                {existingHorarioEspecial ? "Editar horario especial" : "Asignar horario especial"}
              </ContextMenuItem>
              {availableShifts.length > 0 && (
                <>
                  <ContextMenuSeparator />
                  {availableShifts.length === 1 ? (
                    <ContextMenuItem
                      onClick={() => handleOpenLicenciaEmbarazoDialog(availableShifts[0].assignment, availableShifts[0].shift)}
                    >
                      <Baby className="mr-2 h-4 w-4" />
                      Asignar Licencia por Embarazo
                    </ContextMenuItem>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <ContextMenuItem onSelect={(e) => e.preventDefault()}>
                          <Baby className="mr-2 h-4 w-4" />
                          Asignar Licencia por Embarazo
                        </ContextMenuItem>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {availableShifts.map(({ assignment, shift }, index) => (
                          <DropdownMenuItem
                            key={index}
                            onClick={() => handleOpenLicenciaEmbarazoDialog(assignment, shift)}
                          >
                            {shift.name || `Turno ${index + 1}`}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}
              {assignments.length > 0 && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={handleClearCell}>
                    <X className="mr-2 h-4 w-4" />
                    Limpiar
                  </ContextMenuItem>
                </>
              )}
              {hasCellHistory && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => onCellUndo?.()}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Deshacer cambio en esta celda
                  </ContextMenuItem>
                </>
              )}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      
      {/* Diálogo para agregar/editar nota */}
      <Dialog open={notaDialogOpen} onOpenChange={setNotaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{existingNota ? "Editar nota" : "Agregar nota"}</DialogTitle>
            <DialogDescription>
              Ingresa un texto personalizado para esta celda (ej: enfermedad, viaje, vacaciones)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              placeholder="Ej: Enfermedad / Viaje / Vacaciones"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSaveNota()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            {existingNota && (
              <Button variant="destructive" onClick={handleDeleteNota}>
                Eliminar nota
              </Button>
            )}
            <Button variant="outline" onClick={() => setNotaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNota}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para asignar/editar horario especial */}
      <Dialog open={horarioEspecialDialogOpen} onOpenChange={setHorarioEspecialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {existingHorarioEspecial ? "Editar horario especial" : "Asignar horario especial"}
            </DialogTitle>
            <DialogDescription>
              Ingrese las horas de inicio y fin para crear un horario manual personalizado
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="startTime">Hora de inicio (opcional)</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="HH:MM"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endTime">Hora de fin (opcional)</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="HH:MM"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="textoEspecial">Descripción o nota (opcional)</Label>
              <Input
                id="textoEspecial"
                value={textoEspecial}
                onChange={(e) => setTextoEspecial(e.target.value)}
                placeholder="Ej: Reunión especial, Evento, etc."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSaveHorarioEspecial()
                  }
                }}
              />
            </div>
            {availableColors.length > 0 && (
              <div className="grid gap-2">
                <Label>Color (opcional)</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`h-10 w-10 rounded-full border-2 transition-all ${
                      !colorEspecial ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: "transparent", borderStyle: "dashed" }}
                    onClick={() => setColorEspecial("")}
                    title="Sin color"
                  />
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-10 w-10 rounded-full border-2 transition-all ${
                        colorEspecial === color ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setColorEspecial(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {existingHorarioEspecial && (
              <Button variant="destructive" onClick={handleDeleteHorarioEspecial}>
                Eliminar horario especial
              </Button>
            )}
            <Button variant="outline" onClick={() => setHorarioEspecialDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveHorarioEspecial}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para asignar licencia por embarazo */}
      <Dialog open={licenciaEmbarazoDialogOpen} onOpenChange={setLicenciaEmbarazoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Licencia por Embarazo</DialogTitle>
            <DialogDescription>
              {selectedShiftForLicencia && (
                <>
                  Selecciona el rango horario dentro del turno <strong>{selectedShiftForLicencia.shift.name}</strong>.
                  <br />
                  {(() => {
                    const shift = selectedShiftForLicencia.shift
                    const assignment = selectedShiftForLicencia.assignment
                    const startTime = assignment.startTime || shift.startTime || ""
                    const endTime = assignment.endTime || shift.endTime || ""
                    const startTime2 = assignment.startTime2 || shift.startTime2
                    const endTime2 = assignment.endTime2 || shift.endTime2
                    
                    if (startTime2 && endTime2) {
                      return `Horario del turno: ${startTime} - ${endTime} y ${startTime2} - ${endTime2}`
                    }
                    return `Horario del turno: ${startTime} - ${endTime}`
                  })()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="licenciaStartTime">Hora de inicio</Label>
              <Input
                id="licenciaStartTime"
                type="time"
                value={licenciaStartTime}
                onChange={(e) => setLicenciaStartTime(e.target.value)}
                min={selectedShiftForLicencia ? (selectedShiftForLicencia.assignment.startTime || selectedShiftForLicencia.shift.startTime || "") : undefined}
                max={selectedShiftForLicencia ? (selectedShiftForLicencia.assignment.endTime || selectedShiftForLicencia.shift.endTime || "") : undefined}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="licenciaEndTime">Hora de fin</Label>
              <Input
                id="licenciaEndTime"
                type="time"
                value={licenciaEndTime}
                onChange={(e) => setLicenciaEndTime(e.target.value)}
                min={licenciaStartTime || (selectedShiftForLicencia ? (selectedShiftForLicencia.assignment.startTime || selectedShiftForLicencia.shift.startTime || "") : undefined)}
                max={selectedShiftForLicencia ? (selectedShiftForLicencia.assignment.endTime || selectedShiftForLicencia.shift.endTime || "") : undefined}
              />
            </div>
            {licenciaStartTime && licenciaEndTime && selectedShiftForLicencia && (() => {
              const shift = selectedShiftForLicencia.shift
              const assignment = selectedShiftForLicencia.assignment
              const shiftStartTime = assignment.startTime || shift.startTime || ""
              const shiftEndTime = assignment.endTime || shift.endTime || ""
              const shiftStartTime2 = assignment.startTime2 || shift.startTime2
              const shiftEndTime2 = assignment.endTime2 || shift.endTime2

              const licenciaStart = timeToMinutes(licenciaStartTime)
              const licenciaEnd = timeToMinutes(licenciaEndTime)
              const shiftStart = timeToMinutes(shiftStartTime)
              const shiftEnd = timeToMinutes(shiftEndTime)

              let isValid = false
              let errorMessage = ""

              if (licenciaStart >= licenciaEnd) {
                errorMessage = "La hora de inicio debe ser anterior a la hora de fin"
              } else if (shiftStartTime2 && shiftEndTime2) {
                const shiftStart2 = timeToMinutes(shiftStartTime2)
                const shiftEnd2 = timeToMinutes(shiftEndTime2)
                isValid = (licenciaStart >= shiftStart && licenciaEnd <= shiftEnd) || (licenciaStart >= shiftStart2 && licenciaEnd <= shiftEnd2)
                if (!isValid) {
                  errorMessage = `El rango debe estar contenido en ${shiftStartTime} - ${shiftEndTime} o en ${shiftStartTime2} - ${shiftEndTime2}`
                }
              } else {
                isValid = licenciaStart >= shiftStart && licenciaEnd <= shiftEnd
                if (!isValid) {
                  errorMessage = `El rango debe estar contenido en ${shiftStartTime} - ${shiftEndTime}`
                }
              }

              if (errorMessage) {
                return (
                  <div className="text-sm text-destructive">
                    {errorMessage}
                  </div>
                )
              }

              const duration = licenciaEnd - licenciaStart
              return (
                <div className="text-sm text-muted-foreground">
                  Duración: {Math.floor(duration / 60)}h {duration % 60}min
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLicenciaEmbarazoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveLicenciaEmbarazo}
              disabled={!licenciaStartTime || !licenciaEndTime || !selectedShiftForLicencia || (() => {
                if (!selectedShiftForLicencia || !licenciaStartTime || !licenciaEndTime) return true
                const shift = selectedShiftForLicencia.shift
                const assignment = selectedShiftForLicencia.assignment
                const shiftStartTime = assignment.startTime || shift.startTime || ""
                const shiftEndTime = assignment.endTime || shift.endTime || ""
                const shiftStartTime2 = assignment.startTime2 || shift.startTime2
                const shiftEndTime2 = assignment.endTime2 || shift.endTime2

                const licenciaStart = timeToMinutes(licenciaStartTime)
                const licenciaEnd = timeToMinutes(licenciaEndTime)
                const shiftStart = timeToMinutes(shiftStartTime)
                const shiftEnd = timeToMinutes(shiftEndTime)

                if (licenciaStart >= licenciaEnd) return true
                if (shiftStartTime2 && shiftEndTime2) {
                  const shiftStart2 = timeToMinutes(shiftStartTime2)
                  const shiftEnd2 = timeToMinutes(shiftEndTime2)
                  return !((licenciaStart >= shiftStart && licenciaEnd <= shiftEnd) || (licenciaStart >= shiftStart2 && licenciaEnd <= shiftEnd2))
                }
                return !(licenciaStart >= shiftStart && licenciaEnd <= shiftEnd)
              })()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

