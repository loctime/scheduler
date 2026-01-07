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
    const hasLicencia = assignments.some((a) => a.type === "licencia_embarazo")

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

          // Determinar si el medio franco es temprano o tarde
          const medioStart = assignment.startTime ? timeToMinutes(assignment.startTime) : null
          const isEarly = medioStart !== null && medioStart < 14 * 60

          if (hasTime) {
            if (hasShifts) {
              // Cuando hay turno, mostrar como bloque visual pequeño
              return (
                <div 
                  key={`medio-franco-${idx}`} 
                  className="w-full px-1 py-0.5 rounded text-center text-[10px] sm:text-xs md:text-sm font-bold mb-0.5"
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.2)", // green-500 con opacidad
                    color: "rgb(22, 163, 74)", // green-600
                  }}
                >
                  (1/2 Franco)
                </div>
              )
            } else {
              // Cuando es solo medio franco, mostrar como bloque visual apilado
              if (isEarly) {
                return (
                  <div key={`medio-franco-${idx}`} className="w-full space-y-0.5">
                    <div 
                      className="w-full px-1 py-0.5 rounded text-center text-[10px] sm:text-xs md:text-sm font-semibold"
                      style={{
                        backgroundColor: "rgba(34, 197, 94, 0.2)",
                        color: "rgb(22, 163, 74)",
                      }}
                    >
                      {displayTimeLines[0]}
                    </div>
                    <div 
                      className="w-full px-1 py-0.5 rounded text-center text-[10px] sm:text-xs md:text-sm font-bold"
                      style={{
                        backgroundColor: "rgba(34, 197, 94, 0.2)",
                        color: "rgb(22, 163, 74)",
                      }}
                    >
                      (1/2 Franco)
                    </div>
                  </div>
                )
              } else {
                return (
                  <div key={`medio-franco-${idx}`} className="w-full space-y-0.5">
                    <div 
                      className="w-full px-1 py-0.5 rounded text-center text-[10px] sm:text-xs md:text-sm font-bold"
                      style={{
                        backgroundColor: "rgba(34, 197, 94, 0.2)",
                        color: "rgb(22, 163, 74)",
                      }}
                    >
                      (1/2 Franco)
                    </div>
                    <div 
                      className="w-full px-1 py-0.5 rounded text-center text-[10px] sm:text-xs md:text-sm font-semibold"
                      style={{
                        backgroundColor: "rgba(34, 197, 94, 0.2)",
                        color: "rgb(22, 163, 74)",
                      }}
                    >
                      {displayTimeLines[0]}
                    </div>
                  </div>
                )
              }
            }
          } else {
            // Sin horario, mostrar como bloque simple
            return (
              <div 
                key={`medio-franco-${idx}`} 
                className="w-full px-1 py-0.5 rounded text-center text-[10px] sm:text-xs md:text-sm font-semibold mb-0.5"
                style={{
                  backgroundColor: "rgba(34, 197, 94, 0.2)",
                  color: "rgb(22, 163, 74)",
                }}
              >
                1/2 Franco
              </div>
            )
          }
        }

        if (assignment.type === "licencia_embarazo") {
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
                <span className="text-amber-600 dark:text-amber-400 font-bold text-[10px] sm:text-xs mr-1">LICENCIA</span>
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

        // Verificar si este tramo está cubierto por una licencia (para no duplicar el horario)
        const licenciaAssignments = assignments.filter(a => a.type === "licencia_embarazo")
        if (licenciaAssignments.length > 0) {
          // Verificar si este tramo de shift coincide exactamente con alguna licencia
          const shiftStartTime = assignment.startTime || shift.startTime || ""
          const shiftEndTime = assignment.endTime || shift.endTime || ""
          const shiftStartTime2 = assignment.startTime2 || shift.startTime2
          const shiftEndTime2 = assignment.endTime2 || shift.endTime2
          
          // Verificar si la primera franja coincide con alguna licencia
          if (shiftStartTime && shiftEndTime) {
            const matchesLicencia = licenciaAssignments.some(lic => 
              lic.startTime === shiftStartTime && lic.endTime === shiftEndTime
            )
            if (matchesLicencia) {
              // Si solo hay una franja y coincide con licencia, no renderizar
              if (!shiftStartTime2 || !shiftEndTime2) {
                return null
              }
              // Si hay segunda franja, solo mostrar esa
              const displayTimeLines = getShiftDisplayTime(assignment.shiftId || "", shift, {
                ...assignment,
                startTime: undefined,
                endTime: undefined,
              })
              if (displayTimeLines && displayTimeLines.length > 0 && displayTimeLines[0]) {
                return (
                  <div key={uniqueKey} className="w-full space-y-0.5">
                    {displayTimeLines.map((line, lineIdx) => (
                      <span key={lineIdx} className="block text-center text-xs sm:text-sm md:text-base font-semibold text-foreground mb-0.5">
                        {line}
                      </span>
                    ))}
                  </div>
                )
              }
              return null
            }
          }
          
          // Verificar si la segunda franja coincide con alguna licencia
          if (shiftStartTime2 && shiftEndTime2) {
            const matchesLicencia = licenciaAssignments.some(lic => 
              lic.startTime === shiftStartTime2 && lic.endTime === shiftEndTime2
            )
            if (matchesLicencia) {
              // Solo mostrar la primera franja
              const displayTimeLines = getShiftDisplayTime(assignment.shiftId || "", shift, {
                ...assignment,
                startTime2: undefined,
                endTime2: undefined,
              })
              if (displayTimeLines && displayTimeLines.length > 0 && displayTimeLines[0]) {
                return (
                  <div key={uniqueKey} className="w-full space-y-0.5">
                    {displayTimeLines.map((line, lineIdx) => (
                      <span key={lineIdx} className="block text-center text-xs sm:text-sm md:text-base font-semibold text-foreground mb-0.5">
                        {line}
                      </span>
                    ))}
                  </div>
                )
              }
              return null
            }
          }
        }

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

