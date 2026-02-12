import { useEffect, useState, useMemo, useCallback } from "react"
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Horario } from "@/lib/types"
import { format, parseISO, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { getCustomMonthRange, getMonthWeeks } from "@/lib/utils"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { calculateHoursBreakdown } from "@/lib/validations"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"
import { ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"

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
  schedule: Horario | null
  weekDays: Date[]
}

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

  // Agrupar horarios por mes y semana
  const monthGroups = useMemo<MonthGroup[]>(() => {
    if (schedules.length === 0) return []

    // Mapa para agrupar por mes
    const monthMap = new Map<string, MonthGroup>()

    schedules.forEach((schedule) => {
      // Validate weekStart exists before parsing
      if (!schedule.weekStart) {
        console.warn("🔧 [useMonthlySchedules] Schedule sin weekStart, ignorando:", schedule.id)
        return // Ignorar este schedule
      }
      
      const weekStartDate = parseISO(schedule.weekStart)
      
      // Generar días de la semana (usando el weekStart del schedule que ya está correcto)
      const weekStart = weekStartDate // Ya viene como inicio de semana desde la BD
      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      const weekEndDate = weekDays[weekDays.length - 1]
      
      // Determinar a qué mes pertenece esta semana
      // El mes es el que contiene el weekStart en su rango personalizado
      const monthRange = getCustomMonthRange(weekStartDate, monthStartDay)
      let targetMonthDate = monthRange.startDate
      
      // Si el weekStart está antes del inicio del mes calculado, pertenece al mes anterior
      if (weekStartDate < monthRange.startDate) {
        const prevMonth = new Date(monthRange.startDate)
        prevMonth.setMonth(prevMonth.getMonth() - 1)
        targetMonthDate = getCustomMonthRange(prevMonth, monthStartDay).startDate
      }
      
      // Crear key del mes (YYYY-MM basado en el mes personalizado)
      const monthKey = format(targetMonthDate, "yyyy-MM")
      const monthName = format(targetMonthDate, "MMMM yyyy", { locale: es })
      
      // Obtener o crear el grupo del mes
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          monthDate: targetMonthDate,
          weeks: [],
        })
      }
      
      const monthGroup = monthMap.get(monthKey)!
      
      // Verificar si esta semana ya existe en el mes
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
        // Si ya existe, actualizar con el schedule más reciente
        existingWeek.schedule = schedule
      }
    })

    // Ordenar semanas dentro de cada mes
    monthMap.forEach((month) => {
      month.weeks.sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime())
    })

    // Convertir a array y ordenar por mes (más reciente primero)
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

          const normalizedAssignments = normalizeAssignments(assignmentValue)
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

          // Calcular horas por tipo usando calculateHoursBreakdown
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

          // Calcular horas extras usando el nuevo servicio de dominio
          const workingConfig = toWorkingHoursConfig(config)
          const { horasComputables, horasExtra } = calculateTotalDailyHours(normalizedAssignments, workingConfig)
          
          // Acumular horas computables del mes
          stats[employeeId].horasComputablesMes += horasComputables
          
          if (horasExtra > 0) {
            // Acumular en el total del mes
            stats[employeeId].horasExtrasMes += horasExtra
          }
        })
      })
    })

    // Inicializar horasExtrasSemana con 0 para todos los empleados
    // Se calculará por semana cuando se muestre cada semana
    Object.keys(stats).forEach((employeeId) => {
      stats[employeeId].horasExtrasSemana = 0
    })

    return stats
  }, [employees, shifts, config, monthStartDay, weekStartsOn, schedules])

  return {
    monthGroups,
    isLoading,
    error,
    calculateMonthlyStats,
    refetch
  }
}
