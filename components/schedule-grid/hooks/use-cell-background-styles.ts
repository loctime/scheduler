import { useCallback, useMemo } from "react"
import type { CSSProperties } from "react"
import { ShiftAssignment, Turno, MedioTurno } from "@/lib/types"
import { hexToRgba, timeToMinutes } from "../utils/schedule-grid-utils"

interface UseCellBackgroundStylesProps {
  getEmployeeAssignments: (employeeId: string, date: string) => ShiftAssignment[]
  getShiftInfo: (shiftId: string) => Turno | undefined
  shifts: Turno[]
  mediosTurnos: MedioTurno[]
}

export function useCellBackgroundStyles({
  getEmployeeAssignments,
  getShiftInfo,
  shifts,
  mediosTurnos,
}: UseCellBackgroundStylesProps) {
  // Helper: obtener color del medio turno configurado
  const getMedioTurnoColor = useCallback(
    (startTime: string, endTime: string): string => {
      // Buscar el medio turno configurado que coincida con el horario
      const medioTurno = mediosTurnos.find((mt) => mt.startTime === startTime && mt.endTime === endTime)

      // Si se encuentra y tiene color configurado, usarlo; sino usar verde por defecto
      const colorHex = medioTurno?.color || "#22c55e"
      return hexToRgba(colorHex, 0.35)
    },
    [mediosTurnos]
  )

  // Helper: buscar un turno que coincida con un horario dado (para obtener su color)
  const findMatchingShift = useCallback(
    (startTime: string, endTime: string, excludeShiftId?: string): Turno | undefined => {
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
      // Priorizar turnos simples (sin segunda franja) que tengan horarios similares
      const matchingShift = shifts.find((shift) => {
        if (shift.id === excludeShiftId || shift.startTime2 || shift.endTime2) return false

        // Solo considerar turnos simples (sin segunda franja)
        if (shift.startTime && shift.endTime) {
          const shiftStart = timeToMinutes(shift.startTime)
          const shiftEnd = timeToMinutes(shift.endTime)

          // Verificar si el rango de horarios se solapa o es muy similar
          // Coincidencia si la diferencia en inicio y fin es menor a 60 minutos
          const startDiff = Math.abs(shiftStart - startMinutes)
          const endDiff = Math.abs(shiftEnd - endMinutes)

          if (startDiff <= 60 && endDiff <= 60) {
            return true
          }
        }

        return false
      })

      return matchingShift
    },
    [shifts]
  )

  // Obtener el color de fondo para una celda basado en las asignaciones
  const getCellBackgroundStyle = useCallback(
    (employeeId: string, date: string): CSSProperties | undefined => {
      const assignments = getEmployeeAssignments(employeeId, date)

      // Si no hay asignaciones, no aplicar color
      if (assignments.length === 0) return undefined

      // Color verde para franco (opacidad 0.35) - por defecto
      const defaultGreenColor = "rgba(34, 197, 94, 0.35)" // green-500 con opacidad

      // Si es franco, aplicar verde
      if (assignments.some((a) => a.type === "franco")) {
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
      // Si hay turnos, mantener el color normal del turno (la licencia solo se indica en el texto)
      if (licencia) {
        // Solo aplicar color naranja si SOLO hay licencia (sin turnos ni medio franco)
        if (shiftAssignments.length === 0 && !medioFranco) {
          return { backgroundColor: licenciaColor }
        }
        // Si hay turnos, NO cambiar el color - seguir con la lógica normal de turnos
        // La licencia se indicará solo en el texto del tramo correspondiente
      }

      // Si solo hay medio franco (sin turnos), crear gradiente vertical como turno cortado
      if (medioFranco && shiftAssignments.length === 0 && !licencia) {
        if (medioFranco.startTime && medioFranco.endTime) {
          // Buscar un turno que coincida con el horario del medio franco para obtener su color
          const matchingShift = findMatchingShift(medioFranco.startTime, medioFranco.endTime)

          // Determinar si el medio franco es temprano (mañana) o tarde (noche)
          const medioStart = timeToMinutes(medioFranco.startTime)
          const isEarly = medioStart < 14 * 60 // Antes de las 14:00

          if (matchingShift) {
            // Si encontramos un turno que coincide, usar gradiente con su color
            const shiftColor = hexToRgba(matchingShift.color, 0.35)
            if (isEarly) {
              // Medio franco temprano (mañana): arriba color del turno, abajo verde
              return {
                background: `linear-gradient(to bottom, ${shiftColor} 50%, ${defaultGreenColor} 50%)`,
              }
            } else {
              // Medio franco tarde (noche): arriba verde, abajo color del turno
              return {
                background: `linear-gradient(to bottom, ${defaultGreenColor} 50%, ${shiftColor} 50%)`,
              }
            }
          } else {
            // Si no encontramos turno, usar color configurado del medio turno o verde
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
        // Obtener el color del primer turno
        const firstShift = getShiftInfo(shiftAssignments[0].shiftId || "")
        if (!firstShift || !firstShift.color) {
          const medioColor =
            medioFranco.startTime && medioFranco.endTime
              ? getMedioTurnoColor(medioFranco.startTime, medioFranco.endTime)
              : defaultGreenColor
          return { backgroundColor: medioColor }
        }

        const shiftColor = hexToRgba(firstShift.color, 0.35)

        // Determinar si el medio franco es temprano (mañana) o tarde (noche)
        let isMedioFrancoEarly = true // Por defecto, asumir que es temprano

        if (medioFranco.startTime && medioFranco.endTime) {
          const medioStart = timeToMinutes(medioFranco.startTime)
          // Si el medio franco empieza antes de las 14:00, es temprano (mañana)
          isMedioFrancoEarly = medioStart < 14 * 60
        }

        // Crear gradiente vertical: verde para medio franco, color del turno para el turno
        if (isMedioFrancoEarly) {
          // Medio franco temprano (mañana): arriba turno, abajo medio franco (verde)
          return {
            background: `linear-gradient(to bottom, ${shiftColor} 50%, ${defaultGreenColor} 50%)`,
          }
        } else {
          // Medio franco tarde (noche): arriba medio franco (verde), abajo turno
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

        // Obtener horarios (ajustados o base)
        const startTime = firstAssignment.startTime || firstShift.startTime || ""
        const endTime = firstAssignment.endTime || firstShift.endTime || ""
        const startTime2 = firstAssignment.startTime2 || firstShift.startTime2 || ""
        const endTime2 = firstAssignment.endTime2 || firstShift.endTime2 || ""

        // Si es un turno cortado (tiene segunda franja), aplicar gradiente vertical
        if (startTime && endTime && startTime2 && endTime2) {
          // Opacidad más alta para turnos cortados (mejor contraste)
          const cutShiftOpacity = 0.35

          // Buscar turnos que coincidan con cada franja para obtener sus colores
          const morningShift = findMatchingShift(startTime, endTime, firstShift.id)
          const nightShift = findMatchingShift(startTime2, endTime2, firstShift.id)

          // Si encontramos ambos turnos, usar sus colores
          if (morningShift && nightShift) {
            const morningColor = hexToRgba(morningShift.color, cutShiftOpacity)
            const nightColor = hexToRgba(nightShift.color, cutShiftOpacity)
            return {
              background: `linear-gradient(to bottom, ${morningColor} 50%, ${nightColor} 50%)`,
            }
          }
          // Si solo encontramos uno, usar ese color y el del turno actual
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
          // Si no encontramos ninguno, usar el color del turno para ambas partes
          const shiftColor = hexToRgba(firstShift.color, cutShiftOpacity)
          return { backgroundColor: shiftColor }
        }

        // Si no es turno cortado, aplicar color del turno normalmente
        if (firstShift && firstShift.color) {
          return { backgroundColor: hexToRgba(firstShift.color, 0.35) }
        }
      }

      return undefined
    },
    [getEmployeeAssignments, getShiftInfo, hexToRgba, timeToMinutes, getMedioTurnoColor, findMatchingShift]
  )

  return {
    getCellBackgroundStyle,
  }
}

