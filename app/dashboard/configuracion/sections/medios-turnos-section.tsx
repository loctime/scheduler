"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Coffee, Plus, Trash2 } from "lucide-react"
import { Configuracion, MedioTurno } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { SectionFooter } from "./section-footer"

type Props = {
  config: Configuracion
  saveSection: (partial: Partial<Configuracion>) => Promise<void>
}

export function MediosTurnosSection({ config, saveSection }: Props) {
  const { shifts } = useData()
  const [mediosTurnos, setMediosTurnos] = useState<MedioTurno[]>(config.mediosTurnos || [])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setMediosTurnos(config.mediosTurnos || [])
  }, [config.mediosTurnos])

  const shiftColorOptions = useMemo(() => {
    if (!shifts || shifts.length === 0) return []
    const colorMap = new Map<string, { color: string; name: string }>()

    shifts.forEach((shift) => {
      const color = shift.color?.trim()
      if (!color) return
      const key = color.toLowerCase()
      if (!colorMap.has(key)) {
        colorMap.set(key, { color, name: shift.name })
      } else {
        const existing = colorMap.get(key)
        if (existing && existing.name.length < 40 && shift.name && !existing.name.includes(shift.name)) {
          existing.name = `${existing.name}, ${shift.name}`
        }
      }
    })

    return Array.from(colorMap.values())
  }, [shifts])

  const dirty = JSON.stringify(mediosTurnos) !== JSON.stringify(config.mediosTurnos || [])

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveSection({ mediosTurnos })
    } finally {
      setSaving(false)
    }
  }

  const updateMedioTurno = (index: number, patch: Partial<MedioTurno>) => {
    const next = [...mediosTurnos]
    next[index] = { ...next[index], ...patch }
    setMediosTurnos(next)
  }

  const removeMedioTurno = (index: number) => {
    setMediosTurnos(mediosTurnos.filter((_, i) => i !== index))
  }

  const addMedioTurno = () => {
    const nuevo: MedioTurno = {
      id: `medio-turno-${Date.now()}`,
      startTime: "11:00",
      endTime: "15:00",
      nombre: "",
      color: "#22c55e",
    }
    setMediosTurnos([...mediosTurnos, nuevo])
  }

  return (
    <div>
      <Card className="shadow-md border-l-4 border-l-primary/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 shadow-sm">
              <Coffee className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold text-foreground">Medios Turnos (1/2 Franco)</CardTitle>
              <CardDescription className="text-sm text-foreground/75 font-normal">
                Horarios predefinidos que aparecerán al seleccionar "1/2 Franco"
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {mediosTurnos.map((medioTurno, index) => (
              <div
                key={medioTurno.id}
                className="group relative rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="h-3 w-3 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: medioTurno.color || "#22c55e" }}
                  />
                  <span className="text-sm font-medium flex-1">
                    {medioTurno.nombre || `Medio turno ${index + 1}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeMedioTurno(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground/80">Nombre (opcional)</Label>
                    <Input
                      placeholder="Ej: Mañana"
                      value={medioTurno.nombre || ""}
                      onChange={(e) => updateMedioTurno(index, { nombre: e.target.value })}
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground/80">Hora Inicio</Label>
                    <Input
                      type="time"
                      value={medioTurno.startTime}
                      onChange={(e) => updateMedioTurno(index, { startTime: e.target.value })}
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground/80">Hora Fin</Label>
                    <Input
                      type="time"
                      value={medioTurno.endTime}
                      onChange={(e) => updateMedioTurno(index, { endTime: e.target.value })}
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground/80">Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={medioTurno.color || "#22c55e"}
                        onChange={(e) => updateMedioTurno(index, { color: e.target.value })}
                        className="h-9 w-12 p-1 cursor-pointer shrink-0"
                      />
                      <Input
                        type="text"
                        placeholder="#22c55e"
                        value={medioTurno.color || ""}
                        onChange={(e) => updateMedioTurno(index, { color: e.target.value })}
                        className="text-xs font-mono flex-1 h-9"
                      />
                    </div>
                    {shiftColorOptions.length > 0 && (
                      <Select
                        value={
                          shiftColorOptions.find(
                            (option) =>
                              option.color.toLowerCase() === (medioTurno.color || "").toLowerCase(),
                          )?.color || "custom"
                        }
                        onValueChange={(value) => {
                          if (value === "custom") return
                          updateMedioTurno(index, { color: value })
                        }}
                      >
                        <SelectTrigger className="text-xs h-8 mt-1">
                          <SelectValue placeholder="Usar color de turno" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">
                            <span className="text-muted-foreground">Personalizado</span>
                          </SelectItem>
                          {shiftColorOptions.map((option) => (
                            <SelectItem key={option.color} value={option.color}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-full border border-border"
                                  style={{ backgroundColor: option.color }}
                                />
                                <span className="text-sm">{option.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {mediosTurnos.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
                <Coffee className="h-8 w-8 text-muted-foreground/60" />
                <p className="text-base font-medium text-foreground">
                  No hay medios turnos configurados
                </p>
                <p className="text-sm text-foreground/70">Agregá uno para empezar</p>
              </div>
            )}
          </div>

          <Button type="button" variant="outline" onClick={addMedioTurno} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Medio Turno
          </Button>
        </CardContent>
      </Card>

      {dirty || saving ? (
        <SectionFooter onSave={handleSave} saving={saving} dirty={dirty} label="Guardar medios turnos" />
      ) : null}
    </div>
  )
}
