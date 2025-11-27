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
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Empleado } from "@/lib/types"

export default function EmpleadosPage() {
  const { employees, loading: dataLoading, refreshEmployees, user } = useData()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Empleado | null>(null)
  const [formData, setFormData] = useState<{ name: string; email: string; phone: string }>({
    name: "",
    email: "",
    phone: "",
  })
  const [bulkNames, setBulkNames] = useState("")
  const { toast } = useToast()

  const handleOpenDialog = (employee?: any) => {
    if (employee) {
      setEditingEmployee(employee)
      setFormData({ name: employee.name, email: employee.email || "", phone: employee.phone || "" })
      setBulkNames("")
    } else {
      setEditingEmployee(null)
      setFormData({ name: "", email: "", phone: "" })
      setBulkNames("")
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
      if (editingEmployee) {
        // Modo edición: actualizar un solo empleado
        if (!formData.name.trim()) {
          toast({
            title: "Error",
            description: "El nombre es requerido",
            variant: "destructive",
          })
          return
        }
        await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, editingEmployee.id), {
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          updatedAt: serverTimestamp(),
        })
        toast({
          title: "Empleado actualizado",
          description: "Los datos del empleado se han actualizado correctamente",
        })
      } else {
        // Modo creación: agregar uno o múltiples empleados
        const namesToAdd = bulkNames.trim()
          ? bulkNames
              .split("\n")
              .map((name: string) => name.trim())
              .filter((name: string) => name.length > 0)
          : formData.name.trim()
          ? [formData.name.trim()]
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
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        )

        await Promise.all(promises)

        toast({
          title: "Empleados creados",
          description: `Se ${namesToAdd.length === 1 ? "ha creado" : "han creado"} ${namesToAdd.length} empleado${namesToAdd.length === 1 ? "" : "s"} correctamente`,
        })
      }
      // Refrescar datos del contexto
      await refreshEmployees()
      setDialogOpen(false)
      setFormData({ name: "", email: "", phone: "" })
      setBulkNames("")
      setEditingEmployee(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al guardar el empleado",
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
                  {employees.map((employee) => (
                    <TableRow key={employee.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{employee.name}</TableCell>
                      <TableCell className="text-muted-foreground">{employee.email || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{employee.phone || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(employee)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(employee.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">
                {editingEmployee ? "Editar Empleado" : "Agregar Empleados"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingEmployee
                  ? "Actualiza el nombre del empleado"
                  : "Ingresa el nombre del empleado o múltiples nombres (uno por línea) para agregar varios a la vez"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {editingEmployee ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-foreground">
                        Nombre *
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="border-input bg-background text-foreground"
                        placeholder="Nombre del empleado"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-foreground">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="border-input bg-background text-foreground"
                        placeholder="email@ejemplo.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-foreground">
                        Teléfono
                      </Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="border-input bg-background text-foreground"
                        placeholder="+1234567890"
                      />
                    </div>
                  </div>
                ) : (
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
                      Escribe un nombre por línea para agregar múltiples empleados a la vez
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingEmployee ? "Actualizar" : "Agregar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
