"use client"

import { useState } from "react"
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
        <TaskList
          tasks={tasks}
          employees={employees}
          onEdit={handleEditTask}
          onDelete={handleDeleteClick}
          onToggleActive={handleToggleActive}
          onView={handleViewTask}
          isLoading={isLoading}
        />
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
