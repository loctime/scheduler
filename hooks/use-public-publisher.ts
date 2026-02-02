import { useState } from "react"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useOwnerId } from "./use-owner-id"

export interface PublishPublicScheduleOptions {
  companyName: string
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

    setIsPublishing(true)
    setError(null)

    try {
      console.log("🔧 [usePublicPublisher] Publishing schedule:", { 
        companyName: options.companyName, 
        weekId: options.weekId,
        ownerId 
      })

      // Generate public schedule ID (could be based on ownerId + timestamp or custom)
      const publicScheduleId = `${ownerId}_${Date.now()}`
      
      // Get the actual week data from schedules collection
      const weekRef = doc(db, "apps/horarios", "schedules", options.weekId)
      const weekDoc = await getDoc(weekRef)
      
      if (!weekDoc.exists()) {
        throw new Error("No se encontraron datos para la semana especificada")
      }

      const weekData = weekDoc.data()

      // Create public schedule document
      const publicScheduleData = {
        companyName: options.companyName,
        ownerId: ownerId,
        publishedWeekId: options.weekId,
        weekData: {
          weekId: options.weekId,
          startDate: weekData.startDate || "",
          endDate: weekData.endDate || "",
          weekNumber: weekData.weekNumber || 0,
          year: weekData.year || new Date().getFullYear(),
          month: weekData.month || 0,
          assignments: weekData.scheduleData?.assignments || weekData.assignments || {}
        },
        updatedAt: serverTimestamp(),
        publishedAt: serverTimestamp()
      }

      const publicRef = doc(db, "public/horarios", publicScheduleId)
      await setDoc(publicRef, publicScheduleData)

      console.log("🔧 [usePublicPublisher] Schedule published successfully:", publicScheduleId)
      
      return publicScheduleId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al publicar"
      setError(errorMessage)
      console.error("🔧 [usePublicPublisher] Error publishing schedule:", err)
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
