import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { resolveOwnerIdFromCompanySlug } from "@/lib/public-company"

export interface PublicHorarioData {
  ownerId: string
  publishedWeekId: string
  weeks: Record<string, {
    weekId: string
    weekLabel: string
    publishedAt: any
    publicImageUrl?: string | null
    days: Record<string, any[]>
    employees: any[]
  }>
  userId: string
  isPublic?: boolean
  companyName?: string
}

export interface UsePublicHorarioReturn {
  horario: PublicHorarioData | null
  isLoading: boolean
  error: string | null
}

/**
 * Public data contract:
 * - route param is companySlug
 * - slug resolves to ownerId
 * - reads only from public collection apps/horarios/enlaces_publicos/{ownerId}
 */
export function usePublicHorario(companySlug: string): UsePublicHorarioReturn {
  const [horario, setHorario] = useState<PublicHorarioData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPublicHorario = async () => {
    try {
      if (!db) {
        setError("Firestore no disponible")
        setIsLoading(false)
        return
      }

      if (!companySlug || companySlug.trim() === "") {
        setError("Se requiere companySlug para acceder al horario")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      const ownerId = await resolveOwnerIdFromCompanySlug(companySlug)
      if (!ownerId) {
        setError("Empresa no encontrada")
        setHorario(null)
        return
      }

      const horarioRef = doc(db, "apps", "horarios", "enlaces_publicos", ownerId)
      const horarioDoc = await getDoc(horarioRef)

      if (!horarioDoc.exists()) {
        setHorario(null)
        setError("Horario público no disponible")
        return
      }

      const horarioData = horarioDoc.data() as PublicHorarioData
      // Defensive public filter: expose only strictly public fields
      setHorario({
        ownerId: horarioData.ownerId,
        publishedWeekId: horarioData.publishedWeekId,
        weeks: horarioData.weeks || {},
        userId: horarioData.userId,
        isPublic: horarioData.isPublic,
        companyName: horarioData.companyName,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al cargar horario"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPublicHorario()
  }, [companySlug])

  return {
    horario,
    isLoading,
    error,
  }
}
