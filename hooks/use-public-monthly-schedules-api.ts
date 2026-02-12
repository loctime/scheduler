"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import type { Empleado, Horario, Turno } from "@/lib/types"
import type { Configuracion } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/types/employee-stats"
import {
  buildMonthGroupsFromSchedules,
  createCalculateMonthlyStats,
  type MonthGroup,
} from "@/lib/monthly-utils"

export interface PublicMonthlyCompletosResponse {
  companyName: string
  config?: Configuracion
  schedules: Horario[]
  employees: Empleado[]
  shifts: Turno[]
}

export interface UsePublicMonthlySchedulesApiOptions {
  companySlug: string
  year?: number
  month?: number
}

export interface UsePublicMonthlySchedulesApiReturn {
  monthGroups: MonthGroup[]
  companyName?: string
  employees: Empleado[]
  shifts: Turno[]
  config?: Configuracion | null
  isLoading: boolean
  error: string | null
  calculateMonthlyStats: (monthDate: Date) => Record<string, EmployeeMonthlyStats>
  refetch: () => void
}

function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || window.location.origin
  }
  return process.env.NEXT_PUBLIC_API_URL || ""
}

/**
 * Hook para obtener horarios mensuales públicos desde el endpoint del backend.
 * NO usa Firestore ni Auth. Solo fetch HTTP.
 */
export function usePublicMonthlySchedulesApi({
  companySlug,
  year,
  month,
}: UsePublicMonthlySchedulesApiOptions): UsePublicMonthlySchedulesApiReturn {
  const [data, setData] = useState<PublicMonthlyCompletosResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchTrigger, setRefetchTrigger] = useState(0)

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!companySlug) {
      setError("companySlug es requerido")
      setIsLoading(false)
      return
    }

    const loadFromApi = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const baseUrl = getApiBaseUrl()
        const url = `${baseUrl}/api/horarios/publicos-completos?companySlug=${encodeURIComponent(companySlug)}`
        const res = await fetch(url)

        if (!res.ok) {
          if (res.status === 404) {
            setError("Empresa no encontrada")
            setData(null)
          } else {
            setError(res.statusText || "Error al cargar los horarios")
            setData(null)
          }
          return
        }

        const json = (await res.json()) as PublicMonthlyCompletosResponse
        setData(json)
        setError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al cargar los horarios"
        setError(message)
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadFromApi()
  }, [companySlug, refetchTrigger])

  const monthStartDay = data?.config?.mesInicioDia ?? 1
  const weekStartsOn = (data?.config?.semanaInicioDia ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6

  const monthGroups = useMemo<MonthGroup[]>(() => {
    if (!data?.schedules?.length) return []
    const groups = buildMonthGroupsFromSchedules(
      data.schedules,
      monthStartDay,
      weekStartsOn
    )
    if (year != null || month != null) {
      return groups.filter((g) => {
        const [gYear, gMonth] = g.monthKey.split("-").map(Number)
        if (year != null && gYear !== year) return false
        if (month != null && gMonth !== month) return false
        return true
      })
    }
    return groups
  }, [data?.schedules, monthStartDay, weekStartsOn, year, month])

  const calculateMonthlyStats = useMemo(
    () =>
      createCalculateMonthlyStats({
        employees: data?.employees ?? [],
        shifts: data?.shifts ?? [],
        config: data?.config,
        schedules: data?.schedules ?? [],
        monthStartDay,
        weekStartsOn,
      }),
    [data?.employees, data?.shifts, data?.config, data?.schedules, monthStartDay, weekStartsOn]
  )

  return {
    monthGroups,
    companyName: data?.companyName,
    employees: data?.employees ?? [],
    shifts: data?.shifts ?? [],
    config: data?.config ?? null,
    isLoading,
    error,
    calculateMonthlyStats,
    refetch,
  }
}
