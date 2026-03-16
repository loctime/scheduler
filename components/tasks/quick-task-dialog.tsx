import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { TaskFormData } from "@/hooks/use-task-management"
import { TaskType, TaskShift } from "@/types/task"
import { Empleado } from "@/lib/types"

interface QuickTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: TaskFormData) => void
  employees: Empleado[]
  selectedDay?: number
  selectedDate?: Date
  selectedShift?: TaskShift
  isLoading?: boolean
}

const DIAS_SEMANA = [
  { id: 0, name: "Domingo" },
  { id: 1, name: "Lunes" },
  { id: 2, name: "Martes" },
  { id: 3, name: "Miércoles" },
  { id: 4, name: "Jueves" },
  { id: 5, name: "Viernes" },
  { id: 6, name: "Sábado" },
]

export function QuickTaskDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  employees, 
  selectedDay,
  selectedDate,
  selectedShift,
  isLoading = false 
}: QuickTaskDialogProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    detailedContent: "",
    instructions: "",
    employeeIds: [],
    daysOfWeek: selectedDay ? [selectedDay] : [],
    taskType: selectedDate ? "specific" : "weekly",
    specificDate: selectedDate ? selectedDate.toISOString().split('T')[0] : "",
    shift: selectedShift || "both",
    active: true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    // Reset form
    setFormData({
      title: "",
      description: "",
      detailedContent: "",
      instructions: "",
      employeeIds: [],
      daysOfWeek: selectedDay ? [selectedDay] : [],
      taskType: selectedDate ? "specific" : "weekly",
      specificDate: selectedDate ? selectedDate.toISOString().split('T')[0] : "",
      shift: selectedShift || "both",
      active: true,
    })
  }

  const handleTaskTypeChange = (value: TaskType) => {
    setFormData(prev => ({ 
      ...prev, 
      taskType: value,
      daysOfWeek: value === "weekly" && selectedDay ? [selectedDay] : [],
      specificDate: value === "specific" && selectedDate ? selectedDate.toISOString().split('T')[0] : ""
    }))
  }

  const handleDayChange = (dayId: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: checked 
        ? [...(prev.daysOfWeek || []), dayId]
        : prev.daysOfWeek?.filter(id => id !== dayId) || []
    }))
  }

  const handleEmployeeChange = (employeeId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      employeeIds: checked 
        ? [...(prev.employeeIds || []), employeeId]
        : prev.employeeIds?.filter(id => id !== employeeId) || []
    }))
  }

  const selectedDayName = selectedDay !== undefined ? DIAS_SEMANA.find(d => d.id === selectedDay)?.name : ""
  const selectedDateString = selectedDate ? selectedDate.toLocaleDateString('es-AR') : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Agregar Tarea Rápida
            {(selectedDayName || selectedDateString) && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                {selectedDayName && ` ${selectedDayName}`}
                {selectedDateString && ` ${selectedDateString}`}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Información básica */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">Título de la tarea *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Revisar inventario"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="description">Descripción breve</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción corta de la tarea"
                rows={2}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Tipo de tarea */}
          <div>
            <Label>Tipo de tarea</Label>
            <Select
              value={formData.taskType || "weekly"}
              onValueChange={handleTaskTypeChange}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diaria (todos los días)</SelectItem>
                <SelectItem value="weekly">Semanal (días específicos)</SelectItem>
                <SelectItem value="specific">Fecha específica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campos condicionales */}
          {formData.taskType === "weekly" && (
            <div>
              <Label>Días de la semana</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {DIAS_SEMANA.map((dia) => (
                  <div key={dia.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${dia.id}`}
                      checked={formData.daysOfWeek?.includes(dia.id) || false}
                      onCheckedChange={(checked) => handleDayChange(dia.id, checked as boolean)}
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
            </div>
          )}

          {formData.taskType === "specific" && (
            <div>
              <Label htmlFor="specificDate">Fecha específica</Label>
              <Input
                id="specificDate"
                type="date"
                value={formData.specificDate || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, specificDate: e.target.value }))}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Asignación a empleados */}
          <div>
            <Label>Asignar a empleados</Label>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`employee-${employee.id}`}
                    checked={formData.employeeIds?.includes(employee.id) || false}
                    onCheckedChange={(checked) => handleEmployeeChange(employee.id, checked as boolean)}
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
              <p className="text-xs text-gray-500">Visible para todos los empleados</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!formData.title.trim() || isLoading}
            >
              {isLoading ? "Creando..." : "Crear Tarea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
