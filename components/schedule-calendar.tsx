"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { MonthHeader } from "@/components/schedule-calendar/month-header"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { ScheduleGrid } from "@/components/schedule-grid"
import { calculateDailyHours } from "@/lib/validations"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"

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

  const monthRange = getCustomMonthRange(currentMonth, monthStartDay)
  const monthWeeks = getMonthWeeks(currentMonth, monthStartDay, weekStartsOn)
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
      stats[employee.id] = { francos: 0, horasExtras: 0 }
    })

    if (employees.length === 0 || shifts.length === 0) {
      return stats
    }

    const minutosDescanso = config?.minutosDescanso ?? 30
    const horasMinimasParaDescanso = config?.horasMinimasParaDescanso ?? 6

    monthWeeks.forEach((weekDays) => {
      const weekSchedule = getWeekSchedule(weekDays[0])
      if (!weekSchedule?.assignments) return

      weekDays.forEach((day) => {
        if (day < monthRange.startDate || day > monthRange.endDate) return

        const dateStr = format(day, "yyyy-MM-dd")
        const dateAssignments = weekSchedule.assignments[dateStr]
        if (!dateAssignments) return

        Object.entries(dateAssignments).forEach(([employeeId, assignmentValue]) => {
          if (!stats[employeeId]) {
            stats[employeeId] = { francos: 0, horasExtras: 0 }
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
            stats[employeeId].horasExtras += dailyHours - 8
          }
        })
      })
    })

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
        onValueChange={(value) => setActiveTab(value as "general" | "employee")}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3 md:w-auto">
          <TabsTrigger value="general">Vista general</TabsTrigger>
          <TabsTrigger value="employee">Por empleado</TabsTrigger>
          <TabsTrigger value="shifts">Por turnos</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <MonthHeader
            monthRange={monthRange}
            onPreviousMonth={() => setCurrentMonth(subMonths(currentMonth, 1))}
            onNextMonth={() => setCurrentMonth(addMonths(currentMonth, 1))}
            onExportImage={handleExportMonthImage}
            onExportPDF={handleExportMonthPDF}
            exporting={exporting}
          />

          {dataLoading ? (
            <Card className="p-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Cargando datos...</p>
            </Card>
          ) : employees.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                No hay empleados registrados. Agrega empleados para crear horarios.
              </p>
            </Card>
          ) : shifts.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                No hay turnos configurados. Agrega turnos para crear horarios.
              </p>
            </Card>
          ) : (
            <div id="schedule-month-container" className="space-y-6">
              {monthWeeks.map((weekDays, weekIndex) => {
                const weekStartDate = weekDays[0]
                const weekSchedule = getWeekSchedule(weekStartDate)

                return (
                  <WeekSchedule
                    key={weekIndex}
                    weekDays={weekDays}
                    weekIndex={weekIndex}
                    weekSchedule={weekSchedule}
                    employees={employees}
                    shifts={shifts}
                    monthRange={monthRange}
                    onAssignmentUpdate={handleAssignmentUpdate}
                    onExportImage={handleExportWeekImage}
                    onExportPDF={handleExportWeekPDF}
                    onExportExcel={() => handleExportWeekExcel(weekStartDate, weekDays, weekSchedule)}
                    exporting={exporting}
                    mediosTurnos={config?.mediosTurnos}
                    employeeStats={employeeMonthlyStats}
                  />
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="employee" className="space-y-6">
          <Card className="space-y-4 p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Vista por empleado</h3>
                <p className="text-sm text-muted-foreground">
                  Visualiza el horario semanal o mensual para una sola persona.
                </p>
              </div>
              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
                disabled={employees.length === 0}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Sin empleados disponibles" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="inline-flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex w-full rounded-md border p-1 sm:w-auto">
                <Button
                  variant={employeeViewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEmployeeViewMode("week")}
                >
                  Vista semanal
                </Button>
                <Button
                  variant={employeeViewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEmployeeViewMode("month")}
                >
                  Vista mensual
                </Button>
              </div>
              <p className="text-sm text-muted-foreground sm:text-right">
                {selectedEmployee
                  ? `${selectedEmployee.name} · ${
                      employeeViewMode === "week" ? employeeWeekLabel : employeeMonthRangeLabel
                    }`
                  : "Selecciona un empleado"}
              </p>
            </div>
          </Card>

          {dataLoading ? (
            <Card className="p-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Cargando datos...</p>
            </Card>
          ) : employees.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                No hay empleados registrados. Agrega empleados para crear horarios.
              </p>
            </Card>
          ) : shifts.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                No hay turnos configurados. Agrega turnos para crear horarios.
              </p>
            </Card>
          ) : !selectedEmployee ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Selecciona un empleado para visualizar su horario.</p>
            </Card>
          ) : employeeViewMode === "week" ? (
            <Card className="space-y-4 p-4 md:p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xl font-semibold">{selectedEmployee.name}</p>
                  <p className="text-sm text-muted-foreground">{employeeWeekLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                    Semana anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                    Semana actual
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToNextWeek}>
                    Semana siguiente
                  </Button>
                </div>
              </div>
              <ScheduleGrid
                weekDays={employeeWeekDays}
                employees={filteredEmployees}
                shifts={shifts}
                schedule={employeeWeekSchedule}
                monthRange={
                  employeeWeekRange || {
                    startDate: employeeWeekDays[0],
                    endDate: employeeWeekDays[employeeWeekDays.length - 1],
                  }
                }
                mediosTurnos={config?.mediosTurnos}
                readonly
              />
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xl font-semibold">{selectedEmployee.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{employeeMonthRangeLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={goToPreviousEmployeeMonth}>
                    Mes anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToCurrentEmployeeMonth}>
                    Mes actual
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToNextEmployeeMonth}>
                    Mes siguiente
                  </Button>
                </div>
              </div>
              <div id="employee-month-container" className="space-y-6">
                {employeeMonthWeeks.map((weekDays, weekIndex) => {
                  const weekStartDate = weekDays[0]
                  const weekSchedule = getWeekSchedule(weekStartDate)
                  const weekKey = `${selectedEmployee.id}-${format(weekStartDate, "yyyy-MM-dd")}`

                  return (
                    <WeekSchedule
                      key={weekKey}
                      weekDays={weekDays}
                      weekIndex={weekIndex}
                      weekSchedule={weekSchedule}
                      employees={filteredEmployees}
                      shifts={shifts}
                      monthRange={employeeMonthRange}
                      mediosTurnos={config?.mediosTurnos}
                      exporting={exporting}
                      readonly
                      showActions={false}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="shifts" className="space-y-6">
          <Card className="space-y-4 p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Vista por turnos</h3>
                <p className="text-sm text-muted-foreground">
                  Observa qué empleados están asignados a cada turno en todo el mes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={goToPreviousShiftMonth}>
                  Mes anterior
                </Button>
                <Button variant="outline" size="sm" onClick={goToCurrentShiftMonth}>
                  Mes actual
                </Button>
                <Button variant="outline" size="sm" onClick={goToNextShiftMonth}>
                  Mes siguiente
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground capitalize">{shiftMonthLabel}</p>
          </Card>

          {dataLoading ? (
            <Card className="p-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Cargando datos...</p>
            </Card>
          ) : employees.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                No hay empleados registrados. Agrega empleados para crear horarios.
              </p>
            </Card>
          ) : shifts.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                No hay turnos configurados. Agrega turnos para crear horarios.
              </p>
            </Card>
          ) : (
            <Card className="p-0">
              {!hasShiftAssignments && (
                <div className="border-b px-4 py-3 text-sm text-muted-foreground">
                  No se encontraron asignaciones para este mes. Las celdas mostrarán "-" hasta que existan
                  horarios cargados.
                </div>
              )}
              <div className="w-full overflow-auto">
                <table className="min-w-[720px] table-fixed text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="w-48 border-b bg-background px-3 py-3 text-left">Turno</th>
                      {shiftMonthDays.map((day) => (
                        <th key={day.toISOString()} className="min-w-[140px] border-b border-l px-3 py-3">
                          <div className="text-xs font-semibold uppercase">
                            {format(day, "EEE d", { locale: es })}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {format(day, "MMM yyyy", { locale: es })}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="border-t">
                        <td className="bg-muted/40 px-3 py-2 text-sm font-semibold">{shift.name}</td>
                        {shiftMonthDays.map((day) => {
                          const dateStr = format(day, "yyyy-MM-dd")
                          const employeesForShift = shiftAssignmentsByDay[dateStr]?.[shift.id] || []

                          return (
                            <td key={`${shift.id}-${dateStr}`} className="border-l px-3 py-2 align-top">
                              {employeesForShift.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {employeesForShift.map((employeeName) => (
                                    <span
                                      key={`${shift.id}-${dateStr}-${employeeName}`}
                                      className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                                    >
                                      {employeeName}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
