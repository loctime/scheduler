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
  homeMode?: boolean
}

export function DayCellContent({
  assignments,
  dayStatus,
  backgroundStyle,
  getShiftInfo,
  mediosTurnos = [],
  hasIncompleteAssignments = false,
  homeMode = false,
}: DayCellContentProps) {

  const incompleteClass = hasIncompleteAssignments
    ? "ring-2 ring-destructive/50 opacity-75"
    : ""

  const nonNoteAssignments = assignments.filter(a => a.type !== "nota")
  const noteAssignments = assignments.filter(a => a.type === "nota")

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
        <div
          className="absolute left-0 top-0 h-full flex flex-col items-start pt-[2px]"
        >
          {noteAssignments.map((assignment, idx) => (
            <div
              key={`nota-${idx}`}
              className="text-[7px] font-medium italic text-muted-foreground bg-white/90 dark:bg-gray-800/90 px-[2px] py-0 leading-none border-r border-border/40"
              title={assignment.texto || "Nota"}
            >
              {(assignment.texto || "Nota")
                .split("")
                .map((letter, letterIdx) => (
                  <div key={letterIdx} className="leading-none">
                    {letter}
                  </div>
                ))}
            </div>
          ))}
        </div>
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

        {dayStatus === "franco" && (
          <span className={francoClasses}>
            FRANCO
          </span>
        )}
      </div>
    </div>
  )
}
