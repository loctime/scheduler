"use client"

import React, { useMemo } from "react"
import { ShiftAssignment, Turno } from "@/lib/types"
import { getShiftDisplayTime } from "../utils/shift-display-utils"
import { timeToMinutes } from "../utils/schedule-grid-utils"

interface CellAssignmentsProps {
  assignments: ShiftAssignment[]
  getShiftInfo: (shiftId: string) => Turno | undefined
}

export function CellAssignments({ assignments, getShiftInfo }: CellAssignmentsProps) {
  const orderedAssignments = useMemo(() => {
    if (assignments.length === 0) return []

    // Ordenar asignaciones por horario:
    // 1. Turnos (shifts) ordenados por hora de inicio
    // 2. Licencia embarazo
    // 3. Medio franco
    // 4. Otros (francos, notas)

    const hasMedioFranco = assignments.some((a) => a.type === "medio_franco")
    const hasShifts = assignments.some((a) => a.type === "shift" && a.shiftId)
    const hasLicencia = assignments.some((a) => a.type === "licencia")

    // Si hay licencia y turnos, ordenar por horario
    if (hasLicencia && hasShifts) {
      return [...assignments].sort((a, b) => {
        const getStartTime = (assignment: ShiftAssignment): number => {
          if (assignment.startTime) return timeToMinutes(assignment.startTime)
          if (assignment.startTime2) return timeToMinutes(assignment.startTime2)
          return Infinity
        }

        const aStart = getStartTime(a)
        const bStart = getStartTime(b)

        // Si ambos tienen horario, ordenar por hora de inicio
        if (aStart !== Infinity && bStart !== Infinity) {
          return aStart - bStart
        }

        // Mantener orden relativo si no tienen horario
        return 0
      })
    }

    // Lógica original para medio franco
    if (hasMedioFranco && hasShifts) {
      return [...assignments].sort((a, b) => {
        if (a.type === "medio_franco" && b.type !== "medio_franco") {
          const isEarly = a.startTime ? timeToMinutes(a.startTime) < 14 * 60 : true
          return isEarly ? 1 : -1
        }
        if (b.type === "medio_franco" && a.type !== "medio_franco") {
          const isEarly = b.startTime ? timeToMinutes(b.startTime) < 14 * 60 : true
          return isEarly ? -1 : 1
        }
        return 0
      })
    }

    return assignments
  }, [assignments])

  if (assignments.length === 0) {
    return <span className="text-center text-sm sm:text-base md:text-lg text-muted-foreground font-medium">-</span>
  }

  const hasShifts = assignments.some((a) => a.type === "shift" && a.shiftId)

  return (
    <>
      {orderedAssignments.map((assignment, idx) => {
        if (assignment.type === "nota") {
          return (
            <span key={`nota-${idx}`} className="text-center text-xs sm:text-sm md:text-base font-medium italic text-muted-foreground block">
              {assignment.texto || "Nota"}
            </span>
          )
        }

        if (assignment.type === "franco") {
          return (
            <span key={`franco-${idx}`} className="text-center text-xs sm:text-sm md:text-base font-bold block">
              FRANCO
            </span>
          )
        }

        if (assignment.type === "medio_franco") {
          const shift = assignment.shiftId ? getShiftInfo(assignment.shiftId) : undefined
          const displayTimeLines = getShiftDisplayTime(assignment.shiftId || "", shift, assignment)
          const hasTime = assignment.startTime && assignment.endTime

          if (hasTime) {
            if (hasShifts) {
              // Cuando hay turno, mostrar solo texto
              return (
                <span 
                  key={`medio-franco-${idx}`} 
                  className="block text-center text-xs sm:text-sm md:text-base font-bold text-[#22c55e] mb-0.5"
                >
                  (1/2 Franco)
                </span>
              )
            } else {
              // Cuando es solo medio franco, mostrar horario y texto
              const timeText = displayTimeLines[0] || `${assignment.startTime} - ${assignment.endTime}`
              return (
                <div key={`medio-franco-${idx}`} className="w-full space-y-0.5">
                  <span className="block text-center text-xs sm:text-sm md:text-base font-semibold text-foreground mb-0.5">
                    {timeText}
                  </span>
                  <span className="block text-center text-xs sm:text-sm md:text-base font-bold text-[#22c55e] mb-0.5">
                    1/2 Franco
                  </span>
                </div>
              )
            }
          } else {
            // Sin horario, mostrar solo texto
            return (
              <span 
                key={`medio-franco-${idx}`} 
                className="block text-center text-xs sm:text-sm md:text-base font-bold text-[#22c55e] mb-0.5"
              >
                1/2 Franco
              </span>
            )
          }
        }

        if (assignment.type === "licencia") {
          const displayTimeLines = getShiftDisplayTime("", undefined, assignment)
          const hasTime = assignment.startTime && assignment.endTime
          
          if (hasTime) {
            // Renderizar solo texto, sin recuadros
            // Agregar marca "LICENCIA ·" antes del horario
            const timeText = displayTimeLines[0] || `${assignment.startTime} - ${assignment.endTime}`
            
            return (
              <span 
                key={`licencia-embarazo-${idx}`} 
                className="block text-center text-xs sm:text-sm md:text-base font-semibold mb-0.5"
              >
                <span className="text-amber-600 dark:text-amber-400 font-bold text-[10px] sm:text-xs mr-1">Lic.</span>
                <span className="text-foreground mx-1">·</span>
                <span className="text-foreground font-semibold">{timeText}</span>
              </span>
            )
          } else {
            // Sin horario, mostrar solo texto simple
            return (
              <span key={`licencia-embarazo-${idx}`} className="block text-center text-xs sm:text-sm md:text-base font-bold text-amber-600 dark:text-amber-400 mb-0.5">
                LICENCIA EMBARAZO
              </span>
            )
          }
        }

        // Manejar horario especial (sin shiftId pero con startTime/endTime)
        if (assignment.type === "shift" && !assignment.shiftId && (assignment.startTime || assignment.endTime)) {
          const timeDisplay = []
          if (assignment.startTime && assignment.endTime) {
            timeDisplay.push(`${assignment.startTime} - ${assignment.endTime}`)
          } else if (assignment.startTime) {
            timeDisplay.push(`Desde ${assignment.startTime}`)
          } else if (assignment.endTime) {
            timeDisplay.push(`Hasta ${assignment.endTime}`)
          }
          
          if (assignment.texto) {
            timeDisplay.push(assignment.texto)
          }

          return (
            <div key={`horario-especial-${idx}`} className="text-center text-xs sm:text-sm md:text-base">
              {timeDisplay.map((line, lineIdx) => (
                <span key={lineIdx} className="block font-semibold text-primary">
                  {line}
                </span>
              ))}
            </div>
          )
        }

        const shift = getShiftInfo(assignment.shiftId || "")
        if (!shift) return null

        // Crear key única para cada assignment (puede haber múltiples segmentos del mismo turno)
        const uniqueKey = `${assignment.shiftId}-${idx}-${assignment.startTime || ''}-${assignment.endTime || ''}-${assignment.startTime2 || ''}-${assignment.endTime2 || ''}`

        // Renderizar turnos normales (incluye turnos cortados) - solo texto, sin recuadros
        const displayTimeLines = getShiftDisplayTime(assignment.shiftId || "", shift, assignment)

        if (!displayTimeLines || displayTimeLines.length === 0 || (displayTimeLines.length === 1 && !displayTimeLines[0])) {
          // Sin horario, mostrar nombre del turno
          return (
            <span 
              key={uniqueKey} 
              className="block text-center text-xs sm:text-sm md:text-base font-semibold text-foreground mb-0.5"
            >
              {shift.name}
            </span>
          )
        }

        // Renderizar solo texto, sin recuadros - texto negro bien visible
        return (
          <div key={uniqueKey} className="w-full space-y-0.5">
            {displayTimeLines.map((line, lineIdx) => (
              <span 
                key={lineIdx} 
                className="block text-center text-xs sm:text-sm md:text-base font-semibold text-foreground mb-0.5"
              >
                {line}
              </span>
            ))}
          </div>
        )
      })}
    </>
  )
}

