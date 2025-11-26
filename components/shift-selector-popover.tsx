"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Turno, ShiftAssignment } from "@/lib/types"
import { Pencil, ChevronDown, ChevronUp, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ShiftSelectorPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shifts: Turno[]
  selectedShiftIds: string[]
  selectedAssignments?: ShiftAssignment[] // asignaciones con horarios ajustados
  onShiftChange?: (shiftIds: string[]) => void // formato antiguo (compatibilidad)
  onAssignmentsChange?: (assignments: ShiftAssignment[]) => void // nuevo formato
  employeeName: string
  date: string
}

// Helper: Sumar o restar minutos de una hora en formato HH:mm
function adjustTime(timeStr: string | undefined, minutes: number): string {
  if (!timeStr) return ""
  
  const [hours, mins] = timeStr.split(":").map(Number)
  const totalMinutes = hours * 60 + mins + minutes
  
  // Normalizar a 24 horas
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440
  const newHours = Math.floor(normalizedMinutes / 60)
  const newMins = normalizedMinutes % 60
  
  return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`
}

export function ShiftSelectorPopover({
  open,
  onOpenChange,
  shifts,
  selectedShiftIds,
  selectedAssignments = [],
  onShiftChange,
  onAssignmentsChange,
  employeeName,
  date,
}: ShiftSelectorPopoverProps) {
  const { toast } = useToast()
  const [tempSelected, setTempSelected] = useState<string[]>(selectedShiftIds)
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [adjustedTimes, setAdjustedTimes] = useState<Record<string, Partial<ShiftAssignment>>>({})
  // Estado para rastrear extensiones de +30 min
  const [extensions, setExtensions] = useState<Record<string, { before: boolean; after: boolean }>>({})
  // Estado para manejar francos
  const [specialType, setSpecialType] = useState<"shift" | "franco" | "medio_franco" | null>(null)
  const [medioFrancoTime, setMedioFrancoTime] = useState({ startTime: "", endTime: "" })

  // Rastrear el estado anterior de 'open'
  const prevOpenRef = useRef(false)

  // Inicializar cuando el diálogo se abre (solo cuando cambia de false a true)
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current
    
    if (justOpened) {
      console.log('[ShiftSelector] Dialog just opened, initializing with selectedShiftIds:', selectedShiftIds)
      
      // Verificar si hay asignaciones especiales (franco o medio_franco)
      const hasFranco = selectedAssignments.some(a => a.type === "franco")
      const hasMedioFranco = selectedAssignments.some(a => a.type === "medio_franco")
      
      if (hasFranco) {
        setSpecialType("franco")
        setTempSelected([])
        setMedioFrancoTime({ startTime: "", endTime: "" })
      } else if (hasMedioFranco) {
        const medioFranco = selectedAssignments.find(a => a.type === "medio_franco")
        setSpecialType("medio_franco")
        setTempSelected([])
        setMedioFrancoTime({
          startTime: medioFranco?.startTime || "",
          endTime: medioFranco?.endTime || "",
        })
      } else {
        setSpecialType("shift")
        // Inicializar el estado solo cuando se abre por primera vez
        setTempSelected(selectedShiftIds)
        setMedioFrancoTime({ startTime: "", endTime: "" })
      }
      
      // Cargar horarios ajustados si existen (solo para turnos normales)
      const adjusted: Record<string, Partial<ShiftAssignment>> = {}
      selectedAssignments.forEach((assignment) => {
        if (assignment.shiftId && assignment.type !== "franco" && assignment.type !== "medio_franco") {
          adjusted[assignment.shiftId] = {
            startTime: assignment.startTime,
            endTime: assignment.endTime,
            startTime2: assignment.startTime2,
            endTime2: assignment.endTime2,
          }
        }
      })
      setAdjustedTimes(adjusted)
      setEditingShiftId(null)
      
      // Cargar estado de extensiones basado en horarios ajustados
      const loadedExtensions: Record<string, { before: boolean; after: boolean }> = {}
      selectedAssignments.forEach((assignment) => {
        if (assignment.shiftId) {
          const shift = shifts.find((s) => s.id === assignment.shiftId)
          if (shift && assignment.startTime && assignment.endTime) {
            // Verificar si hay extensión de 30 min antes (startTime es 30 min antes del base)
            const baseStart30MinBefore = adjustTime(shift.startTime || "", -30)
            const hasBefore = assignment.startTime === baseStart30MinBefore
            
            // Verificar si hay extensión de 30 min después (endTime es 30 min después del base)
            const baseEnd30MinAfter = adjustTime(shift.endTime || "", 30)
            const hasAfter = assignment.endTime === baseEnd30MinAfter
            
            if (hasBefore || hasAfter) {
              loadedExtensions[assignment.shiftId] = {
                before: hasBefore,
                after: hasAfter,
              }
            }
          }
        }
      })
      setExtensions(loadedExtensions)
    }
    
    prevOpenRef.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]) // Solo ejecutar cuando 'open' cambia

  // Log cuando cambia tempSelected
  useEffect(() => {
    console.log('[ShiftSelector] tempSelected changed:', tempSelected)
  }, [tempSelected])

  const toggleShift = (shiftId: string) => {
    console.log('[ShiftSelector] toggleShift called for:', shiftId)
    setTempSelected((prev) => {
      const newSelection = prev.includes(shiftId)
        ? prev.filter((id) => id !== shiftId)
        : [...prev, shiftId]
      console.log('[ShiftSelector] toggleShift - prev:', prev, 'newSelection:', newSelection)
      return newSelection
    })
  }

  const updateAdjustedTime = (shiftId: string, field: keyof ShiftAssignment, value: string) => {
    setAdjustedTimes((prev) => ({
      ...prev,
      [shiftId]: {
        ...prev[shiftId],
        [field]: value || undefined,
      },
    }))
  }

  const adjustTimeField = (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2", minutes: number) => {
    const shift = shifts.find((s) => s.id === shiftId)
    if (!shift) return

    // Obtener el tiempo actual (ajustado o del turno base)
    const currentTime = adjustedTimes[shiftId]?.[field] || shift[field] || ""
    if (!currentTime) return

    const newTime = adjustTime(currentTime, minutes)
    updateAdjustedTime(shiftId, field, newTime)
  }

  const resetAdjustedTime = (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2") => {
    setAdjustedTimes((prev) => {
      const updated = { ...prev[shiftId] }
      delete updated[field]
      return {
        ...prev,
        [shiftId]: updated,
      }
    })
  }

  const resetAllAdjustedTimes = (shiftId: string) => {
    setAdjustedTimes((prev) => {
      const updated = { ...prev }
      delete updated[shiftId]
      return updated
    })
  }

  const handleSave = () => {
    if (onAssignmentsChange) {
      // Si es franco, retornar array con un solo elemento tipo franco
      if (specialType === "franco") {
        onAssignmentsChange([{ type: "franco" }])
        onOpenChange(false)
        return
      }
      
      // Si es medio franco, validar que tenga horario
      if (specialType === "medio_franco") {
        if (!medioFrancoTime.startTime || !medioFrancoTime.endTime) {
          toast({
            title: "Error",
            description: "Debes especificar un horario para el medio franco",
            variant: "destructive",
          })
          return
        }
        onAssignmentsChange([{
          type: "medio_franco",
          startTime: medioFrancoTime.startTime,
          endTime: medioFrancoTime.endTime,
        }])
        onOpenChange(false)
        return
      }
      
      // Comportamiento normal para turnos
      const assignments: ShiftAssignment[] = tempSelected.map((shiftId) => {
        const shift = shifts.find((s) => s.id === shiftId)
        if (!shift) {
          return { shiftId, type: "shift" }
        }
        
        const adjusted = adjustedTimes[shiftId] || {}
        const result: ShiftAssignment = { shiftId, type: "shift" }
        
        // Solo incluir campos si fueron ajustados y son diferentes del turno base
        if (adjusted.startTime !== undefined && adjusted.startTime !== shift.startTime) {
          result.startTime = adjusted.startTime
          console.log(`[ShiftSelector] Guardando horario ajustado - turno ${shift.name}, startTime: ${shift.startTime} -> ${adjusted.startTime}`)
        } else if (shift.startTime) {
          // Si no fue ajustado pero existe en el turno base, no incluirlo (se tomará del turno)
          // Dejamos undefined para que use el del turno base
        }
        
        if (adjusted.endTime !== undefined && adjusted.endTime !== shift.endTime) {
          result.endTime = adjusted.endTime
          console.log(`[ShiftSelector] Guardando horario ajustado - turno ${shift.name}, endTime: ${shift.endTime} -> ${adjusted.endTime}`)
        }
        
        if (adjusted.startTime2 !== undefined && adjusted.startTime2 !== shift.startTime2) {
          result.startTime2 = adjusted.startTime2
        }
        
        if (adjusted.endTime2 !== undefined && adjusted.endTime2 !== shift.endTime2) {
          result.endTime2 = adjusted.endTime2
        }
        
        return result
      })
      console.log('[ShiftSelector] Guardando asignaciones:', assignments)
      onAssignmentsChange(assignments)
    } else if (onShiftChange) {
      // Modo compatible: solo pasar IDs (no soporta francos)
      onShiftChange(tempSelected)
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    // Restaurar estado inicial
    const hasFranco = selectedAssignments.some(a => a.type === "franco")
    const hasMedioFranco = selectedAssignments.some(a => a.type === "medio_franco")
    
    if (hasFranco) {
      setSpecialType("franco")
      setTempSelected([])
      setMedioFrancoTime({ startTime: "", endTime: "" })
    } else if (hasMedioFranco) {
      const medioFranco = selectedAssignments.find(a => a.type === "medio_franco")
      setSpecialType("medio_franco")
      setTempSelected([])
      setMedioFrancoTime({
        startTime: medioFranco?.startTime || "",
        endTime: medioFranco?.endTime || "",
      })
    } else {
      setSpecialType("shift")
      setTempSelected(selectedShiftIds)
      setMedioFrancoTime({ startTime: "", endTime: "" })
    }
    
    const adjusted: Record<string, Partial<ShiftAssignment>> = {}
    selectedAssignments.forEach((assignment) => {
      if (assignment.shiftId && assignment.type !== "franco" && assignment.type !== "medio_franco") {
        adjusted[assignment.shiftId] = {
          startTime: assignment.startTime,
          endTime: assignment.endTime,
          startTime2: assignment.startTime2,
          endTime2: assignment.endTime2,
        }
      }
    })
    setAdjustedTimes(adjusted)
    setEditingShiftId(null)
    onOpenChange(false)
  }

  const getDisplayTime = (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2"): string => {
    const shift = shifts.find((s) => s.id === shiftId)
    if (!shift) return ""
    return adjustedTimes[shiftId]?.[field] ?? shift[field] ?? ""
  }

  const hasAdjustments = (shiftId: string): boolean => {
    const shift = shifts.find((s) => s.id === shiftId)
    if (!shift) return false
    
    const adjusted = adjustedTimes[shiftId]
    if (!adjusted) return false
    
    // Verificar si algún campo ajustado es diferente del turno base
    return !!(
      (adjusted.startTime !== undefined && adjusted.startTime !== shift.startTime) ||
      (adjusted.endTime !== undefined && adjusted.endTime !== shift.endTime) ||
      (adjusted.startTime2 !== undefined && adjusted.startTime2 !== shift.startTime2) ||
      (adjusted.endTime2 !== undefined && adjusted.endTime2 !== shift.endTime2)
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Asignar Turnos</DialogTitle>
          <DialogDescription>
            {employeeName} - {date}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Opciones de franco */}
          <div className="space-y-3 border-b pb-4">
            <Label className="text-sm font-medium">Estado del día:</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={specialType === "franco" ? "default" : "outline"}
                onClick={() => {
                  setSpecialType("franco")
                  setTempSelected([]) // Limpiar turnos seleccionados
                  setMedioFrancoTime({ startTime: "", endTime: "" })
                }}
                className="w-full"
              >
                Franco
              </Button>
              <Button
                type="button"
                variant={specialType === "medio_franco" ? "default" : "outline"}
                onClick={() => {
                  setSpecialType("medio_franco")
                  setTempSelected([]) // Limpiar turnos seleccionados
                }}
                className="w-full"
              >
                1/2 Franco
              </Button>
              <Button
                type="button"
                variant={specialType === "shift" || specialType === null ? "default" : "outline"}
                onClick={() => {
                  setSpecialType("shift")
                  setMedioFrancoTime({ startTime: "", endTime: "" })
                }}
                className="w-full"
              >
                Turno Normal
              </Button>
            </div>
            
            {/* Si es medio franco, mostrar inputs de horario */}
            {specialType === "medio_franco" && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-medium">Horario del medio franco (normalmente 4 horas):</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Hora Inicio</Label>
                    <Input
                      type="time"
                      value={medioFrancoTime.startTime}
                      onChange={(e) => setMedioFrancoTime({ ...medioFrancoTime, startTime: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Hora Fin</Label>
                    <Input
                      type="time"
                      value={medioFrancoTime.endTime}
                      onChange={(e) => setMedioFrancoTime({ ...medioFrancoTime, endTime: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Lista de turnos (solo mostrar si es turno normal) */}
          {specialType !== "franco" && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Turnos disponibles:</Label>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {shifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay turnos disponibles</p>
              ) : (
                shifts.map((shift) => {
                  const isSelected = tempSelected.includes(shift.id)
                  const isEditing = editingShiftId === shift.id
                  const hasAdj = hasAdjustments(shift.id)

                  return (
                    <div
                      key={shift.id}
                      className={`border rounded-lg p-4 space-y-3 transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                      onClick={(e) => {
                        // Solo hacer toggle si el click NO fue en un elemento interactivo
                        const target = e.target as HTMLElement
                        const isInteractive = 
                          target.closest('button') || 
                          target.closest('input') || 
                          target.closest('[data-slot="checkbox"]') ||
                          target.closest('label') ||
                          target.tagName === 'BUTTON' ||
                          target.tagName === 'INPUT' ||
                          target.tagName === 'LABEL'
                        
                        console.log(`[ShiftSelector] Row onClick - shiftId: ${shift.id}, target:`, target.tagName, 'isInteractive:', isInteractive, 'target.closest results:', {
                          button: !!target.closest('button'),
                          input: !!target.closest('input'),
                          checkbox: !!target.closest('[data-slot="checkbox"]'),
                          label: !!target.closest('label'),
                          tagName: target.tagName
                        })
                        
                        if (!isInteractive) {
                          console.log(`[ShiftSelector] Row onClick - calling toggleShift for: ${shift.id}`)
                          toggleShift(shift.id)
                        } else {
                          console.log(`[ShiftSelector] Row onClick - ignoring click (interactive element)`)
                        }
                      }}
                    >
                      {/* Checkbox y nombre del turno */}
                      <div 
                        className="flex items-center justify-between"
                        onMouseDown={(e) => {
                          console.log(`[ShiftSelector] Checkbox container onMouseDown - shiftId: ${shift.id}, stopping propagation`)
                          // Prevenir que el mousedown en esta área active el toggle del div padre
                          // El checkbox manejará su propio estado a través de onCheckedChange
                          e.stopPropagation()
                        }}
                        onClick={(e) => {
                          console.log(`[ShiftSelector] Checkbox container onClick - shiftId: ${shift.id}, stopping propagation`)
                          // También prevenir el click por si acaso
                          e.stopPropagation()
                        }}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <Checkbox
                            id={`shift-${shift.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              console.log(`[ShiftSelector] Checkbox onCheckedChange - shiftId: ${shift.id}, checked:`, checked, 'current isSelected:', isSelected)
                              // Actualizar estado directamente basado en el valor del checkbox
                              // Radix UI garantiza que checked será true o false
                              setTempSelected((prev) => {
                                console.log(`[ShiftSelector] Checkbox onCheckedChange - prev state:`, prev)
                                let newState
                                if (checked === true) {
                                  // Asegurar que está en la lista
                                  newState = prev.includes(shift.id) ? prev : [...prev, shift.id]
                                } else {
                                  // Remover de la lista
                                  newState = prev.filter((id) => id !== shift.id)
                                }
                                console.log(`[ShiftSelector] Checkbox onCheckedChange - new state:`, newState)
                                return newState
                              })
                            }}
                            onMouseDown={(e) => {
                              console.log(`[ShiftSelector] Checkbox onMouseDown - shiftId: ${shift.id}, stopping propagation`)
                              // Prevenir que el mousedown llegue al div padre
                              e.stopPropagation()
                            }}
                          />
                          <label
                            htmlFor={`shift-${shift.id}`}
                            className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer flex-1"
                            onMouseDown={(e) => {
                              console.log(`[ShiftSelector] Label onMouseDown - shiftId: ${shift.id}, stopping propagation`)
                              // Prevenir que el mousedown llegue al div padre
                              e.stopPropagation()
                            }}
                          >
                            <span
                              className="inline-block h-4 w-4 rounded-full"
                              style={{ backgroundColor: shift.color }}
                            />
                            <span>{shift.name}</span>
                          </label>
                        </div>
                        
                        {isSelected && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {hasAdj && (
                              <Badge variant="secondary" className="text-xs">
                                Ajustado
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingShiftId(isEditing ? null : shift.id)
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Horarios base del turno */}
                      {(shift.startTime || shift.endTime) && (
                        <div className="pl-7 space-y-2">
                          <div className="text-base font-semibold text-foreground">
                            {shift.startTime && shift.endTime
                              ? `${shift.startTime} - ${shift.endTime}`
                              : "Sin horario"}
                            {shift.startTime2 && shift.endTime2 && (
                              <span className="text-base"> / {shift.startTime2} - {shift.endTime2}</span>
                            )}
                          </div>
                          
                          {/* Botones de extensión de 30 min (solo si está seleccionado) */}
                          {isSelected && shift.startTime && shift.endTime && (
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={extensions[shift.id]?.before ? "default" : "outline"}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const currentExtension = extensions[shift.id]?.before || false
                                  const newBeforeState = !currentExtension
                                  
                                  setExtensions((prev) => ({
                                    ...prev,
                                    [shift.id]: {
                                      before: newBeforeState,
                                      after: prev[shift.id]?.after || false,
                                    },
                                  }))
                                  
                                  // Ajustar horario automáticamente
                                  const newStartTime = newBeforeState
                                    ? adjustTime(shift.startTime || "", -30)
                                    : shift.startTime
                                  if (newStartTime && shift.startTime) {
                                    if (newStartTime !== shift.startTime) {
                                      updateAdjustedTime(shift.id, "startTime", newStartTime)
                                    } else {
                                      // Resetear a horario base
                                      resetAdjustedTime(shift.id, "startTime")
                                    }
                                  }
                                }}
                                className="text-xs h-7 px-3"
                              >
                                +30 min antes
                              </Button>
                              <Button
                                type="button"
                                variant={extensions[shift.id]?.after ? "default" : "outline"}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const currentExtension = extensions[shift.id]?.after || false
                                  const newAfterState = !currentExtension
                                  
                                  setExtensions((prev) => ({
                                    ...prev,
                                    [shift.id]: {
                                      before: prev[shift.id]?.before || false,
                                      after: newAfterState,
                                    },
                                  }))
                                  
                                  // Ajustar horario automáticamente
                                  const newEndTime = newAfterState
                                    ? adjustTime(shift.endTime || "", 30)
                                    : shift.endTime
                                  if (newEndTime && shift.endTime) {
                                    if (newEndTime !== shift.endTime) {
                                      updateAdjustedTime(shift.id, "endTime", newEndTime)
                                    } else {
                                      // Resetear a horario base
                                      resetAdjustedTime(shift.id, "endTime")
                                    }
                                  }
                                }}
                                className="text-xs h-7 px-3"
                              >
                                +30 min después
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Formulario para ajustar horarios */}
                      {isSelected && isEditing && (
                        <div className="pl-7 space-y-4 mt-2 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                          {/* Primera franja horaria */}
                          {(shift.startTime || shift.endTime) && (
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">Primera Franja Horaria</Label>
                              <div className="space-y-2">
                                {/* Hora de inicio */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Hora Inicio</Label>
                                  <div className="flex gap-1">
                                    <Input
                                      type="time"
                                      value={getDisplayTime(shift.id, "startTime")}
                                      onChange={(e) => updateAdjustedTime(shift.id, "startTime", e.target.value)}
                                      className="text-xs flex-1"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustTimeField(shift.id, "startTime", -30)}
                                      className="h-9 px-2"
                                      title="-30 min"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustTimeField(shift.id, "startTime", 30)}
                                      className="h-9 px-2"
                                      title="+30 min"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    {adjustedTimes[shift.id]?.startTime && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => resetAdjustedTime(shift.id, "startTime")}
                                        className="h-9 px-2"
                                        title="Restaurar"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Hora de fin */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Hora Fin</Label>
                                  <div className="flex gap-1">
                                    <Input
                                      type="time"
                                      value={getDisplayTime(shift.id, "endTime")}
                                      onChange={(e) => updateAdjustedTime(shift.id, "endTime", e.target.value)}
                                      className="text-xs flex-1"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustTimeField(shift.id, "endTime", -30)}
                                      className="h-9 px-2"
                                      title="-30 min"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustTimeField(shift.id, "endTime", 30)}
                                      className="h-9 px-2"
                                      title="+30 min"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    {adjustedTimes[shift.id]?.endTime && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => resetAdjustedTime(shift.id, "endTime")}
                                        className="h-9 px-2"
                                        title="Restaurar"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Segunda franja horaria */}
                          {(shift.startTime2 || shift.endTime2) && (
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">Segunda Franja Horaria</Label>
                              <div className="space-y-2">
                                {/* Hora de inicio 2 */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Hora Inicio</Label>
                                  <div className="flex gap-1">
                                    <Input
                                      type="time"
                                      value={getDisplayTime(shift.id, "startTime2")}
                                      onChange={(e) => updateAdjustedTime(shift.id, "startTime2", e.target.value)}
                                      className="text-xs flex-1"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustTimeField(shift.id, "startTime2", -30)}
                                      className="h-9 px-2"
                                      title="-30 min"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustTimeField(shift.id, "startTime2", 30)}
                                      className="h-9 px-2"
                                      title="+30 min"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    {adjustedTimes[shift.id]?.startTime2 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => resetAdjustedTime(shift.id, "startTime2")}
                                        className="h-9 px-2"
                                        title="Restaurar"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Hora de fin 2 */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Hora Fin</Label>
                                  <div className="flex gap-1">
                                    <Input
                                      type="time"
                                      value={getDisplayTime(shift.id, "endTime2")}
                                      onChange={(e) => updateAdjustedTime(shift.id, "endTime2", e.target.value)}
                                      className="text-xs flex-1"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustTimeField(shift.id, "endTime2", -30)}
                                      className="h-9 px-2"
                                      title="-30 min"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustTimeField(shift.id, "endTime2", 30)}
                                      className="h-9 px-2"
                                      title="+30 min"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    {adjustedTimes[shift.id]?.endTime2 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => resetAdjustedTime(shift.id, "endTime2")}
                                        className="h-9 px-2"
                                        title="Restaurar"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Botón para restaurar todos los ajustes */}
                          {hasAdj && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => resetAllAdjustedTimes(shift.id)}
                              className="w-full text-xs"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restaurar todos los horarios
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
