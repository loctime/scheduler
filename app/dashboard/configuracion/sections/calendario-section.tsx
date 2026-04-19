"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Loader2, Save } from "lucide-react"
import { Configuracion } from "@/lib/types"

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
    <Card>
      <CardHeader>
        <CardTitle>Calendario</CardTitle>
        <CardDescription>Cómo se muestran y organizan los horarios</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
          <p className="text-sm text-muted-foreground">
            El día del mes en que comienza el período de facturación o cálculo
          </p>
        </div>

        <Separator />

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
          <p className="text-sm text-muted-foreground">
            El día de la semana en que comienza la semana laboral
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="mostrarFinesDeSemana">Mostrar fines de semana</Label>
            <p className="text-sm text-muted-foreground">
              Mostrar sábados y domingos en el calendario
            </p>
          </div>
          <Switch
            id="mostrarFinesDeSemana"
            checked={mostrarFinesDeSemana}
            onCheckedChange={setMostrarFinesDeSemana}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="formatoHora24">Formato de hora 24 horas</Label>
            <p className="text-sm text-muted-foreground">
              Mostrar las horas en formato 24 horas (14:00) en lugar de 12 horas (2:00 PM)
            </p>
          </div>
          <Switch id="formatoHora24" checked={formatoHora24} onCheckedChange={setFormatoHora24} />
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
                Guardar calendario
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
