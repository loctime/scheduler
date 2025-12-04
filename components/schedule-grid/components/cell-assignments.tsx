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

    // Ordenar asignaciones:
    // - Medio franco temprano (mañana): turno arriba, medio franco abajo
    // - Medio franco tarde (noche): medio franco arriba, turno abajo
    const hasMedioFranco = assignments.some((a) => a.type === "medio_franco")
    const hasShifts = assignments.some((a) => a.type === "shift" && a.shiftId)

    if (hasMedioFranco && hasShifts) {
      return [...assignments].sort((a, b) => {
        if (a.type === "medio_franco" && b.type !== "medio_franco") {
          const isEarly = a.startTime ? timeToMinutes(a.startTime) < 14 * 60 : true
          // Si es temprano, el turno va arriba (medio franco abajo)
          // Si es tarde, el medio franco va arriba
          return isEarly ? 1 : -1
        }
        if (b.type === "medio_franco" && a.type !== "medio_franco") {
          const isEarly = b.startTime ? timeToMinutes(b.startTime) < 14 * 60 : true
          // Si es temprano, el turno va arriba (medio franco abajo)
          // Si es tarde, el medio franco va arriba
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

          // Determinar si el medio franco es temprano o tarde
          const medioStart = assignment.startTime ? timeToMinutes(assignment.startTime) : null
          const isEarly = medioStart !== null && medioStart < 14 * 60

          if (hasTime) {
            if (hasShifts) {
              // Cuando hay turno, solo mostrar "(1/2 Franco)" sin horario
              return (
                <span key={`medio-franco-${idx}`} className="block text-center text-xs sm:text-sm md:text-base font-bold text-[#22c55e]">
                  (1/2 Franco)
                </span>
              )
            } else {
              // Cuando es solo medio franco, mostrar como turno cortado
              // Si es temprano: arriba el horario, abajo "(1/2 Franco)"
              // Si es tarde: arriba "(1/2 Franco)", abajo el horario
              if (isEarly) {
                return (
                  <div key={`medio-franco-${idx}`} className="text-center text-xs sm:text-sm md:text-base">
                    <span className="block font-semibold">{displayTimeLines[0]}</span>
                    <span className="block text-[10px] sm:text-xs md:text-sm font-bold text-[#22c55e]">(1/2 Franco)</span>
                  </div>
                )
              } else {
                return (
                  <div key={`medio-franco-${idx}`} className="text-center text-xs sm:text-sm md:text-base">
                    <span className="block text-[10px] sm:text-xs md:text-sm font-bold text-[#22c55e]">(1/2 Franco)</span>
                    <span className="block font-semibold">{displayTimeLines[0]}</span>
                  </div>
                )
              }
            }
          } else {
            return (
              <span key={`medio-franco-${idx}`} className="block text-center text-xs sm:text-sm md:text-base font-semibold">
                1/2 Franco
              </span>
            )
          }
        }

        const shift = getShiftInfo(assignment.shiftId || "")
        if (!shift) return null
        const displayTimeLines = getShiftDisplayTime(assignment.shiftId || "", shift, assignment)

        if (!displayTimeLines || displayTimeLines.length === 0 || (displayTimeLines.length === 1 && !displayTimeLines[0])) {
          return (
            <span key={assignment.shiftId} className="text-center text-xs sm:text-sm md:text-base font-semibold block">
              {shift.name}
            </span>
          )
        }

        return (
          <div key={assignment.shiftId} className="text-center text-xs sm:text-sm md:text-base">
            {displayTimeLines.map((line, lineIdx) => (
              <span key={lineIdx} className="block font-semibold">
                {line}
              </span>
            ))}
          </div>
        )
      })}
    </>
  )
}

