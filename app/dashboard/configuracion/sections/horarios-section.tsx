"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Timer, Coffee, Calculator } from "lucide-react"
import { Configuracion } from "@/lib/types"
import { SectionFooter } from "./section-footer"

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
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-md border-l-4 border-l-primary/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 shadow-sm">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold text-foreground">Jornada diaria</CardTitle>
                <CardDescription className="text-sm text-foreground/75 font-normal">Tope de horas por día</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
              <p className="text-sm text-foreground/75">
                Máximo de horas que un empleado puede trabajar en un día
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-l-4 border-l-primary/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 shadow-sm">
                <Coffee className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold text-foreground">Descansos</CardTitle>
                <CardDescription className="text-sm text-foreground/75 font-normal">Tiempo descontado de los turnos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <p className="text-sm text-foreground/75">
                Minutos que se restan de las horas trabajadas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="horasMinimasParaDescanso">Horas mínimas para aplicar</Label>
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
              <p className="text-sm text-foreground/75">
                El turno debe ser continuo y tener al menos esta duración
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-l-4 border-l-primary/60 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 shadow-sm">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold text-foreground">Reglas para horas extra</CardTitle>
                <CardDescription className="text-sm text-foreground/75 font-normal">Umbrales para el cálculo automático de HE</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-sm text-foreground/75">
                  Por encima de esto cuenta como hora extra
                </p>
              </div>

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
                <p className="text-sm text-foreground/75">
                  Para cálculos semanales de horas extra
                </p>
              </div>

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
                <p className="text-sm text-foreground/75">
                  Para futuros cálculos de HE nocturnas
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="limiteDiarioRecomendado">Límite diario recomendado</Label>
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
                <p className="text-sm text-foreground/75">
                  Para alertas y validaciones futuras
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {dirty || saving ? (
        <SectionFooter onSave={handleSave} saving={saving} dirty={dirty} label="Guardar horarios" />
      ) : null}
    </div>
  )
}
