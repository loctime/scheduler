"use client"

import { useState, useEffect, useMemo } from "react"
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
import { MedioTurno, Puesto } from "@/lib/types"

// Función helper para determinar el color de texto según el contraste
const getContrastColor = (hexColor: string): string => {
  // Remover el # si existe
  const hex = hexColor.replace('#', '')
  
  // Convertir a RGB
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // Calcular la luminosidad relativa
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // Si la luminosidad es mayor a 0.5, usar texto oscuro, sino texto claro
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

export default function ConfiguracionPage() {
  const { user, shifts } = useData()
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
    puestos: [],
  })

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
            puestos: [],
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
        puestos: config.puestos || [],
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
                  <div className="flex-1 grid grid-cols-4 gap-3">
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
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={medioTurno.color || "#22c55e"}
                          onChange={(e) => {
                            const nuevosMediosTurnos = [...(config.mediosTurnos || [])]
                            nuevosMediosTurnos[index] = { ...medioTurno, color: e.target.value }
                            setConfig({ ...config, mediosTurnos: nuevosMediosTurnos })
                          }}
                          className="h-9 w-16 p-1 cursor-pointer"
                        />
                        <Input
                          type="text"
                          placeholder="#22c55e"
                          value={medioTurno.color || ""}
                          onChange={(e) => {
                            const nuevosMediosTurnos = [...(config.mediosTurnos || [])]
                            nuevosMediosTurnos[index] = { ...medioTurno, color: e.target.value }
                            setConfig({ ...config, mediosTurnos: nuevosMediosTurnos })
                          }}
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
                            const nuevosMediosTurnos = [...(config.mediosTurnos || [])]
                            nuevosMediosTurnos[index] = { ...medioTurno, color: value }
                            setConfig({ ...config, mediosTurnos: nuevosMediosTurnos })
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
                  color: "#22c55e", // Verde por defecto
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
            <CardTitle>Puestos de Trabajo</CardTitle>
            <CardDescription>Define los puestos de trabajo y sus colores para diferenciar empleados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {(config.puestos || []).map((puesto, index) => (
                <div key={puesto.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nombre del Puesto</Label>
                      <Input
                        placeholder="Ej: Salón, Cocina, Bacha"
                        value={puesto.nombre}
                        onChange={(e) => {
                          const nuevosPuestos = [...(config.puestos || [])]
                          nuevosPuestos[index] = { ...puesto, nombre: e.target.value }
                          setConfig({ ...config, puestos: nuevosPuestos })
                        }}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={puesto.color}
                          onChange={(e) => {
                            const nuevosPuestos = [...(config.puestos || [])]
                            nuevosPuestos[index] = { ...puesto, color: e.target.value }
                            setConfig({ ...config, puestos: nuevosPuestos })
                          }}
                          className="h-9 w-16 p-1 cursor-pointer"
                        />
                        <Input
                          type="text"
                          placeholder="#000000"
                          value={puesto.color}
                          onChange={(e) => {
                            const nuevosPuestos = [...(config.puestos || [])]
                            nuevosPuestos[index] = { ...puesto, color: e.target.value }
                            setConfig({ ...config, puestos: nuevosPuestos })
                          }}
                          className="text-sm flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 flex items-end">
                      <div
                        className="h-9 w-full rounded border border-border flex items-center justify-center text-xs font-medium"
                        style={{ backgroundColor: puesto.color, color: getContrastColor(puesto.color) }}
                      >
                        Vista previa
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const nuevosPuestos = (config.puestos || []).filter((_, i) => i !== index)
                      setConfig({ ...config, puestos: nuevosPuestos })
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              
              {(!config.puestos || config.puestos.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay puestos configurados. Agrega uno para empezar.
                </p>
              )}
            </div>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const nuevoPuesto: Puesto = {
                  id: `puesto-${Date.now()}`,
                  nombre: "",
                  color: "#3b82f6", // Azul por defecto
                }
                setConfig({
                  ...config,
                  puestos: [...(config.puestos || []), nuevoPuesto],
                })
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar Puesto
            </Button>
            <p className="text-sm text-muted-foreground">
              Los puestos te permiten diferenciar visualmente a los empleados según su área de trabajo. Asigna un puesto a cada empleado desde la página de Empleados.
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

