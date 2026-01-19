"use client"

import React, { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShiftAssignment, Turno } from "@/lib/types"
import { validateCellAssignments } from "@/lib/assignment-validators"
import { useToast } from "@/hooks/use-toast"
import { rangeDuration, timeToMinutes, minutesToTime } from "@/lib/time-utils"

interface LicenciaEmbarazoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  employeeId: string
  assignments: ShiftAssignment[]
  selectedShift?: { assignment: ShiftAssignment; shift?: Turno } | null
  onApply: (
    date: string,
    employeeId: string,
    updatedAssignments: ShiftAssignment[]
  ) => void
}

export function LicenciaEmbarazoDialog({
  open,
  onOpenChange,
  date,
  employeeId,
  assignments,
  selectedShift,
  onApply,
}: LicenciaEmbarazoDialogProps) {
  const [licenciaStartTime, setLicenciaStartTime] = useState("")
  const [licenciaEndTime, setLicenciaEndTime] = useState("")
  const [selectedPreset, setSelectedPreset] = useState<"work-start" | "work-end" | null>(null)

  const { toast } = useToast()

  // Resetear estados cuando se cierra el diálogo
  React.useEffect(() => {
    if (!open) {
      setLicenciaStartTime("")
      setLicenciaEndTime("")
      setSelectedPreset(null)
    }
  }, [open])

  // Calcular opciones rápidas
  const quickPresets = useMemo(() => {
    if (!selectedShift) return null

    const { assignment, shift } = selectedShift
    const MAX_WORK_HOURS = 4
    const maxWorkMinutes = MAX_WORK_HOURS * 60

    const shiftStartTime = assignment.startTime || shift?.startTime || ""
    const shiftEndTime = assignment.endTime || shift?.endTime || ""

    if (!shiftStartTime || !shiftEndTime) return null

    // Solo trabajar con turnos continuos (una sola franja)
    // Si tiene segunda franja, no mostrar presets automáticos
    if (assignment.startTime2 || assignment.endTime2 || shift?.startTime2 || shift?.endTime2) {
      return null
    }

    const shiftStart = timeToMinutes(shiftStartTime)
    const shiftEnd = timeToMinutes(shiftEndTime)
    const totalDuration = rangeDuration(shiftStartTime, shiftEndTime)

    if (totalDuration <= maxWorkMinutes) return null

    const crossesMidnight = shiftEnd < shiftStart

    // Preset 1: Trabajo al inicio → Licencia al final
    let trabajoEndMinutes = shiftStart + maxWorkMinutes
    if (trabajoEndMinutes >= 24 * 60) {
      trabajoEndMinutes = trabajoEndMinutes % (24 * 60)
    }
    const trabajoEnd = minutesToTime(trabajoEndMinutes)
    const preset1 = {
      id: "work-start" as const,
      licenciaStart: trabajoEnd,
      licenciaEnd: shiftEndTime,
      trabajoStart: shiftStartTime,
      trabajoEnd: trabajoEnd,
    }

    // Preset 2: Trabajo al final → Licencia al inicio
    let trabajoStartMinutes: number
    if (crossesMidnight) {
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
    const preset2 = {
      id: "work-end" as const,
      licenciaStart: shiftStartTime,
      licenciaEnd: trabajoStart,
      trabajoStart: trabajoStart,
      trabajoEnd: shiftEndTime,
    }

    return { preset1, preset2 }
  }, [selectedShift])

  const handlePresetSelect = (presetId: "work-start" | "work-end") => {
    if (!quickPresets) return
    const preset = presetId === "work-start" ? quickPresets.preset1 : quickPresets.preset2
    setSelectedPreset(presetId)
    setLicenciaStartTime(preset.licenciaStart)
    setLicenciaEndTime(preset.licenciaEnd)
  }

  const handleManualInputChange = () => {
    // Si el usuario edita manualmente, limpiar la selección rápida
    setSelectedPreset(null)
  }

  const handleSaveLicenciaEmbarazo = () => {
    if (!onApply || !selectedShift) return

    const trimmedStartTime = licenciaStartTime.trim()
    const trimmedEndTime = licenciaEndTime.trim()

    if (!trimmedStartTime || !trimmedEndTime) {
      toast({
        title: "Error",
        description: "Debe ingresar un rango horario válido.",
        variant: "destructive",
      })
      return
    }

    const { assignment: shiftAssignment, shift } = selectedShift

    const isMedioFranco = shiftAssignment.type === "medio_franco"

    const shiftStartTime = shiftAssignment.startTime || shift?.startTime || ""
    const shiftEndTime = shiftAssignment.endTime || shift?.endTime || ""
    const shiftStartTime2 = shiftAssignment.startTime2 || shift?.startTime2
    const shiftEndTime2 = shiftAssignment.endTime2 || shift?.endTime2

    if (!shiftStartTime || !shiftEndTime) {
      toast({
        title: "Error",
        description: "No se puede determinar el horario de referencia del turno.",
        variant: "destructive",
      })
      return
    }

    // Validar duración de licencia
    const licenciaDuration = rangeDuration(trimmedStartTime, trimmedEndTime)
    if (licenciaDuration <= 0) {
      toast({
        title: "Error",
        description: "La hora de inicio debe ser anterior a la hora de fin.",
        variant: "destructive",
      })
      return
    }

    // Validar que el rango esté contenido en el turno
    const isTimeInRange = (time: string, rangeStart: string, rangeEnd: string): boolean => {
      const timeMinutes = timeToMinutes(time)
      const rangeStartMinutes = timeToMinutes(rangeStart)
      const rangeEndMinutes = timeToMinutes(rangeEnd)

      if (rangeEndMinutes < rangeStartMinutes) {
        return timeMinutes >= rangeStartMinutes || timeMinutes <= rangeEndMinutes
      }
      return timeMinutes >= rangeStartMinutes && timeMinutes <= rangeEndMinutes
    }

    let isValid = false

    if (shiftStartTime2 && shiftEndTime2) {
      const inFirstRange =
        isTimeInRange(trimmedStartTime, shiftStartTime, shiftEndTime) &&
        isTimeInRange(trimmedEndTime, shiftStartTime, shiftEndTime)
      const inSecondRange =
        isTimeInRange(trimmedStartTime, shiftStartTime2, shiftEndTime2) &&
        isTimeInRange(trimmedEndTime, shiftStartTime2, shiftEndTime2)
      isValid = inFirstRange || inSecondRange
    } else {
      isValid =
        isTimeInRange(trimmedStartTime, shiftStartTime, shiftEndTime) &&
        isTimeInRange(trimmedEndTime, shiftStartTime, shiftEndTime)
    }

    if (!isValid) {
      toast({
        title: "Error",
        description: "El rango de licencia debe estar contenido en el horario del turno.",
        variant: "destructive",
      })
      return
    }

    // Crear los tramos divididos
    const newAssignments: ShiftAssignment[] = []

    const licenciaStart = timeToMinutes(trimmedStartTime)
    const licenciaEnd = timeToMinutes(trimmedEndTime)
    const shiftStart = timeToMinutes(shiftStartTime)
    const shiftEnd = timeToMinutes(shiftEndTime)

    const normalizeTimeForComparison = (time: string): string => {
      if (!time) return ""
      return time.includes(":") ? time : `${time}:00`
    }

    const licenciaStartNorm = normalizeTimeForComparison(trimmedStartTime)
    const licenciaEndNorm = normalizeTimeForComparison(trimmedEndTime)
    const shiftStartTimeNorm = shiftStartTime ? normalizeTimeForComparison(shiftStartTime) : ""
    const shiftEndTimeNorm = shiftEndTime ? normalizeTimeForComparison(shiftEndTime) : ""
    const shiftStartTime2Norm = shiftStartTime2 ? normalizeTimeForComparison(shiftStartTime2) : ""
    const shiftEndTime2Norm = shiftEndTime2 ? normalizeTimeForComparison(shiftEndTime2) : ""

    const licenciaCoincideConPrimeraFranja =
      shiftStartTime &&
      shiftEndTime &&
      licenciaStartNorm === shiftStartTimeNorm &&
      licenciaEndNorm === shiftEndTimeNorm

    const licenciaCoincideConSegundaFranja =
      shiftStartTime2 &&
      shiftEndTime2 &&
      licenciaStartNorm === shiftStartTime2Norm &&
      licenciaEndNorm === shiftEndTime2Norm

    if (shiftStartTime2 && shiftEndTime2) {
      const shiftStart2 = timeToMinutes(shiftStartTime2)
      const shiftEnd2 = timeToMinutes(shiftEndTime2)

      const licenciaInFirst =
        isTimeInRange(trimmedStartTime, shiftStartTime, shiftEndTime) &&
        isTimeInRange(trimmedEndTime, shiftStartTime, shiftEndTime)
      const licenciaInSecond =
        isTimeInRange(trimmedStartTime, shiftStartTime2, shiftEndTime2) &&
        isTimeInRange(trimmedEndTime, shiftStartTime2, shiftEndTime2)

      if (licenciaInSecond) {
        if (licenciaCoincideConSegundaFranja) {
          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime: shiftStartTime,
            endTime: shiftEndTime,
          })
        } else {
          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime: shiftStartTime,
            endTime: shiftEndTime,
          })

          const crossesMidnight = shiftEnd2 < shiftStart2
          const licenciaStartMinutes = timeToMinutes(trimmedStartTime)
          const licenciaStartIsAfter = crossesMidnight
            ? licenciaStartMinutes >= shiftStart2 || licenciaStartMinutes <= shiftEnd2
            : licenciaStartMinutes > shiftStart2

          if (licenciaStartIsAfter && trimmedStartTime !== shiftStartTime2) {
            newAssignments.push({
              shiftId: shiftAssignment.shiftId,
              type: "shift",
              startTime2: shiftStartTime2,
              endTime2: trimmedStartTime,
            })
          }

          const licenciaEndMinutes = timeToMinutes(trimmedEndTime)
          const licenciaEndIsBefore = crossesMidnight
            ? licenciaEndMinutes < shiftEnd2 || licenciaEndMinutes >= shiftStart2
            : licenciaEndMinutes < shiftEnd2

          if (licenciaEndIsBefore && trimmedEndTime !== shiftEndTime2) {
            newAssignments.push({
              shiftId: shiftAssignment.shiftId,
              type: "shift",
              startTime2: trimmedEndTime,
              endTime2: shiftEndTime2,
            })
          }
        }

        newAssignments.push({
          type: "licencia",
          licenciaType: "embarazo",
          startTime: trimmedStartTime,
          endTime: trimmedEndTime,
        })
      } else if (licenciaInFirst) {
        if (licenciaCoincideConPrimeraFranja) {
          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime2: shiftStartTime2,
            endTime2: shiftEndTime2,
          })
        } else {
          const firstCrossesMidnight = shiftEnd < shiftStart
          const licenciaStartIsAfterFirst = firstCrossesMidnight
            ? licenciaStart > shiftStart || licenciaStart <= shiftEnd
            : licenciaStart > shiftStart

          if (licenciaStartIsAfterFirst && trimmedStartTime !== shiftStartTime) {
            newAssignments.push({
              shiftId: shiftAssignment.shiftId,
              type: "shift",
              startTime: shiftStartTime,
              endTime: trimmedStartTime,
            })
          }

          const licenciaEndIsBeforeFirst = firstCrossesMidnight
            ? licenciaEnd < shiftEnd || licenciaEnd >= shiftStart
            : licenciaEnd < shiftEnd

          if (licenciaEndIsBeforeFirst && trimmedEndTime !== shiftEndTime) {
            newAssignments.push({
              shiftId: shiftAssignment.shiftId,
              type: "shift",
              startTime: trimmedEndTime,
              endTime: shiftEndTime,
            })
          }

          newAssignments.push({
            shiftId: shiftAssignment.shiftId,
            type: "shift",
            startTime2: shiftStartTime2,
            endTime2: shiftEndTime2,
          })
        }

        newAssignments.push({
          type: "licencia",
          licenciaType: "embarazo",
          startTime: trimmedStartTime,
          endTime: trimmedEndTime,
        })
      }
    } else {
      if (licenciaCoincideConPrimeraFranja) {
        newAssignments.push({
          type: "licencia",
          licenciaType: "embarazo",
          startTime: trimmedStartTime,
          endTime: trimmedEndTime,
        })
      } else {
        const crossesMidnight = shiftEnd < shiftStart

        const licenciaStartIsAfter = crossesMidnight
          ? licenciaStart > shiftStart || licenciaStart <= shiftEnd
          : licenciaStart > shiftStart

        if (licenciaStartIsAfter && trimmedStartTime !== shiftStartTime) {
          const partialAssignment: ShiftAssignment = {
            type: isMedioFranco ? "medio_franco" : "shift",
            startTime: shiftStartTime,
            endTime: trimmedStartTime,
          }
          if (shiftAssignment.shiftId && !isMedioFranco) {
            partialAssignment.shiftId = shiftAssignment.shiftId
          }
          newAssignments.push(partialAssignment)
        }

        newAssignments.push({
          type: "licencia",
          licenciaType: "embarazo",
          startTime: trimmedStartTime,
          endTime: trimmedEndTime,
        })

        const licenciaEndIsBefore = crossesMidnight
          ? licenciaEnd < shiftEnd || licenciaEnd >= shiftStart
          : licenciaEnd < shiftEnd

        if (licenciaEndIsBefore && trimmedEndTime !== shiftEndTime) {
          const partialAssignment: ShiftAssignment = {
            type: isMedioFranco ? "medio_franco" : "shift",
            startTime: trimmedEndTime,
            endTime: shiftEndTime,
          }
          if (shiftAssignment.shiftId && !isMedioFranco) {
            partialAssignment.shiftId = shiftAssignment.shiftId
          }
          newAssignments.push(partialAssignment)
        }
      }
    }

    const otherAssignments = assignments.filter((a) => {
      if (isMedioFranco) {
        return a.type !== "medio_franco"
      } else {
        return !(a.type === "shift" && a.shiftId === shiftAssignment.shiftId)
      }
    })

    const turnAssignments = newAssignments.filter((a) => a.type === "shift" || a.type === "medio_franco")
    const licenciaAssignments = newAssignments.filter((a) => a.type === "licencia")
    const otherTurnAssignments = otherAssignments.filter((a) => a.type === "shift" || a.type === "medio_franco")
    const otherSpecialAssignments = otherAssignments.filter((a) => a.type !== "shift" && a.type !== "medio_franco")

    const finalAssignments = [
      ...turnAssignments,
      ...otherTurnAssignments,
      ...licenciaAssignments,
      ...otherSpecialAssignments,
    ]

    const validationResult = validateCellAssignments(finalAssignments)
    if (!validationResult.valid) {
      toast({
        title: "Error de validación",
        description: validationResult.errors.join(". "),
        variant: "destructive",
      })
      return
    }

    onApply(date, employeeId, finalAssignments)
    onOpenChange(false)
    setLicenciaStartTime("")
    setLicenciaEndTime("")
    setSelectedPreset(null)
  }

  if (!selectedShift) return null

  const assignment = selectedShift.assignment
  const shift = selectedShift.shift

  const shiftStartTime = assignment.startTime || shift?.startTime || ""
  const shiftEndTime = assignment.endTime || shift?.endTime || ""

  if (!shiftStartTime || !shiftEndTime) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar licencia por embarazo</DialogTitle>
          <div className="text-sm text-muted-foreground">
            Turno: {shiftStartTime} – {shiftEndTime}
          </div>
        </DialogHeader>

        <div className="space-y-3 py-3">
          {/* Opciones rápidas */}
          {quickPresets && (
            <>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer w-full p-2 rounded-md hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="preset"
                    checked={selectedPreset === "work-start"}
                    onChange={() => handlePresetSelect("work-start")}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Trabajo al inicio → Licencia al final</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer w-full p-2 rounded-md hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="preset"
                    checked={selectedPreset === "work-end"}
                    onChange={() => handlePresetSelect("work-end")}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Trabajo al final → Licencia al inicio</span>
                </label>
              </div>

              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 border-t"></div>
                <span className="text-xs text-muted-foreground">— o —</span>
                <div className="flex-1 border-t"></div>
              </div>
            </>
          )}

          {/* Ingreso manual */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="licenciaStartTime" className="text-sm">
                Inicio licencia
              </Label>
              <Input
                id="licenciaStartTime"
                type="time"
                value={licenciaStartTime}
                onChange={(e) => {
                  setLicenciaStartTime(e.target.value)
                  handleManualInputChange()
                }}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="licenciaEndTime" className="text-sm">
                Fin licencia
              </Label>
              <Input
                id="licenciaEndTime"
                type="time"
                value={licenciaEndTime}
                onChange={(e) => {
                  setLicenciaEndTime(e.target.value)
                  handleManualInputChange()
                }}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSaveLicenciaEmbarazo}
            disabled={!licenciaStartTime || !licenciaEndTime}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
