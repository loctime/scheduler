"use client"

import React, { useMemo } from "react"
import { ShiftAssignment, Turno, MedioTurno } from "@/lib/types"
import { getShiftDisplayTime } from "../utils/shift-display-utils"
import { timeToMinutes } from "../utils/schedule-grid-utils"

interface CellAssignmentsHomeProps {
  assignments: ShiftAssignment[]
  getShiftInfo: (shiftId: string) => Turno | undefined
  mediosTurnos?: MedioTurno[]
}

/**
 * Versión especial de CellAssignments para el Home del PWA.
 * Tipografía mucho más grande y espaciado optimizado.
 */
export function CellAssignmentsHome({ assignments, getShiftInfo, mediosTurnos = [] }: CellAssignmentsHomeProps) {
  const orderedAssignments = useMemo(() => {
    if (assignments.length === 0) return []

    const hasMedioFranco = assignments.some((a) => a.type === "medio_franco")
    const hasShifts = assignments.some((a) => a.type === "shift" && a.shiftId)
    const hasLicencia = assignments.some((a) => a.type === "licencia")

    if (hasLicencia && hasShifts) {
      return [...assignments].sort((a, b) => {
        const getStartTime = (assignment: ShiftAssignment): number => {
          if (assignment.startTime) return timeToMinutes(assignment.startTime)
          if (assignment.startTime2) return timeToMinutes(assignment.startTime2)
          return Infinity
        }

        const aStart = getStartTime(a)
        const bStart = getStartTime(b)

        if (aStart !== Infinity && bStart !== Infinity) {
          return aStart - bStart
        }

        return 0
      })
    }

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
    return <span className="text-center text-2xl sm:text-3xl md:text-4xl text-muted-foreground font-medium">-</span>
  }

  return (
    <>
      {orderedAssignments.map((assignment, idx) => {
        if (assignment.type === "nota") {
          return (
            <span key={`nota-${idx}`} className="text-center text-lg sm:text-xl md:text-2xl font-medium italic text-muted-foreground block">
              {assignment.texto || "Nota"}
            </span>
          )
        }

        if (assignment.type === "franco") {
          return (
            <span key={`franco-${idx}`} className="text-center text-xl sm:text-2xl md:text-3xl font-bold block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-3 py-2 rounded">
              FRANCO
            </span>
          )
        }

        if (assignment.type === "medio_franco") {
          const shift = assignment.shiftId ? getShiftInfo(assignment.shiftId) : undefined
          const displayTimeLines = getShiftDisplayTime(assignment.shiftId || "", shift, assignment)
          const hasTime = assignment.startTime && assignment.endTime
          const medioTurnoMatch = assignment.startTime && assignment.endTime
            ? mediosTurnos.find((medio) => medio.startTime === assignment.startTime && medio.endTime === assignment.endTime)
            : undefined

          if (hasTime) {
            const timeText = displayTimeLines[0] || `${assignment.startTime} - ${assignment.endTime}`
            const medioTurnoColor = medioTurnoMatch?.color || shift?.color || '#10b981'
            
            return (
              <div key={`medio-franco-${idx}`} className="w-full space-y-1">
                <div 
                  className="text-center text-2xl sm:text-3xl md:text-4xl font-semibold text-white px-2 py-1 rounded"
                  style={{ backgroundColor: medioTurnoColor }}
                >
                  {timeText}
                </div>
                <span className="block text-center text-lg sm:text-xl md:text-2xl font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-3 py-2 rounded">
                  1/2 FRANCO
                </span>
              </div>
            )
          } else {
            return (
              <span 
                key={`medio-franco-${idx}`} 
                className="block text-center text-xl sm:text-2xl md:text-3xl font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-3 py-2 rounded"
              >
                1/2 FRANCO
              </span>
            )
          }
        }

        if (assignment.type === "licencia") {
          const displayTimeLines = getShiftDisplayTime("", undefined, assignment)
          const hasTime = assignment.startTime && assignment.endTime
          
          if (hasTime) {
            const timeText = displayTimeLines[0] || `${assignment.startTime} - ${assignment.endTime}`
            
            return (
              <span 
                key={`licencia-embarazo-${idx}`} 
                className="block text-center text-lg sm:text-xl md:text-2xl font-semibold mb-1"
              >
                <span className="text-amber-600 dark:text-amber-400 font-bold text-sm sm:text-base mr-1">Lic.</span>
                <span className="text-foreground mx-1">·</span>
                <span className="text-foreground font-semibold">{timeText}</span>
              </span>
            )
          } else {
            return (
              <span key={`licencia-embarazo-${idx}`} className="block text-center text-xl sm:text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                LICENCIA EMBARAZO
              </span>
            )
          }
        }

        // Horario especial
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
            <div key={`horario-especial-${idx}`} className="text-center text-2xl sm:text-3xl md:text-4xl">
              {timeDisplay.map((line, lineIdx) => (
                <span key={lineIdx} className="block font-semibold text-primary">
                  {line}
                </span>
              ))}
            </div>
          )
        }

        // Turnos normales - TIPOGRAFÍA MUY GRANDE
        const shift = getShiftInfo(assignment.shiftId || "")
        const uniqueKey = `${assignment.shiftId}-${idx}-${assignment.startTime || ''}-${assignment.endTime || ''}-${assignment.startTime2 || ''}-${assignment.endTime2 || ''}`
        const displayTimeLines = getShiftDisplayTime(assignment.shiftId || "", shift, assignment)

        // Detectar si es turno cortado (tiene dos franjas)
        const isCutShift = !!(assignment.startTime && assignment.endTime && assignment.startTime2 && assignment.endTime2)

        // Si es turno cortado, dividir en dos mitades
        if (isCutShift && displayTimeLines.length >= 2) {
          return (
            <div key={uniqueKey} className="w-full h-full flex flex-col absolute inset-0">
              {/* Primera mitad (arriba) - 50% altura */}
              <div className="flex-1 flex items-center justify-center">
                <span className={`text-center text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-foreground`}>
                  {displayTimeLines[0]}
                </span>
              </div>
              {/* Segunda mitad (abajo) - 50% altura */}
              <div className="flex-1 flex items-center justify-center">
                <span className={`text-center text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-foreground`}>
                  {displayTimeLines[1]}
                </span>
              </div>
            </div>
          )
        }

        // Turno normal (una sola franja)
        return (
          <div key={uniqueKey} className="w-full space-y-1">
            {displayTimeLines.map((line, lineIdx) => {
              const isIncomplete = line === "Horario incompleto"
              return (
                <span 
                  key={lineIdx} 
                  className={`block text-center text-2xl sm:text-3xl md:text-4xl font-semibold mb-1 tabular-nums ${
                    isIncomplete 
                      ? "text-amber-600 dark:text-amber-400 italic" 
                      : "text-foreground"
                  }`}
                >
                  {line}
                </span>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
