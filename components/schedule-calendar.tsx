"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { format, subMonths, addMonths, startOfWeek } from "date-fns"
import { useData } from "@/contexts/data-context"
import { Horario, ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"
import { useConfig } from "@/hooks/use-config"
import { getCustomMonthRange, getMonthWeeks } from "@/lib/utils"
import { useExportSchedule } from "@/hooks/use-export-schedule"
import { useScheduleUpdates } from "@/hooks/use-schedule-updates"
import { calculateExtraHours } from "@/lib/validations"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { GeneralView } from "@/components/schedule-calendar/general-view"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ScheduleCalendarProps {
  user: any
}

const normalizeAssignments = (value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  if (typeof value[0] === "string") {
    return (value as string[]).map((shiftId) => ({ shiftId, type: "shift" as const }))
  }
  return (value as ShiftAssignment[]).map((assignment) => ({
    ...assignment,
    type: assignment.type || "shift",
  }))
}

export function ScheduleCalendar({ user }: ScheduleCalendarProps) {
  const [schedules, setSchedules] = useState<Horario[]>([])
  const { employees, shifts, loading: dataLoading } = useData()
  const { config } = useConfig()
  const { toast } = useToast()
  const { exporting, exportImage, exportPDF, exportExcel } = useExportSchedule()

  const monthStartDay = config?.mesInicioDia || 1
  const weekStartsOn = (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6

  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthRange = useMemo(
    () => getCustomMonthRange(currentMonth, monthStartDay),
    [currentMonth, monthStartDay],
  )
  const monthWeeks = useMemo(
    () => getMonthWeeks(currentMonth, monthStartDay, weekStartsOn),
    [currentMonth, monthStartDay, weekStartsOn],
  )

  // Función helper para obtener el horario de una semana específica
  const getWeekSchedule = useCallback((weekStartDate: Date) => {
    const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
    return schedules.find((s) => s.weekStart === weekStartStr) || null
  }, [schedules])

  const getDateAssignments = useCallback(
    (date: Date) => {
      const weekStartDate = startOfWeek(date, { weekStartsOn })
      const weekSchedule = getWeekSchedule(weekStartDate)
      if (!weekSchedule?.assignments) return null
      const dateStr = format(date, "yyyy-MM-dd")
      return weekSchedule.assignments[dateStr] || null
    },
    [weekStartsOn, getWeekSchedule],
  )


  const { handleAssignmentUpdate, handleMarkWeekComplete, pendingEdit, setPendingEdit } = useScheduleUpdates({
    user,
    employees,
    shifts,
    schedules,
    weekStartsOn,
    getWeekSchedule,
  })

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => subMonths(prev, 1))
  }, [])

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1))
  }, [])


  useEffect(() => {
    // Solo crear listeners si el usuario está autenticado
    if (!user || !db) {
      return
    }

    let unsubscribeSchedules: (() => void) | null = null

    const schedulesQuery = query(collection(db, COLLECTIONS.SCHEDULES), orderBy("weekStart", "desc"))
    unsubscribeSchedules = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        const schedulesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Horario[]
        setSchedules(schedulesData)
      },
      (error) => {
        console.error("Error en listener de horarios:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los horarios. Verifica tus permisos.",
          variant: "destructive",
        })
      },
    )

    return () => {
      if (unsubscribeSchedules) unsubscribeSchedules()
    }
  }, [user, toast])

  const handleExportMonthImage = useCallback(async () => {
    await exportImage(
      "schedule-month-container",
      `horario-${format(monthRange.startDate, "yyyy-MM-dd")}.png`
    )
  }, [exportImage, monthRange.startDate])

  const handleExportMonthPDF = useCallback(async () => {
    await exportPDF(
      "schedule-month-container",
      `horario-${format(monthRange.startDate, "yyyy-MM-dd")}.pdf`
    )
  }, [exportPDF, monthRange.startDate])

  const handleExportWeekImage = useCallback(async (weekStartDate: Date, weekEndDate: Date) => {
    const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
    await exportImage(weekId, `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.png`)
  }, [exportImage])

  const handleExportWeekExcel = useCallback(async (weekStartDate: Date, weekDays: Date[], weekSchedule: Horario | null) => {
    await exportExcel(
      weekDays,
      employees,
      shifts,
      weekSchedule,
      `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.xlsx`
    )
  }, [exportExcel, employees, shifts])

  const handleExportWeekPDF = useCallback(async (weekStartDate: Date, weekEndDate: Date) => {
    const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
    await exportPDF(weekId, `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.pdf`)
  }, [exportPDF])

  const employeeMonthlyStats = useMemo<Record<string, EmployeeMonthlyStats>>(() => {
    const stats: Record<string, EmployeeMonthlyStats> = {}
    employees.forEach((employee) => {
      stats[employee.id] = { francos: 0, horasExtrasSemana: 0, horasExtrasMes: 0 }
    })

    if (employees.length === 0 || shifts.length === 0) {
      return stats
    }

    const minutosDescanso = config?.minutosDescanso ?? 30
    const horasMinimasParaDescanso = config?.horasMinimasParaDescanso ?? 6

    // Mapa para rastrear horas extras por semana
    const weeklyExtras: Record<string, Record<string, number>> = {}

    monthWeeks.forEach((weekDays) => {
      const weekSchedule = getWeekSchedule(weekDays[0])
      if (!weekSchedule?.assignments) return

      const weekStartStr = format(weekDays[0], "yyyy-MM-dd")
      // Inicializar el registro de horas extras para esta semana
      if (!weeklyExtras[weekStartStr]) {
        weeklyExtras[weekStartStr] = {}
        employees.forEach((employee) => {
          weeklyExtras[weekStartStr][employee.id] = 0
        })
      }

      weekDays.forEach((day) => {
        if (day < monthRange.startDate || day > monthRange.endDate) return

        const dateStr = format(day, "yyyy-MM-dd")
        const dateAssignments = weekSchedule.assignments[dateStr]
        if (!dateAssignments) return

        Object.entries(dateAssignments).forEach(([employeeId, assignmentValue]) => {
          if (!stats[employeeId]) {
            stats[employeeId] = { francos: 0, horasExtrasSemana: 0, horasExtrasMes: 0 }
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

          // Calcular horas extras: simplemente contar los 30 minutos agregados
          const extraHours = calculateExtraHours(normalizedAssignments, shifts)
          if (extraHours > 0) {
            // Acumular en el total del mes
            stats[employeeId].horasExtrasMes += extraHours
            // Acumular en la semana actual
            weeklyExtras[weekStartStr][employeeId] = (weeklyExtras[weekStartStr][employeeId] || 0) + extraHours
          }
        })
      })
    })

    // Almacenar el mapa de horas extras por semana en el objeto stats
    // Esto permitirá que cada semana use sus propias horas extras
    Object.keys(stats).forEach((employeeId) => {
      // Inicializar horasExtrasSemana con 0, se actualizará por semana cuando se muestre
      stats[employeeId].horasExtrasSemana = 0
    })

    // Agregar el mapa de weeklyExtras a stats para que pueda ser usado por semana
    ;(stats as any).__weeklyExtras = weeklyExtras

    return stats
  }, [
    employees,
    shifts,
    monthWeeks,
    monthRange.startDate,
    monthRange.endDate,
    getWeekSchedule,
    config?.minutosDescanso,
    config?.horasMinimasParaDescanso,
  ])

  return (
    <div className="space-y-6">
      <AlertDialog open={pendingEdit !== null} onOpenChange={(open) => !open && pendingEdit && setPendingEdit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Semana completada</AlertDialogTitle>
            <AlertDialogDescription>
              Esta semana fue completada y marcada como listo. ¿Está seguro que desea editarla?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => pendingEdit?.resolve(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingEdit?.resolve(true)}>Sí, editar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GeneralView
        dataLoading={dataLoading}
        employees={employees}
        shifts={shifts}
        monthRange={monthRange}
        monthWeeks={monthWeeks}
        exporting={exporting}
        mediosTurnos={config?.mediosTurnos}
        employeeMonthlyStats={employeeMonthlyStats}
        getWeekSchedule={getWeekSchedule}
        onAssignmentUpdate={handleAssignmentUpdate}
        onExportMonthImage={handleExportMonthImage}
        onExportMonthPDF={handleExportMonthPDF}
        onExportWeekImage={handleExportWeekImage}
        onExportWeekPDF={handleExportWeekPDF}
        onExportWeekExcel={handleExportWeekExcel}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        user={user}
        onMarkWeekComplete={handleMarkWeekComplete}
      />
    </div>
  )
}
