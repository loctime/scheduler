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
        {/* Tareas del día */}
        {todayTasks.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                Hoy
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                Tareas del día
              </h2>
            </div>
            <div className="space-y-3">
              {todayTasks.map((task) => (
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

        {/* Tareas pendientes */}
        {pendientes.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <CheckSquare className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-medium text-gray-900">Tareas Pendientes</h2>
              <Badge variant="secondary">{pendientes.length}</Badge>
            </div>
            <div className="space-y-3">
              {pendientes.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  employees={employees}
                  onClick={() => router.push(`/pwa/${companySlug}/tareas/${task.id}`)}
                  isToday={false}
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
            <div className="flex items-center space-x-2 mb-4">
              <CheckSquare className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-medium text-gray-900">Tareas Realizadas</h2>
              <Badge variant="default" className="bg-green-100 text-green-800">{realizadas.length}</Badge>
            </div>
            <div className="space-y-3">
              {realizadas.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  employees={employees}
                  onClick={() => router.push(`/pwa/${companySlug}/tareas/${task.id}`)}
                  isToday={false}
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
  const assignedEmployees = task.employeeIds
    ? employees.filter(emp => task.employeeIds!.includes(emp.id))
    : employees

  const daysFormatted = task.daysOfWeek
    ? task.daysOfWeek.map(day => DIAS_SEMANA[day]).join(", ")
    : "Sin días específicos"

  const completedByEmployee = completedBy ? employees.find(emp => emp.id === completedBy) : null

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (viewer?.employeeId) {
      onToggle()
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Navegación directa usando el router pasado como prop
    router.push(`/pwa/${companySlug}/tareas/${task.id}`)
  }

  return (
    <div 
      className={`cursor-pointer hover:shadow-md transition-shadow duration-200 border rounded-lg p-4 ${
        isCompleted ? 'bg-gray-50 opacity-75' : 'bg-white'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {/* Checkbox */}
          <button
            onClick={handleToggle}
            className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isCompleted 
                ? 'bg-green-500 border-green-500 text-white' 
                : 'border-gray-300 hover:border-gray-400 text-transparent'
            }`}
            disabled={!viewer?.employeeId}
          >
            {isCompleted && <Check className="w-3 h-3" />}
          </button>

          <div className="flex-1">
            <h3 className={`text-base font-medium mb-1 ${
              isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
            }`}>
              {task.title}
            </h3>
            {task.description && (
              <p className={`text-sm line-clamp-2 ${
                isCompleted ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {task.description}
              </p>
            )}
          </div>
        </div>

        {isToday && (
          <Badge variant="destructive" className="ml-2">
            Hoy
          </Badge>
        )}
      </div>

      <div className="space-y-2 mt-3">
        {/* Empleados asignados */}
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {assignedEmployees.length > 0
              ? assignedEmployees.map(emp => emp.name).join(", ")
              : "Todos los empleados"
            }
          </span>
        </div>

        {/* Días configurados */}
        {task.daysOfWeek && task.daysOfWeek.length > 0 && (
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {daysFormatted}
            </span>
          </div>
        )}

        {/* Fecha de creación */}
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">
            Creada {format(task.createdAt?.toDate?.() || new Date(), "d 'de' MMMM", { locale: es })}
          </span>
        </div>

        {/* Completado por */}
        {isCompleted && completedByEmployee && (
          <div className="flex items-center space-x-2 text-green-600">
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">
              Realizado por {completedByEmployee.name}
            </span>
          </div>
        )}
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
