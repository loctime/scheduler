"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { doc, onSnapshot } from "firebase/firestore"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
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

  if (ownerIdLoading || isLoading) {
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
              <span className="text-lg font-semibold">Error</span>
              <span className="text-red-600">{error || "Tarea no encontrada"}</span>
            </div>
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

      {/* Contenido */}
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Título y chip */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">
            {task.title}
          </h1>

          {isToday && (
            <span className="inline-block text-xs px-2 py-1 rounded-full bg-red-500 text-white">
              Tarea del día
            </span>
          )}
        </div>

        {/* Descripción */}
        {task.description && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Descripción
            </div>
            <div className="text-base">
              {task.description}
            </div>
          </div>
        )}

        {/* Detalles */}
        {task.detailedContent && (
          <div className="space-y-2">
            <div className="text-lg font-semibold">
              Detalles
            </div>
            <div className="text-base whitespace-pre-line">
              {task.detailedContent}
            </div>
          </div>
        )}

        {/* Instrucciones */}
        {task.instructions && (
          <div className="space-y-2">
            <div className="text-lg font-semibold">
              Instrucciones
            </div>
            <div className="text-base whitespace-pre-line">
              {task.instructions}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
