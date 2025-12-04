"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Turno, ShiftAssignment, MedioTurno } from "@/lib/types"

type SelectionMode = "none" | "franco" | "turno" | "medio_franco"

interface QuickShiftSelectorProps {
  shifts: Turno[]
  mediosTurnos?: MedioTurno[]
  onSelectAssignments: (assignments: ShiftAssignment[]) => void
  onUndo?: () => void
  onToggleFixed?: () => void
  isManuallyFixed?: boolean
  hasCellHistory?: boolean
  readonly?: boolean
}

export function QuickShiftSelector({
  shifts,
  mediosTurnos = [],
  onSelectAssignments,
  onUndo,
  onToggleFixed,
  isManuallyFixed = false,
  hasCellHistory = false,
  readonly = false,
}: QuickShiftSelectorProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("turno")
  const [medioFrancoTime, setMedioFrancoTime] = useState({ startTime: "", endTime: "" })

  const resetMode = () => {
    setSelectionMode("none")
    setMedioFrancoTime({ startTime: "", endTime: "" })
  }

  const handleFranco = () => {
    onSelectAssignments([{ type: "franco" }])
    resetMode()
  }

  const handleTurno = (shift: Turno) => {
    onSelectAssignments([{ type: "shift", shiftId: shift.id }])
    resetMode()
  }

  const handleTurnoMode = () => {
    if (shifts.length === 1) return handleTurno(shifts[0])
    if (shifts.length === 0) return
    setSelectionMode(selectionMode === "turno" ? "none" : "turno")
  }

  const handleMedioFranco = (time?: { startTime: string; endTime: string }) => {
    if (mediosTurnos.length === 1 && !time) {
      onSelectAssignments([
        {
          type: "medio_franco",
          startTime: mediosTurnos[0].startTime,
          endTime: mediosTurnos[0].endTime,
        },
      ])
      resetMode()
      return
    }

    if (time?.startTime && time?.endTime) {
      onSelectAssignments([{ type: "medio_franco", startTime: time.startTime, endTime: time.endTime }])
      resetMode()
      return
    }

    setSelectionMode(selectionMode === "medio_franco" ? "none" : "medio_franco")
  }

  const handleMedioFrancoTimeChange = (field: "startTime" | "endTime", value: string) => {
    const next = { ...medioFrancoTime, [field]: value }
    setMedioFrancoTime(next)
    if (next.startTime && next.endTime) handleMedioFranco(next)
  }

  // Calcular altura disponible para turnos
  const turnosHeight = selectionMode === "turno" && shifts.length > 0 ? 50 : 0
  const medioFrancoHeight = selectionMode === "medio_franco" ? 50 : 0
  const mainContentHeight = 100 - turnosHeight - medioFrancoHeight

  return (
    <div
      className="flex flex-col h-full w-full p-0 m-0"
      onClick={(e) => e.stopPropagation()}
      data-quick-selector="true"
    >
      {/* CONTENIDO PRINCIPAL - 40% (30% franco/turno + 10% 1/2 franco) */}
      <div className="flex flex-col p-0 m-0" style={{ height: `${mainContentHeight}%` }}>
        {/* FRANCO / TURNO - 30% (50%-50% cada uno) */}
        <div className="h-[75%] flex gap-0 p-0 m-0">
          <Button
            type="button"
            variant={selectionMode === "franco" ? "default" : "outline"}
            className="h-full w-1/2 text-lg sm:text-xl font-bold rounded-none border-r-0"
            style={{
              backgroundColor: "#10b981",
              color: "#ffffff",
            }}
            onClick={(e) => {
              e.stopPropagation()
              handleFranco()
            }}
          >
            FRANCO
          </Button>

          <Button
            type="button"
            variant={selectionMode === "turno" ? "default" : "outline"}
            className="h-full w-1/2 text-lg sm:text-xl font-bold rounded-none"
            disabled={shifts.length === 0}
            onClick={(e) => {
              e.stopPropagation()
              handleTurnoMode()
            }}
          >
            TURNO
          </Button>
        </div>

        {/* 1/2 FRANCO - 10% */}
        <Button
          type="button"
          variant={selectionMode === "medio_franco" ? "default" : "outline"}
          className="h-[25%] w-full text-sm font-semibold rounded-none"
          onClick={(e) => {
            e.stopPropagation()
            handleMedioFranco()
          }}
        >
          1/2 FRANCO
        </Button>
      </div>

      {/* TURNOS - 50% (máximo 3 por fila) */}
      {selectionMode === "turno" && shifts.length > 0 && (
        <div className="h-[50%] flex flex-wrap gap-2 p-2 m-0 overflow-y-auto">
          {shifts.map((shift, index) => (
            <Button
              key={shift.id}
              type="button"
              variant="outline"
              className="h-1/2 flex-[0_0_calc(33.333%-0.5rem)] text-sm font-semibold flex items-center justify-center rounded-md border-2 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 px-1"
              style={{ 
                backgroundColor: shift.color,
                color: '#ffffff',
                borderColor: shift.color
              }}
              onClick={(e) => {
                e.stopPropagation()
                handleTurno(shift)
              }}
            >
              <span className="text-center truncate">
                {shift.name.length > 6 ? shift.name.substring(0, 6) : shift.name}
              </span>
            </Button>
          ))}
        </div>
      )}

      {/* MEDIO FRANCO - 50% */}
      {selectionMode === "medio_franco" && (
        <div className="h-[50%] flex flex-col gap-2 p-2 m-0">
          {/* Opciones predefinidas */}
          {mediosTurnos.length > 0 && (
            <div className="flex flex-wrap gap-2 flex-1">
              {mediosTurnos.map((medio, index) => (
                <Button
                  key={medio.id}
                  type="button"
                  variant="outline"
                  className="flex-1 min-w-[calc(50%-0.5rem)] text-sm font-semibold rounded-md border-2 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
                  style={{ 
                    backgroundColor: medio.color || '#10b981',
                    color: '#ffffff',
                    borderColor: medio.color || '#10b981'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMedioFranco({
                      startTime: medio.startTime,
                      endTime: medio.endTime,
                    })
                  }}
                >
                  {medio.nombre || "1/2 Franco"}
                </Button>
              ))}
            </div>
          )}

          {/* Inputs personalizados */}
          <div className="flex gap-2 flex-1">
            <Input
              type="time"
              className="h-full flex-1 rounded-md text-sm"
              placeholder="Inicio"
              value={medioFrancoTime.startTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleMedioFrancoTimeChange("startTime", e.target.value)}
            />
            <Input
              type="time"
              className="h-full flex-1 rounded-md text-sm"
              placeholder="Fin"
              value={medioFrancoTime.endTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleMedioFrancoTimeChange("endTime", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
