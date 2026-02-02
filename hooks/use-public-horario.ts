import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface PublicHorarioData {
  ownerId: string
  weekId: string
  weekLabel: string
  publishedAt: any
  days: Record<string, any[]>
}

export interface UsePublicHorarioReturn {
  horario: PublicHorarioData | null
  isLoading: boolean
  error: string | null
}

/**
 * Hook para leer horarios públicos SIN autenticación
 * Lee desde: apps/horarios/published/{ownerId}
 */
export function usePublicHorario(ownerId: string): UsePublicHorarioReturn {
  const [horario, setHorario] = useState<PublicHorarioData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPublicHorario = async () => {
    console.log("🔧 [usePublicHorario] Iniciando carga para ownerId:", ownerId?.substring(0, 10) + '...')

    try {
      if (!db) {
        console.warn("🔧 [usePublicHorario] Firestore no disponible")
        setIsLoading(false)
        return
      }

      if (!ownerId || ownerId.trim() === '') {
        console.warn("🔧 [usePublicHorario] ownerId no proporcionado")
        setError("Se requiere ownerId para acceder al horario")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      console.log("🔧 [usePublicHorario] Loading public horario for ownerId:", ownerId)
      
      // Path válido: apps/horarios/published/{ownerId}
      const fullPath = "apps/horarios/published/" + ownerId
      console.log("🔧 [usePublicHorario] Reading from:", fullPath)
      
      const horarioRef = doc(db, "apps", "horarios", "published", ownerId)
      console.log("🔧 [usePublicHorario] Document reference created")
      
      const horarioDoc = await getDoc(horarioRef)
      console.log("🔧 [usePublicHorario] Document fetched, exists:", horarioDoc.exists())

      if (!horarioDoc.exists()) {
        console.log("🔧 [usePublicHorario] No published horario found")
        setHorario(null)
        return
      }

      const horarioData = horarioDoc.data() as PublicHorarioData
      console.log("🔧 [usePublicHorario] Public horario found:", {
        ownerId: horarioData.ownerId,
        weekId: horarioData.weekId,
        weekLabel: horarioData.weekLabel,
        hasPublishedAt: !!horarioData.publishedAt,
        daysCount: Object.keys(horarioData.days || {}).length
      })
      
      setHorario(horarioData)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al cargar horario"
      setError(errorMessage)
      console.error("🔧 [usePublicHorario] Error loading public horario:", err)
      console.error("🔧 [usePublicHorario] Error details:", {
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
        ownerId: ownerId?.substring(0, 10) + '...'
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPublicHorario()
  }, [ownerId])

  return {
    horario,
    isLoading,
    error
  }
}
