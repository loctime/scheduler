import type { CSSProperties } from "react"
import { ShiftAssignment, Turno, MedioTurno } from "@/lib/types"
import { hexToRgba, timeToMinutes } from "./schedule-grid-utils"

interface GetDayBackgroundStyleParams {
  assignments: ShiftAssignment[]
  dayStatus: "normal" | "franco" | "medio_franco"
  getShiftInfo: (shiftId: string) => Turno | undefined
  shifts: Turno[]
  mediosTurnos: MedioTurno[]
}

/**
 * Función pura para calcular el estilo de fondo de una celda del calendario.
 * 
 * Esta es la misma lógica que usa ScheduleCell para mantener consistencia visual.
 * 
 * @param params - Parámetros necesarios para calcular el estilo
 * @returns Estilo CSS para aplicar al fondo de la celda, o undefined si no hay estilo
 */
export function getDayBackgroundStyle({
  assignments,
  dayStatus,
  getShiftInfo,
  shifts,
  mediosTurnos,
}: GetDayBackgroundStyleParams): CSSProperties | undefined {
  // Helper: obtener color del medio turno configurado
  const getMedioTurnoColor = (startTime: string, endTime: string): string => {
    const medioTurno = mediosTurnos.find((mt) => mt.startTime === startTime && mt.endTime === endTime)
    const colorHex = medioTurno?.color || "#22c55e"
    return hexToRgba(colorHex, 0.35)
  }

  // Helper: buscar un turno que coincida con un horario dado (para obtener su color)
  const findMatchingShift = (startTime: string, endTime: string, excludeShiftId?: string): Turno | undefined => {
    if (!startTime || !endTime) return undefined

    const startMinutes = timeToMinutes(startTime)
    const endMinutes = timeToMinutes(endTime)

    // Primero intentar buscar por nombre (palabras clave)
    const nameLowerStart =
      startMinutes < 14 * 60 ? ["mañana", "morning", "matutino"] : startMinutes >= 18 * 60 ? ["noche", "night", "nocturno"] : []

    const nameMatch = shifts.find((shift) => {
      if (shift.id === excludeShiftId || shift.startTime2 || shift.endTime2) return false
      const nameLower = shift.name.toLowerCase()
      return nameLowerStart.some((keyword) => nameLower.includes(keyword))
    })

    if (nameMatch) return nameMatch

    // Si no se encuentra por nombre, buscar por horarios similares
    const matchingShift = shifts.find((shift) => {
      if (shift.id === excludeShiftId || shift.startTime2 || shift.endTime2) return false

      if (shift.startTime && shift.endTime) {
        const shiftStart = timeToMinutes(shift.startTime)
        const shiftEnd = timeToMinutes(shift.endTime)

        const startDiff = Math.abs(shiftStart - startMinutes)
        const endDiff = Math.abs(shiftEnd - endMinutes)

        if (startDiff <= 60 && endDiff <= 60) {
          return true
        }
      }

      return false
    })

    return matchingShift
  }

  // Si no hay asignaciones, no aplicar color
  if (assignments.length === 0) {
    if (dayStatus === "franco") {
      return { backgroundColor: "rgba(34, 197, 94, 0.35)" }
    }
    return undefined
  }

  // Color verde para franco (opacidad 0.35) - por defecto
  const defaultGreenColor = "rgba(34, 197, 94, 0.35)" // green-500 con opacidad

  // Si es franco, aplicar verde
  if (assignments.some((a) => a.type === "franco") || dayStatus === "franco") {
    return { backgroundColor: defaultGreenColor }
  }

  // Buscar horario especial (sin shiftId pero con startTime/endTime)
  const horarioEspecial = assignments.find(
    (a) => a.type === "shift" && !a.shiftId && (a.startTime || a.endTime)
  )

  // Si hay un horario especial con color, usar ese color
  if (horarioEspecial && (horarioEspecial as any).color) {
    const especialColor = (horarioEspecial as any).color
    return { backgroundColor: hexToRgba(especialColor, 0.35) }
  }

  // Buscar licencia
  const licencia = assignments.find((a) => a.type === "licencia")

  // Buscar medio franco
  const medioFranco = assignments.find((a) => a.type === "medio_franco")

  // Buscar turnos normales
  const shiftAssignments = assignments.filter((a) => a.type === "shift" && a.shiftId)
  
  // Color para licencia (naranja/amarillo)
  const licenciaColor = "rgba(245, 158, 11, 0.35)" // amber-500 con opacidad

  // Si hay licencia, solo aplicar color si NO hay turnos
  if (licencia) {
    if (shiftAssignments.length === 0 && !medioFranco) {
      return { backgroundColor: licenciaColor }
    }
  }

  // Si solo hay medio franco (sin turnos), crear gradiente vertical como turno cortado
  if (medioFranco && shiftAssignments.length === 0 && !licencia) {
    if (medioFranco.startTime && medioFranco.endTime) {
      const matchingShift = findMatchingShift(medioFranco.startTime, medioFranco.endTime)
      const medioStart = timeToMinutes(medioFranco.startTime)
      const isEarly = medioStart < 14 * 60 // Antes de las 14:00

      if (matchingShift) {
        const shiftColor = hexToRgba(matchingShift.color, 0.35)
        if (isEarly) {
          return {
            background: `linear-gradient(to bottom, ${shiftColor} 50%, ${defaultGreenColor} 50%)`,
          }
        } else {
          return {
            background: `linear-gradient(to bottom, ${defaultGreenColor} 50%, ${shiftColor} 50%)`,
          }
        }
      } else {
        const medioColor = getMedioTurnoColor(medioFranco.startTime, medioFranco.endTime)
        if (isEarly) {
          return {
            background: `linear-gradient(to bottom, ${medioColor} 50%, ${defaultGreenColor} 50%)`,
          }
        } else {
          return {
            background: `linear-gradient(to bottom, ${defaultGreenColor} 50%, ${medioColor} 50%)`,
          }
        }
      }
    }
    return { backgroundColor: defaultGreenColor }
  }

  // Si hay medio franco + turno(s), crear gradiente
  if (medioFranco && shiftAssignments.length > 0) {
    const firstShift = getShiftInfo(shiftAssignments[0].shiftId || "")
    if (!firstShift || !firstShift.color) {
      const medioColor =
        medioFranco.startTime && medioFranco.endTime
          ? getMedioTurnoColor(medioFranco.startTime, medioFranco.endTime)
          : defaultGreenColor
      return { backgroundColor: medioColor }
    }

    const shiftColor = hexToRgba(firstShift.color, 0.35)

    let isMedioFrancoEarly = true
    if (medioFranco.startTime && medioFranco.endTime) {
      const medioStart = timeToMinutes(medioFranco.startTime)
      isMedioFrancoEarly = medioStart < 14 * 60
    }

    if (isMedioFrancoEarly) {
      return {
        background: `linear-gradient(to bottom, ${shiftColor} 50%, ${defaultGreenColor} 50%)`,
      }
    } else {
      return {
        background: `linear-gradient(to bottom, ${defaultGreenColor} 50%, ${shiftColor} 50%)`,
      }
    }
  }

  // Si solo hay turnos normales, verificar si es un turno cortado
  if (shiftAssignments.length > 0) {
    const firstAssignment = shiftAssignments[0]
    const firstShift = getShiftInfo(firstAssignment.shiftId || "")
    if (!firstShift) return undefined

    const startTime = firstAssignment.startTime || firstShift.startTime || ""
    const endTime = firstAssignment.endTime || firstShift.endTime || ""
    const startTime2 = firstAssignment.startTime2 || firstShift.startTime2 || ""
    const endTime2 = firstAssignment.endTime2 || firstShift.endTime2 || ""

    // Si es un turno cortado (tiene segunda franja), aplicar gradiente vertical
    if (startTime && endTime && startTime2 && endTime2) {
      const cutShiftOpacity = 0.35

      // Prioridad 1: Usar colores específicos del turno si están definidos
      if (firstShift.colorPrimeraFranja && firstShift.colorSegundaFranja) {
        const morningColor = hexToRgba(firstShift.colorPrimeraFranja, cutShiftOpacity)
        const nightColor = hexToRgba(firstShift.colorSegundaFranja, cutShiftOpacity)
        return {
          background: `linear-gradient(to bottom, ${morningColor} 50%, ${nightColor} 50%)`,
        }
      }

      // Prioridad 2: Buscar turnos que coincidan con cada franja
      const morningShift = findMatchingShift(startTime, endTime, firstShift.id)
      const nightShift = findMatchingShift(startTime2, endTime2, firstShift.id)

      if (morningShift && nightShift) {
        const morningColor = hexToRgba(morningShift.color, cutShiftOpacity)
        const nightColor = hexToRgba(nightShift.color, cutShiftOpacity)
        return {
          background: `linear-gradient(to bottom, ${morningColor} 50%, ${nightColor} 50%)`,
        }
      }
      if (morningShift) {
        const morningColor = hexToRgba(morningShift.color, cutShiftOpacity)
        const nightColor = hexToRgba(firstShift.color, cutShiftOpacity)
        return {
          background: `linear-gradient(to bottom, ${morningColor} 50%, ${nightColor} 50%)`,
        }
      }
      if (nightShift) {
        const morningColor = hexToRgba(firstShift.color, cutShiftOpacity)
        const nightColor = hexToRgba(nightShift.color, cutShiftOpacity)
        return {
          background: `linear-gradient(to bottom, ${morningColor} 50%, ${nightColor} 50%)`,
        }
      }
      const shiftColor = hexToRgba(firstShift.color, cutShiftOpacity)
      return { backgroundColor: shiftColor }
    }

    // Si no es turno cortado, aplicar color del turno normalmente
    if (firstShift && firstShift.color) {
      return { backgroundColor: hexToRgba(firstShift.color, 0.35) }
    }
  }

  return undefined
}
