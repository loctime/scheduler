"use client"

import React from "react"
import type { CSSProperties } from "react"
import { ShiftAssignment, Turno, MedioTurno } from "@/lib/types"
import { CellAssignments } from "./cell-assignments"
import { CellAssignmentsHome } from "./cell-assignments-home"

interface DayCellContentProps {
  assignments: ShiftAssignment[]
  dayStatus: "normal" | "franco" | "medio_franco"
  backgroundStyle?: CSSProperties
  getShiftInfo: (shiftId: string) => Turno | undefined
  mediosTurnos?: MedioTurno[]
  hasIncompleteAssignments?: boolean
  /** Modo Home: tipografía más grande y padding reducido */
  homeMode?: boolean
}

/**
 * Componente puro que renderiza el contenido visual de una celda del calendario.
 * 
 * Incluye:
 * - Render de bloques de turno (CellAssignments)
 * - Estado FRANCO
 * - Colores de fondo
 * - Indicador de incompletitud si aplica
 * - Layout visual completo
 * 
 * NO incluye:
 * - quickShifts
 * - menús contextuales
 * - handlers de escritura
 * - scheduleId
 * - edición
 */
export function DayCellContent({
  assignments,
  dayStatus,
  backgroundStyle,
  getShiftInfo,
  mediosTurnos = [],
  hasIncompleteAssignments = false,
  homeMode = false,
}: DayCellContentProps) {
  const incompleteClass = hasIncompleteAssignments ? "ring-2 ring-destructive/50 opacity-75" : ""

  // Detectar si hay turno cortado (necesita altura mínima para mostrar gradiente)
  const hasCutShift = assignments.some((a) => 
    a.type === "shift" && 
    a.startTime && 
    a.endTime && 
    a.startTime2 && 
    a.endTime2
  )

  // Estilos diferentes para modo Home vs calendario
  // En modo Home, si hay turno cortado, necesitamos altura mínima para el gradiente
  // Sin padding cuando hay turno cortado para que el contenido ocupe toda la celda
  const containerClasses = homeMode
    ? `flex flex-col gap-2 relative rounded w-full ${hasCutShift ? 'min-h-[120px] p-0' : 'px-3 sm:px-4 md:px-5 py-2 sm:py-3 md:py-4'} ${incompleteClass}`
    : `flex flex-col gap-1.5 relative px-1 sm:px-1.5 md:px-2 py-1 sm:py-1.5 md:py-2 rounded min-h-[80px] w-full ${incompleteClass}`

  const francoClasses = homeMode
    ? "text-center text-xl sm:text-2xl md:text-3xl font-bold block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-3 py-2 rounded"
    : "text-center text-base sm:text-lg md:text-xl lg:text-2xl font-bold block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded"

  return (
    <div 
      className={containerClasses}
      style={backgroundStyle}
    >
      {homeMode ? (
        <CellAssignmentsHome 
          assignments={assignments} 
          getShiftInfo={getShiftInfo} 
          mediosTurnos={mediosTurnos} 
        />
      ) : (
        <CellAssignments 
          assignments={assignments} 
          getShiftInfo={getShiftInfo} 
          mediosTurnos={mediosTurnos} 
        />
      )}
      {dayStatus === "franco" && (
        <span className={francoClasses}>
          FRANCO
        </span>
      )}
    </div>
  )
}
