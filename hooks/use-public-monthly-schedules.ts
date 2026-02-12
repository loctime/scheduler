import { useState, useEffect } from "react"
import { resolvePublicCompany } from "@/lib/public-companies"
import { useMonthlySchedules, type UseMonthlySchedulesOptions, type UseMonthlySchedulesReturn } from "./use-monthly-schedules"

export interface UsePublicMonthlySchedulesOptions {
  companySlug: string
  employees: any[]
  shifts: any[]
  config?: any
  monthStartDay?: number
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

export interface UsePublicMonthlySchedulesReturn extends UseMonthlySchedulesReturn {
  companyName?: string
  isResolving: boolean
  resolveError: string | null
}

/**
 * Hook para obtener horarios mensuales públicos usando companySlug
 * Combina la resolución de companySlug con la lógica de listado mensual
 */
export function usePublicMonthlySchedules({
  companySlug,
  employees,
  shifts,
  config,
  monthStartDay = 1,
  weekStartsOn = 1
}: UsePublicMonthlySchedulesOptions): UsePublicMonthlySchedulesReturn {
  const [isResolving, setIsResolving] = useState(true)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | undefined>()

  const monthlySchedules = useMonthlySchedules({
    ownerId: ownerId || "",
    employees,
    shifts,
    config,
    monthStartDay,
    weekStartsOn
  })

  useEffect(() => {
    const resolveCompany = async () => {
      try {
        setIsResolving(true)
        setResolveError(null)

        if (!companySlug || companySlug.trim() === "") {
          setResolveError("Enlace inválido")
          return
        }

        // Resolver companySlug a ownerId usando O(1) lookup
        const publicCompany = await resolvePublicCompany(companySlug)
        if (!publicCompany) {
          setResolveError("Horario no encontrado")
          return
        }

        setOwnerId(publicCompany.ownerId)
        setCompanyName(publicCompany.companyName)
      } catch (err) {
        console.error('❌ [usePublicMonthlySchedules] Error resolviendo company:', err)
        setResolveError("Error al cargar horario")
      } finally {
        setIsResolving(false)
      }
    }

    resolveCompany()
  }, [companySlug])

  return {
    ...monthlySchedules,
    companyName,
    isResolving,
    resolveError,
    isLoading: isResolving || monthlySchedules.isLoading,
    error: resolveError || monthlySchedules.error
  }
}
