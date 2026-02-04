import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface PublicSchedule {
  id: string
  companyName: string
  ownerId: string
  publishedWeekId: string
  weekData?: {
    weekId: string
    startDate: string
    endDate: string
    weekNumber: number
    year: number
    month: number
    assignments?: Record<string, Record<string, any[]>>
  }
  updatedAt?: any
}

export interface UsePublicScheduleReturn {
  publicSchedule: PublicSchedule | null
  isLoading: boolean
  error: string | null
}

export function usePublicSchedule(publicScheduleId: string): UsePublicScheduleReturn {
  const [publicSchedule, setPublicSchedule] = useState<PublicSchedule | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPublicSchedule = async () => {
      if (!publicScheduleId || !db) {
        setPublicSchedule(null)
        setError("ID de horario no válido")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        console.log("🔧 [usePublicSchedule] Loading public schedule:", publicScheduleId)
        
        const scheduleRef = doc(db, "apps", "horarios", "enlaces_publicos", publicScheduleId)
        console.log("🔧 [usePublicSchedule] Path:", `apps/horarios/enlaces_publicos/${publicScheduleId}`)
        
        const scheduleDoc = await getDoc(scheduleRef)

        if (scheduleDoc.exists()) {
          const data = scheduleDoc.data()
          const publishedWeek = data.weeks?.[data.publishedWeekId]
          const schedule: PublicSchedule = {
            id: scheduleDoc.id,
            companyName: data.companyName || "",
            ownerId: data.ownerId || "",
            publishedWeekId: data.publishedWeekId || "",
            weekData: publishedWeek,
            updatedAt: data.updatedAt
          }
          
          console.log("🔧 [usePublicSchedule] Schedule found:", { 
            companyName: schedule.companyName,
            publishedWeekId: schedule.publishedWeekId 
          })
          
          setPublicSchedule(schedule)
        } else {
          console.log("🔧 [usePublicSchedule] No schedule found")
          setError("Horario no encontrado")
          setPublicSchedule(null)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Error desconocido"
        setError(errorMessage)
        console.error("🔧 [usePublicSchedule] Error loading public schedule:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadPublicSchedule()
  }, [publicScheduleId])

  return {
    publicSchedule,
    isLoading,
    error
  }
}
