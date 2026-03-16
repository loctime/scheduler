import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { TaskFormData } from "@/hooks/use-task-management"
import { TaskType, TaskShift } from "@/types/task"
import { Empleado } from "@/lib/types"
import { RichTextEditor } from "@/components/tasks/simple-rich-text-editor"

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
  // Generar título sugerido basado en contexto
  const generateSuggestedTitle = () => {
    if (!selectedDay && !selectedDate) return ""
    
    const dayName = selectedDay ? DIAS_SEMANA.find(d => d.id === selectedDay)?.name : ""
    const shiftName = selectedShift ? (selectedShift === "morning" ? "Mañana" : "Tarde") : ""
    
    if (dayName && shiftName) {
      return `Tarea ${dayName} ${shiftName}`
    } else if (dayName) {
      return `Tarea ${dayName}`
    } else if (shiftName) {
      return `Tarea ${shiftName}`
    }
    return ""
  }

  // Generar descripción sugerida
  const generateSuggestedDescription = () => {
    if (!selectedDay && !selectedDate) return ""
    
    const dayName = selectedDay ? DIAS_SEMANA.find(d => d.id === selectedDay)?.name : ""
    const shiftName = selectedShift ? (selectedShift === "morning" ? "mañana" : "tarde") : ""
    const dateStr = selectedDate ? selectedDate.toLocaleDateString('es-AR') : ""
    
    if (dayName && shiftName) {
      return `Tarea programada para el ${dayName} en el turno de la ${shiftName}`
    } else if (dayName) {
      return `Tarea programada para el ${dayName}`
    } else if (dateStr) {
      return `Tarea programada para el ${dateStr}`
    }
    return ""
  }

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

  // Autocompletar cuando cambia el contexto
  useEffect(() => {
    if (open && (selectedDay || selectedDate || selectedShift)) {
      setFormData(prev => ({
        ...prev,
        title: prev.title || generateSuggestedTitle(),
        description: prev.description || generateSuggestedDescription(),
        daysOfWeek: selectedDay ? [selectedDay] : prev.daysOfWeek,
        taskType: selectedDate ? "specific" : (prev.taskType || "weekly"),
        specificDate: selectedDate ? selectedDate.toISOString().split('T')[0] : prev.specificDate,
        shift: selectedShift || prev.shift || "both",
      }))
    }
  }, [open, selectedDay, selectedDate, selectedShift])

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
  const selectedShiftName = selectedShift ? (selectedShift === "morning" ? "Mañana" : "Tarde") : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Agregar Tarea Rápida
            {(selectedDayName || selectedDateString || selectedShiftName) && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                {selectedDayName && ` ${selectedDayName}`}
                {selectedShiftName && ` - ${selectedShiftName}`}
                {selectedDateString && ` ${selectedDateString}`}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Contexto visual */}
            {(selectedDayName || selectedDateString || selectedShiftName) && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <span className="font-medium">Contexto:</span>
                  {selectedDayName && <span className="bg-blue-100 px-2 py-1 rounded">{selectedDayName}</span>}
                  {selectedShiftName && <span className="bg-blue-100 px-2 py-1 rounded">{selectedShiftName}</span>}
                  {selectedDateString && <span className="bg-blue-100 px-2 py-1 rounded">{selectedDateString}</span>}
                </div>
              </div>
            )}

            {/* Información básica */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="title">Nombre de la tarea *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={generateSuggestedTitle() || "Ej: Revisar inventario"}
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
                  placeholder={generateSuggestedDescription() || "Descripción corta de la tarea"}
                  rows={2}
                  disabled={isLoading}
                />
              </div>
            </div>

          {/* Tipo de tarea - ocultar si está predefinido por contexto */}
          {!selectedDate && (
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
          )}

          {/* Campos condicionales - ocultar si están predefinidos por contexto */}
          {formData.taskType === "weekly" && !selectedDay && (
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

          {formData.taskType === "specific" && !selectedDate && (
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

          {/* Turno - ocultar si está predefinido por contexto */}
          {!selectedShift && (
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
          )}

          <Separator />

          {/* Asignación a empleados */}
          <div>
            <Label>Asignar a empleados</Label>
            <div className="max-h-40 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
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
                      className="text-sm font-normal cursor-pointer truncate"
                    >
                      {employee.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            {(!formData.employeeIds || formData.employeeIds.length === 0) && (
              <p className="text-xs text-gray-500">Visible para todos los empleados</p>
            )}
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
          </form>
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
            onClick={handleSubmit}
            disabled={isLoading || !formData.title}
          >
            {isLoading ? "Creando..." : "Crear Tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
