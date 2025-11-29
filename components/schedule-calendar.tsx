"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { format, subMonths, addMonths, startOfWeek, addDays, subWeeks, addWeeks } from "date-fns"
import { es } from "date-fns/locale"
import { useData } from "@/contexts/data-context"
import { Horario, ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"
import { useConfig } from "@/hooks/use-config"
import { getCustomMonthRange, getMonthWeeks } from "@/lib/utils"
import { useExportSchedule } from "@/hooks/use-export-schedule"
import { useScheduleUpdates } from "@/hooks/use-schedule-updates"
import { calculateDailyHours } from "@/lib/validations"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { GeneralView } from "@/components/schedule-calendar/general-view"
import { EmployeeView } from "@/components/schedule-calendar/employee-view"
import { ShiftView } from "@/components/schedule-calendar/shift-view"

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
  const [employeeMonth, setEmployeeMonth] = useState(new Date())
  const [shiftMonth, setShiftMonth] = useState(new Date())
  const [activeTab, setActiveTab] = useState<"general" | "employee" | "shifts">("general")
  const [employeeViewMode, setEmployeeViewMode] = useState<"week" | "month">("week")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [employeeWeekStart, setEmployeeWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn }),
  )

  const monthRange = useMemo(
    () => getCustomMonthRange(currentMonth, monthStartDay),
    [currentMonth, monthStartDay],
  )
  const monthWeeks = useMemo(
    () => getMonthWeeks(currentMonth, monthStartDay, weekStartsOn),
    [currentMonth, monthStartDay, weekStartsOn],
  )
  const employeeMonthRange = useMemo(
    () => getCustomMonthRange(employeeMonth, monthStartDay),
    [employeeMonth, monthStartDay],
  )
  const employeeMonthWeeks = useMemo(
    () => getMonthWeeks(employeeMonth, monthStartDay, weekStartsOn),
    [employeeMonth, monthStartDay, weekStartsOn],
  )
  const shiftMonthRange = useMemo(
    () => getCustomMonthRange(shiftMonth, monthStartDay),
    [shiftMonth, monthStartDay],
  )
  const shiftMonthDays = useMemo(() => {
    const days: Date[] = []
    let cursor = new Date(shiftMonthRange.startDate)
    while (cursor <= shiftMonthRange.endDate) {
      days.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return days
  }, [shiftMonthRange])
  const employeeWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(employeeWeekStart, index)),
    [employeeWeekStart],
  )
  const employeeWeekRange = useMemo(() => {
    if (employeeWeekDays.length === 0) {
      return null
    }
    return {
      startDate: employeeWeekDays[0],
      endDate: employeeWeekDays[employeeWeekDays.length - 1],
    }
  }, [employeeWeekDays])
  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  )
  const filteredEmployees = useMemo(() => (selectedEmployee ? [selectedEmployee] : []), [selectedEmployee])
  const employeeWeekLabel = useMemo(() => {
    if (!employeeWeekRange) return ""
    return `Semana del ${format(employeeWeekRange.startDate, "d 'de' MMMM", { locale: es })} al ${format(
      employeeWeekRange.endDate,
      "d 'de' MMMM",
      { locale: es },
    )}`
  }, [employeeWeekRange])
  const employeeMonthRangeLabel = useMemo(
    () => format(employeeMonthRange.startDate, "MMMM yyyy", { locale: es }),
    [employeeMonthRange],
  )
  const shiftMonthLabel = useMemo(
    () => format(shiftMonthRange.startDate, "MMMM yyyy", { locale: es }),
    [shiftMonthRange],
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

  const employeeWeekSchedule = useMemo(
    () => (employeeWeekDays.length ? getWeekSchedule(employeeWeekDays[0]) : null),
    [employeeWeekDays, getWeekSchedule],
  )

  const shiftAssignmentsByDay = useMemo(() => {
    const matrix: Record<string, Record<string, string[]>> = {}
    const employeeNameMap = new Map(employees.map((employee) => [employee.id, employee.name]))

    shiftMonthDays.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd")
      const dateAssignments = getDateAssignments(day)
      if (!dateAssignments) {
        return
      }

      Object.entries(dateAssignments).forEach(([employeeId, assignmentValue]) => {
        const employeeName = employeeNameMap.get(employeeId)
        if (!employeeName) return
        const normalizedAssignments = normalizeAssignments(assignmentValue)
        normalizedAssignments.forEach((assignment) => {
          if (assignment.type !== "shift" || !assignment.shiftId) return
          if (!matrix[dateStr]) {
            matrix[dateStr] = {}
          }
          if (!matrix[dateStr][assignment.shiftId]) {
            matrix[dateStr][assignment.shiftId] = []
          }
          if (!matrix[dateStr][assignment.shiftId].includes(employeeName)) {
            matrix[dateStr][assignment.shiftId].push(employeeName)
          }
        })
      })
    })

    return matrix
  }, [shiftMonthDays, getDateAssignments, employees])

  const hasShiftAssignments = useMemo(() => {
    return Object.values(shiftAssignmentsByDay).some((shiftMap) =>
      Object.values(shiftMap).some((names) => names.length > 0),
    )
  }, [shiftAssignmentsByDay])

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id)
    }
  }, [employees, selectedEmployeeId])

  useEffect(() => {
    setEmployeeWeekStart((prev) => startOfWeek(prev, { weekStartsOn }))
  }, [weekStartsOn])

  const { handleAssignmentUpdate } = useScheduleUpdates({
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

  const goToPreviousWeek = useCallback(() => {
    setEmployeeWeekStart((prev) => startOfWeek(subWeeks(prev, 1), { weekStartsOn }))
  }, [weekStartsOn])

  const goToNextWeek = useCallback(() => {
    setEmployeeWeekStart((prev) => startOfWeek(addWeeks(prev, 1), { weekStartsOn }))
  }, [weekStartsOn])

  const goToCurrentWeek = useCallback(() => {
    setEmployeeWeekStart(startOfWeek(new Date(), { weekStartsOn }))
  }, [weekStartsOn])

  const goToPreviousEmployeeMonth = useCallback(() => {
    setEmployeeMonth((prev) => subMonths(prev, 1))
  }, [])

  const goToNextEmployeeMonth = useCallback(() => {
    setEmployeeMonth((prev) => addMonths(prev, 1))
  }, [])

  const goToCurrentEmployeeMonth = useCallback(() => {
    setEmployeeMonth(new Date())
  }, [])

  const goToPreviousShiftMonth = useCallback(() => {
    setShiftMonth((prev) => subMonths(prev, 1))
  }, [])

  const goToNextShiftMonth = useCallback(() => {
    setShiftMonth((prev) => addMonths(prev, 1))
  }, [])

  const goToCurrentShiftMonth = useCallback(() => {
    setShiftMonth(new Date())
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

    // Mapa para rastrear horas extras por semana (para obtener la última semana)
    const weeklyExtras: Record<string, Record<string, number>> = {}
    let lastWeekStartStr: string | null = null

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
      // Actualizar la última semana procesada
      lastWeekStartStr = weekStartStr

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

          const dailyHours = calculateDailyHours(
            normalizedAssignments,
            shifts,
            minutosDescanso,
            horasMinimasParaDescanso,
          )
          if (dailyHours > 8) {
            const extraHours = dailyHours - 8
            // Acumular en el total del mes
            stats[employeeId].horasExtrasMes += extraHours
            // Acumular en la semana actual
            weeklyExtras[weekStartStr][employeeId] = (weeklyExtras[weekStartStr][employeeId] || 0) + extraHours
          }
        })
      })
    })

    // Asignar las horas extras de la última semana como horasExtrasSemana
    if (lastWeekStartStr && weeklyExtras[lastWeekStartStr]) {
      Object.entries(weeklyExtras[lastWeekStartStr]).forEach(([employeeId, weekExtra]) => {
        stats[employeeId].horasExtrasSemana = weekExtra
      })
    }

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
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "general" | "employee" | "shifts")}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3 md:w-auto">
          <TabsTrigger value="general">Vista general</TabsTrigger>
          <TabsTrigger value="employee">Por empleado</TabsTrigger>
          <TabsTrigger value="shifts">Por turnos</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
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
          />
        </TabsContent>

        <TabsContent value="employee" className="space-y-6">
          <EmployeeView
            dataLoading={dataLoading}
            employees={employees}
            shifts={shifts}
            mediosTurnos={config?.mediosTurnos}
            selectedEmployeeId={selectedEmployeeId}
            selectedEmployeeName={selectedEmployee?.name}
            onEmployeeChange={setSelectedEmployeeId}
            employeeViewMode={employeeViewMode}
            onViewModeChange={setEmployeeViewMode}
            employeeWeekLabel={employeeWeekLabel}
            employeeWeekDays={employeeWeekDays}
            employeeWeekSchedule={employeeWeekSchedule}
            employeeWeekRange={employeeWeekRange}
            filteredEmployees={filteredEmployees}
            employeeMonthRange={employeeMonthRange}
            employeeMonthRangeLabel={employeeMonthRangeLabel}
            employeeMonthWeeks={employeeMonthWeeks}
            getWeekSchedule={getWeekSchedule}
            onPreviousWeek={goToPreviousWeek}
            onCurrentWeek={goToCurrentWeek}
            onNextWeek={goToNextWeek}
            onPreviousMonth={goToPreviousEmployeeMonth}
            onCurrentMonth={goToCurrentEmployeeMonth}
            onNextMonth={goToNextEmployeeMonth}
            exporting={exporting}
          />
        </TabsContent>

        <TabsContent value="shifts" className="space-y-6">
          <ShiftView
            dataLoading={dataLoading}
            employees={employees}
            shifts={shifts}
            shiftMonthDays={shiftMonthDays}
            shiftMonthLabel={shiftMonthLabel}
            shiftAssignmentsByDay={shiftAssignmentsByDay}
            hasShiftAssignments={hasShiftAssignments}
            onPreviousMonth={goToPreviousShiftMonth}
            onCurrentMonth={goToCurrentShiftMonth}
            onNextMonth={goToNextShiftMonth}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
