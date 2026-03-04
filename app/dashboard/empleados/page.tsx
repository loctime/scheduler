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
  query,
  where,
  getDocs,
  writeBatch,
  deleteField,
  type Firestore,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Plus, Trash2, AlertTriangle, Pencil, Users, Clock } from "lucide-react"
import { format, parseISO, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { Skeleton } from "@/components/ui/skeleton"
import { logger } from "@/lib/logger"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Horario, Turno } from "@/lib/types"

/** Impacto de eliminar un empleado: semanas/días/turnos afectados (solo en semanas NO "Listo"). */
export type EmployeeDeleteImpact = {
  daysCount: number
  shiftsCount: number
  dates: string[]
  fromWeekStart: string | null
  lastCompletedWeekInfo: { start: string; end: string } | null
  /** Schedules futuros editables con assignments, para "Limpiar horarios" sin re-lectura. */
  schedulesToUpdate: Array<{ id: string; assignments: Horario["assignments"] }>
}

const BATCH_LIMIT = 500

/**
 * Calcula el impacto de eliminar un empleado: última semana completada, semanas futuras editables
 * y conteo de días/turnos afectados. Reutilizable para el dialog y para la opción "Limpiar horarios".
 */
async function computeEmployeeDeleteImpact(
  db: Firestore,
  ownerId: string,
  employeeId: string
): Promise<EmployeeDeleteImpact> {
  const schedulesRef = collection(db, COLLECTIONS.SCHEDULES)
  const q = query(schedulesRef, where("ownerId", "==", ownerId))
  const snapshot = await getDocs(q)
  const allSchedules = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as (Horario & { id: string })[]

  const completedSchedules = allSchedules
    .filter((s) => s.completada === true && s.weekStart)
    .sort((a, b) => (b.weekStart || "").localeCompare(a.weekStart || ""))

  const lastCompletedWeekStart: string | null =
    completedSchedules.length > 0 ? (completedSchedules[0].weekStart ?? null) : null

  const lastCompletedWeekInfo: { start: string; end: string } | null =
    completedSchedules.length > 0
      ? (() => {
          const w = completedSchedules[0]
          const weekStartDate = parseISO(w.weekStart!)
          const weekEndDate = addDays(weekStartDate, 6)
          return {
            start: format(weekStartDate, "d 'de' MMMM 'de' yyyy", { locale: es }),
            end: format(weekEndDate, "d 'de' MMMM 'de' yyyy", { locale: es }),
          }
        })()
      : null

  const futureEditable = allSchedules.filter((schedule) => {
    if (schedule.completada === true) return false
    if (!lastCompletedWeekStart) return true
    return !!(schedule.weekStart && schedule.weekStart > lastCompletedWeekStart)
  })

  const datesSet = new Set<string>()
  let daysCount = 0
  let shiftsCount = 0
  const schedulesToUpdate: Array<{ id: string; assignments: Horario["assignments"] }> = []

  for (const schedule of futureEditable) {
    const assignments = schedule.assignments || {}
    let hasEmployee = false
    const updatedAssignments: Horario["assignments"] = { ...assignments }

    for (const dateKey of Object.keys(assignments)) {
      const byEmployee = assignments[dateKey]
      if (!byEmployee || !byEmployee[employeeId]) continue
      hasEmployee = true
      daysCount += 1
      datesSet.add(dateKey)
      const val = byEmployee[employeeId]
      shiftsCount += Array.isArray(val) ? val.length : 1
      const next = { ...byEmployee }
      delete next[employeeId]
      updatedAssignments[dateKey] = next
    }

    if (hasEmployee) {
      schedulesToUpdate.push({ id: schedule.id, assignments: updatedAssignments })
    }
  }

  const dates = Array.from(datesSet).sort()

  return {
    daysCount,
    shiftsCount,
    dates,
    fromWeekStart: lastCompletedWeekStart,
    lastCompletedWeekInfo,
    schedulesToUpdate,
  }
}

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

