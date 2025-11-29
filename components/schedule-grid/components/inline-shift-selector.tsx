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
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1">
        <Button
          type="button"
          size="sm"
          variant={specialType === "franco" ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => {
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
          className="h-8 text-xs"
          onClick={() => setSpecialType("medio_franco")}
        >
          1/2 Franco
        </Button>
        <Button
          type="button"
          size="sm"
          variant={specialType === "shift" ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setSpecialType("shift")}
        >
          Turno normal
        </Button>
      </div>

      {specialType === "shift" && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Turnos disponibles</Label>
          <div className="flex flex-col gap-1">
            {shifts.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">No hay turnos configurados</span>
            ) : (
              shifts.map((shift) => (
                <Button
                  key={shift.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-2 justify-start text-left text-xs"
                  onClick={() => handleSelectShift(shift)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: shift.color }}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{shift.name}</span>
                      {(shift.startTime || shift.endTime || shift.startTime2 || shift.endTime2) && (
                        <span className="text-[11px] text-muted-foreground">
                          {shift.startTime && shift.endTime ? `${shift.startTime} - ${shift.endTime}` : ""}
                          {shift.startTime2 && shift.endTime2
                            ? `${shift.startTime && shift.endTime ? " / " : ""}${shift.startTime2} - ${
                                shift.endTime2
                              }`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </div>
      )}

      {specialType === "medio_franco" && (
        <div className="space-y-2">
          {mediosTurnos && mediosTurnos.length > 0 && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Horarios 1/2 franco</Label>
              <div className="grid grid-cols-2 gap-1">
                {mediosTurnos.map((medio) => (
                  <Button
                    key={medio.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-auto py-1 px-2 justify-start text-left text-[11px]"
                    onClick={() =>
                      handleSelectMedioFranco({
                        startTime: medio.startTime,
                        endTime: medio.endTime,
                      })
                    }
                  >
                    <span className="font-medium">{medio.nombre || "1/2 Franco"}</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      ({medio.startTime} - {medio.endTime})
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Horario personalizado</Label>
            <div className="grid grid-cols-2 gap-1">
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Inicio</Label>
                <Input
                  type="time"
                  className="h-7 px-2 text-[11px]"
                  value={medioFrancoTime.startTime}
                  onChange={(e) => {
                    const next = { ...medioFrancoTime, startTime: e.target.value }
                    setMedioFrancoTime(next)
                    handleSelectMedioFranco(next)
                  }}
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Fin</Label>
                <Input
                  type="time"
                  className="h-7 px-2 text-[11px]"
                  value={medioFrancoTime.endTime}
                  onChange={(e) => {
                    const next = { ...medioFrancoTime, endTime: e.target.value }
                    setMedioFrancoTime(next)
                    handleSelectMedioFranco(next)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


