import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { Task } from "@/types/task"
import { TaskType, TaskShift } from "@/types/task"

interface WeeklyCalendarProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onCellClick: (dayId: number, shift: TaskShift) => void
}

const DIAS_SEMANA = [
  { id: 1, name: "Lunes" },
  { id: 2, name: "Martes" },
  { id: 3, name: "Miércoles" },
  { id: 4, name: "Jueves" },
  { id: 5, name: "Viernes" },
  { id: 6, name: "Sábado" },
  { id: 0, name: "Domingo" },
]

const TURNOS = [
  { id: "morning" as TaskShift, name: "Mañana", icon: "🌅" },
  { id: "afternoon" as TaskShift, name: "Tarde", icon: "🌇" },
]

export function WeeklyCalendar({ 
  tasks, 
  onTaskClick, 
  onCellClick
}: WeeklyCalendarProps) {
  // Obtener tareas para un día y turno específicos (solo tareas semanales)
  const getTasksForDayAndShift = (dayId: number, shift: TaskShift) => {
    return tasks.filter(task => {
      const taskType = task.taskType || "weekly"
      
      // No mostrar tareas reference ni specific en calendario
      if (taskType === "specific" || taskType === "reference") return false
      
      // Para tareas diarias, mostrar en todos los días
      if (taskType === "daily") {
        const taskShift = task.shift || "both"
        return taskShift === "both" || taskShift === shift
      }
      
      // Para tareas semanales, verificar si coincide el día
      if (taskType === "weekly") {
        const matchesDay = task.daysOfWeek?.includes(dayId) || false
        if (!matchesDay) return false
        
        const taskShift = task.shift || "both"
        return taskShift === "both" || taskShift === shift
      }
      
      return false
    })
  }

  // Obtener color según tipo de tarea
  const getTaskColor = (task: Task) => {
    const taskType = task.taskType || "weekly"
    switch (taskType) {
      case "daily":
        return "bg-green-100 text-green-800 border-green-200"
      case "weekly":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "specific":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  // Obtener icono según tipo de tarea
  const getTaskIcon = (task: Task) => {
    const taskType = task.taskType || "weekly"
    switch (taskType) {
      case "daily":
        return "🔄"
      case "weekly":
        return "📅"
      case "specific":
        return "📌"
      default:
        return "📋"
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Calendario Semanal</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {/* Header con días */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="w-8"></div> {/* Columna estrecha para turnos */}
          {DIAS_SEMANA.map((dia) => (
            <div key={dia.id} className="text-center font-semibold text-sm">
              {dia.name}
            </div>
          ))}
        </div>

        {/* Filas de turnos */}
        {TURNOS.map((turno) => (
          <div key={turno.id} className="grid grid-cols-8 gap-1 mb-2">
            {/* Header del turno - columna estrecha */}
            <div className="w-8 flex items-center justify-center">
              <div className="text-center">
                <div className="text-sm">{turno.icon}</div>
                <div className="text-xs font-medium">{turno.name}</div>
              </div>
            </div>
            
            {/* Celdas de días - más grandes */}
            {DIAS_SEMANA.map((dia) => {
              const shiftTasks = getTasksForDayAndShift(dia.id, turno.id)
              
              return (
                <div
                  key={`${dia.id}-${turno.id}`}
                  className="border rounded-lg min-h-[140px] p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onCellClick(dia.id, turno.id)}
                >
                  <div className="space-y-2">
                    {shiftTasks.slice(0, 3).map(task => (
                      <div
                        key={task.id}
                        className={`text-xs p-2 rounded border cursor-pointer hover:shadow-md transition-all duration-200 ${getTaskColor(task)} ${
                          !task.active ? 'opacity-50 line-through' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onTaskClick(task)
                        }}
                        title={task.title}
                      >
                        <div className="flex items-center gap-1">
                          <span className="flex-shrink-0">{getTaskIcon(task)}</span>
                          <div className="truncate flex-1 font-medium">{task.title}</div>
                        </div>
                      </div>
                    ))}
                    
                    {shiftTasks.length > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{shiftTasks.length - 3} más
                      </div>
                    )}
                    
                    {/* Botón + siempre visible */}
                    <div 
                      className="h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCellClick(dia.id, turno.id)
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Leyenda optimizada */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span className="text-xs text-gray-600">Diarias</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span className="text-xs text-gray-600">Semanales</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">🌅 Mañana</span>
            <span className="text-xs text-gray-600">🌇 Tarde</span>
          </div>
        </div>

        {/* Sección de Procedimientos/Guías */}
        {(() => {
          const referenceTasks = tasks.filter(task => task.taskType === "reference")
          if (referenceTasks.length === 0) return null
          
          return (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📚</span>
                <h3 className="font-medium text-gray-900">Procedimientos / Guías</h3>
                <Badge variant="outline" className="text-xs">
                  {referenceTasks.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {referenceTasks.map(task => (
                  <div 
                    key={task.id}
                    className="p-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
                    onClick={() => onTaskClick(task)}
                  >
                    <div className="font-medium text-amber-900">{task.title}</div>
                    {task.description && (
                      <div className="text-sm text-amber-700 mt-1">{task.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}
