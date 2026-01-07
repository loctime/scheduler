"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { MedioTurno } from "@/lib/types"

interface SpecialTypeSelectorProps {
  specialType: "shift" | "franco" | "medio_franco" | "licencia_embarazo" | null
  onTypeChange: (type: "shift" | "franco" | "medio_franco" | "licencia_embarazo") => void
  medioFrancoTime: { startTime: string; endTime: string }
  onMedioFrancoTimeChange: (time: { startTime: string; endTime: string }) => void
  selectedMedioTurnoId: string | null
  onMedioTurnoSelect: (id: string | null, time: { startTime: string; endTime: string }) => void
  mediosTurnos?: MedioTurno[]
  licenciaEmbarazoTime?: { startTime: string; endTime: string }
  onLicenciaEmbarazoTimeChange?: (time: { startTime: string; endTime: string }) => void
}

export function SpecialTypeSelector({
  specialType,
  onTypeChange,
  medioFrancoTime,
  onMedioFrancoTimeChange,
  selectedMedioTurnoId,
  onMedioTurnoSelect,
  mediosTurnos,
  licenciaEmbarazoTime = { startTime: "", endTime: "" },
  onLicenciaEmbarazoTimeChange,
}: SpecialTypeSelectorProps) {
  return (
    <div className="space-y-3 border-b pb-4">
      <Label className="text-sm font-medium">Estado del día:</Label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button
          type="button"
          variant={specialType === "franco" ? "default" : "outline"}
          onClick={() => {
            onTypeChange("franco")
          }}
          className="w-full"
        >
          Franco
        </Button>
        <Button
          type="button"
          variant={specialType === "medio_franco" ? "default" : "outline"}
          onClick={() => {
            onTypeChange("medio_franco")
          }}
          className="w-full"
        >
          1/2 Franco
        </Button>
        <Button
          type="button"
          variant={specialType === "licencia_embarazo" ? "default" : "outline"}
          onClick={() => {
            onTypeChange("licencia_embarazo")
          }}
          className="w-full"
        >
          Lic. Embarazo
        </Button>
        <Button
          type="button"
          variant={specialType === "shift" || specialType === null ? "default" : "outline"}
          onClick={() => {
            onTypeChange("shift")
          }}
          className="w-full"
        >
          Turno Normal
        </Button>
      </div>
      
      {specialType === "medio_franco" && (
        <div className="space-y-3 pt-2">
          <Label className="text-xs font-medium">Selecciona un horario predefinido o ingresa uno personalizado:</Label>
          
          {mediosTurnos && mediosTurnos.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Horarios predefinidos:</Label>
              <div className="grid grid-cols-2 gap-2">
                {mediosTurnos.map((medioTurno) => {
                  const isSelected = selectedMedioTurnoId === medioTurno.id
                  const formatTime = (time: string) => time.endsWith(":00") ? time.slice(0, -3) : time
                  const formatRange = (start: string, end: string) => `${formatTime(start)} a ${formatTime(end)}`
                  const displayName = medioTurno.nombre || formatRange(medioTurno.startTime, medioTurno.endTime)
                  return (
                    <Button
                      key={medioTurno.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        onMedioTurnoSelect(medioTurno.id, {
                          startTime: medioTurno.startTime,
                          endTime: medioTurno.endTime,
                        })
                      }}
                      className="text-xs justify-start"
                    >
                      <span className="font-medium">{displayName}</span>
                      <span className="ml-2 text-muted-foreground">
                        ({formatRange(medioTurno.startTime, medioTurno.endTime)})
                      </span>
                    </Button>
                  )
                })}
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">O ingresa un horario personalizado:</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hora Inicio</Label>
                <Input
                  type="time"
                  value={medioFrancoTime.startTime}
                  onChange={(e) => {
                    onMedioFrancoTimeChange({ ...medioFrancoTime, startTime: e.target.value })
                    onMedioTurnoSelect(null, { ...medioFrancoTime, startTime: e.target.value })
                  }}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hora Fin</Label>
                <Input
                  type="time"
                  value={medioFrancoTime.endTime}
                  onChange={(e) => {
                    onMedioFrancoTimeChange({ ...medioFrancoTime, endTime: e.target.value })
                    onMedioTurnoSelect(null, { ...medioFrancoTime, endTime: e.target.value })
                  }}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {specialType === "licencia_embarazo" && onLicenciaEmbarazoTimeChange && (
        <div className="space-y-3 pt-2">
          <Label className="text-xs font-medium">Ingresa el horario de licencia por embarazo:</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hora Inicio</Label>
              <Input
                type="time"
                value={licenciaEmbarazoTime.startTime}
                onChange={(e) => {
                  onLicenciaEmbarazoTimeChange({ ...licenciaEmbarazoTime, startTime: e.target.value })
                }}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hora Fin</Label>
              <Input
                type="time"
                value={licenciaEmbarazoTime.endTime}
                onChange={(e) => {
                  onLicenciaEmbarazoTimeChange({ ...licenciaEmbarazoTime, endTime: e.target.value })
                }}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}






