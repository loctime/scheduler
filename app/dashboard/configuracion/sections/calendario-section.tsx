"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { CalendarRange, Eye } from "lucide-react"
import { Configuracion } from "@/lib/types"
import { SectionFooter } from "./section-footer"

type Props = {
  config: Configuracion
  saveSection: (partial: Partial<Configuracion>) => Promise<void>
}

export function CalendarioSection({ config, saveSection }: Props) {
  const [mesInicioDia, setMesInicioDia] = useState<number>(config.mesInicioDia ?? 1)
  const [semanaInicioDia, setSemanaInicioDia] = useState<number>(config.semanaInicioDia ?? 1)
  const [mostrarFinesDeSemana, setMostrarFinesDeSemana] = useState<boolean>(
    config.mostrarFinesDeSemana ?? true,
  )
  const [formatoHora24, setFormatoHora24] = useState<boolean>(config.formatoHora24 ?? true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setMesInicioDia(config.mesInicioDia ?? 1)
    setSemanaInicioDia(config.semanaInicioDia ?? 1)
    setMostrarFinesDeSemana(config.mostrarFinesDeSemana ?? true)
    setFormatoHora24(config.formatoHora24 ?? true)
  }, [config.mesInicioDia, config.semanaInicioDia, config.mostrarFinesDeSemana, config.formatoHora24])

  const dirty =
    mesInicioDia !== (config.mesInicioDia ?? 1) ||
    semanaInicioDia !== (config.semanaInicioDia ?? 1) ||
    mostrarFinesDeSemana !== (config.mostrarFinesDeSemana ?? true) ||
    formatoHora24 !== (config.formatoHora24 ?? true)

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveSection({
        mesInicioDia,
        semanaInicioDia,
        mostrarFinesDeSemana,
        formatoHora24,
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
                <CalendarRange className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold text-foreground">Períodos</CardTitle>
                <CardDescription className="text-sm text-foreground/75 font-normal">Cuándo empiezan el mes y la semana</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="mesInicioDia">Día de inicio del mes</Label>
              <Select value={mesInicioDia.toString()} onValueChange={(v) => setMesInicioDia(parseInt(v))}>
                <SelectTrigger id="mesInicioDia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      Día {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-foreground/75">
                Día en que comienza el período de cálculo o facturación
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="semanaInicioDia">Día de inicio de la semana</Label>
              <Select
                value={semanaInicioDia.toString()}
                onValueChange={(v) => setSemanaInicioDia(parseInt(v))}
              >
                <SelectTrigger id="semanaInicioDia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Domingo</SelectItem>
                  <SelectItem value="1">Lunes</SelectItem>
                  <SelectItem value="2">Martes</SelectItem>
                  <SelectItem value="3">Miércoles</SelectItem>
                  <SelectItem value="4">Jueves</SelectItem>
                  <SelectItem value="5">Viernes</SelectItem>
                  <SelectItem value="6">Sábado</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-foreground/75">
                Día en que comienza la semana laboral
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-l-4 border-l-primary/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 shadow-sm">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold text-foreground">Visualización</CardTitle>
                <CardDescription className="text-sm text-foreground/75 font-normal">Cómo se ven las horas y los días</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor="mostrarFinesDeSemana" className="text-sm">Mostrar fines de semana</Label>
                <p className="text-sm text-foreground/75">
                  Sábados y domingos en el calendario
                </p>
              </div>
              <Switch
                id="mostrarFinesDeSemana"
                checked={mostrarFinesDeSemana}
                onCheckedChange={setMostrarFinesDeSemana}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor="formatoHora24" className="text-sm">Formato 24 horas</Label>
                <p className="text-sm text-foreground/75">
                  14:00 en lugar de 2:00 PM
                </p>
              </div>
              <Switch id="formatoHora24" checked={formatoHora24} onCheckedChange={setFormatoHora24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {dirty || saving ? (
        <SectionFooter onSave={handleSave} saving={saving} dirty={dirty} label="Guardar calendario" />
      ) : null}
    </div>
  )
}
