import { useEffect, useState, useMemo, useCallback } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import {
  buildMonthGroupsFromSchedules,
  createCalculateMonthlyStats,
  type MonthGroup,
  type WeekGroup,
} from "@/lib/monthly-utils"
import { resolvePublicCompany } from "@/lib/public-companies"

interface PublicScheduleData {
  id: string
  ownerId: string
  publishedWeekId: string
  weeks: Record<string, {
    weekId: string
    weekLabel: string
    publishedAt: any
    publicImageUrl?: string | null
    employees?: any[]
  }>
  userId: string
  isPublic: boolean
  companyName?: string
}

interface FullScheduleData {
  id: string
  weekStart: string
  weekEnd: string
  assignments: Record<string, any>
  employeesSnapshot: any[]
  ordenEmpleadosSnapshot: string[]
  publishedAt: any
  publishedBy: string
  companyName?: string
}

export type { MonthGroup, WeekGroup }

export interface UsePublicMonthlySchedulesV2Options {
  companySlug: string
  employees: any[]
  shifts: any[]
  config?: any
  monthStartDay?: number
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

export interface UsePublicMonthlySchedulesV2Return {
  monthGroups: MonthGroup[]
  companyName?: string
  isLoading: boolean
  error: string | null
  calculateMonthlyStats: (monthDate: Date) => Record<string, EmployeeMonthlyStats>
  refetch: () => void
}

/**
 * Hook para obtener horarios mensuales PÚBLICOS desde publicSchedules
 * Lee exclusivamente desde apps/horarios/publicSchedules/{companySlug}/weeks
 */
export function usePublicMonthlySchedulesV2({
  companySlug,
  employees,
  shifts,
  config,
  monthStartDay = 1,
  weekStartsOn = 1
}: UsePublicMonthlySchedulesV2Options): UsePublicMonthlySchedulesV2Return {
  const [schedules, setSchedules] = useState<PublicScheduleData[]>([])
  const [companyName, setCompanyName] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchTrigger, setRefetchTrigger] = useState(0)

  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1)
  }, [])

  useEffect(() => {
    if (!companySlug || !db) {
      setError("No se pudo inicializar la carga de horarios públicos: companySlug o base de datos no disponible")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    // Primero resolver companySlug a ownerId
    const loadPublicData = async () => {
      try {
        // Resolver companySlug a ownerId usando el mismo sistema que usePublicHorario
        const publicCompany = await resolvePublicCompany(companySlug)
        if (!publicCompany) {
          setError("Empresa no encontrada")
          setIsLoading(false)
          return
        }

        console.log("🔧 [usePublicMonthlySchedulesV2] CompanySlug resuelto:", {
          companySlug,
          ownerId: publicCompany.ownerId,
          companyName: publicCompany.companyName
        })

        // Leer desde enlaces_publicos (único lugar con reglas públicas)
        if (!db) {
          setError("Base de datos no disponible")
          setIsLoading(false)
          return
        }
        
        const publicDocRef = doc(db, "apps", "horarios", "enlaces_publicos", publicCompany.ownerId)
        const publicDoc = await getDoc(publicDocRef)

        if (!publicDoc.exists()) {
          console.log("🔧 [usePublicMonthlySchedulesV2] No existe documento enlaces_publicos para ownerId:", publicCompany.ownerId)
          setSchedules([])
          setCompanyName(publicCompany.companyName)
          setError(null)
          setIsLoading(false)
          return
        }

        const data = publicDoc.data() as PublicScheduleData
        console.log("🔧 [usePublicMonthlySchedulesV2] Datos cargados desde enlaces_publicos:", {
          ownerId: publicCompany.ownerId,
          hasWeeks: !!data.weeks,
          weeksCount: Object.keys(data.weeks || {}).length,
          companyName: data.companyName
        })

        // Para cada week en enlaces_publicos, obtener el schedule original desde schedules/{weekId}
        const schedulesWithFullData: FullScheduleData[] = []
        const weeks = data.weeks || {}
        
        for (const [weekKey, weekData] of Object.entries(weeks)) {
          try {
            // Obtener el schedule original desde schedules/{weekId}
            const scheduleRef = doc(db, "apps", "horarios", "schedules", weekData.weekId)
            const scheduleDoc = await getDoc(scheduleRef)
            
            if (!scheduleDoc.exists()) {
              console.warn("🔧 [usePublicMonthlySchedulesV2] No existe schedule original para weekId:", weekData.weekId)
              continue
            }
            
            const originalSchedule = scheduleDoc.data() as any
            console.log("🔧 [usePublicMonthlySchedulesV2] Schedule original encontrado:", {
              weekId: weekData.weekId,
              hasWeekStart: !!originalSchedule.weekStart,
              hasWeekEnd: !!originalSchedule.weekEnd,
              weekStart: originalSchedule.weekStart,
              weekEnd: originalSchedule.weekEnd
            })
            
            // Crear un schedule con los datos del original pero compatible con la interfaz
            const fullScheduleData = {
              id: weekData.weekId,
              weekStart: originalSchedule.weekStart,
              weekEnd: originalSchedule.weekEnd,
              assignments: originalSchedule.assignments || {},
              employeesSnapshot: originalSchedule.employeesSnapshot || weekData.employees || [],
              ordenEmpleadosSnapshot: originalSchedule.ordenEmpleadosSnapshot || [],
              publishedAt: weekData.publishedAt,
              publishedBy: publicCompany.ownerId,
              companyName: data.companyName || publicCompany.companyName
            }
            
            schedulesWithFullData.push(fullScheduleData)
          } catch (error) {
            console.error("🔧 [usePublicMonthlySchedulesV2] Error obteniendo schedule original:", {
              weekId: weekData.weekId,
              error: error
            })
          }
        }

        setSchedules(schedulesWithFullData as any[])
        setCompanyName(data.companyName || publicCompany.companyName)
        setError(null)

      } catch (err) {
        console.error("❌ [usePublicMonthlySchedulesV2] Error cargando datos públicos:", err)
        setError("Error al cargar los horarios públicos")
      } finally {
        setIsLoading(false)
      }
    }

    loadPublicData()
  }, [companySlug, refetchTrigger])

  const monthGroups = useMemo(
    () =>
      buildMonthGroupsFromSchedules(
        schedules as any,
        monthStartDay,
        weekStartsOn
      ),
    [schedules, monthStartDay, weekStartsOn]
  )

  const calculateMonthlyStats = useMemo(
    () =>
      createCalculateMonthlyStats({
        employees,
        shifts,
        config,
        schedules: schedules as any,
        monthStartDay,
        weekStartsOn,
      }),
    [employees, shifts, config, schedules, monthStartDay, weekStartsOn]
  )

  return {
    monthGroups,
    companyName,
    isLoading,
    error,
    calculateMonthlyStats,
    refetch
  }
}
