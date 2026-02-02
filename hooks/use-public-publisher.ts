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

  const publishToPublic = async (options: PublishPublicScheduleOptions): Promise<string> => {
    if (!ownerId) {
      throw new Error("No se puede publicar sin ownerId")
    }

    if (!db) {
      throw new Error("Firestore no disponible")
    }

    // Validación obligatoria: debe haber weekData
    if (!options.weekData) {
      throw new Error("No hay datos de semana para publicar")
    }

    setIsPublishing(true)
    setError(null)

    try {
      console.log("🔧 [usePublicPublisher] Publishing schedule for ownerId:", ownerId)
      console.log("🔧 [usePublicPublisher] WeekId:", options.weekId)
      
      // Path EXACTO: apps/horarios/published/{ownerId} (4 segmentos)
      console.log("🔧 [usePublicPublisher] Writing to apps/horarios/published/" + ownerId)
      
      // Estructura mínima para lectura pública
      const publicScheduleData = {
        ownerId: ownerId,
        weekId: options.weekId,
        weekLabel: options.weekData.startDate && options.weekData.endDate 
          ? `${options.weekData.startDate} - ${options.weekData.endDate}`
          : `Semana ${options.weekId}`,
        publishedAt: serverTimestamp(),
        days: options.weekData.scheduleData?.assignments || options.weekData.assignments || {}
      }

      // Usar setDoc con overwrite completo
      const publicRef = doc(db, "apps", "horarios", "published", ownerId)
      await setDoc(publicRef, publicScheduleData)

      console.log("🔧 [usePublicPublisher] Publish success - document written to apps/horarios/published/" + ownerId)
      
      return ownerId // Retornar el ownerId para generar URL pública
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al publicar"
      setError(errorMessage)
      console.error("🔧 [usePublicPublisher] Publish error:", err)
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
