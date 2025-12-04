"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, RotateCcw } from "lucide-react"
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
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("none")
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

  return (
    <div
      className="flex flex-col gap-2 px-2 pb-2 pt-0 min-w-[220px]"
      onClick={(e) => e.stopPropagation()}
      data-quick-selector="true"
    >
      {/* HEADER --------------------------------------------------- */}
      {!readonly && (hasCellHistory || onToggleFixed) && (
        <div className="flex items-center justify-center gap-1 border-b pb-0.5 -mx-2 px-2">
          {hasCellHistory && onUndo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={(e) => {
                e.stopPropagation()
                onUndo()
              }}
              title="Deshacer"
              aria-label="Deshacer cambio"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}

          {onToggleFixed && (
            <Button
              type="button"
              variant={isManuallyFixed ? "default" : "outline"}
              size="sm"
              className="h-5 w-5 p-0"
              onClick={(e) => {
                e.stopPropagation()
                onToggleFixed()
              }}
              title={isManuallyFixed ? "Desbloquear horario" : "Bloquear horario"}
              aria-label={isManuallyFixed ? "Desbloquear horario" : "Bloquear horario"}
            >
              <Lock className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* BLOQUES PRINCIPALES -------------------------------------- */}
      <div className="flex flex-col gap-2 border-b pb-3">
        {/* FRANCO / TURNO */}
        <div className="grid grid-cols-2 gap-1">
          <Button
            type="button"
            variant={selectionMode === "franco" ? "default" : "outline"}
            className="h-12 text-base font-bold px-6"
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
            className="h-12 text-base font-bold px-6"
            disabled={shifts.length === 0}
            onClick={(e) => {
              e.stopPropagation()
              handleTurnoMode()
            }}
          >
            TURNO
          </Button>
        </div>

        {/* 1/2 FRANCO */}
        <Button
          type="button"
          variant={selectionMode === "medio_franco" ? "default" : "outline"}
          className="h-10 text-base font-semibold w-full"
          onClick={(e) => {
            e.stopPropagation()
            handleMedioFranco()
          }}
        >
          1/2 FRANCO
        </Button>
      </div>

      {/* SUBSELECCIONES ------------------------------------------- */}

      {/* TURNOS */}
      {selectionMode === "turno" && shifts.length > 0 && (
        <div className="flex flex-col gap-3 border-b pb-4">
          <div className="grid grid-cols-2 gap-3">
            {shifts.map((shift) => (
              <Button
                key={shift.id}
                type="button"
                variant="outline"
                className="h-16 text-base font-medium flex items-center gap-2 justify-start"
                onClick={(e) => {
                  e.stopPropagation()
                  handleTurno(shift)
                }}
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: shift.color }}
                />
                <span className="truncate">{shift.name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* MEDIO FRANCO */}
      {selectionMode === "medio_franco" && (
        <div className="flex flex-col gap-3">
          {/* Opciones predefinidas */}
          {mediosTurnos.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {mediosTurnos.map((medio) => (
                <Button
                  key={medio.id}
                  type="button"
                  variant="outline"
                  className="h-16 text-base font-medium"
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
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="time"
              className="h-16 text-base"
              placeholder="Inicio"
              value={medioFrancoTime.startTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleMedioFrancoTimeChange("startTime", e.target.value)}
            />
            <Input
              type="time"
              className="h-16 text-base"
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
