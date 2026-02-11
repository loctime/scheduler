import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { resolvePublicCompany } from "@/lib/public-companies"
import { sanitizePublicHorarioData, isValidPublicHorarioData, createGenericPublicError, logPublicAccess } from "@/lib/public-data-sanitizer"

export interface UsePublicHorarioReturn {
  horario: any // SanitizedPublicHorarioData pero sin tipado estricto para compatibilidad
  isLoading: boolean
  error: string | null
}

/**
 * Hook para cargar horario público usando el nuevo sistema de companySlug
 * 
 * Características:
 * - Resolución O(1) desde publicCompanies/{slug}
 * - Sanitización estricta de datos sensibles
 * - Logging de accesos para seguridad
 * - 404 controlado sin revelar información
 */
export function usePublicHorario(companySlug: string): UsePublicHorarioReturn {
  const [horario, setHorario] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPublicHorario = async () => {
    try {
      // Resetear estado
      setIsLoading(true)
      setError(null)
      setHorario(null)

      // Validaciones básicas
      if (!db) {
        setError("Servicio no disponible")
        return
      }

      if (!companySlug || companySlug.trim() === "") {
        setError("Enlace inválido")
        return
      }

      // Log de intento de acceso (para seguridad)
      logPublicAccess(companySlug)

      // Resolver companySlug a ownerId usando O(1) lookup
      const publicCompany = await resolvePublicCompany(companySlug)
      if (!publicCompany) {
        // 404 controlado - no revelar si existió o no
        const errorResponse = createGenericPublicError()
        setError(errorResponse.error)
        return
      }

      // Obtener datos públicos desde la colección dedicada
      const horarioRef = doc(db, "apps", "horarios", "enlaces_publicos", publicCompany.ownerId)
      const horarioDoc = await getDoc(horarioRef)

      if (!horarioDoc.exists()) {
        const errorResponse = createGenericPublicError()
        setError(errorResponse.error)
        return
      }

      const rawData = horarioDoc.data() as any
      
      // Sanitizar datos para remover información sensible
      const sanitizedData = sanitizePublicHorarioData(rawData)
      
      if (!isValidPublicHorarioData(sanitizedData)) {
        setError("Horario no disponible")
        return
      }

      // Actualizar log de acceso exitoso
      logPublicAccess(companySlug, navigator.userAgent, 'success')

      setHorario(sanitizedData)
    } catch (err) {
      console.error('❌ [usePublicHorario] Error cargando horario público:', err)
      
      // Error genérico para no revelar información sensible
      const errorMessage = err instanceof Error ? err.message : "Error al cargar horario"
      
      // Si es error de red/conexión, mostrarlo
      if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
        setError("Error de conexión. Intenta nuevamente.")
      } else {
        setError("Error al cargar horario")
      }
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
