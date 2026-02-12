import { useEffect, useState, useMemo, useCallback } from "react"
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

  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1)
  }, [])

  useEffect(() => {
    if (!ownerId || !db) {
      setError("No se pudo inicializar la carga de horarios")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const schedulesQuery = query(
      collection(db, COLLECTIONS.SCHEDULES),
      where("ownerId", "==", ownerId),
      orderBy("weekStart", "desc")
    )

    const unsubscribeSchedules = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        try {
          const schedulesData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Horario[]
          setSchedules(schedulesData)
          setError(null)
        } catch (err) {
          console.error("Error processing schedules data:", err)
          setError("Error al procesar los datos de horarios")
        } finally {
          setIsLoading(false)
        }
      },
      (error) => {
        console.error("Error loading schedules:", error)
        setError("No se pudieron cargar los horarios")
        setIsLoading(false)
      }
    )

    return () => {
      unsubscribeSchedules()
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
