"use client"

import type React from "react"

import { useState } from "react"
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  deleteField,
  getDoc,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Turno } from "@/lib/types"

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
]

export default function TurnosPage() {
  const { shifts, loading: dataLoading, refreshShifts, user } = useData()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Turno | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    startTime: "",
    endTime: "",
    startTime2: "",
    endTime2: "",
    color: PRESET_COLORS[0],
  })
  const [hasSecondShift, setHasSecondShift] = useState(false)
  const { toast } = useToast()

  const handleOpenDialog = (shift?: any) => {
    if (shift) {
      setEditingShift(shift)
      const hasSecond = !!(shift.startTime2 || shift.endTime2)
      setHasSecondShift(hasSecond)
      setFormData({
        name: shift.name,
        startTime: shift.startTime || "",
        endTime: shift.endTime || "",
        startTime2: shift.startTime2 || "",
        endTime2: shift.endTime2 || "",
        color: shift.color,
      })
    } else {
      setEditingShift(null)
      setHasSecondShift(false)
      setFormData({
        name: "",
        startTime: "",
        endTime: "",
        startTime2: "",
        endTime2: "",
        color: PRESET_COLORS[0],
      })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!db) {
      toast({
        title: "Error",
        description: "Firebase no está configurado",
        variant: "destructive",
      })
      return
    }

    try {
      if (editingShift) {
        console.log("🔵 [TURNOS] Iniciando actualización de turno")
        console.log("🔵 [TURNOS] Turno a editar:", {
          id: editingShift.id,
          name: editingShift.name,
          userId: editingShift.userId,
          currentUserId: user?.uid,
        })
        
        const updateData: any = {
          name: formData.name,
          color: formData.color,
          updatedAt: serverTimestamp(),
        }
        
        // Primera franja horaria
        if (formData.startTime) updateData.startTime = formData.startTime
        if (formData.endTime) updateData.endTime = formData.endTime
        
        // Segunda franja horaria (solo si está habilitada)
        if (hasSecondShift) {
          if (formData.startTime2) updateData.startTime2 = formData.startTime2
          if (formData.endTime2) updateData.endTime2 = formData.endTime2
        } else {
          // Si se deshabilitó la segunda franja, eliminar los campos
          updateData.startTime2 = deleteField()
          updateData.endTime2 = deleteField()
        }
        
        // Crear una copia para logging sin las funciones especiales
        const logData: any = {}
        for (const key in updateData) {
          const value = updateData[key]
          if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'FieldValue') {
            if (value._methodName === 'serverTimestamp') {
              logData[key] = "[ServerTimestamp]"
            } else if (value._methodName === 'delete') {
              logData[key] = "[DeleteField]"
            } else {
              logData[key] = `[${value.constructor.name}]`
            }
          } else {
            logData[key] = value
          }
        }
        console.log("🔵 [TURNOS] Datos a actualizar:", logData)
        console.log("🔵 [TURNOS] Keys en updateData:", Object.keys(updateData))
        console.log("🔵 [TURNOS] ¿Tiene createdAt en updateData?:", 'createdAt' in updateData)
        console.log("🔵 [TURNOS] Verificando permisos:", {
          isAuth: !!user,
          userId: user?.uid,
          shiftUserId: editingShift.userId,
          match: user?.uid === editingShift.userId,
        })
        
        const shiftRef = doc(db, COLLECTIONS.SHIFTS, editingShift.id)
        console.log("🔵 [TURNOS] Referencia del documento:", shiftRef.path)
        
        // Leer el documento actual desde Firestore para verificar sus datos
        const currentDoc = await getDoc(shiftRef)
        if (currentDoc.exists()) {
          const currentData = currentDoc.data()
          console.log("🔵 [TURNOS] Datos actuales del documento en Firestore:", {
            userId: currentData.userId,
            name: currentData.name,
            hasUserId: 'userId' in currentData,
            allFields: Object.keys(currentData),
          })
          console.log("🔵 [TURNOS] Comparación userId:", {
            documentUserId: currentData.userId,
            currentUserUid: user?.uid,
            match: currentData.userId === user?.uid,
          })
        } else {
          console.error("❌ [TURNOS] El documento no existe en Firestore")
        }
        
        await updateDoc(shiftRef, updateData)
        console.log("✅ [TURNOS] Turno actualizado exitosamente")
        
        toast({
          title: "Turno actualizado",
          description: "El turno se ha actualizado correctamente",
        })
      } else {
        const newShiftData: any = {
          name: formData.name,
          color: formData.color,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
        
        // Primera franja horaria
        if (formData.startTime) newShiftData.startTime = formData.startTime
        if (formData.endTime) newShiftData.endTime = formData.endTime
        
        // Segunda franja horaria (solo si está habilitada)
        if (hasSecondShift) {
          if (formData.startTime2) newShiftData.startTime2 = formData.startTime2
          if (formData.endTime2) newShiftData.endTime2 = formData.endTime2
        }
        
        await addDoc(collection(db, COLLECTIONS.SHIFTS), newShiftData)
        toast({
          title: "Turno creado",
          description: "El turno se ha creado correctamente",
        })
      }
      // Refrescar datos del contexto
      await refreshShifts()
      setDialogOpen(false)
    } catch (error: any) {
      console.error("❌ [TURNOS] Error al guardar turno:", error)
      console.error("❌ [TURNOS] Detalles del error:", {
        code: error.code,
        message: error.message,
        stack: error.stack,
      })
      
      // Si es un error de permisos, mostrar información adicional
      if (error.code === "permission-denied") {
        console.error("❌ [TURNOS] Error de permisos - Información de depuración:", {
          userId: user?.uid,
          editingShift: editingShift ? {
            id: editingShift.id,
            userId: editingShift.userId,
            name: editingShift.name,
          } : null,
          isAuth: !!user,
        })
      }
      
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al guardar el turno",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este turno?")) return

    if (!db) {
      toast({
        title: "Error",
        description: "Firebase no está configurado",
        variant: "destructive",
      })
      return
    }

    try {
      await deleteDoc(doc(db, COLLECTIONS.SHIFTS, id))
      // Refrescar datos del contexto
      await refreshShifts()
      toast({
        title: "Turno eliminado",
        description: "El turno se ha eliminado correctamente",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al eliminar el turno",
        variant: "destructive",
      })
    }
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Turnos</h2>
            <p className="text-muted-foreground">Configura los turnos de trabajo disponibles</p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Turno
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dataLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border bg-card">
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-24 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : shifts.length === 0 ? (
            <Card className="col-span-full border-border bg-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay turnos configurados. Agrega tu primer turno.
              </CardContent>
            </Card>
          ) : (
            shifts.map((shift) => (
              <Card key={shift.id} className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-card-foreground">{shift.name}</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {(() => {
                          const firstShift = shift.startTime && shift.endTime
                            ? `${shift.startTime} - ${shift.endTime}`
                            : null
                          const secondShift = shift.startTime2 && shift.endTime2
                            ? `${shift.startTime2} - ${shift.endTime2}`
                            : null
                          
                          if (firstShift && secondShift) {
                            return `${firstShift} / ${secondShift}`
                          } else if (firstShift) {
                            return firstShift
                          } else {
                            return "Sin horario definido"
                          }
                        })()}
                      </CardDescription>
                    </div>
                    <Badge className="h-8 w-8 rounded-full" style={{ backgroundColor: shift.color }} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent"
                      onClick={() => handleOpenDialog(shift)}
                    >
                      <Pencil className="mr-2 h-3 w-3" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(shift.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">
                {editingShift ? "Editar Turno" : "Agregar Turno"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingShift ? "Actualiza los datos del turno" : "Ingresa los datos del nuevo turno"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground">
                    Nombre *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Mañana, Tarde, Noche"
                    required
                    className="border-input bg-background text-foreground"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-medium text-foreground">Primera Franja Horaria</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime" className="text-foreground">
                        Hora Inicio
                      </Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="border-input bg-background text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime" className="text-foreground">
                        Hora Fin
                      </Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="border-input bg-background text-foreground"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="second-shift" className="text-foreground cursor-pointer">
                      Turno cortado (Segunda franja horaria)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Activa esta opción para agregar una segunda franja horaria
                    </p>
                  </div>
                  <Switch
                    id="second-shift"
                    checked={hasSecondShift}
                    onCheckedChange={(checked) => {
                      setHasSecondShift(checked)
                      if (!checked) {
                        // Limpiar campos de segunda franja si se desactiva
                        setFormData({ ...formData, startTime2: "", endTime2: "" })
                      }
                    }}
                  />
                </div>
                
                {hasSecondShift && (
                  <div className="space-y-3">
                    <Label className="text-base font-medium text-foreground">Segunda Franja Horaria</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startTime2" className="text-foreground">
                          Hora Inicio
                        </Label>
                        <Input
                          id="startTime2"
                          type="time"
                          value={formData.startTime2}
                          onChange={(e) => setFormData({ ...formData, startTime2: e.target.value })}
                          className="border-input bg-background text-foreground"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endTime2" className="text-foreground">
                          Hora Fin
                        </Label>
                        <Input
                          id="endTime2"
                          type="time"
                          value={formData.endTime2}
                          onChange={(e) => setFormData({ ...formData, endTime2: e.target.value })}
                          className="border-input bg-background text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="text-foreground">Color *</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-10 w-10 rounded-full border-2 transition-all ${
                          formData.color === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingShift ? "Actualizar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
