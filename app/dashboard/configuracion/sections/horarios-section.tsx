"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Loader2, Save } from "lucide-react"
import { Configuracion } from "@/lib/types"

type Props = {
  config: Configuracion
  saveSection: (partial: Partial<Configuracion>) => Promise<void>
}

type ReglasState = {
  horasNormalesPorDia: number
  horasNormalesPorSemana: number
  inicioHorarioNocturno: string
  limiteDiarioRecomendado: number
}

const defaultReglas: ReglasState = {
  horasNormalesPorDia: 8,
  horasNormalesPorSemana: 48,
  inicioHorarioNocturno: "21:00",
  limiteDiarioRecomendado: 10,
}

function reglasFromConfig(config: Configuracion): ReglasState {
  const r = config.reglasHorarias
  return {
    horasNormalesPorDia: r?.horasNormalesPorDia ?? defaultReglas.horasNormalesPorDia,
    horasNormalesPorSemana: r?.horasNormalesPorSemana ?? defaultReglas.horasNormalesPorSemana,
    inicioHorarioNocturno: r?.inicioHorarioNocturno ?? defaultReglas.inicioHorarioNocturno,
    limiteDiarioRecomendado: r?.limiteDiarioRecomendado ?? defaultReglas.limiteDiarioRecomendado,
  }
}

export function HorariosSection({ config, saveSection }: Props) {
  const [horasMaximasPorDia, setHorasMaximasPorDia] = useState(config.horasMaximasPorDia ?? 8)
  const [minutosDescanso, setMinutosDescanso] = useState(config.minutosDescanso ?? 30)
  const [horasMinimasParaDescanso, setHorasMinimasParaDescanso] = useState(
    config.horasMinimasParaDescanso ?? 6,
  )
  const [reglas, setReglas] = useState<ReglasState>(reglasFromConfig(config))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setHorasMaximasPorDia(config.horasMaximasPorDia ?? 8)
    setMinutosDescanso(config.minutosDescanso ?? 30)
    setHorasMinimasParaDescanso(config.horasMinimasParaDescanso ?? 6)
    setReglas(reglasFromConfig(config))
  }, [
    config.horasMaximasPorDia,
    config.minutosDescanso,
    config.horasMinimasParaDescanso,
    config.reglasHorarias?.horasNormalesPorDia,
    config.reglasHorarias?.horasNormalesPorSemana,
    config.reglasHorarias?.inicioHorarioNocturno,
    config.reglasHorarias?.limiteDiarioRecomendado,
  ])

  const currentReglas = reglasFromConfig(config)
  const dirty =
    horasMaximasPorDia !== (config.horasMaximasPorDia ?? 8) ||
    minutosDescanso !== (config.minutosDescanso ?? 30) ||
    horasMinimasParaDescanso !== (config.horasMinimasParaDescanso ?? 6) ||
    reglas.horasNormalesPorDia !== currentReglas.horasNormalesPorDia ||
    reglas.horasNormalesPorSemana !== currentReglas.horasNormalesPorSemana ||
    reglas.inicioHorarioNocturno !== currentReglas.inicioHorarioNocturno ||
    reglas.limiteDiarioRecomendado !== currentReglas.limiteDiarioRecomendado

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveSection({
        horasMaximasPorDia,
        minutosDescanso,
        horasMinimasParaDescanso,
        reglasHorarias: { ...reglas },
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Horarios y cálculos</CardTitle>
          <CardDescription>Límites, descansos y reglas para el cálculo de horas extra</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="horasMaximasPorDia">Horas máximas por día</Label>
            <Input
              id="horasMaximasPorDia"
              type="number"
              min="1"
              max="24"
              value={horasMaximasPorDia}
              onChange={(e) =>
                setHorasMaximasPorDia(Math.max(1, Math.min(24, parseInt(e.target.value) || 8)))
              }
            />
            <p className="text-sm text-muted-foreground">
              Número máximo de horas que un empleado puede trabajar en un día
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="minutosDescanso">Minutos de descanso</Label>
            <Input
              id="minutosDescanso"
              type="number"
              min="0"
              max="120"
              value={minutosDescanso}
              onChange={(e) =>
                setMinutosDescanso(Math.max(0, Math.min(120, parseInt(e.target.value) || 30)))
              }
            />
            <p className="text-sm text-muted-foreground">
              Minutos de descanso que se restan de las horas trabajadas. Solo aplica a turnos continuos que cumplan el mínimo de horas.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="horasMinimasParaDescanso">Horas mínimas para descanso</Label>
            <Input
              id="horasMinimasParaDescanso"
              type="number"
              min="1"
              max="12"
              step="0.5"
              value={horasMinimasParaDescanso}
              onChange={(e) =>
                setHorasMinimasParaDescanso(
                  Math.max(1, Math.min(12, parseFloat(e.target.value) || 6)),
                )
              }
            />
            <p className="text-sm text-muted-foreground">
              Un turno continuo debe tener al menos esta cantidad de horas para aplicar el descanso. Los turnos cortados no aplican descanso.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="horasNormalesPorDia">Horas normales por día</Label>
            <Input
              id="horasNormalesPorDia"
              type="number"
              min="1"
              max="24"
              value={reglas.horasNormalesPorDia}
              onChange={(e) =>
                setReglas({
                  ...reglas,
                  horasNormalesPorDia: Math.max(1, Math.min(24, parseInt(e.target.value) || 8)),
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Horas normales de trabajo por día. Las horas trabajadas por encima de este valor se consideran horas extra.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="horasNormalesPorSemana">Horas normales por semana</Label>
            <Input
              id="horasNormalesPorSemana"
              type="number"
              min="1"
              max="168"
              value={reglas.horasNormalesPorSemana}
              onChange={(e) =>
                setReglas({
                  ...reglas,
                  horasNormalesPorSemana: Math.max(1, Math.min(168, parseInt(e.target.value) || 48)),
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Horas normales de trabajo por semana. Útil para cálculos semanales de horas extra.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="inicioHorarioNocturno">Inicio horario nocturno</Label>
            <Input
              id="inicioHorarioNocturno"
              type="time"
              value={reglas.inicioHorarioNocturno}
              onChange={(e) =>
                setReglas({ ...reglas, inicioHorarioNocturno: e.target.value || "21:00" })
              }
            />
            <p className="text-sm text-muted-foreground">
              Hora de inicio del horario nocturno (para futuros cálculos de horas extra nocturnas).
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="limiteDiarioRecomendado">Límite diario recomendado de horas</Label>
            <Input
              id="limiteDiarioRecomendado"
              type="number"
              min="1"
              max="24"
              value={reglas.limiteDiarioRecomendado}
              onChange={(e) =>
                setReglas({
                  ...reglas,
                  limiteDiarioRecomendado: Math.max(1, Math.min(24, parseInt(e.target.value) || 10)),
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Límite diario recomendado de horas trabajadas (para alertas y validaciones futuras).
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar horarios
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
