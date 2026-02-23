"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { doc, onSnapshot } from "firebase/firestore"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowLeft, Calendar, Users, Clock, FileText, CheckSquare, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { db } from "@/lib/firebase"
import { useOwnerIdFromSlug, useEmployeesByOwnerId } from "@/hooks/use-owner-data"
import { PwaViewerBadge, useViewer } from "@/components/pwa/PwaViewerBadge"
import { Task } from "@/types/task"

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

export default function TareaDetallePage() {
  const params = useParams()
  const router = useRouter()
  const companySlug = params.companySlug as string
  const taskId = params.taskId as string
  const viewer = useViewer()
  
  const { ownerId, loading: ownerIdLoading } = useOwnerIdFromSlug(companySlug)
  const { employees, loading: employeesLoading } = useEmployeesByOwnerId(ownerId)
  
  const [task, setTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db || !taskId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      doc(db, "apps", "horarios", "tasks", taskId),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const taskData = docSnapshot.data() as Omit<Task, 'id'>
          setTask({
            id: docSnapshot.id,
            ...taskData
          })
        } else {
          setError("Tarea no encontrada")
        }
        setIsLoading(false)
      },
      (err) => {
        setError("Error al cargar la tarea")
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [taskId])

  if (ownerIdLoading || employeesLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span>Error</span>
            </div>
            <p className="text-red-600 mt-2">{error || "Tarea no encontrada"}</p>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="mt-4"
            >
              Volver
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const assignedEmployees = task.employeeIds
    ? employees.filter(emp => task.employeeIds!.includes(emp.id))
    : employees

  const daysFormatted = task.daysOfWeek
    ? task.daysOfWeek.map(day => DIAS_SEMANA[day]).join(", ")
    : "Sin días específicos"

  const isToday = task.daysOfWeek?.includes(new Date().getDay())

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
                <h1 className="text-xl font-semibold text-gray-900">Detalle de Tarea</h1>
                <p className="text-sm text-gray-500">
                  {format(task.createdAt?.toDate?.() || new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
            </div>
            <PwaViewerBadge />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Título y badge */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                  {task.title}
                </CardTitle>
                {isToday && (
                  <Badge variant="destructive" className="mb-3">
                    Tarea del día
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Descripción */}
            {task.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-gray-600" />
                  Descripción
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            )}

            <Separator className="my-6" />

            {/* Contenido detallado */}
            {task.detailedContent && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-gray-600" />
                  Contenido Detallado
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {task.detailedContent}
                  </p>
                </div>
              </div>
            )}

            {/* Instrucciones */}
            {task.instructions && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                  <CheckSquare className="h-5 w-5 mr-2 text-gray-600" />
                  Instrucciones
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-900 whitespace-pre-wrap">
                    {task.instructions}
                  </p>
                </div>
              </div>
            )}

            <Separator className="my-6" />

            {/* Información de asignación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Empleados asignados */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-gray-600" />
                  Empleados Asignados
                </h3>
                <div className="space-y-2">
                  {assignedEmployees.length > 0 ? (
                    assignedEmployees.map((employee) => (
                      <div
                        key={employee.id}
                        className="flex items-center space-x-2 p-2 bg-gray-50 rounded"
                      >
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-700">{employee.name}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">Todos los empleados</p>
                  )}
                </div>
              </div>

              {/* Días configurados */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-gray-600" />
                  Días Configurados
                </h3>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-700">{daysFormatted}</p>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Metadatos */}
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>
                  Creada {format(task.createdAt?.toDate?.() || new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${task.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{task.active ? 'Activa' : 'Inactiva'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
