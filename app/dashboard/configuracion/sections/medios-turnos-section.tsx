"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Save, Trash2 } from "lucide-react"
import { Configuracion, MedioTurno } from "@/lib/types"
import { useData } from "@/contexts/data-context"

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
    <Card>
      <CardHeader>
        <CardTitle>Medios Turnos (1/2 Franco)</CardTitle>
        <CardDescription>Define horarios predefinidos para los medios francos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {mediosTurnos.map((medioTurno, index) => (
            <div key={medioTurno.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nombre (opcional)</Label>
                  <Input
                    placeholder="Ej: Mañana"
                    value={medioTurno.nombre || ""}
                    onChange={(e) => updateMedioTurno(index, { nombre: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Hora Inicio</Label>
                  <Input
                    type="time"
                    value={medioTurno.startTime}
                    onChange={(e) => updateMedioTurno(index, { startTime: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Hora Fin</Label>
                  <Input
                    type="time"
                    value={medioTurno.endTime}
                    onChange={(e) => updateMedioTurno(index, { endTime: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={medioTurno.color || "#22c55e"}
                      onChange={(e) => updateMedioTurno(index, { color: e.target.value })}
                      className="h-9 w-16 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      placeholder="#22c55e"
                      value={medioTurno.color || ""}
                      onChange={(e) => updateMedioTurno(index, { color: e.target.value })}
                      className="text-sm flex-1"
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
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Colores de turnos" />
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
                              <span className="text-xs text-muted-foreground">
                                {option.color.toUpperCase()}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeMedioTurno(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          {mediosTurnos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay medios turnos configurados. Agrega uno para empezar.
            </p>
          )}
        </div>

        <Button type="button" variant="outline" onClick={addMedioTurno} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Agregar Medio Turno
        </Button>
        <p className="text-sm text-muted-foreground">
          Estos horarios aparecerán como opciones cuando se seleccione "1/2 Franco" al asignar turnos.
        </p>

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar medios turnos
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
