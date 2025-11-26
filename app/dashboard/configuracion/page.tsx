"use client"

import { useState, useEffect } from "react"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Configuracion } from "@/lib/types"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useData } from "@/contexts/data-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Plus, Trash2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { MedioTurno } from "@/lib/types"

export default function ConfiguracionPage() {
  const { user } = useData()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<Configuracion>({
    mesInicioDia: 1,
    horasMaximasPorDia: 8,
    semanaInicioDia: 1, // Lunes por defecto
    mostrarFinesDeSemana: true,
    formatoHora24: true,
    minutosDescanso: 30,
    horasMinimasParaDescanso: 6,
    mediosTurnos: [],
  })

  useEffect(() => {
    if (!user) return

    const loadConfig = async () => {
      if (!db) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const configRef = doc(db, COLLECTIONS.CONFIG, "general")
        const configSnap = await getDoc(configRef)

        if (configSnap.exists()) {
          setConfig(configSnap.data() as Configuracion)
        } else {
          // Configuración por defecto
          const defaultConfig: Configuracion = {
            mesInicioDia: 1,
            horasMaximasPorDia: 8,
            semanaInicioDia: 1,
            mostrarFinesDeSemana: true,
            formatoHora24: true,
            minutosDescanso: 30,
            horasMinimasParaDescanso: 6,
            mediosTurnos: [],
          }
          await setDoc(configRef, {
            ...defaultConfig,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
            updatedByName: user.displayName || user.email,
          })
          setConfig(defaultConfig)
        }
      } catch (error: any) {
        console.error("Error loading config:", error)
        toast({
          title: "Error",
          description: "No se pudo cargar la configuración",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [user, toast])

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "No estás autenticado",
        variant: "destructive",
      })
      return
    }

    if (!db) {
      toast({
        title: "Error",
        description: "Firebase no está configurado",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      const configRef = doc(db, COLLECTIONS.CONFIG, "general")
      
      // Preparar datos asegurándonos de que todos los campos estén presentes
      const dataToSave: any = {
        mesInicioDia: config.mesInicioDia,
        horasMaximasPorDia: config.horasMaximasPorDia,
        semanaInicioDia: config.semanaInicioDia,
        mostrarFinesDeSemana: config.mostrarFinesDeSemana,
        formatoHora24: config.formatoHora24,
        minutosDescanso: config.minutosDescanso,
        horasMinimasParaDescanso: config.horasMinimasParaDescanso,
        mediosTurnos: config.mediosTurnos || [],
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email || "",
      }

      // Si el documento no existe, agregar createdAt
      const configSnap = await getDoc(configRef)
      if (!configSnap.exists()) {
        dataToSave.createdAt = serverTimestamp()
      }

      await setDoc(configRef, dataToSave, { merge: true })

      toast({
        title: "Configuración guardada",
        description: "Los cambios se han guardado correctamente",
      })
    } catch (error: any) {
      console.error("Error saving config:", error)
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        user: user?.uid,
        config: config,
      })
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la configuración",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
          <p className="text-muted-foreground">Gestiona las opciones generales del sistema</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de Calendario</CardTitle>
            <CardDescription>Configura cómo se muestran y organizan los horarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="mesInicioDia">Día de inicio del mes</Label>
              <Select
                value={config.mesInicioDia.toString()}
                onValueChange={(value) => setConfig({ ...config, mesInicioDia: parseInt(value) })}
              >
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
                value={config.semanaInicioDia.toString()}
                onValueChange={(value) => setConfig({ ...config, semanaInicioDia: parseInt(value) })}
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
                checked={config.mostrarFinesDeSemana}
                onCheckedChange={(checked) => setConfig({ ...config, mostrarFinesDeSemana: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de Horarios</CardTitle>
            <CardDescription>Límites y restricciones para los horarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="horasMaximasPorDia">Horas máximas por día</Label>
              <Input
                id="horasMaximasPorDia"
                type="number"
                min="1"
                max="24"
                value={config.horasMaximasPorDia}
                onChange={(e) =>
                  setConfig({ ...config, horasMaximasPorDia: Math.max(1, Math.min(24, parseInt(e.target.value) || 8)) })
                }
              />
              <p className="text-sm text-muted-foreground">
                Número máximo de horas que un empleado puede trabajar en un día
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de Descansos</CardTitle>
            <CardDescription>Gestiona los tiempos de descanso de los empleados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="minutosDescanso">Minutos de descanso</Label>
              <Input
                id="minutosDescanso"
                type="number"
                min="0"
                max="120"
                value={config.minutosDescanso}
                onChange={(e) =>
                  setConfig({ ...config, minutosDescanso: Math.max(0, Math.min(120, parseInt(e.target.value) || 30)) })
                }
              />
              <p className="text-sm text-muted-foreground">
                Minutos de descanso que se restan de las horas trabajadas (no se cuentan como horas trabajadas). Solo aplica a turnos continuos que cumplan el mínimo de horas.
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
                value={config.horasMinimasParaDescanso}
                onChange={(e) =>
                  setConfig({ ...config, horasMinimasParaDescanso: Math.max(1, Math.min(12, parseFloat(e.target.value) || 6)) })
                }
              />
              <p className="text-sm text-muted-foreground">
                Un turno continuo debe tener al menos esta cantidad de horas para aplicar el descanso. Los turnos cortados (con segunda franja horaria) no aplican descanso, independientemente de su duración.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medios Turnos (1/2 Franco)</CardTitle>
            <CardDescription>Define horarios predefinidos para los medios francos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {(config.mediosTurnos || []).map((medioTurno, index) => (
                <div key={medioTurno.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nombre (opcional)</Label>
                      <Input
                        placeholder="Ej: Mañana"
                        value={medioTurno.nombre || ""}
                        onChange={(e) => {
                          const nuevosMediosTurnos = [...(config.mediosTurnos || [])]
                          nuevosMediosTurnos[index] = { ...medioTurno, nombre: e.target.value }
                          setConfig({ ...config, mediosTurnos: nuevosMediosTurnos })
                        }}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Hora Inicio</Label>
                      <Input
                        type="time"
                        value={medioTurno.startTime}
                        onChange={(e) => {
                          const nuevosMediosTurnos = [...(config.mediosTurnos || [])]
                          nuevosMediosTurnos[index] = { ...medioTurno, startTime: e.target.value }
                          setConfig({ ...config, mediosTurnos: nuevosMediosTurnos })
                        }}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Hora Fin</Label>
                      <Input
                        type="time"
                        value={medioTurno.endTime}
                        onChange={(e) => {
                          const nuevosMediosTurnos = [...(config.mediosTurnos || [])]
                          nuevosMediosTurnos[index] = { ...medioTurno, endTime: e.target.value }
                          setConfig({ ...config, mediosTurnos: nuevosMediosTurnos })
                        }}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const nuevosMediosTurnos = (config.mediosTurnos || []).filter((_, i) => i !== index)
                      setConfig({ ...config, mediosTurnos: nuevosMediosTurnos })
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              
              {(!config.mediosTurnos || config.mediosTurnos.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay medios turnos configurados. Agrega uno para empezar.
                </p>
              )}
            </div>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const nuevoMedioTurno: MedioTurno = {
                  id: `medio-turno-${Date.now()}`,
                  startTime: "11:00",
                  endTime: "15:00",
                  nombre: "",
                }
                setConfig({
                  ...config,
                  mediosTurnos: [...(config.mediosTurnos || []), nuevoMedioTurno],
                })
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar Medio Turno
            </Button>
            <p className="text-sm text-muted-foreground">
              Estos horarios aparecerán como opciones cuando se seleccione "1/2 Franco" al asignar turnos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de Visualización</CardTitle>
            <CardDescription>Opciones de formato y presentación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="formatoHora24">Formato de hora 24 horas</Label>
                <p className="text-sm text-muted-foreground">
                  Mostrar las horas en formato 24 horas (14:00) en lugar de 12 horas (2:00 PM)
                </p>
              </div>
              <Switch
                id="formatoHora24"
                checked={config.formatoHora24}
                onCheckedChange={(checked) => setConfig({ ...config, formatoHora24: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar configuración
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}

