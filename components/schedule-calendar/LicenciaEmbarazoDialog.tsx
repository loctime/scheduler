"use client"

import React, { useState, useMemo } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ShiftAssignment, Turno, Configuracion } from "@/lib/types"
import { validateCellAssignments } from "@/lib/assignment-validators"
import { useToast } from "@/hooks/use-toast"
import { rangeDuration } from "@/lib/time-utils"

interface LicenciaEmbarazoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  date: string
  employeeId: string
  assignments: ShiftAssignment[]
  config?: Configuracion

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
  config,
  selectedShift,
  onApply,
}: LicenciaEmbarazoDialogProps) {
  const [licenciaStartTime, setLicenciaStartTime] = useState("")
  const [licenciaEndTime, setLicenciaEndTime] = useState("")
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null)

  const { toast } = useToast()

  // Resetear estados cuando se cierra el diálogo
  React.useEffect(() => {
    if (!open) {
      setLicenciaStartTime("")
      setLicenciaEndTime("")
      setSelectedSuggestion(null)
    }
  }, [open])

  // Usar timeToMinutes de time-utils en lugar de función local
  const timeToMinutes = (time: string): number => {
    if (!time) return 0
    // Normalizar formato: si no tiene ":", asumir que son solo horas (ej: "11" -> "11:00")
    const normalizedTime = time.includes(":") ? time : `${time}:00`
    const [hours, minutes] = normalizedTime.split(":").map(Number)
    return (hours * 60 + minutes) % 1440
  }

  // Helper para calcular duración usando time-utils
  const calculateDuration = (start: string, end: string): number => {
    return rangeDuration(start, end)
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

  // Calcular sugerencias automáticas de licencia - Generalizado para cualquier turno
  const calculateLicenciaSuggestions = useMemo(() => {
    if (!selectedShift) return []

    const { assignment, shift } = selectedShift
    const MAX_WORK_HOURS = 4 // Máximo de 4 horas trabajables
    const maxWorkMinutes = MAX_WORK_HOURS * 60

    // CRÍTICO: Usar SOLO valores explícitos del assignment (autosuficiencia)
    // NO usar fallback al turno base
    const shiftStartTime = assignment.startTime
    const shiftEndTime = assignment.endTime
    const shiftStartTime2 = assignment.startTime2
    const shiftEndTime2 = assignment.endTime2

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
  }, [selectedShift])

  const handleSaveLicenciaEmbarazo = () => {
    if (!onApply || !selectedShift) return

    const trimmedStartTime = licenciaStartTime.trim()
    const trimmedEndTime = licenciaEndTime.trim()

    if (!trimmedStartTime || !trimmedEndTime) {
      return // Validación básica - el diálogo debe validar antes
    }

    const { assignment: shiftAssignment, shift } = selectedShift

    // Verificar si es medio_franco
    const isMedioFranco = shiftAssignment.type === "medio_franco"

    // CRÍTICO: Usar SOLO valores explícitos del assignment (autosuficiencia)
    // No usar turno base como fallback - el assignment debe tener todos los datos necesarios
    if (!shiftAssignment.startTime || !shiftAssignment.endTime) {
      toast({
        title: "Error",
        description: "El assignment está incompleto. No se puede dividir.",
        variant: "destructive",
      })
      return
    }

    const shiftStartTime = shiftAssignment.startTime
    const shiftEndTime = shiftAssignment.endTime
    const shiftStartTime2 = shiftAssignment.startTime2 // Puede ser undefined si es turno simple
    const shiftEndTime2 = shiftAssignment.endTime2 // Puede ser undefined si es turno simple

    // Validar duración de licencia (considerando cruce de medianoche)
    const licenciaDuration = calculateDuration(trimmedStartTime, trimmedEndTime)
    if (licenciaDuration <= 0) {
      return // Duración inválida
    }

    // Validar que el rango esté contenido en el turno
    let isValid = false

    if (shiftStartTime2 && shiftEndTime2) {
      // Turno cortado: validar en cualquiera de las dos franjas
      const inFirstRange =
        isTimeInRange(trimmedStartTime, shiftStartTime, shiftEndTime) &&
        isTimeInRange(trimmedEndTime, shiftStartTime, shiftEndTime)
      const inSecondRange =
        isTimeInRange(trimmedStartTime, shiftStartTime2, shiftEndTime2) &&
        isTimeInRange(trimmedEndTime, shiftStartTime2, shiftEndTime2)

      isValid = inFirstRange || inSecondRange
    } else {
      // Turno continuo: validar rango (considerando cruce de medianoche)
      isValid =
        isTimeInRange(trimmedStartTime, shiftStartTime, shiftEndTime) &&
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

    // Si el turno tiene segunda franja (turno cortado)
    if (shiftStartTime2 && shiftEndTime2) {
      const shiftStart2 = timeToMinutes(shiftStartTime2)
      const shiftEnd2 = timeToMinutes(shiftEndTime2)

      // Determinar en qué franja está la licencia
      const licenciaInFirst =
        isTimeInRange(trimmedStartTime, shiftStartTime, shiftEndTime) &&
        isTimeInRange(trimmedEndTime, shiftStartTime, shiftEndTime)
      const licenciaInSecond =
        isTimeInRange(trimmedStartTime, shiftStartTime2, shiftEndTime2) &&
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

          // Tramo después de licencia en segunda franja (si existe)
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

          // Tramo después de licencia en primera franja (si existe)
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
          ? licenciaStart > shiftStart || licenciaStart <= shiftEnd
          : licenciaStart > shiftStart

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
          ? licenciaEnd < shiftEnd || licenciaEnd >= shiftStart
          : licenciaEnd < shiftEnd

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

    onApply(date, employeeId, finalAssignments)

    onOpenChange(false)
    setLicenciaStartTime("")
    setLicenciaEndTime("")
    setSelectedSuggestion(null)
  }

  if (!selectedShift) return null

  // GUARD-RAIL: Bloqueo explícito si no hay horario real
  const assignment = selectedShift.assignment
  const hasRealSchedule = assignment.startTime && assignment.endTime

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {!hasRealSchedule && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              Definí primero el horario trabajado desde "Editar horario".
            </AlertDescription>
          </Alert>
        )}
        <DialogHeader>
          <DialogTitle>Asignar Licencia por Embarazo</DialogTitle>
          <DialogDescription>
            {selectedShift.assignment.type === "medio_franco" ? (
              <>
                1/2 Franco: <strong>{selectedShift.shift?.name || "Medio Franco"}</strong>
                <br />
                <span className="text-xs">
                  {(() => {
                    const assignment = selectedShift.assignment
                    // CRÍTICO: Usar SOLO valores explícitos del assignment
                    const startTime = assignment.startTime || ""
                    const endTime = assignment.endTime || ""
                    const startTime2 = assignment.startTime2
                    const endTime2 = assignment.endTime2

                    if (startTime2 && endTime2) {
                      return `Horario completo: ${startTime} - ${endTime} y ${startTime2} - ${endTime2}`
                    }
                    return `Horario completo: ${startTime} - ${endTime}`
                  })()}
                  <br />
                  <span className="text-muted-foreground">
                    Asigne la licencia por embarazo sobre este medio franco. Si la licencia cubre todo el medio franco,
                    este será reemplazado completamente por la licencia.
                  </span>
                </span>
              </>
            ) : (
              <>
                {selectedShift.shift ? (
                  <>
                    Turno: <strong>{selectedShift.shift.name}</strong>
                    <br />
                  </>
                ) : (
                  <>
                    <span className="text-destructive font-semibold">⚠️ Advertencia: El turno base fue eliminado</span>
                    <br />
                  </>
                )}
                <span className="text-xs">
                  {(() => {
                    const assignment = selectedShift.assignment
                    // CRÍTICO: Usar SOLO valores explícitos del assignment (autosuficiencia)
                    const startTime = assignment.startTime || ""
                    const endTime = assignment.endTime || ""
                    const startTime2 = assignment.startTime2
                    const endTime2 = assignment.endTime2

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
            <br />
            <div className="mt-3 p-3 bg-muted/50 rounded-md border border-border">
              <p className="text-xs text-foreground font-medium mb-1">
                ℹ️ Información importante:
              </p>
              <p className="text-xs text-muted-foreground">
                El día mantendrá su duración total. Las horas se dividirán entre trabajo y licencia por embarazo.
                El sistema propone opciones válidas, pero tú decides cómo dividir el horario.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {hasRealSchedule && (
            <div className="p-3 rounded-md bg-muted/60 border text-xs">
              El sistema propone opciones válidas, pero <strong>no aplica ningún cambio automáticamente</strong>.
              Debes seleccionar una opción o definir el rango manualmente y confirmar.
            </div>
          )}
          {hasRealSchedule && calculateLicenciaSuggestions.length > 0 && (
            <div className="space-y-3 pb-3 border-b">
              <Label className="text-sm font-semibold">Sugerencias automáticas (selecciona una opción):</Label>
              <p className="text-xs text-muted-foreground mb-2">
                El sistema propone opciones válidas. Selecciona una para prellenar los campos, o define manualmente.
              </p>
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
                            <div className="text-[10px] text-muted-foreground mt-1 italic">{suggestion.description}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {hasRealSchedule && (
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
                    min={assignment.startTime || undefined}
                    max={assignment.endTime || undefined}
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
                    min={licenciaStartTime || assignment.startTime || undefined}
                    max={assignment.endTime || undefined}
                  />
                </div>
              </div>
            </div>
          )}
          {hasRealSchedule &&
            licenciaStartTime &&
            licenciaEndTime &&
            (() => {
              // CRÍTICO: Usar SOLO valores explícitos del assignment
              const shiftStartTime = assignment.startTime || ""
              const shiftEndTime = assignment.endTime || ""
              const shiftStartTime2 = assignment.startTime2
              const shiftEndTime2 = assignment.endTime2

              let isValid = false
              let errorMessage = ""

              // Verificar que inicio < fin (considerando cruce de medianoche)
              const licenciaDuration = calculateDuration(licenciaStartTime, licenciaEndTime)
              if (licenciaDuration <= 0) {
                errorMessage = "La hora de inicio debe ser anterior a la hora de fin"
              } else if (shiftStartTime2 && shiftEndTime2) {
                // Turno cortado: validar en cualquiera de las dos franjas
                const inFirstRange =
                  isTimeInRange(licenciaStartTime, shiftStartTime, shiftEndTime) &&
                  isTimeInRange(licenciaEndTime, shiftStartTime, shiftEndTime)
                const inSecondRange =
                  isTimeInRange(licenciaStartTime, shiftStartTime2, shiftEndTime2) &&
                  isTimeInRange(licenciaEndTime, shiftStartTime2, shiftEndTime2)
                isValid = inFirstRange || inSecondRange
                if (!isValid) {
                  errorMessage = `El rango debe estar contenido en ${shiftStartTime} - ${shiftEndTime} o en ${shiftStartTime2} - ${shiftEndTime2}`
                }
              } else {
                // Turno continuo: validar rango (considerando cruce de medianoche)
                isValid =
                  isTimeInRange(licenciaStartTime, shiftStartTime, shiftEndTime) &&
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSaveLicenciaEmbarazo}
            disabled={
              !hasRealSchedule ||
              !licenciaStartTime ||
              !licenciaEndTime ||
              calculateDuration(licenciaStartTime, licenciaEndTime) <= 0
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
