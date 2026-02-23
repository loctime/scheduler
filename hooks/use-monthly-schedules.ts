import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Horario } from "@/lib/types"
import {
  buildMonthGroupsFromSchedules,
  createCalculateMonthlyStats,
  type MonthGroup,
  type WeekGroup,
} from "@/lib/monthly-utils"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { getCache, setCache } from "@/lib/cache/indexeddb-cache"
import { compareArraysByIds } from "@/lib/cache/cache-utils"

export type { MonthGroup, WeekGroup }

export interface UseMonthlySchedulesOptions {
  ownerId: string
  employees: any[]
  shifts: any[]
  config?: any
  monthStartDay?: number
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

export interface UseMonthlySchedulesReturn {
  monthGroups: MonthGroup[]
  isLoading: boolean
  error: string | null
  calculateMonthlyStats: (monthDate: Date) => Record<string, EmployeeMonthlyStats>
  refetch: () => void
}

/**
 * Hook compartido para obtener y organizar horarios mensuales
 * Extrae la lógica del dashboard para ser reutilizada en PWA
 */
export function useMonthlySchedules({
  ownerId,
  employees,
  shifts,
  config,
  monthStartDay = 1,
  weekStartsOn = 1
}: UseMonthlySchedulesOptions): UseMonthlySchedulesReturn {
  const [schedules, setSchedules] = useState<Horario[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchTrigger, setRefetchTrigger] = useState(0)
  const listenerSetupRef = useRef(false)
  const mountedRef = useRef(true)

  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!ownerId || !db) {
      setError("No se pudo inicializar la carga de horarios")
      setIsLoading(false)
      return
    }

    // Limpiar listener anterior si existe
    listenerSetupRef.current = false

    const cacheKey = `monthly-schedules-${ownerId}`
    
    // 1. Cargar desde cache primero (stale-while-revalidate)
    getCache<Horario[]>(cacheKey)
      .then((cachedSchedules) => {
        if (cachedSchedules && cachedSchedules.length > 0 && mountedRef.current) {
          setSchedules(cachedSchedules)
          setIsLoading(false)
          setError(null)
          // Continuar con listener en background
        } else if (mountedRef.current) {
          setIsLoading(true)
        }
      })
      .catch(() => {
        // Ignorar errores de cache, continuar con carga normal
        if (mountedRef.current) {
          setIsLoading(true)
        }
      })

    setError(null)

    const schedulesQuery = query(
      collection(db, COLLECTIONS.SCHEDULES),
      where("ownerId", "==", ownerId),
      orderBy("weekStart", "desc")
    )

    const unsubscribeSchedules = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        if (!mountedRef.current) return
        
        try {
          const schedulesData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Horario[]
          
          // Solo actualizar si los datos cambiaron (evitar re-renders innecesarios)
          setSchedules((prevSchedules) => {
            if (compareArraysByIds(prevSchedules, schedulesData)) {
              return prevSchedules // No cambiar si son iguales
            }
            return schedulesData
          })
          
          setError(null)
          
          // Actualizar cache en background
          setCache(cacheKey, schedulesData).catch(() => {
            // Ignorar errores de cache
          })
        } catch (err) {
          console.error("Error processing schedules data:", err)
          if (mountedRef.current) {
            setError("Error al procesar los datos de horarios")
          }
        } finally {
          if (mountedRef.current) {
            setIsLoading(false)
          }
        }
      },
      (error) => {
        console.error("Error loading schedules:", error)
        if (mountedRef.current) {
          setError("No se pudieron cargar los horarios")
          setIsLoading(false)
        }
      }
    )

    listenerSetupRef.current = true

    return () => {
      unsubscribeSchedules()
      listenerSetupRef.current = false
    }
  }, [ownerId, refetchTrigger])

  const monthGroups = useMemo(
    () => buildMonthGroupsFromSchedules(schedules, monthStartDay, weekStartsOn),
    [schedules, monthStartDay, weekStartsOn]
  )

  const calculateMonthlyStats = useMemo(
    () =>
      createCalculateMonthlyStats({
        employees,
        shifts,
        config,
        schedules,
        monthStartDay,
        weekStartsOn,
      }),
    [employees, shifts, config, schedules, monthStartDay, weekStartsOn]
  )

  return {
    monthGroups,
    isLoading,
    error,
    calculateMonthlyStats,
    refetch
  }
}
