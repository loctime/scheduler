"use client"

import React from "react"
import type { CSSProperties } from "react"
import { ShiftAssignment, Turno, MedioTurno } from "@/lib/types"
import { CellAssignments } from "./cell-assignments"

interface DayCellContentProps {
  assignments: ShiftAssignment[]
  dayStatus: "normal" | "franco" | "medio_franco"
  backgroundStyle?: CSSProperties
  getShiftInfo: (shiftId: string) => Turno | undefined
  mediosTurnos?: MedioTurno[]
  hasIncompleteAssignments?: boolean
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
}: DayCellContentProps) {
  const incompleteClass = hasIncompleteAssignments ? "ring-2 ring-destructive/50 opacity-75" : ""

  return (
    <div 
      className={`flex flex-col gap-1.5 relative px-1 sm:px-1.5 md:px-2 py-1 sm:py-1.5 md:py-2 rounded min-h-[80px] w-full ${incompleteClass}`}
      style={{
        ...backgroundStyle,
        // Asegurar que el fondo sea visible incluso si el estilo tiene baja opacidad
        minHeight: '80px',
      }}
    >
      <CellAssignments 
        assignments={assignments} 
        getShiftInfo={getShiftInfo} 
        mediosTurnos={mediosTurnos} 
      />
      {dayStatus === "franco" && (
        <span className="text-center text-xs sm:text-sm md:text-base font-bold block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">
          FRANCO
        </span>
      )}
    </div>
  )
}
