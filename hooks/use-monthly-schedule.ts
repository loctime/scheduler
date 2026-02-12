"use client"

import { useMemo } from "react"
import { useMonthlySchedules } from "@/hooks/use-monthly-schedules"
import { usePublicMonthlySchedulesV2 } from "@/hooks/use-public-monthly-schedules-v2"
import type { Empleado, Turno } from "@/lib/types"
import type { Configuracion } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"

export interface MonthGroup {
  monthKey: string
  monthName: string
  monthDate: Date
  weeks: {
    weekStartDate: Date
    weekEndDate: Date
    weekStartStr: string
    schedule: any
    weekDays: Date[]
  }[]
}

export interface UseMonthlyScheduleOptions {
  /** ownerId para contexto autenticado (dashboard) */
  ownerId?: string | null
  /** companySlug para vista pública (PWA sin auth) */
  companySlug?: string | null
  /** Año para filtrar (opcional) */
  year?: number
  /** Mes (1-12) para filtrar (opcional) */
  month?: number
  /** Empleados (solo necesario cuando ownerId está definido) */
  employees?: Empleado[]
  /** Turnos (solo necesario cuando ownerId está definido) */
  shifts?: Turno[]
  /** Configuración (solo necesario cuando ownerId está definido) */
  config?: Configuracion | null
  monthStartDay?: number
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

export interface UseMonthlyScheduleReturn {
  monthGroups: MonthGroup[]
  companyName?: string
  isLoading: boolean
  error: string | null
  calculateMonthlyStats: (monthDate: Date) => Record<string, EmployeeMonthlyStats>
  refetch: () => void
}

/**
 * Hook unificado para horarios mensuales.
 * No usa useAuth, useData ni contexto de usuario.
 * Recibe ownerId o companySlug explícitamente.
 *
 * - ownerId: consulta schedules directamente (requiere usuario logueado para Firestore)
 * - companySlug: usa enlaces_publicos (funciona sin auth)
 */
export function useMonthlySchedule({
  ownerId,
  companySlug,
  year,
  month,
  employees = [],
  shifts = [],
  config,
  monthStartDay = 1,
  weekStartsOn = 1,
}: UseMonthlyScheduleOptions): UseMonthlyScheduleReturn {
  const useOwnerId = Boolean(ownerId)
  const useSlug = Boolean(companySlug)

  const ownerResult = useMonthlySchedules({
    ownerId: ownerId ?? "",
    employees,
    shifts,
    config,
    monthStartDay,
    weekStartsOn,
  })

  const publicResult = usePublicMonthlySchedulesV2({
    companySlug: companySlug ?? "",
    employees,
    shifts,
    config,
    monthStartDay,
    weekStartsOn,
  })

  const filterByYearMonth = (groups: MonthGroup[]) => {
    if (year == null && month == null) return groups
    return groups.filter((g) => {
      const [gYear, gMonth] = g.monthKey.split("-").map(Number)
      if (year != null && gYear !== year) return false
      if (month != null && gMonth !== month) return false
      return true
    })
  }

  return useMemo(() => {
    if (useOwnerId) {
      const filtered = filterByYearMonth(ownerResult.monthGroups)
      return {
        monthGroups: filtered,
        companyName: config?.nombreEmpresa,
        isLoading: ownerResult.isLoading,
        error: ownerResult.error,
        calculateMonthlyStats: ownerResult.calculateMonthlyStats,
        refetch: ownerResult.refetch,
      }
    }
    if (useSlug) {
      const filtered = filterByYearMonth(publicResult.monthGroups)
      return {
        monthGroups: filtered,
        companyName: publicResult.companyName,
        isLoading: publicResult.isLoading,
        error: publicResult.error,
        calculateMonthlyStats: publicResult.calculateMonthlyStats,
        refetch: publicResult.refetch,
      }
    }

    return {
      monthGroups: [],
      companyName: undefined,
      isLoading: false,
      error: null,
      calculateMonthlyStats: () => ({}),
      refetch: () => {},
    }
  }, [
    useOwnerId,
    useSlug,
    year,
    month,
    ownerResult,
    publicResult,
    config?.nombreEmpresa,
  ])
}
