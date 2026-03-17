"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTaskManagement } from "@/hooks/use-task-management"
import { useToast } from "@/hooks/use-toast"
import { Plus, X } from "lucide-react"
import { Empleado } from "@/lib/types"

interface QuickCreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Empleado[]
  viewerId: string
  ownerId: string
}

export function QuickCreateTaskDialog({
  open,
  onOpenChange,
  employees,
  viewerId,
  ownerId
}: QuickCreateTaskDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const { createTask } = useTaskManagement()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "El título es requerido",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    
    // Obtener fecha de hoy en formato YYYYMMDD
    const today = new Date()
    const specificDate = today.getFullYear().toString() + 
                       (today.getMonth() + 1).toString().padStart(2, '0') + 
                       today.getDate().toString().padStart(2, '0')

    try {
      const result = await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        detailedContent: "",
        instructions: "",
        employeeIds: selectedEmployees.length > 0 ? selectedEmployees : undefined,
        taskType: "specific",
        specificDate: specificDate,
        shift: "both",
        active: true,
        createdBy: viewerId,
        source: "employee"
      })

      if (result) {
        // Resetear formulario
        setTitle("")
        setDescription("")
        setSelectedEmployees([])
        onOpenChange(false)
        
        toast({
          title: "Tarea creada",
          description: "La tarea se ha creado exitosamente y aparecerá hoy",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear la tarea",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmployeeChange = (employeeId: string, checked: boolean) => {
    setSelectedEmployees(prev => 
      checked 
        ? [...prev, employeeId]
        : prev.filter(id => id !== employeeId)
    )
  }

  const handleClose = () => {
    if (!isLoading) {
      setTitle("")
      setDescription("")
      setSelectedEmployees([])
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nueva Tarea Rápida
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div>
            <label className="text-sm font-medium">Título *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la tarea"
              disabled={isLoading}
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-sm font-medium">Descripción</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción breve (opcional)"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Empleados */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Asignar a empleados (dejar vacío para todos)
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
              {employees.map((emp) => (
                <div key={emp.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`emp-${emp.id}`}
                    checked={selectedEmployees.includes(emp.id)}
                    onCheckedChange={(checked) => 
                      handleEmployeeChange(emp.id, checked as boolean)
                    }
                    disabled={isLoading}
                  />
                  <label 
                    htmlFor={`emp-${emp.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {emp.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !title.trim()}
            >
              {isLoading ? "Creando..." : "Crear Tarea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
