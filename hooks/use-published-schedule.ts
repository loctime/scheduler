import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useOwnerId } from "./use-owner-id"
import { createSettingsRef } from "@/lib/firestore-helpers"

export interface PublishedScheduleData {
  id: string
  companyName: string
  ownerId: string
  publishedWeekId: string
  weekData: {
    weekId: string
    startDate: string
    endDate: string
    weekNumber: number
    year: number
    month: number
    assignments?: Record<string, Record<string, any[]>>
  }
  publishedAt: any
  updatedAt: any
}

export interface UsePublishedScheduleReturn {
  publishedSchedule: PublishedScheduleData | null
  isLoading: boolean
  error: string | null
  shareUrl: string | null
}

export function usePublishedSchedule(): UsePublishedScheduleReturn {
  const [publishedSchedule, setPublishedSchedule] = useState<PublishedScheduleData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ownerId = useOwnerId()

  const loadPublishedSchedule = async () => {
    try {
      if (!db) {
        console.warn("Firestore not available")
        setIsLoading(false)
        return
      }

      if (!ownerId) {
        console.warn("🔧 [usePublishedSchedule] ownerId not available yet - skipping load")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      console.log("🔧 [usePublishedSchedule] Loading published schedule for ownerId:", ownerId)
      
      // Leer settings para obtener el publishedScheduleId - path válido
      const settingsRef = createSettingsRef(db, ownerId)
      const settingsDoc = await getDoc(settingsRef)
      
      if (!settingsDoc.exists()) {
        console.log("🔧 [usePublishedSchedule] No settings found - no published schedule")
        setPublishedSchedule(null)
        return
      }

      const settingsData = settingsDoc.data() as any
      const publishedScheduleId = settingsData.publishedScheduleId

      if (!publishedScheduleId) {
        console.log("🔧 [usePublishedSchedule] No publishedScheduleId in settings")
        setPublishedSchedule(null)
        return
      }

      console.log("🔧 [usePublishedSchedule] Reading published schedule:", publishedScheduleId)
      
      // Leer el horario publicado desde la colección pública
      const publicScheduleRef = doc(db, "public/horarios", publishedScheduleId)
      const publicScheduleDoc = await getDoc(publicScheduleRef)

      if (!publicScheduleDoc.exists()) {
        console.log("🔧 [usePublishedSchedule] Published schedule not found in public collection")
        setPublishedSchedule(null)
        return
      }

      const scheduleData = publicScheduleDoc.data() as PublishedScheduleData
      console.log("🔧 [usePublishedSchedule] Published schedule found:", {
        companyName: scheduleData.companyName,
        publishedWeekId: scheduleData.publishedWeekId
      })
      
      setPublishedSchedule({
        ...scheduleData,
        id: publicScheduleDoc.id
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      console.error("🔧 [usePublishedSchedule] Error loading published schedule:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPublishedSchedule()
  }, [ownerId])

  // Generar URL de compartir
  const shareUrl = publishedSchedule 
    ? `${window.location.origin}/pwa/horario/${publishedSchedule.id}`
    : null

  return {
    publishedSchedule,
    isLoading,
    error,
    shareUrl
  }
}
