"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
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
import { ShiftAssignment, Turno, Configuracion } from "@/lib/types"
import { validateCellAssignments } from "@/lib/assignment-validators"
import { useToast } from "@/hooks/use-toast"
import { calculateExtraHours } from "@/lib/validations"
import { adjustTime } from "@/lib/utils"
import { rangeDuration, rangesOverlap } from "@/lib/time-utils"

interface EditarHorarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  assignment: ShiftAssignment
  shift?: Turno
  assignmentIndex: number

  assignments: ShiftAssignment[]
  date: string
  employeeId: string
  scheduleId?: string

  config?: Configuracion

  onSave: (
    date: string,
    employeeId: string,
    updatedAssignments: ShiftAssignment[],
    options?: { scheduleId?: string }
  ) => void
}

export function EditarHorarioDialog({
  open,
  onOpenChange,
  assignment,
  shift,
  assignmentIndex,
  assignments,
  date,
  employeeId,
  scheduleId,
  config,
  onSave,
}: EditarHorarioDialogProps) {
  const [editStartTime, setEditStartTime] = useState("")
  const [editEndTime, setEditEndTime] = useState("")
  const [editStartTime2, setEditStartTime2] = useState("")
  const [editEndTime2, setEditEndTime2] = useState("")
  const [hasSecondSegment, setHasSecondSegment] = useState(false)

  const { toast } = useToast()

  // Precargar los horarios cuando se abre el diálogo o cambia el assignment
  useEffect(() => {
    if (open && assignment) {
      setEditStartTime(assignment.startTime || "")
      setEditEndTime(assignment.endTime || "")
      
      // Cargar segunda franja si existe explícitamente en el assignment
      const hasSecond = !!(assignment.startTime2 && assignment.endTime2)
      setHasSecondSegment(hasSecond)
      setEditStartTime2(assignment.startTime2 || "")
      setEditEndTime2(assignment.endTime2 || "")
    }
  }, [open, assignment])

  // Helper para calcular duración usando time-utils
  const calculateDuration = (start: string, end: string): number => {
    return rangeDuration(start, end)
  }

  const handleSaveEditarHorario = () => {
    if (!onSave) return

    const trimmedStartTime = editStartTime.trim()
    const trimmedEndTime = editEndTime.trim()

    if (!trimmedStartTime || !trimmedEndTime) {
      toast({
        title: "Error",
        description: "Debe especificar hora de inicio y fin.",
        variant: "destructive",
      })
      return
    }

    // Validar formato HH:MM
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(trimmedStartTime) || !timeRegex.test(trimmedEndTime)) {
      toast({
        title: "Error",
        description: "Formato de hora inválido. Use HH:MM (ej: 08:00).",
        variant: "destructive",
      })
      return
    }

    // Validar duración positiva considerando medianoche
    const duration = rangeDuration(trimmedStartTime, trimmedEndTime)
    if (duration <= 0) {
      toast({
        title: "Error",
        description: "La hora de fin debe ser posterior a la hora de inicio.",
        variant: "destructive",
      })
      return
    }

    // Validar segunda franja si existe
    if (hasSecondSegment) {
      const trimmedStartTime2 = editStartTime2.trim()
      const trimmedEndTime2 = editEndTime2.trim()

      if (!trimmedStartTime2 || !trimmedEndTime2) {
        toast({
          title: "Error",
          description: "Si activa segunda franja, debe especificar ambas horas.",
          variant: "destructive",
        })
        return
      }

      if (!timeRegex.test(trimmedStartTime2) || !timeRegex.test(trimmedEndTime2)) {
        toast({
          title: "Error",
          description: "Formato de hora inválido en segunda franja.",
          variant: "destructive",
        })
        return
      }

      const duration2 = rangeDuration(trimmedStartTime2, trimmedEndTime2)
      if (duration2 <= 0) {
        toast({
          title: "Error",
          description: "La hora de fin de segunda franja debe ser posterior a la hora de inicio.",
          variant: "destructive",
        })
        return
      }

      // Validar que las franjas no se solapen
      if (rangesOverlap(trimmedStartTime, trimmedEndTime, trimmedStartTime2, trimmedEndTime2)) {
        toast({
          title: "Error",
          description: "Las dos franjas del turno no pueden solaparse.",
          variant: "destructive",
        })
        return
      }
    }

    // Validar que el índice sea válido
    if (assignmentIndex === -1 || assignmentIndex >= assignments.length) {
      toast({
        title: "Error",
        description: "No se pudo encontrar el assignment a editar.",
        variant: "destructive",
      })
      return
    }

    // Actualizar el assignment existente usando el índice directo
    // Mantener shiftId, empleado y día (no modificar estos campos)
    const updatedAssignments = assignments.map((a, index) => {
      // Editar exactamente el assignment seleccionado usando el índice
      if (index === assignmentIndex) {
        // CRÍTICO: Preservar explícitamente shiftId y otros campos, solo modificar horarios
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

    onSave(date, employeeId, updatedAssignments, { scheduleId })

    onOpenChange(false)
    setEditStartTime("")
    setEditEndTime("")
    setEditStartTime2("")
    setEditEndTime2("")
    setHasSecondSegment(false)
  }

  const handleConvertToSimpleShift = () => {
    // Convertir turno cortado a simple eliminando segunda franja
    setHasSecondSegment(false)
    setEditStartTime2("")
    setEditEndTime2("")
  }

  const handleCancel = () => {
    onOpenChange(false)
    setEditStartTime("")
    setEditEndTime("")
    setEditStartTime2("")
    setEditEndTime2("")
    setHasSecondSegment(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar horario</DialogTitle>
          <DialogDescription>
            {shift ? (
              <>
                Turno: <strong>{shift.name}</strong>
              </>
            ) : (
              <span className="text-destructive font-semibold">⚠️ Advertencia: El turno base fue eliminado</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Sección A: Turno base (solo lectura) */}
          {shift && (
            <div className="space-y-3 border-b pb-4">
              <Label className="text-sm font-semibold text-muted-foreground">
                Horario del turno (referencia)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Hora inicio</Label>
                  <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
                    {shift.startTime || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Hora fin</Label>
                  <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
                    {shift.endTime || "—"}
                  </div>
                </div>
              </div>
              {shift.startTime2 && shift.endTime2 && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Segundo tramo inicio</Label>
                    <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
                      {shift.startTime2}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Segundo tramo fin</Label>
                    <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
                      {shift.endTime2}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sección B: Horario real del día (editable) */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold">
              Horario trabajado (real)
            </Label>

            {/* Primera franja */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Primera franja</Label>
                {editStartTime && editEndTime && (
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const duration = calculateDuration(editStartTime, editEndTime)
                      return `${Math.floor(duration / 60)}h ${duration % 60}min`
                    })()}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="editStartTime" className="text-xs">Hora inicio</Label>
                  <div className="flex gap-1">
                    <Input
                      id="editStartTime"
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="flex-1"
                      required
                    />
                    {/* Botones de atajo */}
                    <div className="flex flex-col gap-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => {
                          if (editStartTime) {
                            setEditStartTime(adjustTime(editStartTime, -15))
                          }
                        }}
                        title="Restar 15 min"
                      >
                        -15
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => {
                          if (editStartTime) {
                            setEditStartTime(adjustTime(editStartTime, 15))
                          }
                        }}
                        title="Sumar 15 min"
                      >
                        +15
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editEndTime" className="text-xs">Hora fin</Label>
                  <div className="flex gap-1">
                    <Input
                      id="editEndTime"
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="flex-1"
                      required
                    />
                    {/* Botones de atajo */}
                    <div className="flex flex-col gap-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => {
                          if (editEndTime) {
                            setEditEndTime(adjustTime(editEndTime, -15))
                          }
                        }}
                        title="Restar 15 min"
                      >
                        -15
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => {
                          if (editEndTime) {
                            setEditEndTime(adjustTime(editEndTime, 15))
                          }
                        }}
                        title="Sumar 15 min"
                      >
                        +15
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Botones de atajo más grandes */}
              {editStartTime && editEndTime && (
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      if (editStartTime && editEndTime) {
                        setEditStartTime(adjustTime(editStartTime, -30))
                        setEditEndTime(adjustTime(editEndTime, 30))
                      }
                    }}
                  >
                    +30 min
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      if (editStartTime && editEndTime) {
                        setEditStartTime(adjustTime(editStartTime, -60))
                        setEditEndTime(adjustTime(editEndTime, 60))
                      }
                    }}
                  >
                    +60 min
                  </Button>
                </div>
              )}
            </div>

            {/* Segunda franja (si existe o se puede agregar) */}
            {hasSecondSegment && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Segunda franja</Label>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="editStartTime2" className="text-xs">Hora inicio</Label>
                    <Input
                      id="editStartTime2"
                      type="time"
                      value={editStartTime2}
                      onChange={(e) => setEditStartTime2(e.target.value)}
                      required={hasSecondSegment}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEndTime2" className="text-xs">Hora fin</Label>
                    <Input
                      id="editEndTime2"
                      type="time"
                      value={editEndTime2}
                      onChange={(e) => setEditEndTime2(e.target.value)}
                      required={hasSecondSegment}
                    />
                  </div>
                </div>
                {editStartTime2 && editEndTime2 && (
                  <div className="text-xs text-muted-foreground text-right">
                    Duración: {(() => {
                      const duration = calculateDuration(editStartTime2, editEndTime2)
                      return `${Math.floor(duration / 60)}h ${duration % 60}min`
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Botón para agregar segunda franja si no existe */}
            {!hasSecondSegment && (
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

            {/* Cálculo de horas extra (si hay turno base) */}
            {shift && editStartTime && editEndTime && config && (() => {
              const tempAssignment = {
                ...assignment,
                startTime: editStartTime,
                endTime: editEndTime,
                startTime2: hasSecondSegment && editStartTime2 && editEndTime2 ? editStartTime2 : undefined,
                endTime2: hasSecondSegment && editStartTime2 && editEndTime2 ? editEndTime2 : undefined,
              }
              const { horasNormales, horasExtra } = calculateExtraHours(
                tempAssignment,
                shift,
                config.minutosDescanso || 30,
                config.horasMinimasParaDescanso || 6
              )
              if (horasExtra > 0) {
                return (
                  <div className="border-t pt-4">
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Horas normales:</span>
                        <span className="font-medium">{horasNormales.toFixed(2)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Horas extra:</span>
                        <span className="font-semibold text-primary">{horasExtra.toFixed(2)}h</span>
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            })()}

            {/* Mensaje si el turno es huérfano o assignment incompleto */}
            <>
              {!shift && (
                <div className="border-t pt-4">
                  <div className="text-xs text-muted-foreground">
                    ⚠️ Turno base eliminado. No se puede calcular horas extra.
                  </div>
                </div>
              )}
              {shift && (!editStartTime || !editEndTime) && (
                <div className="border-t pt-4">
                  <div className="text-xs text-muted-foreground">
                    ℹ️ Complete el horario real para ver el cálculo de horas extra.
                  </div>
                </div>
              )}
            </>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
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
  )
}