export default function EmpleadosPage() {
  const { employees, shifts, loading: dataLoading, refreshEmployees, refreshShifts, user, userData } = useData()
  const { toast } = useToast()
  const ownerId = getOwnerIdForActor(user, userData)
  
  // Estados para empleados
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [bulkNames, setBulkNames] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [lastCompletedWeekInfo, setLastCompletedWeekInfo] = useState<{ start: string; end: string } | null>(null)
  const [employeeDeleteImpact, setEmployeeDeleteImpact] = useState<EmployeeDeleteImpact | null>(null)
  const [editingField, setEditingField] = useState<{id: string, field: string} | null>(null)
  const [inlineValue, setInlineValue] = useState("")

  // Estados para turnos
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Turno | null>(null)
  const [shiftFormData, setShiftFormData] = useState({
    name: "",
    startTime: "",
    endTime: "",
    startTime2: "",
    endTime2: "",
    color: PRESET_COLORS[0],
    colorPrimeraFranja: PRESET_COLORS[0],
    colorSegundaFranja: PRESET_COLORS[1],
  })
  const [hasSecondShift, setHasSecondShift] = useState(false)

  const handleOpenEmployeeDialog = () => {
    setBulkNames("")
    setEmployeeDialogOpen(true)
  }

  const handleInlineSave = async (employeeId: string, field: string, value: string | null) => {
    if (!db) {
      toast({
        title: "Error",
        description: "Firebase no está configurado",
        variant: "destructive",
      })
      return
    }
    if (!ownerId) {
      toast({
        title: "Error",
        description: "Owner no válido",
        variant: "destructive",
      })
      return
    }

    try {
      const updateData: any = {
        updatedAt: serverTimestamp(),
      }

      if (field === 'name') {
        if (!value || !value.trim()) {
          toast({
            title: "Error",
            description: "El nombre es requerido",
            variant: "destructive",
          })
          setEditingField(null)
          setInlineValue("")
          return
        }
        updateData.name = value.trim()
      } else if (field === 'email') {
        updateData.email = value?.trim() || null
      } else if (field === 'phone') {
        updateData.phone = value?.trim() || null
      }

      await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, employeeId), updateData)
      
      toast({
        title: "Actualizado",
        description: "Campo actualizado correctamente",
      })
      
      await refreshEmployees()
      setEditingField(null)
      setInlineValue("")
    } catch (error: any) {
      logger.error("[DEBUG] Error al actualizar campo:", error)
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al actualizar",
        variant: "destructive",
      })
      setEditingField(null)
      setInlineValue("")
    }
  }

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
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
      const namesToAdd = bulkNames.trim()
        ? bulkNames
            .split("\n")
            .map((name: string) => name.trim())
            .filter((name: string) => name.length > 0)
        : []

      if (namesToAdd.length === 0) {
        toast({
          title: "Error",
          description: "Debes ingresar al menos un nombre",
          variant: "destructive",
        })
        return
      }

      if (!ownerId) {
        toast({
          title: "Error",
          description: "Owner no válido",
          variant: "destructive",
        })
        return
      }

      const promises = namesToAdd.map((name: string) =>
        addDoc(collection(db!, COLLECTIONS.EMPLOYEES), {
          name,
          ownerId,
          userId: user!.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )

      await Promise.all(promises)

      toast({
        title: "Empleados creados",
        description: `Se ${namesToAdd.length === 1 ? "ha creado" : "han creado"} ${namesToAdd.length} empleado${namesToAdd.length === 1 ? "" : "s"} correctamente`,
      })
      
      await refreshEmployees()
      setEmployeeDialogOpen(false)
      setBulkNames("")
    } catch (error: any) {
      logger.error("[DEBUG] Error general al crear empleado:", error)
      
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al crear el empleado",
        variant: "destructive",
      })
    }
  }

  const handleDeleteClick = async (id: string, name: string) => {
    setEmployeeToDelete({ id, name })
    setEmployeeDeleteImpact(null)

    if (db && ownerId) {
      try {
        const impact = await computeEmployeeDeleteImpact(db, ownerId, id)
        setEmployeeDeleteImpact(impact)
        setLastCompletedWeekInfo(impact.lastCompletedWeekInfo)
      } catch (error) {
        logger.error("Error al calcular impacto de eliminación:", error)
        setEmployeeDeleteImpact(null)
        setLastCompletedWeekInfo(null)
      }
    }

    setDeleteDialogOpen(true)
  }

  const handleEmployeeDelete = async (mode: "keepHours" | "clearHours") => {
    if (!employeeToDelete || !db) return

    setIsDeleting(true)
    try {
      if (!ownerId) throw new Error("Owner no válido")

      if (mode === "clearHours") {
        let toUpdate = employeeDeleteImpact?.schedulesToUpdate
        if (!toUpdate?.length && (employeeDeleteImpact === null || employeeDeleteImpact.daysCount > 0)) {
          const impact = await computeEmployeeDeleteImpact(db, ownerId, employeeToDelete.id)
          toUpdate = impact.schedulesToUpdate
        }
        if (toUpdate?.length) {
          for (let i = 0; i < toUpdate.length; i += BATCH_LIMIT) {
            const batch = writeBatch(db)
            const chunk = toUpdate!.slice(i, i + BATCH_LIMIT)
            for (const { id: scheduleId, assignments } of chunk) {
              const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId)
              batch.update(scheduleRef, { assignments, updatedAt: serverTimestamp() })
            }
            await batch.commit()
          }
        }
      }

      await deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, employeeToDelete.id))
      await refreshEmployees()
      setDeleteDialogOpen(false)
      setEmployeeToDelete(null)
      setEmployeeDeleteImpact(null)

      if (mode === "keepHours") {
        toast({
          title: "Empleado eliminado",
          description: "El empleado ha sido eliminado. Las horas ya registradas en estadísticas se mantienen.",
        })
      } else {
        toast({
          title: "Empleado eliminado",
          description: "Se han limpiado sus horarios en semanas editables y el empleado ha sido eliminado.",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al eliminar el empleado",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Funciones para turnos
  const handleOpenShiftDialog = (shift?: any) => {
    if (shift) {
      setEditingShift(shift)
      const hasSecond = !!(shift.startTime2 || shift.endTime2)
      setHasSecondShift(hasSecond)
      setShiftFormData({
        name: shift.name,
        startTime: shift.startTime || "",
        endTime: shift.endTime || "",
        startTime2: shift.startTime2 || "",
        endTime2: shift.endTime2 || "",
        color: shift.color,
        colorPrimeraFranja: shift.colorPrimeraFranja || shift.color || PRESET_COLORS[0],
        colorSegundaFranja: shift.colorSegundaFranja || shift.color || PRESET_COLORS[1],
      })
    } else {
      setEditingShift(null)
      setHasSecondShift(false)
      setShiftFormData({
        name: "",
        startTime: "",
        endTime: "",
        startTime2: "",
        endTime2: "",
        color: PRESET_COLORS[0],
        colorPrimeraFranja: PRESET_COLORS[0],
        colorSegundaFranja: PRESET_COLORS[1],
      })
    }
    setShiftDialogOpen(true)
  }

  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validar que los horarios estén presentes
    if (!shiftFormData.startTime || !shiftFormData.endTime) {
      toast({
        title: "Error de validación",
        description: "Los horarios de inicio y fin son obligatorios para mostrar correctamente los turnos en el calendario.",
        variant: "destructive",
      })
      return
    }

    // Validar segunda franja si está activada
    if (hasSecondShift && (!shiftFormData.startTime2 || !shiftFormData.endTime2)) {
      toast({
        title: "Error de validación",
        description: "Si activas el turno cortado, debes especificar los horarios de la segunda franja.",
        variant: "destructive",
      })
      return
    }

    // Validar color de segunda franja si está activada
    if (hasSecondShift && !shiftFormData.colorSegundaFranja) {
      toast({
        title: "Error de validación",
        description: "Si activas el turno cortado, debes especificar el color de la segunda franja.",
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
      if (editingShift) {
        const updateData: any = {
          name: shiftFormData.name,
          color: shiftFormData.color,
          startTime: shiftFormData.startTime,
          endTime: shiftFormData.endTime,
          ownerId,
          updatedAt: serverTimestamp(),
        }
        
        if (hasSecondShift) {
          if (shiftFormData.startTime2) updateData.startTime2 = shiftFormData.startTime2
          if (shiftFormData.endTime2) updateData.endTime2 = shiftFormData.endTime2
          if (shiftFormData.colorPrimeraFranja) updateData.colorPrimeraFranja = shiftFormData.colorPrimeraFranja
          if (shiftFormData.colorSegundaFranja) updateData.colorSegundaFranja = shiftFormData.colorSegundaFranja
        } else {
          updateData.startTime2 = deleteField()
          updateData.endTime2 = deleteField()
          updateData.colorPrimeraFranja = deleteField()
          updateData.colorSegundaFranja = deleteField()
        }
        
        const shiftRef = doc(db, COLLECTIONS.SHIFTS, editingShift.id)
        await updateDoc(shiftRef, updateData)
        
        toast({
          title: "Turno actualizado",
          description: "El turno se ha actualizado correctamente",
        })
      } else {
        const newShiftData: any = {
          name: shiftFormData.name,
          color: shiftFormData.color,
          startTime: shiftFormData.startTime,
          endTime: shiftFormData.endTime,
          ownerId,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
        
        if (hasSecondShift) {
          if (shiftFormData.startTime2) newShiftData.startTime2 = shiftFormData.startTime2
          if (shiftFormData.endTime2) newShiftData.endTime2 = shiftFormData.endTime2
          if (shiftFormData.colorPrimeraFranja) newShiftData.colorPrimeraFranja = shiftFormData.colorPrimeraFranja
          if (shiftFormData.colorSegundaFranja) newShiftData.colorSegundaFranja = shiftFormData.colorSegundaFranja
        }
        
        await addDoc(collection(db, COLLECTIONS.SHIFTS), newShiftData)
        toast({
          title: "Turno creado",
          description: "El turno se ha creado correctamente",
        })
      }
      await refreshShifts()
      setShiftDialogOpen(false)
    } catch (error: any) {
      logger.error("[TURNOS] Error al guardar turno:", error)
      
      if (error.code === "permission-denied") {
        logger.error("[TURNOS] Error de permisos:", {
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

  const handleShiftDelete = async (id: string) => {
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Empleados y Turnos</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Gestiona los empleados y turnos de trabajo</p>
          </div>
        </div>

        <Tabs defaultValue="empleados" className="w-full">
          <TabsList>
            <TabsTrigger value="empleados">
              <Users className="mr-2 h-4 w-4" />
              Empleados
            </TabsTrigger>
            <TabsTrigger value="turnos">
              <Clock className="mr-2 h-4 w-4" />
              Turnos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="empleados" className="space-y-6 mt-6" forceMount>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Lista de Empleados</h3>
                <p className="text-sm text-muted-foreground">Total: {employees.length} empleados</p>
              </div>
              <Button onClick={() => handleOpenEmployeeDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Empleados
              </Button>
            </div>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                {dataLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-12 flex-1" />
                        <Skeleton className="h-12 w-32" />
                        <Skeleton className="h-12 w-32" />
                        <Skeleton className="h-12 w-24" />
                      </div>
                    ))}
                  </div>
                ) : employees.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No hay empleados registrados. Agrega tu primer empleado.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-foreground">Nombre</TableHead>
                        <TableHead className="text-foreground">Email</TableHead>
                        <TableHead className="text-foreground">Teléfono</TableHead>
                        <TableHead className="text-right text-foreground">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee) => {
                        const isEditing = editingField?.id === employee.id
                        const editingThisField = isEditing && editingField?.field
                        
                        return (
                          <TableRow key={employee.id} className="border-border">
                            <TableCell className="font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                {editingThisField === 'name' ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input
                                      value={inlineValue}
                                      onChange={(e) => setInlineValue(e.target.value)}
                                      onBlur={() => handleInlineSave(employee.id, 'name', inlineValue)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleInlineSave(employee.id, 'name', inlineValue)
                                        } else if (e.key === 'Escape') {
                                          setEditingField(null)
                                          setInlineValue("")
                                        }
                                      }}
                                      autoFocus
                                      className="h-8 flex-1"
                                    />
                                  </div>
                                ) : (
                                  <>
                                    <span className="flex-1">{employee.name}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setEditingField({ id: employee.id, field: 'name' })
                                        setInlineValue(employee.name)
                                      }}
                                      title="Editar nombre"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {editingThisField === 'email' ? (
                                <Input
                                  type="email"
                                  value={inlineValue}
                                  onChange={(e) => setInlineValue(e.target.value)}
                                  onBlur={() => handleInlineSave(employee.id, 'email', inlineValue)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleInlineSave(employee.id, 'email', inlineValue)
                                    } else if (e.key === 'Escape') {
                                      setEditingField(null)
                                      setInlineValue("")
                                    }
                                  }}
                                  autoFocus
                                  className="h-8"
                                  placeholder="email@ejemplo.com"
                                />
                              ) : (
                                <div
                                  onClick={() => {
                                    setEditingField({ id: employee.id, field: 'email' })
                                    setInlineValue(employee.email || "")
                                  }}
                                  className="cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2 transition-colors"
                                >
                                  {employee.email || "-"}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {editingThisField === 'phone' ? (
                                <Input
                                  value={inlineValue}
                                  onChange={(e) => setInlineValue(e.target.value)}
                                  onBlur={() => handleInlineSave(employee.id, 'phone', inlineValue)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleInlineSave(employee.id, 'phone', inlineValue)
                                    } else if (e.key === 'Escape') {
                                      setEditingField(null)
                                      setInlineValue("")
                                    }
                                  }}
                                  autoFocus
                                  className="h-8"
                                  placeholder="+1234567890"
                                />
                              ) : (
                                <div
                                  onClick={() => {
                                    setEditingField({ id: employee.id, field: 'phone' })
                                    setInlineValue(employee.phone || "")
                                  }}
                                  className="cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2 transition-colors"
                                >
                                  {employee.phone || "-"}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteClick(employee.id, employee.name)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="turnos" className="space-y-6 mt-6" forceMount>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Turnos de Trabajo</h3>
                <p className="text-sm text-muted-foreground">Configura los turnos disponibles</p>
              </div>
              <Button onClick={() => handleOpenShiftDialog()}>
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
                              const formatTime = (time: string) => {
                                if (!time) return time
                                return time.endsWith(":00") ? time.slice(0, -3) : time
                              }
                              const formatRange = (start: string, end: string) => {
                                return `${formatTime(start)} a ${formatTime(end)}`
                              }
                              
                              const firstShift = shift.startTime && shift.endTime
                                ? formatRange(shift.startTime, shift.endTime)
                                : null
                              const secondShift = shift.startTime2 && shift.endTime2
                                ? formatRange(shift.startTime2, shift.endTime2)
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
                          onClick={() => handleOpenShiftDialog(shift)}
                        >
                          <Pencil className="mr-2 h-3 w-3" />
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleShiftDelete(shift.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog para agregar empleados */}
        <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">
                Agregar Empleados
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Ingresa el nombre del empleado o múltiples nombres (uno por línea) para agregar varios a la vez
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEmployeeSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="bulkNames" className="text-foreground">
                    Nombres de Empleados *
                  </Label>
                  <Textarea
                    id="bulkNames"
                    value={bulkNames}
                    onChange={(e) => setBulkNames(e.target.value)}
                    placeholder="Ingresa un nombre por línea. Ejemplo:&#10;Juan Pérez&#10;María García&#10;Carlos López"
                    className="border-input bg-background text-foreground min-h-32"
                    rows={6}
                  />
                  <p className="text-sm text-muted-foreground">
                    Escribe un nombre por línea para agregar múltiples empleados a la vez. Puedes editar los detalles (email, teléfono) después haciendo clic en cada campo.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEmployeeDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Agregar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog para agregar/editar turnos */}
        <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">
                {editingShift ? "Editar Turno" : "Agregar Turno"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingShift ? "Actualiza los datos del turno" : "Ingresa los datos del nuevo turno"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleShiftSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground">
                    Nombre *
                  </Label>
                  <Input
                    id="name"
                    value={shiftFormData.name}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, name: e.target.value })}
                    placeholder="Ej: Mañana, Tarde, Noche"
                    required
                    className="border-input bg-background text-foreground"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-medium text-foreground">
                    Primera Franja Horaria *
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      (Obligatorio para mostrar horarios correctamente)
                    </span>
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime" className="text-foreground">
                        Hora Inicio *
                      </Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={shiftFormData.startTime}
                        onChange={(e) => setShiftFormData({ ...shiftFormData, startTime: e.target.value })}
                        className="border-input bg-background text-foreground"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime" className="text-foreground">
                        Hora Fin *
                      </Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={shiftFormData.endTime}
                        onChange={(e) => setShiftFormData({ ...shiftFormData, endTime: e.target.value })}
                        className="border-input bg-background text-foreground"
                        required
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
                        setShiftFormData({ 
                          ...shiftFormData, 
                          startTime2: "", 
                          endTime2: "",
                          colorPrimeraFranja: PRESET_COLORS[0],
                          colorSegundaFranja: PRESET_COLORS[1]
                        })
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
                          value={shiftFormData.startTime2}
                          onChange={(e) => setShiftFormData({ ...shiftFormData, startTime2: e.target.value })}
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
                          value={shiftFormData.endTime2}
                          onChange={(e) => setShiftFormData({ ...shiftFormData, endTime2: e.target.value })}
                          className="border-input bg-background text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {hasSecondShift ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-foreground">Color Primera Franja *</Label>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`h-10 w-10 rounded-full border-2 transition-all ${
                              shiftFormData.colorPrimeraFranja === color ? "border-foreground scale-110" : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setShiftFormData({ ...shiftFormData, colorPrimeraFranja: color, color: color })}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Color Segunda Franja *</Label>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`h-10 w-10 rounded-full border-2 transition-all ${
                              shiftFormData.colorSegundaFranja === color ? "border-foreground scale-110" : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setShiftFormData({ ...shiftFormData, colorSegundaFranja: color })}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-foreground">Color *</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`h-10 w-10 rounded-full border-2 transition-all ${
                            shiftFormData.color === color ? "border-foreground scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setShiftFormData({ ...shiftFormData, color })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShiftDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingShift ? "Actualizar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* AlertDialog para eliminar empleado */}
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open)
            if (!open) setEmployeeDeleteImpact(null)
          }}
        >
          <AlertDialogContent className="border-2 border-destructive">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <AlertDialogTitle className="text-2xl text-destructive">
                  ⚠️ Eliminar Empleado
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-lg font-semibold text-foreground pt-2">
                ¿Eliminar a <span className="text-destructive font-bold text-xl">{employeeToDelete?.name}</span>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              {(!employeeDeleteImpact || (employeeDeleteImpact.daysCount === 0 && employeeDeleteImpact.shiftsCount === 0)) ? (
                <>
                  <div className="bg-destructive/5 border-l-4 border-destructive p-4 rounded-r">
                    <p className="font-bold text-destructive mb-2">⚠️ Esta acción eliminará al empleado del sistema.</p>
                    <p className="text-sm">No tiene turnos en semanas futuras editables. Las semanas marcadas como &quot;Listo&quot; no se modifican.</p>
                  </div>
                  <p className="text-center font-bold text-destructive text-lg">⛔ Esta acción NO se puede deshacer</p>
                </>
              ) : (
                <>
                  <div className="bg-destructive/5 border-l-4 border-destructive p-4 rounded-r">
                    <p className="font-bold text-destructive mb-2">⚠️ Este empleado tiene turnos en semanas NO &quot;Listo&quot;</p>
                    <p className="text-sm mb-2">
                      Si lo eliminas, desaparecerá de esas semanas. Las semanas &quot;Listo&quot; se conservan. Las horas ya registradas pueden permanecer en las estadísticas mensuales según la opción que elijas.
                    </p>
                    <ul className="space-y-1 text-sm mt-2">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span className="text-green-700 dark:text-green-400">Semanas &quot;Listo&quot; no se modifican (historial protegido)</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    {employeeDeleteImpact.lastCompletedWeekInfo && (
                      <p className="text-sm">
                        <strong>Última semana completada:</strong> {employeeDeleteImpact.lastCompletedWeekInfo.start} – {employeeDeleteImpact.lastCompletedWeekInfo.end}
                      </p>
                    )}
                    {employeeDeleteImpact.fromWeekStart && (
                      <p className="text-sm">
                        <strong>Desde semana:</strong> {employeeDeleteImpact.fromWeekStart}
                      </p>
                    )}
                    <p className="text-sm"><strong>Días afectados:</strong> {employeeDeleteImpact.daysCount}</p>
                    <p className="text-sm"><strong>Turnos afectados:</strong> {employeeDeleteImpact.shiftsCount}</p>
                    {employeeDeleteImpact.dates.length > 0 && (
                      <p className="text-sm">
                        <strong>Fechas:</strong>{" "}
                        {employeeDeleteImpact.dates.slice(0, 6).join(", ")}
                        {employeeDeleteImpact.dates.length > 6 && ` y ${employeeDeleteImpact.dates.length - 6} más…`}
                      </p>
                    )}
                  </div>
                  <p className="text-center font-bold text-destructive text-lg">⛔ Esta acción NO se puede deshacer</p>
                </>
              )}
            </div>
            <AlertDialogFooter className="gap-2 flex-wrap">
              <AlertDialogCancel disabled={isDeleting} className="w-full sm:w-auto">
                Cancelar
              </AlertDialogCancel>
              {(!employeeDeleteImpact || (employeeDeleteImpact.daysCount === 0 && employeeDeleteImpact.shiftsCount === 0)) ? (
                <Button
                  variant="destructive"
                  onClick={() => handleEmployeeDelete("keepHours")}
                  disabled={isDeleting}
                  className="w-full sm:w-auto font-bold py-3"
                >
                  {isDeleting ? "Eliminando..." : "Eliminar definitivamente"}
                </Button>
              ) : (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => handleEmployeeDelete("keepHours")}
                    disabled={isDeleting}
                    className="w-full sm:w-auto font-bold py-3 bg-destructive/80 hover:bg-destructive/90"
                  >
                    {isDeleting ? "Eliminando..." : "Eliminar y mantener horas"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleEmployeeDelete("clearHours")}
                    disabled={isDeleting}
                    className="w-full sm:w-auto font-bold py-3"
                  >
                    {isDeleting ? "Eliminando..." : "Limpiar horarios y eliminar"}
                  </Button>
                </>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}
