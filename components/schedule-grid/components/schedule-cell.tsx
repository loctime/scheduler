"use client"

import React, { useState, useMemo, useEffect } from "react"
import type { CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
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
import { Check, RotateCcw, Undo2, Lock, FileText, X, Clock, Baby, Plus } from "lucide-react"
import { ShiftRequestMarker } from "@/components/shift-request-marker"
import { ShiftAssignment, Turno, MedioTurno, Configuracion } from "@/lib/types"
import { CellAssignments } from "./cell-assignments"
import { QuickShiftSelector } from "./quick-shift-selector"
import { getDay, parseISO } from "date-fns"
import type { PatternSuggestion } from "@/lib/pattern-learning"
import { validateCellAssignments } from "@/lib/assignment-validators"
import { useToast } from "@/hooks/use-toast"
import { isAssignmentIncomplete, getIncompletenessReason } from "@/lib/assignment-utils"
import { EditarHorarioDialog } from "@/components/schedule-calendar/EditarHorarioDialog"
import { LicenciaEmbarazoDialog } from "@/components/schedule-calendar/LicenciaEmbarazoDialog"
import { getEmployeeRequest } from "@/lib/employee-requests"

interface ScheduleCellProps {
  date: string
  employeeId: string
  assignments: ShiftAssignment[]
  backgroundStyle?: CSSProperties
  isSelected: boolean
  isClickable: boolean
  getShiftInfo: (shiftId: string) => Turno | undefined
  onCellClick: (date: string, employeeId: string) => void
  cellKey: string
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
  hasIncompleteAssignments?: boolean
  updateEmployeeRequestCache?: (key: string, request: any) => void
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
  cellKey,
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
  hasIncompleteAssignments = false,
  updateEmployeeRequestCache,
}: ScheduleCellProps) {
  const [notaDialogOpen, setNotaDialogOpen] = useState(false)
  const [notaTexto, setNotaTexto] = useState("")
  // Estado local para pedidos de empleados
  const [employeeRequestActive, setEmployeeRequestActive] = useState(false)
  const [employeeRequestDescription, setEmployeeRequestDescription] = useState("")
  
  // Cargar datos del pedido al montar el componente
  useEffect(() => {
    const loadEmployeeRequest = async () => {
      try {
        if (readonly || !scheduleId) return
        const request = await getEmployeeRequest(scheduleId, employeeId, date)
        if (request && request.active) {
          setEmployeeRequestActive(true)
          setEmployeeRequestDescription(request.description)
        } else {
          setEmployeeRequestActive(false)
          setEmployeeRequestDescription("")
        }
      } catch (error) {
        console.error("Error loading employee request:", error)
      }
    }

    loadEmployeeRequest()
  }, [scheduleId, employeeId, date, readonly])
  
  // Handlers para pedidos de empleados
  const handleEmployeeRequestToggle = () => {
    setEmployeeRequestActive(!employeeRequestActive)
  }
  
  const handleEmployeeRequestEditDescription = (description: string) => {
    setEmployeeRequestDescription(description)
  }
  const [horarioEspecialDialogOpen, setHorarioEspecialDialogOpen] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [textoEspecial, setTextoEspecial] = useState("")
  const [colorEspecial, setColorEspecial] = useState<string>("")
  const [licenciaEmbarazoDialogOpen, setLicenciaEmbarazoDialogOpen] = useState(false)
  const [selectedShiftForLicencia, setSelectedShiftForLicencia] = useState<{ assignment: ShiftAssignment; shift?: Turno } | null>(null)
  const [editarHorarioDialogOpen, setEditarHorarioDialogOpen] = useState(false)
  const [selectedShiftForEdit, setSelectedShiftForEdit] = useState<{ assignment: ShiftAssignment; shift?: Turno; assignmentIndex: number } | null>(null)
  const [editarHorarioSubmenuOpen, setEditarHorarioSubmenuOpen] = useState(false)
  
  const { toast } = useToast()
  
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
  const incompleteClass = hasIncompleteAssignments ? "ring-2 ring-destructive/50 opacity-75" : ""
  const incompleteIndicator = hasIncompleteAssignments ? "relative" : ""

  // Verificar si ya hay una nota en esta celda
  const existingNota = assignments.find((a) => a.type === "nota")
  
  // Verificar si ya hay un horario especial en esta celda
  const existingHorarioEspecial = assignments.find(
    (a) => a.type === "shift" && !a.shiftId && (a.startTime || a.endTime)
  )

  // Encontrar todos los turnos asignados editables (con índice real)
  // CRÍTICO: Permitir assignments con shiftId huérfano (turno base eliminado)
  const editableShiftAssignments = React.useMemo(() => {
    return assignments
      .map((assignment, index) => {
        // Solo incluir assignments de tipo "shift" con shiftId
        if (assignment.type !== "shift" || !assignment.shiftId) return null
        
        const shift = getShiftInfo(assignment.shiftId)
        // Permitir edición incluso si el turno base no existe (shift undefined)
        // El assignment es autosuficiente si tiene startTime/endTime
        return {
          assignment,
          shift: shift || undefined,
          index, // Índice real en el array
        }
      })
      .filter((item): item is { assignment: ShiftAssignment; shift: Turno | undefined; index: number } => item !== null)
  }, [assignments, getShiftInfo])

  // Mantener firstShiftAssignment para compatibilidad con código existente (licencia, etc.)
  const firstShiftAssignment = React.useMemo(() => {
    if (editableShiftAssignments.length === 0) return null
    const first = editableShiftAssignments[0]
    if (!first) return null
    return { assignment: first.assignment, shift: first.shift }
  }, [editableShiftAssignments])
  
  // Detectar si el turno base está huérfano (eliminado)
  const isOrphanShift = React.useMemo(() => {
    if (!firstShiftAssignment) return false
    return firstShiftAssignment.assignment.shiftId && !firstShiftAssignment.shift
  }, [firstShiftAssignment])

  // Detectar si es turno cortado (tiene segunda franja explícita)
  const isTurnoCortado = React.useMemo(() => {
    if (!firstShiftAssignment) return false
    return !!(firstShiftAssignment.assignment.startTime2 && firstShiftAssignment.assignment.endTime2)
  }, [firstShiftAssignment])

  // Validar si se puede aplicar licencia por embarazo
  // REQUISITO: Debe existir al menos un assignment de tipo "shift" o "medio_franco"
  // No se exige horario real explícito - se puede usar el turno base como referencia inicial
  const canApplyLicenciaEmbarazo = React.useMemo(() => {
    return assignments.some(
      (a) => a.type === "shift" || a.type === "medio_franco"
    )
  }, [assignments])

  // Encontrar turnos (shifts) y medios francos disponibles para asignar licencia
  // PERMITE turnos sin horario real - se usa el turno base como referencia inicial
  const availableShifts = React.useMemo(() => {
    const shifts = assignments
      .filter((a) => a.type === "shift")
      .map((a) => {
        const shift = a.shiftId ? getShiftInfo(a.shiftId) : undefined
        // Incluir incluso si no tiene horario real - el turno base servirá como referencia
        return { assignment: a, shift: shift || undefined }
      })
      .filter((item): item is { assignment: ShiftAssignment; shift: Turno | undefined } => {
        // Solo incluir si tiene turno base o tiene horario real
        const hasRealSchedule = !!(item.assignment.startTime && item.assignment.endTime)
        return item.shift !== undefined || hasRealSchedule
      })
    
    // Agregar medios francos (con o sin horario real)
    const mediosFrancos = assignments
      .filter((a) => a.type === "medio_franco")
      .map((a) => {
        // Si tiene horario real, crear turno virtual con esos horarios
        // Si no, crear turno virtual genérico (aunque esto es raro para medio_franco)
        const virtualShift: Turno = {
          id: "medio_franco_virtual",
          name: "1/2 Franco",
          startTime: a.startTime || "",
          endTime: a.endTime || "",
          startTime2: a.startTime2,
          endTime2: a.endTime2,
          color: "#22c55e",
          userId: "",
        }
        return { assignment: a, shift: virtualShift }
      })
    
    return [...shifts, ...mediosFrancos]
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


  const handleOpenLicenciaEmbarazoDialog = (shiftAssignment: ShiftAssignment, shift?: Turno) => {
    // Permitir abrir el modal incluso si no hay horario real
    // El turno base servirá como referencia inicial
    setSelectedShiftForLicencia({ assignment: shiftAssignment, shift })
    setLicenciaEmbarazoDialogOpen(true)
  }


  const handleOpenEditarHorarioDialog = (assignmentIndex?: number) => {
    // Si se pasa un índice específico, abrir ese assignment
    if (assignmentIndex !== undefined) {
      const editableItem = editableShiftAssignments.find((item) => item && item.index === assignmentIndex)
      if (!editableItem) return

      const { assignment, shift, index } = editableItem
      setSelectedShiftForEdit({ assignment, shift, assignmentIndex: index })
      setEditarHorarioDialogOpen(true)
      setEditarHorarioSubmenuOpen(false)
      return
    }

    // Si hay solo un turno, abrirlo directamente
    if (editableShiftAssignments.length === 1) {
      const first = editableShiftAssignments[0]
      if (!first) return
      
      const { assignment, shift, index } = first
      setSelectedShiftForEdit({ assignment, shift, assignmentIndex: index })
      setEditarHorarioDialogOpen(true)
      return
    }

    // Si hay múltiples turnos, mostrar submenú
    if (editableShiftAssignments.length > 1) {
      setEditarHorarioSubmenuOpen(true)
      return
    }

    // Si no hay turnos editables, no hacer nada
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <td
            className={`border-r-2 border-black px-1 sm:px-1.5 md:px-2 py-1 sm:py-1.5 md:py-2 last:border-r-0 relative group ${
              isClickable ? `cursor-pointer transition-all ${hoverClass} active:brightness-90 touch-manipulation` : ""
            } ${selectedClass} ${incompleteClass} ${
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
              date={date}
              scheduleId={scheduleId}
              updateEmployeeRequestCache={updateEmployeeRequestCache}
            />
          ) : (
            <CellAssignments assignments={assignments} getShiftInfo={getShiftInfo} />
          )}
        </div>
        {/* Marcador visual único abajo al centro */}
        {!readonly && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10">
            <ShiftRequestMarker 
              active={employeeRequestActive}
              description={employeeRequestDescription}
              onToggle={handleEmployeeRequestToggle}
              onEditDescription={handleEmployeeRequestEditDescription}
              scheduleId={scheduleId || ''}
              employeeId={employeeId}
              date={date}
              availableShifts={quickShifts}
              mediosTurnos={mediosTurnos}
              updateEmployeeRequestCache={updateEmployeeRequestCache}
            />
          </div>
        )}
        
       
      </td>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {!readonly && (
            <>
              {/* FASE 11: Guard rails - Deshabilitar opciones de edición si hay incompletos */}
              {/* Solo mostrar "Editar horario" si hay assignments editables */}
              {editableShiftAssignments.length > 0 && (
                <>
                  {editableShiftAssignments.length === 1 ? (
                    <ContextMenuItem 
                      onClick={() => handleOpenEditarHorarioDialog()}
                      disabled={hasIncompleteAssignments}
                      className={hasIncompleteAssignments ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      Editar horario
                      {hasIncompleteAssignments && " (Bloqueado - Assignments incompletos)"}
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuSub>
                      <ContextMenuSubTrigger 
                        disabled={hasIncompleteAssignments}
                        className={hasIncompleteAssignments ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        Editar horario
                        {hasIncompleteAssignments && " (Bloqueado - Assignments incompletos)"}
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {editableShiftAssignments.map((item) => {
                          if (!item) return null
                          const { assignment, shift, index } = item
                          const shiftName = shift?.name || "Turno eliminado (huérfano)"
                          const timeRange = assignment.startTime && assignment.endTime
                            ? `${assignment.startTime} - ${assignment.endTime}`
                            : "Sin horario"
                          const secondRange = assignment.startTime2 && assignment.endTime2
                            ? ` / ${assignment.startTime2} - ${assignment.endTime2}`
                            : ""
                          
                          return (
                            <ContextMenuItem
                              key={index}
                              onClick={() => handleOpenEditarHorarioDialog(index)}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{shiftName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {timeRange}{secondRange}
                                </span>
                              </div>
                            </ContextMenuItem>
                          )
                        })}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  )}
                  <ContextMenuSeparator />
                </>
              )}
              <ContextMenuItem onClick={handleOpenNotaDialog}>
                <FileText className="mr-2 h-4 w-4" />
                {existingNota ? "Editar nota" : "Agregar nota"}
              </ContextMenuItem>
              <ContextMenuItem onClick={handleOpenHorarioEspecialDialog}>
                <Clock className="mr-2 h-4 w-4" />
                {existingHorarioEspecial ? "Editar horario especial" : "Asignar horario especial"}
              </ContextMenuItem>
              <>
                <ContextMenuSeparator />
                {availableShifts.length === 1 ? (
                  <ContextMenuItem
                    onClick={() => handleOpenLicenciaEmbarazoDialog(availableShifts[0].assignment, availableShifts[0].shift)}
                    disabled={!canApplyLicenciaEmbarazo}
                    className={!canApplyLicenciaEmbarazo ? "opacity-50 cursor-not-allowed" : ""}
                    title={!canApplyLicenciaEmbarazo ? "Definí primero el horario trabajado (Editar horario)" : undefined}
                  >
                    <Baby className="mr-2 h-4 w-4" />
                    Asignar licencia por embarazo
                  </ContextMenuItem>
                ) : availableShifts.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <ContextMenuItem 
                        onSelect={(e) => e.preventDefault()}
                        disabled={!canApplyLicenciaEmbarazo}
                        className={!canApplyLicenciaEmbarazo ? "opacity-50 cursor-not-allowed" : ""}
                        title={!canApplyLicenciaEmbarazo ? "Definí primero el horario trabajado (Editar horario)" : undefined}
                      >
                        <Baby className="mr-2 h-4 w-4" />
                        Asignar licencia por embarazo
                      </ContextMenuItem>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {availableShifts.map(({ assignment, shift }, index) => (
                        <DropdownMenuItem
                          key={index}
                          onClick={() => handleOpenLicenciaEmbarazoDialog(assignment, shift)}
                        >
                          {shift?.name || `Turno ${index + 1}`}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <ContextMenuItem
                    disabled
                    className="opacity-50 cursor-not-allowed"
                    title="Definí primero el horario trabajado (Editar horario)"
                  >
                    <Baby className="mr-2 h-4 w-4" />
                    Asignar licencia por embarazo
                  </ContextMenuItem>
                )}
              </>
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
              
              {/* Opción de regla fija */}
              {onToggleFixed && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => {
                    const dayOfWeek = getDay(parseISO(date))
                    onToggleFixed(date, employeeId, dayOfWeek)
                  }}>
                    <Lock className="mr-2 h-4 w-4" />
                    {hasFixedSchedule ? "Editar regla fija" : "Crear regla fija"}
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
      {selectedShiftForLicencia && (
        <LicenciaEmbarazoDialog
          open={licenciaEmbarazoDialogOpen}
          onOpenChange={(open) => {
            setLicenciaEmbarazoDialogOpen(open)
            if (!open) {
              setSelectedShiftForLicencia(null)
            }
          }}
          date={date}
          employeeId={employeeId}
          assignments={assignments}
          selectedShift={selectedShiftForLicencia}
          onApply={(date, employeeId, updatedAssignments) => {
            if (onAssignmentUpdate) {
              onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })
            }
          }}
        />
      )}

      {/* Diálogo para editar horario asignado */}
      {selectedShiftForEdit && (
        <EditarHorarioDialog
          open={editarHorarioDialogOpen}
          onOpenChange={(open) => {
            setEditarHorarioDialogOpen(open)
            if (!open) {
              setSelectedShiftForEdit(null)
            }
          }}
          assignment={selectedShiftForEdit.assignment}
          shift={selectedShiftForEdit.shift}
          assignmentIndex={selectedShiftForEdit.assignmentIndex}
          assignments={assignments}
          date={date}
          employeeId={employeeId}
          scheduleId={scheduleId}
          config={config || undefined}
          onSave={onAssignmentUpdate || (() => {})}
        />
      )}
    </>
  )
}
