"use client"

import React, { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { ShiftAssignment, Turno, MedioTurno, Separador } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { CellAssignments } from "./cell-assignments"
import { CellAssignmentsHome } from "./cell-assignments-home"

interface DayCellContentProps {
  assignments: ShiftAssignment[]
  dayStatus: "normal" | "franco" | "medio_franco"
  backgroundStyle?: CSSProperties
  getShiftInfo: (shiftId: string) => Turno | undefined
  mediosTurnos?: MedioTurno[]
  hasIncompleteAssignments?: boolean
  homeMode?: boolean
  sectors?: Separador[]
}

export function DayCellContent({
  assignments,
  dayStatus,
  backgroundStyle,
  getShiftInfo,
  mediosTurnos = [],
  hasIncompleteAssignments = false,
  homeMode = false,
  sectors = [],
}: DayCellContentProps) {

  const incompleteClass = hasIncompleteAssignments
    ? "ring-2 ring-destructive/50 opacity-75"
    : ""

  const nonNoteAssignments = assignments.filter(a => a.type !== "nota")
  const noteAssignments = assignments.filter(a => a.type === "nota")


  const sectorNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    sectors.forEach((sector) => map.set(sector.id, sector.nombre))
    return map
  }, [sectors])

  const sectorSlots = React.useMemo(() => {
    const base = assignments.find((a) => a.type === "shift" || a.type === "medio_franco")
    if (!base?.sectorSlots || base.sectorSlots.length === 0) return []
    return [...base.sectorSlots]
      .filter((slot) => slot.slot === 1 || slot.slot === 2)
      .sort((a, b) => a.slot - b.slot)
  }, [assignments])

  const hasCutShift = assignments.some((a) =>
    a.type === "shift" &&
    a.startTime &&
    a.endTime &&
    a.startTime2 &&
    a.endTime2
  )

  /*
    🔹 Reservamos espacio a la izquierda SOLO si hay nota
    🔹 Así nunca se superpone con el horario
  */
const leftPaddingForNote = noteAssignments.length > 0 ? "pl-[12px]" : ""
  const containerClasses = homeMode
    ? `relative flex flex-col gap-2 rounded w-full ${
        hasCutShift ? "min-h-[120px]" : "px-3 sm:px-4 md:px-5 py-2 sm:py-3 md:py-4"
      } ${leftPaddingForNote} ${incompleteClass}`
    : `relative flex flex-col gap-1.5 px-1 sm:px-1.5 md:px-2 py-1 sm:py-1.5 md:py-2 rounded min-h-[80px] w-full ${leftPaddingForNote} ${incompleteClass}` 

  const francoClasses = homeMode
    ? "text-center text-xl sm:text-2xl md:text-3xl font-bold block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-3 py-2 rounded"
    : "text-center text-base sm:text-lg md:text-xl lg:text-2xl font-bold block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded"

  return (
    <div className={containerClasses} style={backgroundStyle}>

      {/* 🔹 Nota lateral */}
      {noteAssignments.length > 0 && (
        <VerticalNote texto={noteAssignments[0].texto || "Nota"} />
      )}

      {/* 🔹 Contenido principal */}
      <div className="flex-1 min-h-0">
        {homeMode ? (
          <CellAssignmentsHome
            assignments={nonNoteAssignments}
            getShiftInfo={getShiftInfo}
            mediosTurnos={mediosTurnos}
          />
        ) : (
          <CellAssignments
            assignments={nonNoteAssignments}
            getShiftInfo={getShiftInfo}
            mediosTurnos={mediosTurnos}
          />
        )}

        {sectorSlots.length > 0 && (
          <div className="mt-1 flex items-center gap-1">
            {sectorSlots.map((slot) => (
              <Badge key={slot.slot} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {sectorNameById.get(slot.sectorId) || slot.sectorId}
              </Badge>
            ))}
          </div>
        )}

        {dayStatus === "franco" && (
          <span className={francoClasses}>
            FRANCO
          </span>
        )}
      </div>
    </div>
  )
}

function VerticalNote({ texto }: { texto: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState<string[][]>([])
  const [fontSize, setFontSize] = useState(12)

  useEffect(() => {
    if (!containerRef.current) return

    const containerHeight = containerRef.current.parentElement?.clientHeight || 0
    const words = texto.trim().split(/\s+/) // Dividir por espacios, múltiples palabras
    
    // Si es una sola palabra, ajustar tamaño de letra para que quepa
    if (words.length === 1) {
      const word = words[0]
      const maxLetterSize = Math.floor(containerHeight / word.length)
      
      // Limitar entre 14px y 24px para legibilidad (DEBUG)
      const optimalSize = Math.max(14, Math.min(24, maxLetterSize))
      setFontSize(optimalSize)
      
      // Una sola columna para la palabra completa
      setColumns([word.split("")])
    } else {
      // Múltiples palabras: usar tamaño estándar y múltiples columnas
      setFontSize(24) // DEBUG: Super grande
      
      const letterHeight = 24 + 2 // Ajustado para fontSize 24px
      const maxLettersPerColumn = Math.floor(containerHeight / letterHeight)
      
      const cols: string[][] = []
      let currentColumn: string[] = []
      
      words.forEach((word, wordIndex) => {
        // Calcular espacio necesario (palabra + espacio si no es primera)
        const spaceNeeded = word.length + (currentColumn.length > 0 ? 1 : 0)
        
        // Si la palabra cabe en la columna actual
        if (currentColumn.length + spaceNeeded <= maxLettersPerColumn) {
          // Agregar espacio si no es la primera palabra en la columna
          if (currentColumn.length > 0) {
            currentColumn.push(" ")
          }
          currentColumn.push(...word.split(""))
        } else {
          // Nueva columna para esta palabra
          if (currentColumn.length > 0) {
            cols.push(currentColumn)
          }
          currentColumn = word.split("")
        }
        
        // Última palabra: agregar la columna final
        if (wordIndex === words.length - 1 && currentColumn.length > 0) {
          cols.push(currentColumn)
        }
      })
      
      setColumns(cols)
    }
  }, [texto, fontSize])

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-0 h-full flex"
      style={{ width: "20px" }}
    >
      {columns.map((col, colIndex) => (
        <div key={colIndex} className="flex flex-col">
          {col.map((letter, i) => (
            <span
              key={i}
              className="font-bold font-medium italic text-foreground leading-none text-center w-[20px] !text-[16px]"
            >
              {letter}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
