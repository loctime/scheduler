"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { doc, onSnapshot, setDoc, updateDoc, deleteField } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Trash2, Edit, Plus, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useOwnerIdFromSlug, useEmployeesByOwnerId } from "@/hooks/use-owner-data"
import { Task } from "@/types/task"
import { DataContext } from "@/contexts/data-context"
import { useContext } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
]

interface TaskFormData {
  id?: string
  title: string
  description: string
  daysOfWeek: number[]
  employeeIds: string[]
  active: boolean
}

export default function TasksPage() {
  const dataContext = useContext(DataContext)
  const user = dataContext?.user
  
  return (
    <DashboardLayout user={user}>
      <TasksContent />
    </DashboardLayout>
  )
}

function TasksContent() {
  const params = useParams()
  const router = useRouter()
  const companySlug = params.companySlug as string
  const { toast } = useToast()
  // Usar useData para obtener el usuario autenticado
  const dataContext = useContext(DataContext)
  const user = dataContext?.user
  const ownerId = user?.uid || ""
  const { employees } = useEmployeesByOwnerId(ownerId)
  
  const [actions, setActions] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingAction, setEditingAction] = useState<TaskFormData | null>(null)
  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    daysOfWeek: [new Date().getDay()],
    employeeIds: [],
    active: true,
  })

  // Cargar acciones desde Firestore
  useEffect(() => {
    if (!ownerId) return

    const unsubscribe = onSnapshot(
      doc(db!, "apps", "horarios", "dailyActions", ownerId),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data()
          setActions(data?.actions || [])
        } else {
          setActions([])
        }
        setIsLoading(false)
      },
      (error) => {
        console.error("Error loading daily actions:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar las acciones diarias",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    )

    return unsubscribe
  }, [ownerId, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!ownerId || !formData.title.trim()) return

    try {
      const docRef = doc(db!, "apps", "horarios", "dailyActions", ownerId)
      const newTask: Task = {
        id: editingAction?.id || Date.now().toString(),
        ownerId: ownerId,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        daysOfWeek: formData.daysOfWeek,
        employeeIds: formData.employeeIds.length > 0 ? formData.employeeIds : undefined,
        active: formData.active,
        createdAt: new Date(),
      }

      const currentData = actions.find(a => a.id === newTask.id)
      
      if (currentData) {
        // Actualizar acción existente
        const updatedActions = actions.map(a => 
          a.id === newTask.id ? newTask : a
        )
        await updateDoc(docRef, { actions: updatedActions })
        toast({ title: "Acción actualizada", description: "La acción se actualizó correctamente" })
      } else {
        // Agregar nueva acción
        await setDoc(docRef, { 
          actions: [...actions, newTask] 
        }, { merge: true })
        toast({ title: "Acción creada", description: "La acción se creó correctamente" })
      }

      handleCloseDialog()
    } catch (error) {
      console.error("Error saving action:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la acción",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (actionId: string) => {
    if (!ownerId) return

    try {
      const docRef = doc(db!, "apps", "horarios", "dailyActions", ownerId)
      const updatedActions = actions.filter(a => a.id !== actionId)
      await updateDoc(docRef, { actions: updatedActions })
      toast({ title: "Acción eliminada", description: "La acción se eliminó correctamente" })
    } catch (error) {
      console.error("Error deleting action:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la acción",
        variant: "destructive",
      })
    }
  }

  const handleToggleActive = async (actionId: string, active: boolean) => {
    if (!ownerId) return

    try {
      const docRef = doc(db!, "apps", "horarios", "dailyActions", ownerId)
      const updatedActions = actions.map(a => 
        a.id === actionId ? { ...a, active } : a
      )
      await updateDoc(docRef, { actions: updatedActions })
    } catch (error) {
      console.error("Error toggling action:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la acción",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (action: Task) => {
    const formDataForEdit: TaskFormData = {
      id: action.id,
      title: action.title,
      description: action.description || "",
      daysOfWeek: action.daysOfWeek || [],
      employeeIds: action.employeeIds || [],
      active: action.active,
    }
    setEditingAction(formDataForEdit)
    setFormData(formDataForEdit)
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingAction(null)
    setFormData({
      title: "",
      description: "",
      daysOfWeek: [new Date().getDay()],
      employeeIds: [],
      active: true,
    })
  }

  if (isLoading) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Acciones Diarias</h1>
          <p className="text-muted-foreground">
            Configura acciones específicas para cada día de la semana
          </p>
        </div>
        
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingAction(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Acción
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAction ? "Editar Acción" : "Nueva Acción"}
              </DialogTitle>
              <DialogDescription>
                Configura una acción para un día específico de la semana
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Pedido de insumos"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalles adicionales..."
                />
              </div>
              
              <div>
                <Label>Días de la semana</Label>
                <div className="space-y-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={formData.daysOfWeek.includes(day.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({ 
                              ...formData, 
                              daysOfWeek: [...formData.daysOfWeek, day.value] 
                            })
                          } else {
                            setFormData({ 
                              ...formData, 
                              daysOfWeek: formData.daysOfWeek.filter(d => d !== day.value) 
                            })
                          }
                        }}
                      />
                      <Label htmlFor={`day-${day.value}`} className="text-sm">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <Label>Asignar a empleados (opcional)</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {employees.map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={employee.id}
                        checked={formData.employeeIds.includes(employee.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              employeeIds: [...formData.employeeIds, employee.id],
                            })
                          } else {
                            setFormData({
                              ...formData,
                              employeeIds: formData.employeeIds.filter(id => id !== employee.id),
                            })
                          }
                        }}
                      />
                      <Label htmlFor={employee.id} className="text-sm">
                        {employee.name}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Si no seleccionas empleados, la acción será visible para todos
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">Activa</Label>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingAction ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {actions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay acciones configuradas</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primera acción diaria para que los empleados la vean en el PWA
              </p>
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Acción
              </Button>
            </CardContent>
          </Card>
        ) : (
          actions.map((action) => (
            <Card key={action.id} className={!action.active ? "opacity-50" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                    <Badge variant={action.active ? "default" : "secondary"}>
                      {action.active ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(action)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(action.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {action.description && (
                  <CardDescription>{action.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">Días: </span>
                    {(action.daysOfWeek || []).map(day => DAYS_OF_WEEK.find(d => d.value === day)?.label).join(', ')}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>Activa:</span>
                    <Switch
                      checked={action.active}
                      onCheckedChange={(checked) => handleToggleActive(action.id, checked)}
                    />
                  </div>
                </div>
                {action.employeeIds && action.employeeIds.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="font-medium">Asignada a: </span>
                    {action.employeeIds
                      .map(id => employees.find(e => e.id === id)?.name)
                      .filter(Boolean)
                      .join(", ") || "Ninguno"}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
