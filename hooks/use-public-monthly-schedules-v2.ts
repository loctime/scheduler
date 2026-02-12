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
  weekStart: string
  weekEnd: string
  assignments: Record<string, any>
  employeesSnapshot: any[]
  ordenEmpleadosSnapshot: string[]
  publishedAt: any
  publishedBy: string
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

    // Leer desde publicSchedules en lugar de schedules privado
    const publicSchedulesQuery = query(
      collection(db, "apps", "horarios", "publicSchedules", companySlug, "weeks"),
      orderBy("weekStart", "desc")
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

  // Agrupar horarios por mes y semana (misma lógica que el dashboard)
  const monthGroups = useMemo<MonthGroup[]>(() => {
    if (schedules.length === 0) return []

    const monthMap = new Map<string, MonthGroup>()

    schedules.forEach((schedule) => {
      const weekStartDate = parseISO(schedule.weekStart)
      
      const weekStart = weekStartDate
      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      const weekEndDate = weekDays[weekDays.length - 1]
      
      const monthRange = getCustomMonthRange(weekStartDate, monthStartDay)
      let targetMonthDate = monthRange.startDate
      
      if (weekStartDate < monthRange.startDate) {
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
          weekEndDate,
          weekStartStr,
          schedule,
          weekDays,
        })
      } else {
        existingWeek.schedule = schedule
      }
    })

    monthMap.forEach((month) => {
      month.weeks.sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime())
    })

    return Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey))
  }, [schedules, monthStartDay, weekStartsOn])

  // Calcular estadísticas mensuales para empleados
  const calculateMonthlyStats = useCallback((monthDate: Date): Record<string, EmployeeMonthlyStats> => {
    const stats: Record<string, EmployeeMonthlyStats> = {}
    employees.forEach((employee) => {
      stats[employee.id] = { francos: 0, francosSemana: 0, horasExtrasSemana: 0, horasExtrasMes: 0, horasComputablesMes: 0, horasSemana: 0, horasLicenciaEmbarazo: 0, horasMedioFranco: 0 }
    })

    if (employees.length === 0 || shifts.length === 0) {
      return stats
    }

    const monthRange = getCustomMonthRange(monthDate, monthStartDay)
    const monthWeeks = getMonthWeeks(monthDate, monthStartDay, weekStartsOn)
    const minutosDescanso = config?.minutosDescanso ?? 30
    const horasMinimasParaDescanso = config?.horasMinimasParaDescanso ?? 6

    monthWeeks.forEach((weekDays) => {
      const weekStartStr = format(weekDays[0], "yyyy-MM-dd")
      const weekSchedule = schedules.find((s) => s.weekStart === weekStartStr) || null
      if (!weekSchedule?.assignments) return

      weekDays.forEach((day) => {
        if (day < monthRange.startDate || day > monthRange.endDate) return

        const dateStr = format(day, "yyyy-MM-dd")
        const dateAssignments = weekSchedule.assignments[dateStr]
        if (!dateAssignments) return

        Object.entries(dateAssignments).forEach(([employeeId, assignmentValue]) => {
          if (!stats[employeeId]) {
            stats[employeeId] = { francos: 0, francosSemana: 0, horasExtrasSemana: 0, horasExtrasMes: 0, horasComputablesMes: 0, horasSemana: 0, horasLicenciaEmbarazo: 0, horasMedioFranco: 0 }
          }

          const normalizedAssignments = normalizeAssignments(assignmentValue as ShiftAssignmentValue | undefined)
          if (normalizedAssignments.length === 0) {
            return
          }

          let francosCount = 0
          normalizedAssignments.forEach((assignment) => {
            if (assignment.type === "franco") {
              francosCount += 1
            } else if (assignment.type === "medio_franco") {
              francosCount += 0.5
            }
          })

          if (francosCount > 0) {
            stats[employeeId].francos += francosCount
          }

          const hoursBreakdown = calculateHoursBreakdown(
            normalizedAssignments,
            shifts,
            minutosDescanso,
            horasMinimasParaDescanso
          )
          if (hoursBreakdown.licencia > 0) {
            stats[employeeId].horasLicenciaEmbarazo = (stats[employeeId].horasLicenciaEmbarazo || 0) + hoursBreakdown.licencia
          }
          if (hoursBreakdown.medio_franco > 0) {
            stats[employeeId].horasMedioFranco = (stats[employeeId].horasMedioFranco || 0) + hoursBreakdown.medio_franco
          }

          const workingConfig = toWorkingHoursConfig(config)
          const { horasComputables, horasExtra } = calculateTotalDailyHours(normalizedAssignments, workingConfig)
          
          stats[employeeId].horasComputablesMes += horasComputables
          
          if (horasExtra > 0) {
            stats[employeeId].horasExtrasMes += horasExtra
          }
        })
      })
    })

    Object.keys(stats).forEach((employeeId) => {
      stats[employeeId].horasExtrasSemana = 0
    })

    return stats
  }, [employees, shifts, config, monthStartDay, weekStartsOn, schedules])

  return {
    monthGroups,
    companyName,
    isLoading,
    error,
    calculateMonthlyStats,
    refetch
  }
}
