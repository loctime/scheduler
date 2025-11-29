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
import { Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function EmpleadosPage() {
  const { employees, loading: dataLoading, refreshEmployees, user } = useData()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bulkNames, setBulkNames] = useState("")
  const { toast } = useToast()
  
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
      console.error("[DEBUG] Error al actualizar campo:", error)
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
      console.error("[DEBUG] ❌ Error general al crear empleado:", error)
      
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al crear el empleado",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este empleado?")) return

    if (!db) {
      toast({
        title: "Error",
        description: "Firebase no está configurado",
        variant: "destructive",
      })
      return
    }

    try {
      await deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, id))
      // Refrescar datos del contexto
      await refreshEmployees()
      toast({
        title: "Empleado eliminado",
        description: "El empleado se ha eliminado correctamente",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al eliminar el empleado",
        variant: "destructive",
      })
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
                              onClick={() => handleDelete(employee.id)}
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
      </div>
    </DashboardLayout>
  )
}
