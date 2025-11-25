"use client"

import { useState, useEffect } from "react"
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
  const [tempSelected, setTempSelected] = useState<string[]>(selectedShiftIds)
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [adjustedTimes, setAdjustedTimes] = useState<Record<string, Partial<ShiftAssignment>>>({})

  useEffect(() => {
    if (open) {
      setTempSelected(selectedShiftIds)
      // Cargar horarios ajustados si existen
      const adjusted: Record<string, Partial<ShiftAssignment>> = {}
      selectedAssignments.forEach((assignment) => {
        adjusted[assignment.shiftId] = {
          startTime: assignment.startTime,
          endTime: assignment.endTime,
          startTime2: assignment.startTime2,
          endTime2: assignment.endTime2,
        }
      })
      setAdjustedTimes(adjusted)
      setEditingShiftId(null)
    }
  }, [selectedShiftIds, selectedAssignments, open])

  const toggleShift = (shiftId: string) => {
    setTempSelected((prev) => {
      if (prev.includes(shiftId)) {
        return prev.filter((id) => id !== shiftId)
      } else {
        return [...prev, shiftId]
      }
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
      // Convertir a formato ShiftAssignment[]
      const assignments: ShiftAssignment[] = tempSelected.map((shiftId) => {
        const shift = shifts.find((s) => s.id === shiftId)
        if (!shift) {
          return { shiftId }
        }
        
        const adjusted = adjustedTimes[shiftId] || {}
        const result: ShiftAssignment = { shiftId }
        
        // Solo incluir campos si fueron ajustados y son diferentes del turno base
        if (adjusted.startTime !== undefined && adjusted.startTime !== shift.startTime) {
          result.startTime = adjusted.startTime
        } else if (shift.startTime) {
          // Si no fue ajustado pero existe en el turno base, no incluirlo (se tomará del turno)
          // Dejamos undefined para que use el del turno base
        }
        
        if (adjusted.endTime !== undefined && adjusted.endTime !== shift.endTime) {
          result.endTime = adjusted.endTime
        }
        
        if (adjusted.startTime2 !== undefined && adjusted.startTime2 !== shift.startTime2) {
          result.startTime2 = adjusted.startTime2
        }
        
        if (adjusted.endTime2 !== undefined && adjusted.endTime2 !== shift.endTime2) {
          result.endTime2 = adjusted.endTime2
        }
        
        return result
      })
      onAssignmentsChange(assignments)
    } else if (onShiftChange) {
      // Modo compatible: solo pasar IDs
      onShiftChange(tempSelected)
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    setTempSelected(selectedShiftIds)
    const adjusted: Record<string, Partial<ShiftAssignment>> = {}
    selectedAssignments.forEach((assignment) => {
      adjusted[assignment.shiftId] = {
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        startTime2: assignment.startTime2,
        endTime2: assignment.endTime2,
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
                        isSelected ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      {/* Checkbox y nombre del turno */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          <Checkbox
                            id={`shift-${shift.id}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleShift(shift.id)}
                          />
                          <label
                            htmlFor={`shift-${shift.id}`}
                            className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer flex-1"
                          >
                            <span
                              className="inline-block h-4 w-4 rounded-full"
                              style={{ backgroundColor: shift.color }}
                            />
                            <span>{shift.name}</span>
                          </label>
                        </div>
                        
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            {hasAdj && (
                              <Badge variant="secondary" className="text-xs">
                                Ajustado
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingShiftId(isEditing ? null : shift.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Horarios base del turno */}
                      {(shift.startTime || shift.endTime) && (
                        <div className="text-xs text-muted-foreground pl-7">
                          <span className="font-medium">Base:</span>{" "}
                          {shift.startTime && shift.endTime
                            ? `${shift.startTime} - ${shift.endTime}`
                            : "Sin horario"}
                          {shift.startTime2 && shift.endTime2 && (
                            <span> / {shift.startTime2} - {shift.endTime2}</span>
                          )}
                        </div>
                      )}

                      {/* Formulario para ajustar horarios */}
                      {isSelected && isEditing && (
                        <div className="pl-7 space-y-4 mt-2 border-t pt-3">
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
