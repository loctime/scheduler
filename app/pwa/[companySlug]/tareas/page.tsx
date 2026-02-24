"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckSquare, Clock, Calendar, AlertCircle, ArrowLeft, Check, ChevronDown, ChevronRight } from "lucide-react"
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
  const todayDayNumber = today.getDay()

  // Paso 1: Filtrado correcto por empleado
  const filteredTasks = useMemo(() => {
    if (!ownerId) return []
    
    return tasks.filter(task => {
      if (!task.active) return false
      if (task.ownerId !== ownerId) return false

      // Si no tiene employeeIds → es para todos
      if (!task.employeeIds || task.employeeIds.length === 0) return true

      return task.employeeIds.includes(viewer?.employeeId || '')
    })
  }, [tasks, ownerId, viewer?.employeeId])

  // Paso 2: Separar tareas del día vs no del día
  const { tareasDelDia, tareasNoDelDia } = useMemo(() => {
    const tareasDelDia = filteredTasks.filter(task =>
      task.daysOfWeek?.includes(todayDayNumber)
    )
    
    const tareasNoDelDia = filteredTasks.filter(task =>
      !task.daysOfWeek?.includes(todayDayNumber)
    )
    
    return { tareasDelDia, tareasNoDelDia }
  }, [filteredTasks, todayDayNumber])

  // Paso 3: Dentro de tareasDelDia separar pendientes y completadas
  const { pendientes, completadas } = useMemo(() => {
    const pendientes = tareasDelDia.filter(
      t => !completedMap[t.id]
    )
    
    const completadas = tareasDelDia.filter(
      t => completedMap[t.id]
    )
    
    return { pendientes, completadas }
  }, [tareasDelDia, completedMap])

  // Orden final: pendientes primero, luego completadas
  const tareasOrdenadasHoy = useMemo(() => {
    return [...pendientes, ...completadas]
  }, [pendientes, completadas])

  // Estado para controlar expansión de secciones
  const [expandedHoy, setExpandedHoy] = useState(true)
  const [expandedTareas, setExpandedTareas] = useState(true)

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
        {/* Sección 1: Pendientes del día */}
        {tareasOrdenadasHoy.length > 0 && (
          <div>
            <div 
              className="flex items-center space-x-2 mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
              onClick={() => setExpandedHoy(!expandedHoy)}
            >
              {expandedHoy ? (
                <ChevronDown className="h-5 w-5 text-yellow-600" />
              ) : (
                <ChevronRight className="h-5 w-5 text-yellow-600" />
              )}
              <CheckSquare className="h-5 w-5 text-yellow-600" />
              <h2 className="text-lg font-medium text-yellow-700">Pendientes del día ({tareasOrdenadasHoy.length})</h2>
            </div>
            {expandedHoy && (
              <div className="space-y-3">
                {tareasOrdenadasHoy.map((task) => (
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
            )}
          </div>
        )}

        {/* Sección 2: Tareas (no del día) */}
        {tareasNoDelDia.length > 0 && (
          <div>
            <div 
              className="flex items-center space-x-2 mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
              onClick={() => setExpandedTareas(!expandedTareas)}
            >
              {expandedTareas ? (
                <ChevronDown className="h-5 w-5 text-blue-600" />
              ) : (
                <ChevronRight className="h-5 w-5 text-blue-600" />
              )}
              <Calendar className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-medium text-blue-700">Tareas ({tareasNoDelDia.length})</h2>
            </div>
            {expandedTareas && (
              <div className="space-y-3">
                {tareasNoDelDia.map((task) => (
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
            )}
          </div>
        )}

        {/* No hay tareas */}
        {tareasOrdenadasHoy.length === 0 && tareasNoDelDia.length === 0 && (
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
  const [expanded, setExpanded] = useState(false)

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

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpanded(!expanded)
  }

  return (
    <div 
      className={`rounded-xl border p-4 space-y-3 cursor-pointer transition-all ${
        isCompleted 
          ? 'opacity-60 bg-green-50 border-green-200' 
          : 'hover:shadow-md bg-white'
      }`}
      onClick={toggleExpanded}
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

      {/* Descripción y botones */}
      <div className="flex items-start justify-between">
        {task.description && (
          <div className="text-sm text-muted-foreground flex-1 mr-4">
            {task.description}
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={toggleExpanded}
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            {expanded ? "Ocultar detalles" : "Expandir"}
          </button>
        </div>
      </div>

      {/* Sección expandible de detalles */}
      {expanded && (
        <div className="border-t pt-3 mt-3 space-y-3">
          {/* Contenido detallado */}
          {task.detailedContent && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-1">Detalles:</h4>
              <div className="text-sm text-gray-600 whitespace-pre-wrap">
                {task.detailedContent}
              </div>
            </div>
          )}

          {/* Instrucciones */}
          {task.instructions && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-1">Instrucciones:</h4>
              <div className="text-sm text-gray-600 whitespace-pre-wrap">
                {task.instructions}
              </div>
            </div>
          )}

          {/* Días de la semana */}
          {task.daysOfWeek && task.daysOfWeek.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-1">Días programados:</h4>
              <div className="flex flex-wrap gap-1">
                {task.daysOfWeek.map(dayNum => (
                  <span 
                    key={dayNum}
                    className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                  >
                    {DIAS_SEMANA[dayNum]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Asignados */}
          {task.employeeIds && task.employeeIds.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-1">Asignado a:</h4>
              <div className="text-sm text-gray-600">
                {task.employeeIds.map(empId => {
                  const employee = employees.find(emp => emp.id === empId)
                  return employee ? employee.name : 'Desconocido'
                }).join(', ')}
              </div>
            </div>
          )}

          {/* Botón para ir a página completa */}
          <div className="pt-2">
            <button 
              onClick={goToDetail}
              className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
            >
              Ver página de detalles
            </button>
          </div>
        </div>
      )}
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
