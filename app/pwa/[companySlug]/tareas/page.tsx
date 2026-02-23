"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckSquare, Clock, Calendar, AlertCircle, ArrowLeft, Check } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useOwnerIdFromSlug, useEmployeesByOwnerId } from "@/hooks/use-owner-data"
import { useTasks } from "@/hooks/use-tasks"
import { useDailyTaskStatus } from "@/hooks/use-daily-task-status"
import { PwaViewerBadge, useViewer } from "@/components/pwa/PwaViewerBadge"
import { Task } from "@/types/task"

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

export default function TareasPage() {
  const params = useParams()
  const router = useRouter()
  const companySlug = params.companySlug as string
  const viewer = useViewer()
  
  const { ownerId, loading: ownerIdLoading } = useOwnerIdFromSlug(companySlug)
  const { employees, loading: employeesLoading } = useEmployeesByOwnerId(ownerId)
  
  const { tasks, todayTasks, isLoading, error } = useTasks(viewer?.employeeId, ownerId)
  const { completedMap, toggleTask } = useDailyTaskStatus(ownerId, viewer)

  const today = new Date()
  const todayName = DIAS_SEMANA[today.getDay()]

  // Separar tareas: pendientes vs realizadas
  const { pendientes, realizadas } = useMemo(() => {
    const pendientes = tasks.filter(task => !completedMap[task.id])
    const realizadas = tasks.filter(task => completedMap[task.id])
    return { pendientes, realizadas }
  }, [tasks, completedMap])

  // Estado para expandir/ocultar realizadas
  const [expanded, setExpanded] = useState(false)

  if (ownerIdLoading || employeesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span>Error al cargar las tareas</span>
            </div>
            <p className="text-red-600 mt-2">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="p-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Tareas</h1>
                <p className="text-sm text-gray-500">
                  {todayName}, {format(today, "d 'de' MMMM", { locale: es })}
                </p>
              </div>
            </div>
            <PwaViewerBadge />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Tareas pendientes */}
        {pendientes.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <CheckSquare className="h-5 w-5 text-yellow-600" />
              <h2 className="text-lg font-medium text-yellow-700">Pendientes del día</h2>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{pendientes.length}</Badge>
            </div>
            <div className="space-y-3">
              {pendientes.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  employees={employees}
                  onClick={() => router.push(`/pwa/${companySlug}/tareas/${task.id}`)}
                  isToday={true}
                  companySlug={companySlug}
                  router={router}
                  isCompleted={!!completedMap[task.id]}
                  completedBy={completedMap[task.id]?.employeeId}
                  onToggle={() => toggleTask(task.id)}
                  viewer={viewer}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tareas realizadas */}
        {realizadas.length > 0 && (
          <div>
            <div 
              onClick={() => setExpanded(!expanded)}
              className="bg-green-50 dark:bg-green-950/40 border border-green-400 rounded-xl p-3 mt-2 cursor-pointer transition-all"
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                  ✔ Pendientes al día
                </span>
                <span className="text-xs text-green-600">
                  {expanded ? "Ocultar" : "Ver realizadas"}
                </span>
              </div>

              {expanded && (
                <div className="mt-3 space-y-2 border-t border-green-300 pt-2">
                  {realizadas.map((task) => (
                    <div key={task.id} className="text-sm">
                      <div className="font-medium line-through opacity-70">
                        {task.title}
                      </div>
                      <div className="text-muted-foreground">
                        Realizada por {employees.find(emp => emp.id === completedMap[task.id]?.employeeId)?.name || 'Desconocido'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* No hay tareas */}
        {pendientes.length === 0 && realizadas.length === 0 && (
          <div className="text-center py-12">
            <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay tareas para mostrar</h3>
            <p className="text-gray-600">No se encontraron tareas activas para este día.</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface TaskCardProps {
  task: Task
  employees: any[]
  onClick: () => void
  isToday: boolean
  companySlug: string
  router: any
  isCompleted: boolean
  completedBy?: string
  onToggle: () => void
  viewer: any
}

function TaskCard({ task, employees, onClick, isToday, companySlug, router, isCompleted, completedBy, onToggle, viewer }: TaskCardProps) {
  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (viewer?.employeeId) {
      onToggle()
    }
  }

  const goToDetail = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/pwa/${companySlug}/tareas/${task.id}`)
  }

  return (
    <div 
      className={`rounded-xl border p-4 space-y-3 cursor-pointer transition-all ${
        isCompleted 
          ? 'opacity-60 bg-green-50 border-green-200' 
          : 'hover:shadow-md bg-white'
      }`}
      onClick={goToDetail}
    >
      {/* Header con título y checkbox */}
      <div className="flex items-start justify-between">
        {/* Título */}
        <div className={`text-2xl font-semibold ${
          isCompleted ? 'line-through text-green-700' : ''
        }`}>
          {task.title}
        </div>

        {/* Checkbox */}
        <button
          onClick={handleToggle}
          className={`flex items-center space-x-2 text-sm font-medium px-3 py-1 rounded-md border transition-colors ${
            isCompleted 
              ? 'bg-green-500 text-white border-green-500 hover:bg-green-600' 
              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
          }`}
          disabled={!viewer?.employeeId}
        >
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
            isCompleted 
              ? 'bg-white border-white' 
              : 'border-gray-400'
          }`}>
            {isCompleted && (
              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010-1.414l-8 8a1 1 0 01-1.414 1.414L8.586 7H4a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1v-8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          {isCompleted ? "Desmarcar" : "Realizado"}
        </button>
      </div>

      {/* Descripción y botón */}
      <div className="flex items-start justify-between">
        {task.description && (
          <div className="text-sm text-muted-foreground">
            {task.description}
          </div>
        )}
        
        <button 
          onClick={goToDetail}
          className="text-blue-600 hover:text-blue-800 underline text-sm"
        >
          Ver más detalles
        </button>
      </div>
    </div>
  )
}

function Users({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  )
}
