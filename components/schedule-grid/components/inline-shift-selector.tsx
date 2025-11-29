"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { MedioTurno, ShiftAssignment, Turno } from "@/lib/types"

type SpecialType = "shift" | "franco" | "medio_franco"

interface InlineShiftSelectorProps {
  shifts: Turno[]
  mediosTurnos?: MedioTurno[]
  onSelectAssignments: (assignments: ShiftAssignment[]) => void
}

export function InlineShiftSelector({ shifts, mediosTurnos, onSelectAssignments }: InlineShiftSelectorProps) {
  const [specialType, setSpecialType] = useState<SpecialType>("shift")
  const [medioFrancoTime, setMedioFrancoTime] = useState<{ startTime: string; endTime: string }>({
    startTime: "",
    endTime: "",
  })

  const handleSelectShift = (shift: Turno) => {
    onSelectAssignments([
      {
        type: "shift",
        shiftId: shift.id,
      },
    ])
  }

  const handleSelectFranco = () => {
    onSelectAssignments([{ type: "franco" }])
  }

  const handleSelectMedioFranco = (time: { startTime: string; endTime: string }) => {
    if (!time.startTime || !time.endTime) return
    onSelectAssignments([
      {
        type: "medio_franco",
        startTime: time.startTime,
        endTime: time.endTime,
      },
    ])
  }

  // Por ahora mostramos todos los turnos configurados como opciones rápidas
  // El usuario puede nombrarlos "Mañana", "Tarde", "Noche", etc.
  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-3 gap-1">
        <Button
          type="button"
          size="sm"
          variant={specialType === "franco" ? "default" : "outline"}
          className="h-6 text-[11px] px-1.5"
          onClick={(e) => {
            e.stopPropagation()
            setSpecialType("franco")
            handleSelectFranco()
          }}
        >
          Franco
        </Button>
        <Button
          type="button"
          size="sm"
          variant={specialType === "medio_franco" ? "default" : "outline"}
          className="h-6 text-[11px] px-1.5"
          onClick={(e) => {
            e.stopPropagation()
            setSpecialType("medio_franco")
          }}
        >
          1/2 Franco
        </Button>
        <Button
          type="button"
          size="sm"
          variant={specialType === "shift" ? "default" : "outline"}
          className="h-6 text-[11px] px-1.5"
          onClick={(e) => {
            e.stopPropagation()
            setSpecialType("shift")
          }}
        >
          Turno
        </Button>
      </div>

      {specialType === "shift" && (
        <div className="flex flex-wrap gap-1">
          {shifts.length === 0 ? (
            <span className="text-[10px] text-muted-foreground">No hay turnos</span>
          ) : (
            shifts.map((shift) => (
              <Button
                key={shift.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-1.5 text-[11px]"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectShift(shift)
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full mr-1"
                  style={{ backgroundColor: shift.color }}
                />
                {shift.name}
              </Button>
            ))
          )}
        </div>
      )}

      {specialType === "medio_franco" && (
        <div className="space-y-1">
          {mediosTurnos && mediosTurnos.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mediosTurnos.map((medio) => (
                <Button
                  key={medio.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-1.5 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectMedioFranco({
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

          <div className="grid grid-cols-2 gap-1">
            <Input
              type="time"
              className="h-6 px-1.5 text-[11px]"
              placeholder="Inicio"
              value={medioFrancoTime.startTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation()
                const next = { ...medioFrancoTime, startTime: e.target.value }
                setMedioFrancoTime(next)
                // Solo guardar y cerrar si ambos campos están completos
                if (next.startTime && next.endTime) {
                  handleSelectMedioFranco(next)
                }
              }}
              onBlur={(e) => {
                // Al perder el foco, si ambos campos están completos, guardar y cerrar
                const currentValue = e.target.value
                const next = { ...medioFrancoTime, startTime: currentValue }
                if (next.startTime && next.endTime) {
                  handleSelectMedioFranco(next)
                }
              }}
            />
            <Input
              type="time"
              className="h-6 px-1.5 text-[11px]"
              placeholder="Fin"
              value={medioFrancoTime.endTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation()
                const next = { ...medioFrancoTime, endTime: e.target.value }
                setMedioFrancoTime(next)
                // Solo guardar y cerrar si ambos campos están completos
                if (next.startTime && next.endTime) {
                  handleSelectMedioFranco(next)
                }
              }}
              onBlur={(e) => {
                // Al perder el foco, si ambos campos están completos, guardar y cerrar
                const currentValue = e.target.value
                const next = { ...medioFrancoTime, endTime: currentValue }
                if (next.startTime && next.endTime) {
                  handleSelectMedioFranco(next)
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}


