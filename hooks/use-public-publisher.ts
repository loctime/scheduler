import { useState } from "react"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useOwnerId } from "./use-owner-id"
import { useData } from "@/contexts/data-context"

export interface PublishPublicScheduleOptions {
  companyName?: string
  weekId: string
  weekData: any
  publicImageUrl?: string
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
  const { user } = useData()

  console.log("🔧 [usePublicPublisher] Hook inicializado", { 
    hasOwnerId: !!ownerId,
    ownerId: ownerId?.substring(0, 10) + '...', // .Solo mostrar primeros 10 chars por seguridad
    hasUser: !!user,
    userId: user?.uid?.substring(0, 10) + '...'
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
      console.log("🔧 [usePublicPublisher] Has publicImageUrl:", !!options.publicImageUrl)
      
      // Path EXACTO: apps/horarios/enlaces_publicos/{ownerId} (3 segmentos - válido)
      const fullPath = "apps/horarios/enlaces_publicos/" + ownerId
      console.log("🔧 [usePublicPublisher] Writing to:", fullPath)
      
      // Estructura con weeks y publicImageUrl
      const weekData = {
        weekId: options.weekId,
        weekLabel: options.weekData.startDate && options.weekData.endDate 
          ? `${options.weekData.startDate} - ${options.weekData.endDate}`
          : `Semana ${options.weekId}`,
        publishedAt: serverTimestamp(),
        publicImageUrl: options.publicImageUrl || null,
        days: options.weekData.scheduleData?.assignments || options.weekData.assignments || {},
        employees: options.weekData.employees || []
      }
      
      const publicScheduleData = {
        ownerId: ownerId,
        publishedWeekId: options.weekId,
        weeks: {
          [options.weekId]: weekData
        },
        userId: user?.uid, // Requerido por las reglas de Firestore
        isPublic: true, // Flag para identificar como horario público
        companyName: options.companyName || ""
      }

      console.log("🔧 [usePublicPublisher] Datos a publicar:", {
        ...publicScheduleData,
        publishedAt: "[Timestamp]",
        weeksCount: Object.keys(publicScheduleData.weeks).length,
        currentWeekId: publicScheduleData.publishedWeekId,
        hasPublicImageUrl: !!weekData.publicImageUrl,
        daysCount: Object.keys(weekData.days).length,
        employeesCount: weekData.employees.length
      })

      // Usar setDoc con overwrite completo en apps/horarios/enlaces_publicos/{ownerId}
      const publicRef = doc(db, "apps", "horarios", "enlaces_publicos", ownerId)
      console.log("🔧 [usePublicPublisher] Document reference created for apps/horarios/enlaces_publicos/" + ownerId)
      
      await setDoc(publicRef, publicScheduleData)
      console.log("🔧 [usePublicPublisher] Publish success - document written to:", fullPath)
      console.log("🔧 [usePublicPublisher] PublicImageUrl saved successfully:", !!options.publicImageUrl)
      
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
