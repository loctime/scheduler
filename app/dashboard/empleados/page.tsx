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
import { Plus, Trash2, AlertTriangle } from "lucide-react"
import { format, parseISO, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { Skeleton } from "@/components/ui/skeleton"
import { logger } from "@/lib/logger"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Horario } from "@/lib/types"

export default function EmpleadosPage() {
  const { employees, loading: dataLoading, refreshEmployees, user } = useData()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bulkNames, setBulkNames] = useState("")
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [lastCompletedWeekInfo, setLastCompletedWeekInfo] = useState<{ start: string; end: string } | null>(null)
  
  // Estados para edición inline
  const [editingField, setEditingField] = useState<{id: string, field: string} | null>(null)
  const [inlineValue, setInlineValue] = useState("")

  const handleOpenDialog = () => {
    setBulkNames("")
    setDialogOpen(true)
  }

  // Función para guardar cambios inline
  const handleInlineSave = async (employeeId: string, field: string, value: string | null) => {
    if (!db) {
      toast({
        title: "Error",
        description: "Firebase no está configurado",
        variant: "destructive",
      })
      return
    }

    try {
      const updateData: any = {
        updatedAt: serverTimestamp(),
      }

      // Solo actualizar el campo que cambió
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
      // Solo creación: agregar uno o múltiples empleados
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

      // Crear todos los empleados
      const promises = namesToAdd.map((name: string) =>
        addDoc(collection(db!, COLLECTIONS.EMPLOYEES), {
          name,
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
      
      // Refrescar datos del contexto
      await refreshEmployees()
      setDialogOpen(false)
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
    
    // Obtener información de la última semana completada antes de abrir el modal
    // Optimizado: obtener solo semanas completadas con límite
    if (db) {
      try {
        // Query optimizada: obtener semanas completadas
        // Nota: Para usar where + orderBy necesitaríamos un índice compuesto
        // Por ahora obtenemos todas las completadas y ordenamos en cliente
        const completedQuery = query(
          collection(db, COLLECTIONS.SCHEDULES),
          where("completada", "==", true),
        )
        const schedulesSnapshot = await getDocs(completedQuery)
        
        const completedSchedules = schedulesSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Horario[]
          .filter((s) => s.weekStart)
          .sort((a, b) => {
            if (!a.weekStart || !b.weekStart) return 0
            return b.weekStart.localeCompare(a.weekStart)
          })
        
        if (completedSchedules.length > 0) {
          const lastCompleted = completedSchedules[0]
          const weekStartDate = parseISO(lastCompleted.weekStart!)
          const weekEndDate = addDays(weekStartDate, 6)
          
          setLastCompletedWeekInfo({
            start: format(weekStartDate, "d 'de' MMMM 'de' yyyy", { locale: es }),
            end: format(weekEndDate, "d 'de' MMMM 'de' yyyy", { locale: es }),
          })
        } else {
          setLastCompletedWeekInfo(null)
        }
      } catch (error) {
        logger.error("Error al obtener información de semanas completadas:", error)
        setLastCompletedWeekInfo(null)
      }
    }
    
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!employeeToDelete || !db) {
      return
    }

    setIsDeleting(true)
    try {
      // Optimizar: obtener solo semanas completadas para encontrar la última
      const completedQuery = query(
        collection(db, COLLECTIONS.SCHEDULES),
        where("completada", "==", true),
      )
      const completedSnapshot = await getDocs(completedQuery)
      
      // Encontrar la última semana completada (marcada como "listo")
      const completedSchedules = completedSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Horario[]
        .filter((s) => s.weekStart)
        .sort((a, b) => {
          if (!a.weekStart || !b.weekStart) return 0
          return b.weekStart.localeCompare(a.weekStart)
        })
      
      let lastCompletedWeekStart: string | null = null
      if (completedSchedules.length > 0) {
        lastCompletedWeekStart = completedSchedules[0].weekStart || null
      }
      
      // Obtener todos los horarios para filtrar en cliente
      // Nota: Para optimizar más necesitaríamos índices compuestos en Firestore
      if (!db) {
        throw new Error("Firebase no está configurado")
      }
      
      const schedulesQuery = query(collection(db, COLLECTIONS.SCHEDULES))
      const schedulesSnapshot = await getDocs(schedulesQuery)
      
      // Filtrar solo los horarios que son futuros a la última semana completada
      const allSchedules = schedulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Horario[]
      
      const schedulesToUpdate = allSchedules.filter((schedule) => {
        // No tocar semanas completadas
        if (schedule.completada === true) {
          return false
        }
        
        // Si no hay última semana completada, eliminar de todos los no completados
        if (!lastCompletedWeekStart) {
          return true
        }
        
        // Solo eliminar de semanas futuras a la última completada
        if (schedule.weekStart && schedule.weekStart > lastCompletedWeekStart!) {
          return true
        }
        
        return false
      })
      
      // Eliminar asignaciones del empleado solo en horarios seleccionados usando batch writes
      const BATCH_LIMIT = 500 // Límite de Firestore
      const updates: Array<{ scheduleId: string; updateData: any }> = []
      
      for (const schedule of schedulesToUpdate) {
        const scheduleDoc = schedulesSnapshot.docs.find((doc) => doc.id === schedule.id)
        if (!scheduleDoc) continue
        
        const updatedAssignments = { ...schedule.assignments }
        let hasChanges = false
        
        // Eliminar el empleado de todas las fechas de este horario
        Object.keys(updatedAssignments).forEach((date) => {
          if (updatedAssignments[date][employeeToDelete.id]) {
            delete updatedAssignments[date][employeeToDelete.id]
            hasChanges = true
          }
        })
        
        // Agregar a la lista de actualizaciones si hay cambios
        if (hasChanges) {
          updates.push({
            scheduleId: schedule.id,
            updateData: {
              assignments: updatedAssignments,
              updatedAt: serverTimestamp(),
            },
          })
        }
      }
      
      // Ejecutar actualizaciones en batches
      if (updates.length > 0 && db) {
        for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
          const batch = writeBatch(db)
          const batchUpdates = updates.slice(i, i + BATCH_LIMIT)
          
          for (const { scheduleId, updateData } of batchUpdates) {
            const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId)
            batch.update(scheduleRef, updateData)
          }
          
          await batch.commit()
        }
      }
      
      // Eliminar el empleado del sistema
      if (db) {
        await deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, employeeToDelete.id))
      }
      
      // Refrescar datos del contexto
      await refreshEmployees()
      
      setDeleteDialogOpen(false)
      setEmployeeToDelete(null)
      
      toast({
        title: "Empleado eliminado",
        description: lastCompletedWeekStart 
          ? `El empleado se ha eliminado de todas las semanas futuras a la última semana completada (${lastCompletedWeekStart})`
          : "El empleado se ha eliminado de todos los horarios",
      })
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

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Empleados</h2>
            <p className="text-muted-foreground">Gestiona los empleados de tu equipo</p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Empleados
          </Button>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Lista de Empleados</CardTitle>
            <CardDescription className="text-muted-foreground">Total: {employees.length} empleados</CardDescription>
          </CardHeader>
          <CardContent>
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
                          {editingThisField === 'name' ? (
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
                              className="h-8"
                            />
                          ) : (
                            <div
                              onClick={() => {
                                setEditingField({ id: employee.id, field: 'name' })
                                setInlineValue(employee.name)
                              }}
                              className="cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2 transition-colors"
                            >
                              {employee.name}
                            </div>
                          )}
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">
                Agregar Empleados
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Ingresa el nombre del empleado o múltiples nombres (uno por línea) para agregar varios a la vez
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
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
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Agregar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
              <div className="bg-destructive/5 border-l-4 border-destructive p-4 rounded-r">
                <p className="font-bold text-destructive mb-2">⚠️ Esta acción eliminará:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold">•</span>
                    <span>Al empleado <strong>del sistema completamente</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold">•</span>
                    <span>Sus asignaciones de <strong>todas las semanas futuras</strong> a la última semana marcada como "listo"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-green-700">Se mantendrán sus asignaciones en semanas ya marcadas como "listo" (historial)</span>
                  </li>
                </ul>
              </div>
              {lastCompletedWeekInfo && (
                <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-500 rounded-lg p-4">
                  <p className="font-bold text-green-700 dark:text-green-400 mb-2">
                    📅 Última semana completada:
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-300">
                    <strong>Desde:</strong> {lastCompletedWeekInfo.start}
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-300">
                    <strong>Hasta:</strong> {lastCompletedWeekInfo.end}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-2 italic">
                    ✓ Todas las semanas hasta esta fecha están protegidas y no se eliminarán
                  </p>
                </div>
              )}
              <p className="text-center font-bold text-destructive text-lg">
                ⛔ Esta acción NO se puede deshacer
              </p>
            </div>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={isDeleting} className="w-full sm:w-auto">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto font-bold text-lg py-3"
              >
                {isDeleting ? "Eliminando..." : "⚠️ Eliminar Definitivamente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}
