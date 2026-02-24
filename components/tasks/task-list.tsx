"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Users, 
  Calendar, 
  Clock, 
  FileText,
  Eye
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Task } from "@/types/task"
import { Empleado } from "@/lib/types"

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

interface TaskListProps {
  tasks: Task[]
  employees: Empleado[]
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onToggleActive: (task: Task) => void
  onView: (task: Task) => void
  isLoading?: boolean
}

export function TaskList({ 
  tasks, 
  employees, 
  onEdit, 
  onDelete, 
  onToggleActive, 
  onView,
  isLoading = false 
}: TaskListProps) {
  const [showInactive, setShowInactive] = useState(false)

  const filteredTasks = tasks.filter(task => 
    showInactive ? true : task.active
  )

  // Auditoría: Loggear tareas recibidas
  console.log("Tasks recibidas:", tasks)
  console.log("Filtered tasks:", filteredTasks)
  console.log("Show inactive:", showInactive)

  const getAssignedEmployees = (task: Task) => {
    if (!task.employeeIds || task.employeeIds.length === 0) {
      return "Todos los empleados"
    }
    return employees
      .filter(emp => task.employeeIds!.includes(emp.id))
      .map(emp => emp.name)
      .join(", ")
  }

  const getDaysFormatted = (task: Task) => {
    if (!task.daysOfWeek || task.daysOfWeek.length === 0) {
      return "Sin días específicos"
    }
    return task.daysOfWeek.map(day => DIAS_SEMANA[day]).join(", ")
  }

  const isToday = (task: Task) => {
    if (!task.daysOfWeek) return false
    return task.daysOfWeek.includes(new Date().getDay())
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (filteredTasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {showInactive ? "No hay tareas inactivas" : "No hay tareas activas"}
          </h3>
          <p className="text-gray-500">
            {showInactive 
              ? "No se encontraron tareas inactivas para mostrar"
              : "Crea tu primera tarea usando el botón de arriba"
            }
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtro de estado */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Tareas ({filteredTasks.length})
        </h3>
        <div className="flex items-center space-x-2">
          <label htmlFor="show-inactive" className="text-sm text-gray-600">
            Mostrar inactivas
          </label>
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
        </div>
      </div>

      {/* Lista de tareas */}
      <div className="space-y-3">
        {filteredTasks.map((task) => (
          <Card key={task.id} className={!task.active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <CardTitle className="text-base font-medium">
                      {task.title}
                    </CardTitle>
                    {isToday(task) && (
                      <Badge variant="destructive" className="text-xs">
                        Hoy
                      </Badge>
                    )}
                    {!task.active && (
                      <Badge variant="secondary" className="text-xs">
                        Inactiva
                      </Badge>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {/* Switch activo/inactivo */}
                  <div className="flex items-center space-x-1">
                    <Switch
                      checked={task.active}
                      onCheckedChange={() => onToggleActive(task)}
                      disabled={isLoading}
                    />
                  </div>
                  
                  {/* Menú de acciones */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(task)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(task)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDelete(task)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {/* Empleados asignados */}
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600 truncate">
                    {getAssignedEmployees(task)}
                  </span>
                </div>

                {/* Días configurados */}
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {getDaysFormatted(task)}
                  </span>
                </div>

                {/* Fecha de creación */}
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    Creada {format(task.createdAt?.toDate?.() || new Date(), "d 'de' MMMM", { locale: es })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
