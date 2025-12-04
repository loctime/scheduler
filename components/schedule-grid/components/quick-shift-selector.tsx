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

  // Calcular altura disponible para turnos
  const hasHeader = !readonly && (hasCellHistory || onToggleFixed)
  const headerHeight = hasHeader ? 10 : 0
  const turnosHeight = selectionMode === "turno" && shifts.length > 0 ? 50 : 0
  const medioFrancoHeight = selectionMode === "medio_franco" ? 50 : 0
  const mainContentHeight = 100 - headerHeight - turnosHeight - medioFrancoHeight

  return (
    <div
      className="flex flex-col h-full w-full p-0 m-0"
      onClick={(e) => e.stopPropagation()}
      data-quick-selector="true"
    >
      {/* HEADER - 10% */}
      {hasHeader && (
        <div className="h-[10%] flex items-center justify-center gap-1 p-0 m-0">
          {hasCellHistory && onUndo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-full aspect-square p-0 rounded-none"
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
              className="h-full aspect-square p-0 rounded-none"
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

      {/* CONTENIDO PRINCIPAL - 40% (30% franco/turno + 10% 1/2 franco) */}
      <div className="flex flex-col p-0 m-0" style={{ height: `${mainContentHeight}%` }}>
        {/* FRANCO / TURNO - 30% (50%-50% cada uno) */}
        <div className="h-[75%] flex gap-0 p-0 m-0">
          <Button
            type="button"
            variant={selectionMode === "franco" ? "default" : "outline"}
            className="h-full w-1/2 text-base font-bold rounded-none border-r-0"
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
            className="h-full w-1/2 text-base font-bold rounded-none"
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
          className="h-[25%] w-full text-base font-semibold rounded-none"
          onClick={(e) => {
            e.stopPropagation()
            handleMedioFranco()
          }}
        >
          1/2 FRANCO
        </Button>
      </div>

      {/* TURNOS - 50% (si hay dos turnos, 50%-50% cada uno) */}
      {selectionMode === "turno" && shifts.length > 0 && (
        <div className="h-[50%] flex gap-0 p-0 m-0">
          {shifts.map((shift, index) => (
            <Button
              key={shift.id}
              type="button"
              variant="outline"
              className="h-full flex-1 text-xl font-semibold flex items-center gap-2 justify-center rounded-none border-r-0 last:border-r"
              onClick={(e) => {
                e.stopPropagation()
                handleTurno(shift)
              }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: shift.color }}
              />
              <span className="truncate">{shift.name}</span>
            </Button>
          ))}
        </div>
      )}

      {/* MEDIO FRANCO - 50% */}
      {selectionMode === "medio_franco" && (
        <div className="h-[50%] flex flex-col gap-0 p-0 m-0">
          {/* Opciones predefinidas */}
          {mediosTurnos.length > 0 && (
            <div className="flex gap-0 flex-1">
              {mediosTurnos.map((medio, index) => (
                <Button
                  key={medio.id}
                  type="button"
                  variant="outline"
                  className="h-full flex-1 text-base font-medium rounded-none border-r-0 last:border-r"
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
          <div className="flex gap-0 flex-1">
            <Input
              type="time"
              className="h-full flex-1 rounded-none border-r-0 text-base"
              placeholder="Inicio"
              value={medioFrancoTime.startTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleMedioFrancoTimeChange("startTime", e.target.value)}
            />
            <Input
              type="time"
              className="h-full flex-1 rounded-none text-base"
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
