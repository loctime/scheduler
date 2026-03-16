"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, ArrowLeft } from "lucide-react"
import { TaskForm } from "@/components/tasks/task-form"
import { TaskList } from "@/components/tasks/task-list"
import { useTasks } from "@/hooks/use-tasks"
import { useTaskManagement } from "@/hooks/use-task-management"
import { useData } from "@/contexts/data-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Task } from "@/types/task"
import { TaskType } from "@/types/task"
import { TaskFormData } from "@/hooks/use-task-management"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

type ViewMode = "list" | "create" | "edit"

function TareasContent() {
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const { employees, user, userData } = useData()
  console.log("User desde useData:", user)
  console.log("UserData desde useData:", userData)
  console.log("UserData ownerId:", userData?.ownerId)
  const { tasks, isLoading: tasksLoading } = useTasks(undefined, userData?.ownerId)
  const { createTask, updateTask, deleteTask, toggleTaskActive, isLoading: managementLoading } = useTaskManagement()
  const { toast } = useToast()

  // Organizar tareas por tipo
  const { dailyTasks, weeklyTasks, specificTasks } = useMemo(() => {
    const dailyTasks = tasks.filter(task => (task.taskType || "weekly") === "daily")
    const weeklyTasks = tasks.filter(task => (task.taskType || "weekly") === "weekly")
    const specificTasks = tasks.filter(task => (task.taskType || "weekly") === "specific")
    
    return { dailyTasks, weeklyTasks, specificTasks }
  }, [tasks])

  const handleCreateTask = async (data: TaskFormData) => {
    const result = await createTask(data)
    if (result) {
      setViewMode("list")
    }
  }

  const handleUpdateTask = async (data: TaskFormData) => {
    if (!selectedTask) return
    
    const result = await updateTask(selectedTask.id, data)
    if (result) {
      setViewMode("list")
      setSelectedTask(null)
    }
  }

  const handleDeleteTask = async () => {
    if (!taskToDelete) return

    const result = await deleteTask(taskToDelete.id)
    if (result) {
      setDeleteDialogOpen(false)
      setTaskToDelete(null)
    }
  }

  const handleToggleActive = async (task: Task) => {
    await toggleTaskActive(task.id, task.active)
  }

  const handleEditTask = (task: Task) => {
    setSelectedTask(task)
    setViewMode("edit")
  }

  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task)
    setDeleteDialogOpen(true)
  }

  const handleViewTask = (task: Task) => {
    // Aquí podrías abrir un modal de vista o navegar a una página de detalle
    toast({
      title: "Ver tarea",
      description: "Función de vista detallada próximamente",
    })
  }

  const handleCancel = () => {
    setViewMode("list")
    setSelectedTask(null)
  }

  const isLoading = tasksLoading || managementLoading

  // Componente para calendario semanal simple
  const WeeklyCalendar = ({ tasks }: { tasks: Task[] }) => {
    const daysOfWeek = [
      { id: 1, name: "Lunes" },
      { id: 2, name: "Martes" },
      { id: 3, name: "Miércoles" },
      { id: 4, name: "Jueves" },
      { id: 5, name: "Viernes" },
      { id: 6, name: "Sábado" },
      { id: 0, name: "Domingo" },
    ]

    return (
      <div className="grid grid-cols-7 gap-4">
        {daysOfWeek.map(day => {
          const dayTasks = tasks.filter(task => 
            task.daysOfWeek?.includes(day.id)
          )
          
          return (
            <div key={day.id} className="border rounded-lg p-3">
              <h4 className="font-semibold text-sm mb-2 text-center">{day.name}</h4>
              <div className="space-y-2">
                {dayTasks.map(task => (
                  <div 
                    key={task.id}
                    className={`text-xs p-2 rounded border cursor-pointer hover:bg-gray-50 ${
                      !task.active ? 'opacity-50 line-through' : 'bg-white'
                    }`}
                    onClick={() => {
                      setSelectedTask(task)
                      setViewMode("edit")
                    }}
                  >
                    <div className="font-medium truncate">{task.title}</div>
                    {task.description && (
                      <div className="text-gray-500 truncate">{task.description}</div>
                    )}
                  </div>
                ))}
                {dayTasks.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-4">
                    Sin tareas
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tareas</h1>
          <p className="text-gray-500">
            Gestiona las tareas asignadas a los empleados
          </p>
        </div>
        
        {viewMode === "list" && (
          <Button onClick={() => setViewMode("create")}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
        )}

        {viewMode !== "list" && (
          <Button variant="outline" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        )}
      </div>

      {/* Contenido principal */}
      {viewMode === "list" && (
        <div className="space-y-8">
          {/* Tareas Diarias */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                Tareas Diarias ({dailyTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyTasks.length > 0 ? (
                <TaskList
                  tasks={dailyTasks}
                  employees={employees}
                  onEdit={handleEditTask}
                  onDelete={handleDeleteClick}
                  onToggleActive={handleToggleActive}
                  onView={handleViewTask}
                  isLoading={isLoading}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No hay tareas diarias configuradas
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tareas Semanales - Calendario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                Tareas Semanales ({weeklyTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyTasks.length > 0 ? (
                <div className="overflow-x-auto">
                  <WeeklyCalendar tasks={weeklyTasks} />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No hay tareas semanales configuradas
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tareas Específicas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                Tareas por Fecha ({specificTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {specificTasks.length > 0 ? (
                <TaskList
                  tasks={specificTasks.sort((a, b) => (a.specificDate || '').localeCompare(b.specificDate || ''))}
                  employees={employees}
                  onEdit={handleEditTask}
                  onDelete={handleDeleteClick}
                  onToggleActive={handleToggleActive}
                  onView={handleViewTask}
                  isLoading={isLoading}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No hay tareas con fecha específica configuradas
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === "create" && (
        <TaskForm
          employees={employees}
          onSubmit={handleCreateTask}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      )}

      {viewMode === "edit" && selectedTask && (
        <TaskForm
          task={selectedTask}
          employees={employees}
          onSubmit={handleUpdateTask}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      )}

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás por eliminar la tarea "<strong>{taskToDelete?.title}</strong>". 
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function TareasPage() {
  const { user } = useData()
  
  return (
    <DashboardLayout user={user}>
      <TareasContent />
    </DashboardLayout>
  )
}
