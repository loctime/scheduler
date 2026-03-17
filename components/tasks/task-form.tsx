"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TaskFormData } from "@/hooks/use-task-management"
import { Empleado } from "@/lib/types"
import { TaskType, TaskShift } from "@/types/task"
import { RichTextEditor } from "@/components/tasks/simple-rich-text-editor"

const DIAS_SEMANA = [
  { id: 0, name: "Domingo" },
  { id: 1, name: "Lunes" },
  { id: 2, name: "Martes" },
  { id: 3, name: "Miércoles" },
  { id: 4, name: "Jueves" },
  { id: 5, name: "Viernes" },
  { id: 6, name: "Sábado" },
]

interface TaskFormProps {
  task?: Partial<TaskFormData> | null
  employees: Empleado[]
  onSubmit: (data: TaskFormData) => void
  onCancel: () => void
  onDelete?: () => void
  isLoading?: boolean
}

export function TaskForm({ task, employees, onSubmit, onCancel, onDelete, isLoading = false }: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: task?.title || "",
    description: task?.description || "",
    detailedContent: task?.detailedContent || "",
    instructions: task?.instructions || "",
    employeeIds: task?.employeeIds || [],
    daysOfWeek: task?.daysOfWeek || [],
    taskType: task?.taskType || "weekly",
    specificDate: task?.specificDate || "",
    shift: task?.shift || "both",
    active: task?.active ?? true,
  })

  console.log("TaskForm - formData:", formData)
  console.log("TaskForm - task:", task)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleEmployeeChange = (employeeId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      employeeIds: checked
        ? [...(prev.employeeIds || []), employeeId]
        : (prev.employeeIds || []).filter(id => id !== employeeId)
    }))
  }

  const handleDayChange = (dayId: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: checked
        ? [...(prev.daysOfWeek || []), dayId]
        : (prev.daysOfWeek || []).filter(id => id !== dayId)
    }))
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {task?.title ? "Editar Tarea" : "Nueva Tarea"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información básica */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título de la tarea"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción breve de la tarea"
                rows={3}
                disabled={isLoading}
              />
            </div>
          </div>

          <Separator />

          {/* Tipo de tarea */}
          <div>
            <Label htmlFor="taskType" className="text-base font-medium">Tipo de Tarea</Label>
            <Select
              value={formData.taskType || "weekly"}
              onValueChange={(value: TaskType) =>
                setFormData(prev => ({ 
                  ...prev, 
                  taskType: value,
                  // Limpiar campos irrelevantes al cambiar tipo
                  daysOfWeek: value === "weekly" ? prev.daysOfWeek : [],
                  specificDate: value === "specific" ? prev.specificDate : ""
                }))
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo de tarea" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diaria (todos los días)</SelectItem>
                <SelectItem value="weekly">Semanal (días específicos)</SelectItem>
                <SelectItem value="specific">Fecha específica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campos condicionales según tipo */}
          {formData.taskType === "weekly" && (
            <div>
              <Label className="text-base font-medium">Días de la Semana</Label>
              <p className="text-sm text-gray-500 mb-3">
                Selecciona los días en que esta tarea debe mostrarse
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DIAS_SEMANA.map((dia) => (
                  <div key={dia.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${dia.id}`}
                      checked={formData.daysOfWeek?.includes(dia.id) || false}
                      onCheckedChange={(checked) => 
                        handleDayChange(dia.id, checked as boolean)
                      }
                      disabled={isLoading}
                    />
                    <Label 
                      htmlFor={`day-${dia.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {dia.name}
                    </Label>
                  </div>
                ))}
              </div>
              {(!formData.daysOfWeek || formData.daysOfWeek.length === 0) && (
                <p className="text-sm text-gray-500 mt-2">
                  La tarea no se mostrará como "tarea del día"
                </p>
              )}
            </div>
          )}

          {formData.taskType === "specific" && (
            <div>
              <Label htmlFor="specificDate">Fecha Específica</Label>
              <Input
                id="specificDate"
                type="date"
                value={formData.specificDate || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, specificDate: e.target.value }))}
                disabled={isLoading}
                min={new Date().toISOString().split('T')[0]} // No permitir fechas pasadas
              />
              <p className="text-sm text-gray-500 mt-1">
                La tarea solo se mostrará en esta fecha específica
              </p>
            </div>
          )}

          {formData.taskType === "daily" && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Tarea diaria:</strong> Esta tarea aparecerá todos los días para los empleados asignados.
              </p>
            </div>
          )}

          <Separator />

          {/* Turno */}
          <div>
            <Label htmlFor="shift" className="text-base font-medium">Turno</Label>
            <Select
              value={formData.shift || "both"}
              onValueChange={(value: TaskShift) =>
                setFormData(prev => ({ ...prev, shift: value }))
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el turno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">🌅 Turno Mañana</SelectItem>
                <SelectItem value="afternoon">🌇 Turno Tarde</SelectItem>
                <SelectItem value="both">🔄 Ambos Turnos</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500 mt-1">
              Selecciona en qué turno se debe realizar esta tarea
            </p>
          </div>

          <Separator />

          {/* Contenido detallado */}
          <div>
            <Label htmlFor="detailedContent">Contenido Detallado</Label>
            <RichTextEditor
              value={formData.detailedContent || ""}
              onChange={(val: string) =>
                setFormData(prev => ({ ...prev, detailedContent: val }))
              }
              disabled={isLoading}
              placeholder="Información detallada, pasos a seguir, etc."
            />
          </div>

          {/* Instrucciones */}
          <div>
            <Label htmlFor="instructions">Instrucciones Especiales</Label>
            <RichTextEditor
              value={formData.instructions || ""}
              onChange={(val: string) =>
                setFormData(prev => ({ ...prev, instructions: val }))
              }
              disabled={isLoading}
              placeholder="Instrucciones importantes, advertencias, etc."
            />
          </div>

          <Separator />

          {/* Asignación de empleados */}
          <div>
            <Label className="text-base font-medium">Asignar a Empleados</Label>
            <p className="text-sm text-gray-500 mb-3">
              Si no seleccionas empleados, la tarea será visible para todos
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`employee-${employee.id}`}
                    checked={formData.employeeIds?.includes(employee.id) || false}
                    onCheckedChange={(checked) => 
                      handleEmployeeChange(employee.id, checked as boolean)
                    }
                    disabled={isLoading}
                  />
                  <Label 
                    htmlFor={`employee-${employee.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {employee.name}
                  </Label>
                </div>
              ))}
            </div>
            {(!formData.employeeIds || formData.employeeIds.length === 0) && (
              <Badge variant="secondary" className="mt-2">
                Visible para todos los empleados
              </Badge>
            )}
          </div>

          <Separator />

          {/* Estado activo */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, active: checked as boolean }))
              }
              disabled={isLoading}
            />
            <Label htmlFor="active" className="cursor-pointer">
              Tarea activa
            </Label>
          </div>

          {/* Botones */}
          <div className="flex justify-between pt-4">
            {/* Botón eliminar - solo en modo edición */}
            {task?.title && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={isLoading}
              >
                Eliminar Tarea
              </Button>
            )}
            
            {/* Botones principales */}
            <div className="flex space-x-3 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !formData.title.trim()}
              >
                {isLoading ? "Guardando..." : (task?.title ? "Actualizar" : "Crear")}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
