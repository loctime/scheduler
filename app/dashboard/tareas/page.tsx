"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, ArrowLeft } from "lucide-react"
import { TaskForm } from "@/components/tasks/task-form"
import { TaskList } from "@/components/tasks/task-list"
import { WeeklyCalendar } from "@/components/tasks/weekly-calendar"
import { QuickTaskDialog } from "@/components/tasks/quick-task-dialog"
import { useTasks } from "@/hooks/use-tasks"
import { useTaskManagement } from "@/hooks/use-task-management"
import { useData } from "@/contexts/data-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Task } from "@/types/task"
import { TaskType, TaskShift } from "@/types/task"
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
  
  // Estados para el calendario interactivo
  const [quickDialogOpen, setQuickDialogOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedShift, setSelectedShift] = useState<TaskShift | null>(null)
  const [currentWeek, setCurrentWeek] = useState<Date[]>(() => {
    const today = new Date()
    const currentDay = today.getDay()
    const week = []
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() - currentDay + i)
      week.push(date)
    }
    return week
  })

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

  // Funciones para el calendario interactivo
  const handleCellClick = (dayId: number, date: Date, shift: TaskShift) => {
    setSelectedDay(dayId)
    setSelectedDate(date)
    setSelectedShift(shift)
    setQuickDialogOpen(true)
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setViewMode("edit")
  }

  const handleWeekChange = (direction: 'prev' | 'next') => {
    const newWeek = [...currentWeek]
    const daysToMove = direction === 'prev' ? -7 : 7
    
    newWeek.forEach(date => {
      date.setDate(date.getDate() + daysToMove)
    })
    
    setCurrentWeek(newWeek)
  }

  const handleQuickCreateTask = async (data: TaskFormData) => {
    const result = await createTask(data)
    if (result) {
      setQuickDialogOpen(false)
      setSelectedDay(null)
      setSelectedDate(null)
      setSelectedShift(null)
      toast({
        title: "Tarea creada",
        description: "La tarea se ha creado exitosamente",
      })
    }
  }

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

          {/* Tareas Semanales - Calendario Interactivo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                Calendario Semanal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WeeklyCalendar
                tasks={tasks} // Todas las tareas para el calendario
                onTaskClick={handleTaskClick}
                onCellClick={handleCellClick}
                onWeekChange={handleWeekChange}
                currentWeek={currentWeek}
              />
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

      {/* Diálogo rápido para crear tareas */}
      <QuickTaskDialog
        open={quickDialogOpen}
        onOpenChange={setQuickDialogOpen}
        onSubmit={handleQuickCreateTask}
        employees={employees}
        selectedDay={selectedDay || undefined}
        selectedDate={selectedDate || undefined}
        selectedShift={selectedShift || undefined}
        isLoading={managementLoading}
      />

      {/* Existing dialogs */}
      <Dialog open={viewMode === "create"} onOpenChange={(open) => !open && setViewMode("list")}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nueva Tarea</DialogTitle>
          </DialogHeader>
          <TaskForm
            task={null}
            employees={employees}
            onSubmit={handleCreateTask}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={viewMode === "edit"} onOpenChange={(open) => !open && setViewMode("list")}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Tarea</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <TaskForm
              task={selectedTask}
              employees={employees}
              onSubmit={handleUpdateTask}
              onCancel={handleCancel}
              isLoading={isLoading}
            />
          )}
        </DialogContent>
      </Dialog>

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
