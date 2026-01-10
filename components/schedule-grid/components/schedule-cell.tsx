"use client"

import React, { useState, useMemo } from "react"
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
import { validateCellAssignments } from "@/lib/assignment-validators"
import { useToast } from "@/hooks/use-toast"

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
  onToggleExtra: (type: "before" | "after", segment?: "first" | "second") => void
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
  hasIncompleteAssignments?: boolean
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
  hasIncompleteAssignments = false,
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
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null)
  const [editarHorarioDialogOpen, setEditarHorarioDialogOpen] = useState(false)
  const [selectedShiftForEdit, setSelectedShiftForEdit] = useState<{ assignment: ShiftAssignment; shift: Turno } | null>(null)
  const [editStartTime, setEditStartTime] = useState("")
  const [editEndTime, setEditEndTime] = useState("")
  const [editStartTime2, setEditStartTime2] = useState("")
  const [editEndTime2, setEditEndTime2] = useState("")
  const [hasSecondSegment, setHasSecondSegment] = useState(false)
  
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

  // Encontrar el primer turno asignado para edición
  const firstShiftAssignment = React.useMemo(() => {
    const shiftAssignment = assignments.find((a) => a.type === "shift" && a.shiftId)
    if (!shiftAssignment || !shiftAssignment.shiftId) return null
    const shift = getShiftInfo(shiftAssignment.shiftId)
    if (!shift) return null
    return { assignment: shiftAssignment, shift }
  }, [assignments, getShiftInfo])

  // Detectar si es turno cortado (tiene segunda franja explícita)
  const isTurnoCortado = React.useMemo(() => {
    if (!firstShiftAssignment) return false
    return !!(firstShiftAssignment.assignment.startTime2 && firstShiftAssignment.assignment.endTime2)
  }, [firstShiftAssignment])

  // Encontrar turnos (shifts) y medios francos disponibles para asignar licencia
  const availableShifts = React.useMemo(() => {
    const shifts = assignments
      .filter((a) => a.type === "shift" && a.shiftId)
      .map((a) => {
        const shift = getShiftInfo(a.shiftId!)
        return shift ? { assignment: a, shift } : null
      })
      .filter((item): item is { assignment: ShiftAssignment; shift: Turno } => item !== null)
    
    // Agregar medios francos que tengan horario (startTime/endTime)
    const mediosFrancos = assignments
      .filter((a) => a.type === "medio_franco" && a.startTime && a.endTime)
      .map((a) => {
        // Crear un Turno virtual para medio_franco
        const virtualShift: Turno = {
          id: "medio_franco_virtual",
          name: "1/2 Franco",
          startTime: a.startTime!,
          endTime: a.endTime!,
          startTime2: a.startTime2,
          endTime2: a.endTime2,
          color: "#22c55e",
          userId: "", // Campo requerido pero no relevante para virtual
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

  const timeToMinutes = (time: string): number => {
    if (!time) return 0
    // Normalizar formato: si no tiene ":", asumir que son solo horas (ej: "11" -> "11:00")
    const normalizedTime = time.includes(":") ? time : `${time}:00`
    const [hours, minutes] = normalizedTime.split(":").map(Number)
    return hours * 60 + minutes
  }

  const minutesToTime = (minutes: number): string => {
    // Manejar valores negativos (turnos que cruzan medianoche)
    let normalizedMinutes = minutes
    if (normalizedMinutes < 0) {
      normalizedMinutes = 24 * 60 + normalizedMinutes
    }
    normalizedMinutes = normalizedMinutes % (24 * 60)
    
    const hours = Math.floor(normalizedMinutes / 60)
    const mins = normalizedMinutes % 60
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
  }

  // Calcular duración de un turno considerando que puede cruzar medianoche
  const calculateDuration = (startTime: string, endTime: string): number => {
    const start = timeToMinutes(startTime)
    const end = timeToMinutes(endTime)
    
    // Si el fin es menor que el inicio, cruza medianoche
    if (end < start) {
      return (24 * 60 - start) + end
    }
    return end - start
  }

  // Verificar si un tiempo está dentro de un rango (considerando cruce de medianoche)
  const isTimeInRange = (time: string, rangeStart: string, rangeEnd: string): boolean => {
    const timeMinutes = timeToMinutes(time)
    const rangeStartMinutes = timeToMinutes(rangeStart)
    const rangeEndMinutes = timeToMinutes(rangeEnd)
    
    // Si el rango cruza medianoche
    if (rangeEndMinutes < rangeStartMinutes) {
      return timeMinutes >= rangeStartMinutes || timeMinutes <= rangeEndMinutes
    }
    // Rango normal
    return timeMinutes >= rangeStartMinutes && timeMinutes <= rangeEndMinutes
  }

  const handleOpenLicenciaEmbarazoDialog = (shiftAssignment: ShiftAssignment, shift: Turno) => {
    // Si es medio_franco con horario completo, asignar licencia directamente sin abrir diálogo
    if (shiftAssignment.type === "medio_franco" && shiftAssignment.startTime && shiftAssignment.endTime && !shiftAssignment.startTime2) {
      handleAssignLicenciaToMedioFranco(shiftAssignment)
      return
    }
    
    setSelectedShiftForLicencia({ assignment: shiftAssignment, shift })
    setLicenciaStartTime("")
    setLicenciaEndTime("")
    setSelectedSuggestion(null)
    setLicenciaEmbarazoDialogOpen(true)
  }

  // Asignar licencia directamente a medio_franco completo (reemplaza todo el medio_franco)
  const handleAssignLicenciaToMedioFranco = (medioFrancoAssignment: ShiftAssignment) => {
    if (!onAssignmentUpdate || !medioFrancoAssignment.startTime || !medioFrancoAssignment.endTime) return

    const licenciaAssignment: ShiftAssignment = {
      type: "licencia",
      licenciaType: "embarazo",
      startTime: medioFrancoAssignment.startTime,
      endTime: medioFrancoAssignment.endTime,
    }

    // Filtrar el medio_franco original y agregar la licencia
    const otherAssignments = assignments.filter((a) => a.type !== "medio_franco")
    const finalAssignments = [...otherAssignments, licenciaAssignment]

    onAssignmentUpdate(date, employeeId, finalAssignments, { scheduleId })
  }

  // Calcular sugerencias automáticas de licencia - Generalizado para cualquier turno
  const calculateLicenciaSuggestions = useMemo(() => {
    if (!selectedShiftForLicencia) return []

    const { assignment, shift } = selectedShiftForLicencia
    const MAX_WORK_HOURS = 4 // Máximo de 4 horas trabajables
    const maxWorkMinutes = MAX_WORK_HOURS * 60

    // Obtener horarios del turno (considerando ajustes del assignment)
    const shiftStartTime = assignment.startTime || shift.startTime || ""
    const shiftEndTime = assignment.endTime || shift.endTime || ""
    const shiftStartTime2 = assignment.startTime2 || shift.startTime2
    const shiftEndTime2 = assignment.endTime2 || shift.endTime2

    if (!shiftStartTime || !shiftEndTime) return []

    const shiftStart = timeToMinutes(shiftStartTime)
    const shiftEnd = timeToMinutes(shiftEndTime)

    const suggestions: Array<{
      id: string
      label: string
      licenciaStart: string
      licenciaEnd: string
      trabajoStart: string
      trabajoEnd: string
      trabajoHours: number
      licenciaHours: number
      description: string
    }> = []

    // Si el turno tiene dos franjas (turno cortado)
    if (shiftStartTime2 && shiftEndTime2) {
      const firstDuration = calculateDuration(shiftStartTime, shiftEndTime)
      const secondDuration = calculateDuration(shiftStartTime2, shiftEndTime2)
      const totalDuration = firstDuration + secondDuration

      // Verificar que el turno completo sea mayor a 4 horas
      if (totalDuration <= maxWorkMinutes) {
        return [] // El turno ya es menor o igual a 4 horas
      }

      // Para turnos cortados, ofrecer licencia completa en una de las dos franjas
      // siempre que la otra franja tenga al menos 4 horas de trabajo
      
      // Sugerencia 1: Licencia en la primera franja (trabajo en la segunda)
      if (secondDuration >= maxWorkMinutes) {
        const trabajoHours = secondDuration / 60
        const licenciaHours = firstDuration / 60
        
        suggestions.push({
          id: "licencia-primera",
          label: "Licencia en primera franja",
          licenciaStart: shiftStartTime,
          licenciaEnd: shiftEndTime,
          trabajoStart: shiftStartTime2,
          trabajoEnd: shiftEndTime2,
          trabajoHours,
          licenciaHours,
          description: `Licencia: ${shiftStartTime} - ${shiftEndTime} | Trabajo: ${shiftStartTime2} - ${shiftEndTime2}`,
        })
      }

      // Sugerencia 2: Licencia en la segunda franja (trabajo en la primera)
      if (firstDuration >= maxWorkMinutes) {
        const trabajoHours = firstDuration / 60
        const licenciaHours = secondDuration / 60
        
        suggestions.push({
          id: "licencia-segunda",
          label: "Licencia en segunda franja",
          licenciaStart: shiftStartTime2,
          licenciaEnd: shiftEndTime2,
          trabajoStart: shiftStartTime,
          trabajoEnd: shiftEndTime,
          trabajoHours,
          licenciaHours,
          description: `Trabajo: ${shiftStartTime} - ${shiftEndTime} | Licencia: ${shiftStartTime2} - ${shiftEndTime2}`,
        })
      }

      // Si ninguna franja individual tiene 4h pero la suma sí, dividir la franja más larga
      if (suggestions.length === 0) {
        const longestDuration = Math.max(firstDuration, secondDuration)
        const longestIsFirst = firstDuration >= secondDuration
        
        if (longestIsFirst && firstDuration > maxWorkMinutes) {
          // Dividir primera franja
          const shiftStart = timeToMinutes(shiftStartTime)
          const shiftEnd = timeToMinutes(shiftEndTime)
          const crossesMidnight = shiftEnd < shiftStart
          
          // Trabajo al inicio
          let trabajoEndMinutes = shiftStart + maxWorkMinutes
          if (trabajoEndMinutes >= 24 * 60) {
            trabajoEndMinutes = trabajoEndMinutes % (24 * 60)
          }
          const trabajoEnd = minutesToTime(trabajoEndMinutes)
          
          suggestions.push({
            id: "work-start",
            label: "Trabajo al inicio (primera franja)",
            licenciaStart: trabajoEnd,
            licenciaEnd: shiftEndTime,
            trabajoStart: shiftStartTime,
            trabajoEnd: trabajoEnd,
            trabajoHours: maxWorkMinutes / 60,
            licenciaHours: (firstDuration - maxWorkMinutes) / 60,
            description: `Trabajo: ${shiftStartTime} - ${trabajoEnd} (4h) | Licencia: ${trabajoEnd} - ${shiftEndTime}`,
          })
        } else if (!longestIsFirst && secondDuration > maxWorkMinutes) {
          // Dividir segunda franja
          const shiftStart2 = timeToMinutes(shiftStartTime2)
          const shiftEnd2 = timeToMinutes(shiftEndTime2)
          const crossesMidnight = shiftEnd2 < shiftStart2
          
          // Trabajo al inicio
          let trabajoEndMinutes = shiftStart2 + maxWorkMinutes
          if (trabajoEndMinutes >= 24 * 60) {
            trabajoEndMinutes = trabajoEndMinutes % (24 * 60)
          }
          const trabajoEnd = minutesToTime(trabajoEndMinutes)
          
          suggestions.push({
            id: "work-start",
            label: "Trabajo al inicio (segunda franja)",
            licenciaStart: trabajoEnd,
            licenciaEnd: shiftEndTime2,
            trabajoStart: shiftStartTime2,
            trabajoEnd: trabajoEnd,
            trabajoHours: maxWorkMinutes / 60,
            licenciaHours: (secondDuration - maxWorkMinutes) / 60,
            description: `Trabajo: ${shiftStartTime2} - ${trabajoEnd} (4h) | Licencia: ${trabajoEnd} - ${shiftEndTime2}`,
          })
        }
      }
    } else {
      // Turno continuo (una sola franja) - funciona para cualquier horario, incluso si cruza medianoche
      const totalDuration = calculateDuration(shiftStartTime, shiftEndTime)

      if (totalDuration <= maxWorkMinutes) {
        return [] // El turno ya es menor o igual a 4 horas
      }

      const crossesMidnight = shiftEnd < shiftStart

      // Sugerencia 1: Trabajo al inicio (licencia al final)
      let trabajoEndMinutes = shiftStart + maxWorkMinutes
      // Si la suma supera 24h, ajustar (normalizar al rango 0-1439)
      if (trabajoEndMinutes >= 24 * 60) {
        trabajoEndMinutes = trabajoEndMinutes % (24 * 60)
      }
      const trabajoEnd = minutesToTime(trabajoEndMinutes)
      const trabajoHours = maxWorkMinutes / 60
      const licenciaHours = (totalDuration - maxWorkMinutes) / 60

      suggestions.push({
        id: "work-start",
        label: "Trabajo al inicio",
        licenciaStart: trabajoEnd,
        licenciaEnd: shiftEndTime,
        trabajoStart: shiftStartTime,
        trabajoEnd: trabajoEnd,
        trabajoHours,
        licenciaHours,
        description: `Trabajo: ${shiftStartTime} - ${trabajoEnd} (4h) | Licencia: ${trabajoEnd} - ${shiftEndTime}`,
      })

      // Sugerencia 2: Trabajo al final (licencia al inicio)
      let trabajoStartMinutes: number
      if (crossesMidnight) {
        // El fin está en el día siguiente (ej: 00:00 = 0 min), trabajo empieza 4h antes
        // Calcular desde el final del turno (que es en el día siguiente)
        trabajoStartMinutes = (24 * 60 + shiftEnd) - maxWorkMinutes
        if (trabajoStartMinutes < 0) {
          trabajoStartMinutes = 24 * 60 + trabajoStartMinutes
        } else if (trabajoStartMinutes >= 24 * 60) {
          trabajoStartMinutes = trabajoStartMinutes - 24 * 60
        }
      } else {
        trabajoStartMinutes = shiftEnd - maxWorkMinutes
      }
      const trabajoStart = minutesToTime(trabajoStartMinutes)
      
      suggestions.push({
        id: "work-end",
        label: "Trabajo al final",
        licenciaStart: shiftStartTime,
        licenciaEnd: trabajoStart,
        trabajoStart: trabajoStart,
        trabajoEnd: shiftEndTime,
        trabajoHours,
        licenciaHours,
        description: `Licencia: ${shiftStartTime} - ${trabajoStart} | Trabajo: ${trabajoStart} - ${shiftEndTime} (4h)`,
      })
    }

    return suggestions
  }, [selectedShiftForLicencia])

  const handleOpenEditarHorarioDialog = () => {
    if (!firstShiftAssignment) {
      // Si no hay turno asignado, usar el comportamiento actual (abrir selector)
      onCellClick(date, employeeId)
      return
    }
    
    const { assignment, shift } = firstShiftAssignment
    setSelectedShiftForEdit({ assignment, shift })
    
    // Precargar los horarios actuales SOLO del assignment (autosuficiencia)
    // NO usar el turno base como fallback
    setEditStartTime(assignment.startTime || "")
    setEditEndTime(assignment.endTime || "")
    
    // Cargar segunda franja si existe explícitamente en el assignment
    const hasSecond = !!(assignment.startTime2 && assignment.endTime2)
    setHasSecondSegment(hasSecond)
    setEditStartTime2(assignment.startTime2 || "")
    setEditEndTime2(assignment.endTime2 || "")
    
    setEditarHorarioDialogOpen(true)
  }

  const handleSaveEditarHorario = () => {
    if (!onAssignmentUpdate || !selectedShiftForEdit) return

    const trimmedStartTime = editStartTime.trim()
    const trimmedEndTime = editEndTime.trim()

    if (!trimmedStartTime || !trimmedEndTime) {
      return // Validación básica
    }

    const { assignment } = selectedShiftForEdit
    
    // Actualizar el assignment existente manteniendo shiftId y otros campos
    // Actualizar el primer assignment que coincida con el shiftId (normalmente solo hay uno)
    const updatedAssignments = assignments.map((a) => {
      // Buscar el assignment exacto (por shiftId y tipo)
      // Comparar también por startTime/endTime para identificar el assignment específico
      if (a.type === "shift" && a.shiftId === assignment.shiftId) {
        // Verificar si es el mismo assignment comparando campos clave
        const isSameAssignment = 
          a.startTime === assignment.startTime &&
          a.endTime === assignment.endTime &&
          a.startTime2 === assignment.startTime2 &&
          a.endTime2 === assignment.endTime2
        
        // Actualizar solo si es el mismo assignment o si solo hay uno con este shiftId
        if (isSameAssignment) {
          // CRÍTICO: Preservar explícitamente startTime2/endTime2 según el estado del diálogo
          const updated: ShiftAssignment = {
            ...a,
            startTime: trimmedStartTime,
            endTime: trimmedEndTime,
          }
          
          // Si hay segunda franja en el diálogo, incluirla explícitamente
          if (hasSecondSegment && editStartTime2.trim() && editEndTime2.trim()) {
            updated.startTime2 = editStartTime2.trim()
            updated.endTime2 = editEndTime2.trim()
          } else {
            // Si no hay segunda franja, eliminar explícitamente (convertir a turno simple)
            delete updated.startTime2
            delete updated.endTime2
          }
          
          return updated
        }
      }
      return a
    })

    // Validar assignments de la celda antes de guardar (validación global)
    const validationResult = validateCellAssignments(updatedAssignments)
    if (!validationResult.valid) {
      toast({
        title: "Error de validación",
        description: validationResult.errors.join(". "),
        variant: "destructive",
      })
      return
    }

    onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })

    setEditarHorarioDialogOpen(false)
    setEditStartTime("")
    setEditEndTime("")
    setEditStartTime2("")
    setEditEndTime2("")
    setHasSecondSegment(false)
    setSelectedShiftForEdit(null)
  }

  const handleConvertToSimpleShift = () => {
    // Convertir turno cortado a simple eliminando segunda franja
    setHasSecondSegment(false)
    setEditStartTime2("")
    setEditEndTime2("")
  }

  const handleSaveLicenciaEmbarazo = () => {
    if (!onAssignmentUpdate || !selectedShiftForLicencia) return

    const trimmedStartTime = licenciaStartTime.trim()
    const trimmedEndTime = licenciaEndTime.trim()

    if (!trimmedStartTime || !trimmedEndTime) {
      return // Validación básica - el diálogo debe validar antes
    }

    const { assignment: shiftAssignment, shift } = selectedShiftForLicencia
    
    // Verificar si es medio_franco
    const isMedioFranco = shiftAssignment.type === "medio_franco"

    // Obtener el horario base del turno (considerando ajustes)
    const shiftStartTime = shiftAssignment.startTime || shift.startTime || ""
    const shiftEndTime = shiftAssignment.endTime || shift.endTime || ""
    const shiftStartTime2 = shiftAssignment.startTime2 || shift.startTime2
    const shiftEndTime2 = shiftAssignment.endTime2 || shift.endTime2

    // Validar duración de licencia (considerando cruce de medianoche)
    const licenciaDuration = calculateDuration(trimmedStartTime, trimmedEndTime)
    if (licenciaDuration <= 0) {
      return // Duración inválida
    }

    // Validar que el rango esté contenido en el turno
    let isValid = false
    
    if (shiftStartTime2 && shiftEndTime2) {
      // Turno cortado: validar en cualquiera de las dos franjas
      const inFirstRange = isTimeInRange(trimmedStartTime, shiftStartTime, shiftEndTime) && 
                           isTimeInRange(trimmedEndTime, shiftStartTime, shiftEndTime)
      const inSecondRange = isTimeInRange(trimmedStartTime, shiftStartTime2, shiftEndTime2) && 
                            isTimeInRange(trimmedEndTime, shiftStartTime2, shiftEndTime2)
      
      isValid = inFirstRange || inSecondRange
    } else {
      // Turno continuo: validar rango (considerando cruce de medianoche)
      isValid = isTimeInRange(trimmedStartTime, shiftStartTime, shiftEndTime) && 
                isTimeInRange(trimmedEndTime, shiftStartTime, shiftEndTime)
    }
    
    if (!isValid) {
      return // Fuera de rango
    }

    // Crear los tramos divididos
    const newAssignments: ShiftAssignment[] = []

    // Convertir a minutos para comparaciones
    const licenciaStart = timeToMinutes(trimmedStartTime)
    const licenciaEnd = timeToMinutes(trimmedEndTime)
    const shiftStart = timeToMinutes(shiftStartTime)
    const shiftEnd = timeToMinutes(shiftEndTime)

    // Verificar si la licencia coincide EXACTAMENTE con alguna franja completa
    // Normalizar tiempos antes de comparar para manejar diferentes formatos
    const normalizeTimeForComparison = (time: string): string => {
      if (!time) return ""
      // Si no tiene ":", agregar ":00"
      return time.includes(":") ? time : `${time}:00`
    }
    
    const licenciaStartNorm = normalizeTimeForComparison(trimmedStartTime)
    const licenciaEndNorm = normalizeTimeForComparison(trimmedEndTime)
    const shiftStartTimeNorm = shiftStartTime ? normalizeTimeForComparison(shiftStartTime) : ""
    const shiftEndTimeNorm = shiftEndTime ? normalizeTimeForComparison(shiftEndTime) : ""
    const shiftStartTime2Norm = shiftStartTime2 ? normalizeTimeForComparison(shiftStartTime2) : ""
    const shiftEndTime2Norm = shiftEndTime2 ? normalizeTimeForComparison(shiftEndTime2) : ""
    
    const licenciaCoincideConPrimeraFranja = shiftStartTime && shiftEndTime && 
      licenciaStartNorm === shiftStartTimeNorm && 
      licenciaEndNorm === shiftEndTimeNorm
    
    const licenciaCoincideConSegundaFranja = shiftStartTime2 && shiftEndTime2 && 
      licenciaStartNorm === shiftStartTime2Norm && 
      licenciaEndNorm === shiftEndTime2Norm

    // Si el turno tiene segunda franja (turno cortado)
    if (shiftStartTime2 && shiftEndTime2) {
      const shiftStart2 = timeToMinutes(shiftStartTime2)
      const shiftEnd2 = timeToMinutes(shiftEndTime2)

      // Determinar en qué franja está la licencia
      const licenciaInFirst = isTimeInRange(trimmedStartTime, shiftStartTime, shiftEndTime) && 
                              isTimeInRange(trimmedEndTime, shiftStartTime, shiftEndTime)
      const licenciaInSecond = isTimeInRange(trimmedStartTime, shiftStartTime2, shiftEndTime2) && 
                               isTimeInRange(trimmedEndTime, shiftStartTime2, shiftEndTime2)
      
      if (licenciaInSecond) {
        // Licencia está en la segunda franja
        
        // Si la licencia coincide EXACTAMENTE con la segunda franja completa
        if (licenciaCoincideConSegundaFranja) {
          // Solo crear assignment con la primera franja (sin segunda franja)
          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime: shiftStartTime,
            endTime: shiftEndTime,
          })
        } else {
          // Licencia está parcialmente en la segunda franja - dividir
          // Mantener primera franja completa
          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime: shiftStartTime,
            endTime: shiftEndTime,
          })

          // Tramo antes de licencia en segunda franja (si existe)
          const crossesMidnight = shiftEnd2 < shiftStart2
          const licenciaStartMinutes = timeToMinutes(trimmedStartTime)
          const licenciaStartIsAfter = crossesMidnight 
            ? (licenciaStartMinutes >= shiftStart2 || licenciaStartMinutes <= shiftEnd2)
            : (licenciaStartMinutes > shiftStart2)
          
          if (licenciaStartIsAfter && trimmedStartTime !== shiftStartTime2) {
            newAssignments.push({
              shiftId: shiftAssignment.shiftId,
              type: "shift",
              startTime2: shiftStartTime2,
              endTime2: trimmedStartTime,
            })
          }

          // Tramo después de licencia en segunda franja (si existe)
          const licenciaEndMinutes = timeToMinutes(trimmedEndTime)
          const licenciaEndIsBefore = crossesMidnight
            ? (licenciaEndMinutes < shiftEnd2 || licenciaEndMinutes >= shiftStart2)
            : (licenciaEndMinutes < shiftEnd2)
          
          if (licenciaEndIsBefore && trimmedEndTime !== shiftEndTime2) {
            newAssignments.push({
              shiftId: shiftAssignment.shiftId,
              type: "shift",
              startTime2: trimmedEndTime,
              endTime2: shiftEndTime2,
            })
          }
        }

        // Siempre agregar la licencia
        newAssignments.push({
          type: "licencia",
          licenciaType: "embarazo",
          startTime: trimmedStartTime,
          endTime: trimmedEndTime,
        })
        
      } else if (licenciaInFirst) {
        // Licencia está en la primera franja
        
        // Si la licencia coincide EXACTAMENTE con la primera franja completa
        if (licenciaCoincideConPrimeraFranja) {
          // Solo crear assignment con la segunda franja (sin primera franja)
          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime2: shiftStartTime2,
            endTime2: shiftEndTime2,
          })
        } else {
          // Licencia está parcialmente en la primera franja - dividir
          // Tramo antes de licencia en primera franja (si existe)
          const firstCrossesMidnight = shiftEnd < shiftStart
          const licenciaStartIsAfterFirst = firstCrossesMidnight
            ? (licenciaStart > shiftStart || licenciaStart <= shiftEnd)
            : (licenciaStart > shiftStart)
          
          if (licenciaStartIsAfterFirst && trimmedStartTime !== shiftStartTime) {
            newAssignments.push({
              shiftId: shiftAssignment.shiftId,
              type: "shift",
              startTime: shiftStartTime,
              endTime: trimmedStartTime,
            })
          }

          // Tramo después de licencia en primera franja (si existe)
          const licenciaEndIsBeforeFirst = firstCrossesMidnight
            ? (licenciaEnd < shiftEnd || licenciaEnd >= shiftStart)
            : (licenciaEnd < shiftEnd)
          
          if (licenciaEndIsBeforeFirst && trimmedEndTime !== shiftEndTime) {
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

        // Siempre agregar la licencia
        newAssignments.push({
          type: "licencia",
          licenciaType: "embarazo",
          startTime: trimmedStartTime,
          endTime: trimmedEndTime,
        })
      }
    } else {
      // Turno continuo (una sola franja)
      
      // Si la licencia coincide EXACTAMENTE con el turno completo, solo crear la licencia
      if (licenciaCoincideConPrimeraFranja) {
        // Solo agregar licencia, no crear assignment de shift o medio_franco
        // (el medio_franco o shift original se eliminará en otherAssignments)
        newAssignments.push({
          type: "licencia",
          licenciaType: "embarazo",
          startTime: trimmedStartTime,
          endTime: trimmedEndTime,
        })
      } else {
        // Licencia está parcialmente en el turno - dividir
        const crossesMidnight = shiftEnd < shiftStart
        
        // Tramo antes de licencia (si existe)
        const licenciaStartIsAfter = crossesMidnight
          ? (licenciaStart > shiftStart || licenciaStart <= shiftEnd)
          : (licenciaStart > shiftStart)
        
        if (licenciaStartIsAfter && trimmedStartTime !== shiftStartTime) {
          // Mantener tipo original (shift o medio_franco)
          const partialAssignment: ShiftAssignment = {
            type: isMedioFranco ? "medio_franco" : "shift",
            startTime: shiftStartTime,
            endTime: trimmedStartTime,
          }
          // Solo agregar shiftId si existe (medio_franco puede no tenerlo)
          if (shiftAssignment.shiftId && !isMedioFranco) {
            partialAssignment.shiftId = shiftAssignment.shiftId
          }
          newAssignments.push(partialAssignment)
        }

        // Tramo de licencia
        newAssignments.push({
          type: "licencia",
          licenciaType: "embarazo",
          startTime: trimmedStartTime,
          endTime: trimmedEndTime,
        })

        // Tramo después de licencia (si existe)
        const licenciaEndIsBefore = crossesMidnight
          ? (licenciaEnd < shiftEnd || licenciaEnd >= shiftStart)
          : (licenciaEnd < shiftEnd)
        
        if (licenciaEndIsBefore && trimmedEndTime !== shiftEndTime) {
          // Mantener tipo original (shift o medio_franco)
          const partialAssignment: ShiftAssignment = {
            type: isMedioFranco ? "medio_franco" : "shift",
            startTime: trimmedEndTime,
            endTime: shiftEndTime,
          }
          // Solo agregar shiftId si existe (medio_franco puede no tenerlo)
          if (shiftAssignment.shiftId && !isMedioFranco) {
            partialAssignment.shiftId = shiftAssignment.shiftId
          }
          newAssignments.push(partialAssignment)
        }
      }
    }

    // Mantener todas las demás asignaciones (francos, notas, otros turnos, etc.)
    // Si es medio_franco, filtrarlo también; si es shift, filtrar por shiftId
    const otherAssignments = assignments.filter((a) => {
      if (isMedioFranco) {
        // Para medio_franco, eliminar el medio_franco original si la licencia coincide exactamente
        if (a.type === "medio_franco" && a.startTime && a.endTime) {
          const aStartNorm = normalizeTimeForComparison(a.startTime)
          const aEndNorm = normalizeTimeForComparison(a.endTime)
          // Si coincide exactamente, no incluir (se reemplaza por licencia)
          if (licenciaStartNorm === aStartNorm && licenciaEndNorm === aEndNorm) {
            return false
          }
        }
        // Mantener el medio_franco si no coincide exactamente (licencia parcial)
        return true
      } else {
        // Para shift, filtrar por shiftId
        return !(a.type === "shift" && a.shiftId === shiftAssignment.shiftId)
      }
    })

    // Separar por tipo para ordenar correctamente
    const turnAssignments = newAssignments.filter((a) => a.type === "shift" || a.type === "medio_franco")
    const licenciaAssignments = newAssignments.filter((a) => a.type === "licencia")
    const otherTurnAssignments = otherAssignments.filter((a) => a.type === "shift" || a.type === "medio_franco")
    const otherSpecialAssignments = otherAssignments.filter((a) => a.type !== "shift" && a.type !== "medio_franco")

    // Ordenar: turnos (del mismo shift, otros shifts), licencia, otros (francos, notas, etc.)
    const finalAssignments = [
      ...turnAssignments,
      ...otherTurnAssignments,
      ...licenciaAssignments,
      ...otherSpecialAssignments,
    ]

    // CRÍTICO: Validar assignments de la celda antes de guardar (validación global)
    // Esto previene solapamientos entre todos los tipos de assignments
    const validationResult = validateCellAssignments(finalAssignments)
    if (!validationResult.valid) {
      toast({
        title: "Error de validación",
        description: validationResult.errors.join(". "),
        variant: "destructive",
      })
      return
    }

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
            {/* Indicador de assignments incompletos */}
            {hasIncompleteAssignments && (
              <div
                className="absolute top-1 right-1 z-10 flex items-center gap-1 bg-destructive/20 border border-destructive/40 rounded px-1.5 py-0.5"
                title="Esta celda contiene assignments incompletos. Debe normalizarlos antes de editar."
                aria-label="Assignments incompletos"
              >
                <Lock className="h-3 w-3 text-destructive" />
                <span className="text-xs font-semibold text-destructive">!</span>
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
              <DropdownMenuContent align="end" className="w-56 text-xs">
                {isTurnoCortado ? (
                  <>
                    {/* Opciones para primera franja */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Primera franja
                    </div>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault()
                        onToggleExtra("before", "first")
                        onExtraMenuOpenChange(false)
                      }}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="flex-1">+30 min antes (1ra)</span>
                      {hasExtraBefore && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault()
                        onToggleExtra("after", "first")
                        onExtraMenuOpenChange(false)
                      }}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="flex-1">+30 min después (1ra)</span>
                      {hasExtraAfter && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                    {/* Separador */}
                    <div className="my-1 border-t border-border" />
                    {/* Opciones para segunda franja */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Segunda franja
                    </div>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault()
                        onToggleExtra("before", "second")
                        onExtraMenuOpenChange(false)
                      }}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="flex-1">+30 min antes (2da)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault()
                        onToggleExtra("after", "second")
                        onExtraMenuOpenChange(false)
                      }}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="flex-1">+30 min después (2da)</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {/* Opciones para turno simple */}
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault()
                        onToggleExtra("before", "first")
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
                        onToggleExtra("after", "first")
                        onExtraMenuOpenChange(false)
                      }}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="flex-1">+30 min después</span>
                      {hasExtraAfter && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  </>
                )}
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
              <ContextMenuItem onClick={handleOpenEditarHorarioDialog}>
                {firstShiftAssignment ? "Editar horario" : "Editar turno"}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar Licencia por Embarazo</DialogTitle>
            <DialogDescription>
              {selectedShiftForLicencia && (
                <>
                  {selectedShiftForLicencia.assignment.type === "medio_franco" ? (
                    <>
                      1/2 Franco: <strong>{selectedShiftForLicencia.shift.name}</strong>
                      <br />
                      <span className="text-xs">
                        {(() => {
                          const shift = selectedShiftForLicencia.shift
                          const assignment = selectedShiftForLicencia.assignment
                          const startTime = assignment.startTime || shift.startTime || ""
                          const endTime = assignment.endTime || shift.endTime || ""
                          const startTime2 = assignment.startTime2 || shift.startTime2
                          const endTime2 = assignment.endTime2 || shift.endTime2
                          
                          if (startTime2 && endTime2) {
                            return `Horario completo: ${startTime} - ${endTime} y ${startTime2} - ${endTime2}`
                          }
                          return `Horario completo: ${startTime} - ${endTime}`
                        })()}
                        <br />
                        <span className="text-muted-foreground">
                          Asigne la licencia por embarazo sobre este medio franco. Si la licencia cubre todo el medio franco, este será reemplazado completamente por la licencia.
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      Turno: <strong>{selectedShiftForLicencia.shift.name}</strong>
                      <br />
                      <span className="text-xs">
                        {(() => {
                          const shift = selectedShiftForLicencia.shift
                          const assignment = selectedShiftForLicencia.assignment
                          const startTime = assignment.startTime || shift.startTime || ""
                          const endTime = assignment.endTime || shift.endTime || ""
                          const startTime2 = assignment.startTime2 || shift.startTime2
                          const endTime2 = assignment.endTime2 || shift.endTime2
                          
                          if (startTime2 && endTime2) {
                            return `Horario completo: ${startTime} - ${endTime} y ${startTime2} - ${endTime2}`
                          }
                          return `Horario completo: ${startTime} - ${endTime}`
                        })()}
                        <br />
                        <span className="text-muted-foreground">
                          El empleado trabajará 4 horas efectivas. El resto será licencia por embarazo.
                        </span>
                      </span>
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {calculateLicenciaSuggestions.length > 0 && (
              <div className="space-y-3 pb-3 border-b">
                <Label className="text-sm font-semibold">Sugerencias automáticas:</Label>
                <div className="space-y-2">
                  {calculateLicenciaSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedSuggestion === suggestion.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedSuggestion(suggestion.id)
                        setLicenciaStartTime(suggestion.licenciaStart)
                        setLicenciaEndTime(suggestion.licenciaEnd)
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedSuggestion === suggestion.id
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                            }`}
                          >
                            {selectedSuggestion === suggestion.id && (
                              <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm mb-1">{suggestion.label}</div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">Trabajo:</span>{" "}
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {suggestion.trabajoStart} - {suggestion.trabajoEnd}
                              </span>{" "}
                              <span className="text-muted-foreground">({suggestion.trabajoHours.toFixed(1)} h)</span>
                            </div>
                            <div>
                              <span className="font-semibold text-orange-600 dark:text-orange-400">Licencia:</span>{" "}
                              <span className="text-orange-600 dark:text-orange-400 font-medium">
                                {suggestion.licenciaStart} - {suggestion.licenciaEnd}
                              </span>{" "}
                              <span className="text-muted-foreground">({suggestion.licenciaHours.toFixed(1)} h)</span>
                            </div>
                            {suggestion.description && (
                              <div className="text-[10px] text-muted-foreground mt-1 italic">
                                {suggestion.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-4">
              <Label className="text-sm font-semibold">O especifica manualmente:</Label>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="licenciaStartTime">Hora de inicio de licencia</Label>
                  <Input
                    id="licenciaStartTime"
                    type="time"
                    value={licenciaStartTime}
                    onChange={(e) => {
                      setLicenciaStartTime(e.target.value)
                      setSelectedSuggestion(null) // Limpiar selección si se edita manualmente
                    }}
                    min={selectedShiftForLicencia ? (selectedShiftForLicencia.assignment.startTime || selectedShiftForLicencia.shift.startTime || "") : undefined}
                    max={selectedShiftForLicencia ? (selectedShiftForLicencia.assignment.endTime || selectedShiftForLicencia.shift.endTime || "") : undefined}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="licenciaEndTime">Hora de fin de licencia</Label>
                  <Input
                    id="licenciaEndTime"
                    type="time"
                    value={licenciaEndTime}
                    onChange={(e) => {
                      setLicenciaEndTime(e.target.value)
                      setSelectedSuggestion(null) // Limpiar selección si se edita manualmente
                    }}
                    min={licenciaStartTime || (selectedShiftForLicencia ? (selectedShiftForLicencia.assignment.startTime || selectedShiftForLicencia.shift.startTime || "") : undefined)}
                    max={selectedShiftForLicencia ? (selectedShiftForLicencia.assignment.endTime || selectedShiftForLicencia.shift.endTime || "") : undefined}
                  />
                </div>
              </div>
            </div>
            {licenciaStartTime && licenciaEndTime && selectedShiftForLicencia && (() => {
              const shift = selectedShiftForLicencia.shift
              const assignment = selectedShiftForLicencia.assignment
              const shiftStartTime = assignment.startTime || shift.startTime || ""
              const shiftEndTime = assignment.endTime || shift.endTime || ""
              const shiftStartTime2 = assignment.startTime2 || shift.startTime2
              const shiftEndTime2 = assignment.endTime2 || shift.endTime2

              let isValid = false
              let errorMessage = ""

              // Verificar que inicio < fin (considerando cruce de medianoche)
              const licenciaDuration = calculateDuration(licenciaStartTime, licenciaEndTime)
              if (licenciaDuration <= 0) {
                errorMessage = "La hora de inicio debe ser anterior a la hora de fin"
              } else if (shiftStartTime2 && shiftEndTime2) {
                // Turno cortado: validar en cualquiera de las dos franjas
                const inFirstRange = isTimeInRange(licenciaStartTime, shiftStartTime, shiftEndTime) && 
                                     isTimeInRange(licenciaEndTime, shiftStartTime, shiftEndTime)
                const inSecondRange = isTimeInRange(licenciaStartTime, shiftStartTime2, shiftEndTime2) && 
                                      isTimeInRange(licenciaEndTime, shiftStartTime2, shiftEndTime2)
                isValid = inFirstRange || inSecondRange
                if (!isValid) {
                  errorMessage = `El rango debe estar contenido en ${shiftStartTime} - ${shiftEndTime} o en ${shiftStartTime2} - ${shiftEndTime2}`
                }
              } else {
                // Turno continuo: validar rango (considerando cruce de medianoche)
                isValid = isTimeInRange(licenciaStartTime, shiftStartTime, shiftEndTime) && 
                          isTimeInRange(licenciaEndTime, shiftStartTime, shiftEndTime)
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

              return (
                <div className="text-sm text-muted-foreground">
                  Duración: {Math.floor(licenciaDuration / 60)}h {licenciaDuration % 60}min
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

                // Validar duración
                const licenciaDuration = calculateDuration(licenciaStartTime, licenciaEndTime)
                if (licenciaDuration <= 0) return true
                
                // Validar rango
                if (shiftStartTime2 && shiftEndTime2) {
                  const inFirstRange = isTimeInRange(licenciaStartTime, shiftStartTime, shiftEndTime) && 
                                       isTimeInRange(licenciaEndTime, shiftStartTime, shiftEndTime)
                  const inSecondRange = isTimeInRange(licenciaStartTime, shiftStartTime2, shiftEndTime2) && 
                                        isTimeInRange(licenciaEndTime, shiftStartTime2, shiftEndTime2)
                  return !(inFirstRange || inSecondRange)
                }
                return !(isTimeInRange(licenciaStartTime, shiftStartTime, shiftEndTime) && 
                         isTimeInRange(licenciaEndTime, shiftStartTime, shiftEndTime))
              })()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar horario asignado */}
      <Dialog open={editarHorarioDialogOpen} onOpenChange={setEditarHorarioDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar horario</DialogTitle>
            <DialogDescription>
              {selectedShiftForEdit && (
                <>
                  Turno: <strong>{selectedShiftForEdit.shift.name}</strong>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Modifique las horas de inicio y fin del horario asignado.
                    {hasSecondSegment && " Puede editar ambas franjas independientemente."}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Primera franja */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Primera franja</div>
              <div className="grid gap-2">
                <Label htmlFor="editStartTime">Hora de inicio</Label>
                <Input
                  id="editStartTime"
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editEndTime">Hora de fin</Label>
                <Input
                  id="editEndTime"
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  required
                />
              </div>
              {editStartTime && editEndTime && (() => {
                const duration = calculateDuration(editStartTime, editEndTime)
                return (
                  <div className="text-sm text-muted-foreground">
                    Duración: {Math.floor(duration / 60)}h {duration % 60}min
                  </div>
                )
              })()}
            </div>

            {/* Segunda franja (si existe o se puede agregar) */}
            {hasSecondSegment && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Segunda franja</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleConvertToSimpleShift}
                    className="text-xs text-destructive hover:text-destructive"
                  >
                    Convertir a turno simple
                  </Button>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editStartTime2">Hora de inicio (segunda franja)</Label>
                  <Input
                    id="editStartTime2"
                    type="time"
                    value={editStartTime2}
                    onChange={(e) => setEditStartTime2(e.target.value)}
                    required={hasSecondSegment}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editEndTime2">Hora de fin (segunda franja)</Label>
                  <Input
                    id="editEndTime2"
                    type="time"
                    value={editEndTime2}
                    onChange={(e) => setEditEndTime2(e.target.value)}
                    required={hasSecondSegment}
                  />
                </div>
                {editStartTime2 && editEndTime2 && (() => {
                  const duration = calculateDuration(editStartTime2, editEndTime2)
                  return (
                    <div className="text-sm text-muted-foreground">
                      Duración: {Math.floor(duration / 60)}h {duration % 60}min
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Botón para agregar segunda franja si no existe */}
            {!hasSecondSegment && selectedShiftForEdit && (
              <div className="border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHasSecondSegment(true)
                    setEditStartTime2("")
                    setEditEndTime2("")
                  }}
                  className="w-full"
                >
                  Agregar segunda franja (turno cortado)
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditarHorarioDialogOpen(false)
              setEditStartTime("")
              setEditEndTime("")
              setEditStartTime2("")
              setEditEndTime2("")
              setHasSecondSegment(false)
              setSelectedShiftForEdit(null)
            }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEditarHorario}
              disabled={!editStartTime || !editEndTime || (hasSecondSegment && (!editStartTime2 || !editEndTime2))}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

