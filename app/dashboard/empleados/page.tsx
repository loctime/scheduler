"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore"
import { auth, db, isFirebaseConfigured } from "@/lib/firebase"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function EmpleadosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" })
  const { toast } = useToast()

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      router.push("/")
      return
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/")
      } else {
        setUser(currentUser)
        setLoading(false)
      }
    })

    const q = query(collection(db, "employees"), orderBy("name"))
    const unsubscribeEmployees = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    })

    return () => {
      unsubscribeAuth()
      unsubscribeEmployees()
    }
  }, [router])

  const handleOpenDialog = (employee?: any) => {
    if (employee) {
      setEditingEmployee(employee)
      setFormData({ name: employee.name, email: employee.email || "", phone: employee.phone || "" })
    } else {
      setEditingEmployee(null)
      setFormData({ name: "", email: "", phone: "" })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingEmployee) {
        await updateDoc(doc(db, "employees", editingEmployee.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        })
        toast({
          title: "Empleado actualizado",
          description: "Los datos del empleado se han actualizado correctamente",
        })
      } else {
        await addDoc(collection(db, "employees"), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        toast({
          title: "Empleado creado",
          description: "El empleado se ha creado correctamente",
        })
      }
      setDialogOpen(false)
      setFormData({ name: "", email: "", phone: "" })
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

    try {
      await deleteDoc(doc(db, "employees", id))
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
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
            Agregar Empleado
          </Button>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Lista de Empleados</CardTitle>
            <CardDescription className="text-muted-foreground">Total: {employees.length} empleados</CardDescription>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
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
                {editingEmployee ? "Editar Empleado" : "Agregar Empleado"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingEmployee ? "Actualiza los datos del empleado" : "Ingresa los datos del nuevo empleado"}
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
                    required
                    className="border-input bg-background text-foreground"
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
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingEmployee ? "Actualizar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
