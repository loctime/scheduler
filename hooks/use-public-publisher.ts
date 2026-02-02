import { useState } from "react"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useOwnerId } from "./use-owner-id"

export interface PublishPublicScheduleOptions {
  companyName?: string
  weekId: string
  weekData: any
}

export interface UsePublicPublisherReturn {
  publishToPublic: (options: PublishPublicScheduleOptions) => Promise<string>
  isPublishing: boolean
  error: string | null
}

export function usePublicPublisher(): UsePublicPublisherReturn {
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ownerId = useOwnerId()

  console.log("🔧 [usePublicPublisher] Hook inicializado", { 
    hasOwnerId: !!ownerId,
    ownerId: ownerId?.substring(0, 10) + '...' // Solo mostrar primeros 10 chars por seguridad
  })

  const publishToPublic = async (options: PublishPublicScheduleOptions): Promise<string> => {
    console.log("🔧 [usePublicPublisher] publishToPublic llamado con:", {
      weekId: options.weekId,
      hasWeekData: !!options.weekData,
      weekDataSize: options.weekData ? JSON.stringify(options.weekData).length : 0,
      weekDataKeys: options.weekData ? Object.keys(options.weekData) : []
    })

    if (!ownerId) {
      console.error("🔧 [usePublicPublisher] Error: No ownerId disponible")
      throw new Error("No se puede publicar sin ownerId")
    }

    if (!db) {
      console.error("🔧 [usePublicPublisher] Error: Firestore no disponible")
      throw new Error("Firestore no disponible")
    }

    // Validación obligatoria: debe haber weekData
    if (!options.weekData) {
      console.error("🔧 [usePublicPublisher] Error: No weekData proporcionado")
      throw new Error("No hay datos de semana para publicar")
    }

    setIsPublishing(true)
    setError(null)

    try {
      console.log("🔧 [usePublicPublisher] Publishing schedule for ownerId:", ownerId)
      console.log("🔧 [usePublicPublisher] WeekId:", options.weekId)
      
      // Path EXACTO: apps/horarios_public/{ownerId}/current (4 segmentos)
      const fullPath = "apps/horarios_public/" + ownerId + "/current"
      console.log("🔧 [usePublicPublisher] Writing to:", fullPath)
      
      // Estructura mínima para lectura pública
      const publicScheduleData = {
        ownerId: ownerId,
        weekId: options.weekId,
        weekLabel: options.weekData.startDate && options.weekData.endDate 
          ? `${options.weekData.startDate} - ${options.weekData.endDate}`
          : `Semana ${options.weekId}`,
        publishedAt: serverTimestamp(),
        days: options.weekData.scheduleData?.assignments || options.weekData.assignments || {},
        employees: options.weekData.employees || []
      }

      console.log("🔧 [usePublicPublisher] Datos a publicar:", {
        ...publicScheduleData,
        publishedAt: "[Timestamp]",
        daysCount: Object.keys(publicScheduleData.days).length,
        hasAssignments: Object.keys(publicScheduleData.days).length > 0,
        employeesCount: publicScheduleData.employees.length
      })

      // Usar setDoc con overwrite completo en apps/horarios_public/{ownerId}/current
      const publicRef = doc(db, "apps", "horarios_public", ownerId, "current")
      console.log("🔧 [usePublicPublisher] Document reference created for apps/horarios_public/" + ownerId + "/current")
      
      await setDoc(publicRef, publicScheduleData)
      console.log("🔧 [usePublicPublisher] Publish success - document written to:", fullPath)
      
      return ownerId // Retornar el ownerId para generar URL pública
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al publicar"
      setError(errorMessage)
      console.error("🔧 [usePublicPublisher] Publish error:", err)
      console.error("🔧 [usePublicPublisher] Error details:", {
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
        ownerId: ownerId?.substring(0, 10) + '...'
      })
      throw new Error(errorMessage)
    } finally {
      setIsPublishing(false)
    }
  }

  return {
    publishToPublic,
    isPublishing,
    error
  }
}
