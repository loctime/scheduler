import { useEffect, useState, useMemo, useCallback } from "react"
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format, parseISO, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { getCustomMonthRange, getMonthWeeks } from "@/lib/utils"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { calculateHoursBreakdown } from "@/lib/validations"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"
import { ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"

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

const normalizeAssignments = (value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  return (value as any[]).map((assignment) => ({
    type: assignment.type,
    shiftId: assignment.shiftId || "",
    startTime: assignment.startTime || "",
    endTime: assignment.endTime || "",
  }))
}

export interface MonthGroup {
  monthKey: string // YYYY-MM
  monthName: string // "Enero 2024"
  monthDate: Date // Fecha del mes
  weeks: WeekGroup[]
}

export interface WeekGroup {
  weekStartDate: Date
  weekEndDate: Date
  weekStartStr: string
  schedule: any // PublicScheduleData
  weekDays: Date[]
}

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
      setError("No se pudo inicializar la carga de horarios públicos")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    // Leer desde enlaces_publicos (la única colección pública con reglas definidas)
    const publicSchedulesQuery = query(
      collection(db, "apps", "horarios", "enlaces_publicos", companySlug),
      orderBy("publishedAt", "desc")
    )

    const unsubscribeSchedules = onSnapshot(
      publicSchedulesQuery,
      (snapshot) => {
        try {
          const schedulesData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as PublicScheduleData[]
          setSchedules(schedulesData)
          
          // Extraer companyName del primer schedule que lo tenga
          const firstScheduleWithCompanyName = schedulesData.find(schedule => schedule.companyName)
          if (firstScheduleWithCompanyName) {
            setCompanyName(firstScheduleWithCompanyName.companyName)
          }
          
          setError(null)
        } catch (err) {
          console.error("Error processing public schedules data:", err)
          setError("Error al procesar los datos de horarios públicos")
        } finally {
          setIsLoading(false)
        }
      },
      (error) => {
        console.error("Error loading public schedules:", error)
        setError("No se pudieron cargar los horarios públicos")
        setIsLoading(false)
      }
    )

    return () => {
      unsubscribeSchedules()
    }
  }, [companySlug, refetchTrigger])

  // Agrupar horarios por mes y semana (adaptado a estructura enlaces_publicos)
  const monthGroups = useMemo<MonthGroup[]>(() => {
    if (schedules.length === 0) return []

    const monthMap = new Map<string, MonthGroup>()

    schedules.forEach((publicDoc) => {
      // Extraer weeks del documento enlaces_publicos
      const weeks = publicDoc.weeks || {}
      
      Object.values(weeks).forEach((weekData) => {
        // Extraer fechas del weekLabel o usar valores por defecto
        let weekStart: Date
        let weekEnd: Date
        
        if (weekData.weekLabel && weekData.weekLabel.includes(' - ')) {
          const [startStr, endStr] = weekData.weekLabel.split(' - ')
          weekStart = parseISO(startStr.trim())
          weekEnd = parseISO(endStr.trim())
        } else {
          // Fallback: usar fecha de publicación como referencia
          weekStart = weekData.publishedAt?.toDate() || new Date()
          weekEnd = addDays(weekStart, 6)
        }
        
        const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
        
        const monthRange = getCustomMonthRange(weekStart, monthStartDay)
        let targetMonthDate = monthRange.startDate
        
        if (weekStart < monthRange.startDate) {
          const prevMonth = new Date(monthRange.startDate)
          prevMonth.setMonth(prevMonth.getMonth() - 1)
          targetMonthDate = getCustomMonthRange(prevMonth, monthStartDay).startDate
        }
        
        const monthKey = format(targetMonthDate, "yyyy-MM")
        const monthName = format(targetMonthDate, "MMMM yyyy", { locale: es })
        
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            monthKey,
            monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            monthDate: targetMonthDate,
            weeks: [],
          })
        }
        
        const monthGroup = monthMap.get(monthKey)!
        const weekStartStr = format(weekStart, "yyyy-MM-dd")
        
        const existingWeek = monthGroup.weeks.find((w) => w.weekStartStr === weekStartStr)
        
        if (!existingWeek) {
          monthGroup.weeks.push({
            weekStartDate: weekStart,
            weekEndDate: weekEnd,
            weekStartStr,
            schedule: {
              id: weekData.weekId,
              weekStart: format(weekStart, "yyyy-MM-dd"),
              weekEnd: format(weekEnd, "yyyy-MM-dd"),
              assignments: {}, // Los assignments no están disponibles en enlaces_publicos
              employeesSnapshot: weekData.employees || [],
              ordenEmpleadosSnapshot: [],
              ...weekData
            },
            weekDays,
          })
        }
      })
    })

    monthMap.forEach((month) => {
      month.weeks.sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime())
    })

    return Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey))
  }, [schedules, monthStartDay, weekStartsOn])

  // Calcular estadísticas mensuales para empleados (adaptado para enlaces_publicos)
  const calculateMonthlyStats = useCallback((monthDate: Date): Record<string, EmployeeMonthlyStats> => {
    const stats: Record<string, EmployeeMonthlyStats> = {}
    employees.forEach((employee) => {
      stats[employee.id] = { francos: 0, francosSemana: 0, horasExtrasSemana: 0, horasExtrasMes: 0, horasComputablesMes: 0, horasSemana: 0, horasLicenciaEmbarazo: 0, horasMedioFranco: 0 }
    })

    if (employees.length === 0 || shifts.length === 0) {
      return stats
    }

    // Nota: Con enlaces_publicos no tenemos acceso a los assignments detallados
    // Solo podemos mostrar información básica de empleados
    // Las estadísticas de horas no se pueden calcular sin assignments
    
    return stats
  }, [employees, shifts])

  return {
    monthGroups,
    companyName,
    isLoading,
    error,
    calculateMonthlyStats,
    refetch
  }
}
