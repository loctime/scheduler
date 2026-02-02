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
    try {
      if (!db) {
        console.warn("Firestore not available")
        setIsLoading(false)
        return
      }

      if (!ownerId || ownerId.trim() === '') {
        console.warn("🔧 [usePublicHorario] ownerId not provided")
        setError("Se requiere ownerId para acceder al horario")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      console.log("🔧 [usePublicHorario] Loading public horario for ownerId:", ownerId)
      
      // Path válido: apps/horarios/published/{ownerId}
      const horarioRef = doc(db, "apps", "horarios", "published", ownerId)
      console.log("🔧 [usePublicHorario] Reading from: apps/horarios/published/" + ownerId)
      
      const horarioDoc = await getDoc(horarioRef)

      if (!horarioDoc.exists()) {
        console.log("🔧 [usePublicHorario] No published horario found")
        setHorario(null)
        return
      }

      const horarioData = horarioDoc.data() as PublicHorarioData
      console.log("🔧 [usePublicHorario] Public horario found:", {
        ownerId: horarioData.ownerId,
        weekId: horarioData.weekId,
        weekLabel: horarioData.weekLabel
      })
      
      setHorario(horarioData)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al cargar horario"
      setError(errorMessage)
      console.error("🔧 [usePublicHorario] Error loading public horario:", err)
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
