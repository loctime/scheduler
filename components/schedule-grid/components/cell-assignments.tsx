"use client"

import React, { useMemo } from "react"
import { ShiftAssignment, Turno, MedioTurno } from "@/lib/types"
import { getShiftDisplayTime } from "../utils/shift-display-utils"
import { timeToMinutes } from "../utils/schedule-grid-utils"

interface CellAssignmentsProps {
  assignments: ShiftAssignment[]
  getShiftInfo: (shiftId: string) => Turno | undefined
  mediosTurnos?: MedioTurno[]
}

export function CellAssignments({ assignments, getShiftInfo, mediosTurnos = [] }: CellAssignmentsProps) {
  const orderedAssignments = useMemo(() => {
    if (assignments.length === 0) return []

    // Ordenar asignaciones por tipo y horario:
    // 1. Turnos (shifts) ordenados por hora de inicio
    // 2. Licencia embarazo
    // 3. Medio franco
    // 4. Francos
    // 5. Otros (horarios especiales)
    // 6. Notas (siempre al final)

    const hasMedioFranco = assignments.some((a) => a.type === "medio_franco")
    const hasShifts = assignments.some((a) => a.type === "shift" && a.shiftId)
    const hasLicencia = assignments.some((a) => a.type === "licencia")

    // Si hay licencia y turnos, ordenar por horario (excepto notas)
    if (hasLicencia && hasShifts) {
      return [...assignments].sort((a, b) => {
        // Las notas siempre van al final
        if (a.type === "nota" && b.type !== "nota") return 1
        if (b.type === "nota" && a.type !== "nota") return -1
        
        const getStartTime = (assignment: ShiftAssignment): number => {
          if (assignment.startTime) return timeToMinutes(assignment.startTime)
          if (assignment.startTime2) return timeToMinutes(assignment.startTime2)
          return Infinity
        }

        const aStart = getStartTime(a)
        const bStart = getStartTime(b)

        if (aStart === Infinity && bStart === Infinity) return 0
        if (aStart === Infinity) return 1
        if (bStart === Infinity) return -1

        return aStart - bStart
      })
    }

    // Ordenamiento por defecto (notas al final)
    return [...assignments].sort((a, b) => {
      // Las notas siempre van al final
      if (a.type === "nota" && b.type !== "nota") return 1
      if (b.type === "nota" && a.type !== "nota") return -1
      
      // Para los demás tipos, mantener orden existente
      return 0
    })
  }, [assignments])

  if (assignments.length === 0) {
    return <span className="text-center text-lg sm:text-xl md:text-2xl text-muted-foreground font-medium">-</span>
  }

  const hasShifts = assignments.some((a) => a.type === "shift" && a.shiftId)

  return (
    <>
      {orderedAssignments.map((assignment, idx) => {
        if (assignment.type === "nota") {
          return (
            <div key={`nota-${idx}`} className="w-full flex items-center justify-center">
              <span className="text-center text-base sm:text-lg md:text-xl font-medium italic text-muted-foreground block">
                {assignment.texto || "Nota"}
              </span>
            </div>
          )
        }

        if (assignment.type === "franco") {
          return (
            <span key={`franco-${idx}`} className="text-center text-base sm:text-lg md:text-xl font-bold block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">
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
            // Crear un assignment virtual para el medio turno con color
            const timeText = displayTimeLines[0] || `${assignment.startTime} - ${assignment.endTime}`
            const medioTurnoColor = medioTurnoMatch?.color || shift?.color || '#10b981' // Color verde por defecto para medios turnos
            
            return (
              <div key={`medio-franco-${idx}`} className="w-full space-y-0.5">
                {/* Medio turno con su color */}
                <div 
                  className="text-center text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-white px-1 py-0.5 rounded flex items-center justify-center"
                  style={{ backgroundColor: medioTurnoColor }}
                >
                  {timeText}
                </div>
                {/* 1/2 FRANCO con fondo verde */}
                <span className="block text-center text-base sm:text-lg md:text-xl lg:text-2xl font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded flex items-center justify-center">
                  1/2 FRANCO
                </span>
              </div>
            )
          } else {
            // Sin horario, mostrar solo 1/2 FRANCO
            return (
              <span 
                key={`medio-franco-${idx}`} 
                className="block text-center text-base sm:text-lg md:text-xl lg:text-2xl font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded flex items-center justify-center"
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
            // Renderizar solo texto, sin recuadros
            // Agregar marca "LICENCIA ·" antes del horario
            const timeText = displayTimeLines[0] || `${assignment.startTime} - ${assignment.endTime}`
            
            return (
              <span 
                key={`licencia-embarazo-${idx}`} 
                className="block text-center text-base sm:text-lg md:text-xl lg:text-2xl font-semibold mb-0.5"
              >
                <span className="text-amber-600 dark:text-amber-400 font-bold text-[10px] sm:text-xs mr-1">Lic.</span>
                <span className="text-foreground mx-1">·</span>
                <span className="text-foreground font-semibold">{timeText}</span>
              </span>
            )
          } else {
            // Sin horario, mostrar solo texto simple
            return (
              <span key={`licencia-embarazo-${idx}`} className="block text-center text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-amber-600 dark:text-amber-400 mb-0.5">
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
            <div key={`horario-especial-${idx}`} className="text-center text-base sm:text-lg md:text-xl lg:text-2xl">
              {timeDisplay.map((line, lineIdx) => (
                <span key={lineIdx} className="block font-semibold text-primary">
                  {line}
                </span>
              ))}
            </div>
          )
        }

        // CONTRATO v1.0: El turno base NO se usa para render
        // Solo se obtiene para referencia, pero el display viene del assignment
        const shift = getShiftInfo(assignment.shiftId || "")

        // Crear key única para cada assignment (puede haber múltiples segmentos del mismo turno)
        const uniqueKey = `${assignment.shiftId}-${idx}-${assignment.startTime || ''}-${assignment.endTime || ''}-${assignment.startTime2 || ''}-${assignment.endTime2 || ''}`

        // CONTRATO v1.0: Renderizar turnos usando SOLO datos del assignment
        // getShiftDisplayTime ya maneja el caso de horario incompleto
        const displayTimeLines = getShiftDisplayTime(assignment.shiftId || "", shift, assignment)

        // Detectar si es turno cortado (tiene dos franjas)
        const isCutShift = !!(assignment.startTime && assignment.endTime && assignment.startTime2 && assignment.endTime2)

        // Si es turno cortado, dividir en dos mitades
        if (isCutShift && displayTimeLines.length >= 2) {
          return (
            <div key={uniqueKey} className="w-full h-full flex flex-col absolute inset-0">
              {/* Primera mitad (arriba) - 50% altura */}
              <div className="flex-1 flex items-center justify-center">
                <span className={`text-center text-base sm:text-lg md:text-xl lg:text-2xl font-semibold tabular-nums text-foreground`}>
                  {displayTimeLines[0]}
                </span>
              </div>
              {/* Segunda mitad (abajo) - 50% altura */}
              <div className="flex-1 flex items-center justify-center">
                <span className={`text-center text-base sm:text-lg md:text-xl lg:text-2xl font-semibold tabular-nums text-foreground`}>
                  {displayTimeLines[1]}
                </span>
              </div>
            </div>
          )
        }

        // Renderizar horarios desde el assignment (puede incluir "Horario incompleto")
        return (
          <div key={uniqueKey} className="w-full space-y-0.5">
            {displayTimeLines.map((line, lineIdx) => {
              // Si es "Horario incompleto", usar estilo de advertencia
              const isIncomplete = line === "Horario incompleto"
              return (
                <span 
                  key={lineIdx} 
                  className={`block text-center text-base sm:text-lg md:text-xl lg:text-2xl font-semibold tabular-nums mb-0.5 flex items-center justify-center ${
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
