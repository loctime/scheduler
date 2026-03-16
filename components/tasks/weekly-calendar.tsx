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
  onCellClick: (dayId: number, date: Date, shift: TaskShift) => void
  onWeekChange?: (direction: 'prev' | 'next') => void
  currentWeek?: Date[]
}

const DIAS_SEMANA = [
  { id: 0, name: "Dom" },
  { id: 1, name: "Lun" },
  { id: 2, name: "Mar" },
  { id: 3, name: "Mié" },
  { id: 4, name: "Jue" },
  { id: 5, name: "Vie" },
  { id: 6, name: "Sáb" },
]

const TURNOS = [
  { id: "morning" as TaskShift, name: "Mañana", icon: "🌅" },
  { id: "afternoon" as TaskShift, name: "Tarde", icon: "🌇" },
]

export function WeeklyCalendar({ 
  tasks, 
  onTaskClick, 
  onCellClick, 
  onWeekChange,
  currentWeek 
}: WeeklyCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Generar semana actual si no se proporciona
  const weekDates = currentWeek || (() => {
    const today = new Date()
    const currentDay = today.getDay()
    const week = []
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() - currentDay + i)
      week.push(date)
    }
    return week
  })()

  // Obtener tareas para un día y turno específicos
  const getTasksForDayAndShift = (dayId: number, date: Date, shift: TaskShift) => {
    const dateString = date.getFullYear().toString() + 
                     (date.getMonth() + 1).toString().padStart(2, '0') + 
                     date.getDate().toString().padStart(2, '0')

    return tasks.filter(task => {
      const taskType = task.taskType || "weekly"
      
      // Filtrar por tipo y fecha primero
      let matchesDate = false
      switch (taskType) {
        case "daily":
          matchesDate = true
          break
        case "weekly":
          matchesDate = task.daysOfWeek?.includes(dayId) || false
          break
        case "specific":
          matchesDate = task.specificDate === dateString
          break
        default:
          matchesDate = task.daysOfWeek?.includes(dayId) || false
      }
      
      if (!matchesDate) return false
      
      // Filtrar por turno
      const taskShift = task.shift || "both"
      return taskShift === "both" || taskShift === shift
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
          <div className="flex items-center gap-2">
            {onWeekChange && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onWeekChange('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onWeekChange('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Header con días y turnos */}
        <div className="grid grid-cols-8 gap-2 mb-2">
          <div></div> {/* Espacio vacío para turnos */}
          {DIAS_SEMANA.map((dia) => {
            const date = weekDates[DIAS_SEMANA.findIndex(d => d.id === dia.id)]
            const isToday = new Date().toDateString() === date.toDateString()
            
            return (
              <div key={dia.id} className="text-center">
                <div className="font-semibold text-sm">{dia.name}</div>
                <div className={`text-xs ${isToday ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                  {date.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Filas de turnos */}
        {TURNOS.map((turno) => (
          <div key={turno.id} className="grid grid-cols-8 gap-2">
            {/* Header del turno */}
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="text-lg">{turno.icon}</div>
                <div className="text-xs font-medium">{turno.name}</div>
              </div>
            </div>
            
            {/* Celdas de días para este turno */}
            {DIAS_SEMANA.map((dia) => {
              const date = weekDates[DIAS_SEMANA.findIndex(d => d.id === dia.id)]
              const shiftTasks = getTasksForDayAndShift(dia.id, date, turno.id)
              
              return (
                <div
                  key={`${dia.id}-${turno.id}`}
                  className="border rounded-lg min-h-[100px] p-2 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onCellClick(dia.id, date, turno.id)}
                >
                  <div className="space-y-1">
                    {shiftTasks.slice(0, 2).map(task => (
                      <div
                        key={task.id}
                        className={`text-xs p-1 rounded border cursor-pointer hover:shadow-sm transition-shadow ${getTaskColor(task)} ${
                          !task.active ? 'opacity-50 line-through' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onTaskClick(task)
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span>{getTaskIcon(task)}</span>
                          <div className="truncate flex-1">{task.title}</div>
                        </div>
                      </div>
                    ))}
                    
                    {shiftTasks.length > 2 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{shiftTasks.length - 2} más
                      </div>
                    )}
                    
                    {shiftTasks.length === 0 && (
                      <div 
                        className="h-6 flex items-center justify-center text-gray-400 hover:text-gray-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCellClick(dia.id, date, turno.id)
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Leyenda */}
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
            <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
            <span className="text-xs text-gray-600">Específicas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">🌅 Mañana</span>
            <span className="text-xs text-gray-600">🌇 Tarde</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
