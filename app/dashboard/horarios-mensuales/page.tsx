"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { Horario } from "@/lib/types"
import { useConfig } from "@/hooks/use-config"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO, startOfWeek, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { getCustomMonthRange, getMonthWeeks } from "@/lib/utils"
import { useExportSchedule } from "@/hooks/use-export-schedule"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { calculateDailyHours, calculateExtraHours } from "@/lib/validations"
import { ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"

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

interface MonthGroup {
  monthKey: string // "YYYY-MM" para ordenar
  monthName: string // "Noviembre 2025"
  monthDate: Date // Fecha del mes
  weeks: WeekGroup[]
}

interface WeekGroup {
  weekStartDate: Date
  weekEndDate: Date
  weekStartStr: string
  schedule: Horario | null
  weekDays: Date[]
}

export default function HorariosMensualesPage() {
  const [schedules, setSchedules] = useState<Horario[]>([])
  const { employees, shifts, loading: dataLoading, user } = useData()
  const { config } = useConfig(user)
  const { toast } = useToast()
  const { exporting, exportImage, exportPDF, exportExcel } = useExportSchedule()
  const weekStartsOn = (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const monthStartDay = config?.mesInicioDia || 1


  useEffect(() => {
    if (!user || !db) return

    const schedulesQuery = query(
      collection(db, COLLECTIONS.SCHEDULES),
      where("createdBy", "==", user.uid),
      orderBy("weekStart", "desc")
    )
    const unsubscribeSchedules = onSnapshot(
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
      unsubscribeSchedules()
    }
  }, [user, toast])

  // Agrupar horarios por mes y semana
  const monthGroups = useMemo<MonthGroup[]>(() => {
    if (schedules.length === 0) return []

    // Mapa para agrupar por mes
    const monthMap = new Map<string, MonthGroup>()

    schedules.forEach((schedule) => {
      const weekStartDate = parseISO(schedule.weekStart)
      
      // Generar días de la semana (usando el weekStart del schedule que ya está correcto)
      const weekStart = weekStartDate // Ya viene como inicio de semana desde la BD
      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      const weekEndDate = weekDays[weekDays.length - 1]
      
      // Determinar a qué mes pertenece esta semana
      // El mes es el que contiene el weekStartDate en su rango personalizado
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
      stats[employee.id] = { francos: 0, horasExtrasSemana: 0, horasExtrasMes: 0 }
    })

    if (employees.length === 0 || shifts.length === 0) {
      return stats
    }

    const monthRange = getCustomMonthRange(monthDate, monthStartDay)
    const monthWeeks = getMonthWeeks(monthDate, monthStartDay, weekStartsOn)
    const minutosDescanso = config?.minutosDescanso ?? 30
    const horasMinimasParaDescanso = config?.horasMinimasParaDescanso ?? 6

    // Mapa para rastrear horas extras por semana (para obtener la última semana)
    const weeklyExtras: Record<string, Record<string, number>> = {}
    let lastWeekStartStr: string | null = null

    monthWeeks.forEach((weekDays) => {
      const weekStartStr = format(weekDays[0], "yyyy-MM-dd")
      const weekSchedule = schedules.find((s) => s.weekStart === weekStartStr) || null
      if (!weekSchedule?.assignments) return

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

    // Inicializar horasExtrasSemana con 0 para todos los empleados
    // Se calculará por semana cuando se muestre cada semana
    Object.keys(stats).forEach((employeeId) => {
      stats[employeeId].horasExtrasSemana = 0
    })

    return stats
  }, [employees, shifts, config, monthStartDay, weekStartsOn, schedules])

  const handleExportWeekImage = useCallback(async (weekStartDate: Date, weekEndDate: Date) => {
    const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
    await exportImage(weekId, `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.png`, {
      nombreEmpresa: config?.nombreEmpresa,
      colorEmpresa: config?.colorEmpresa,
    })
  }, [exportImage, config])

  const handleExportWeekPDF = useCallback(async (weekStartDate: Date, weekEndDate: Date) => {
    const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
    await exportPDF(weekId, `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.pdf`, {
      nombreEmpresa: config?.nombreEmpresa,
      colorEmpresa: config?.colorEmpresa,
    })
  }, [exportPDF, config])

  const handleExportWeekExcel = useCallback(async (weekStartDate: Date, weekDays: Date[], weekSchedule: Horario | null) => {
    await exportExcel(
      weekDays,
      employees,
      shifts,
      weekSchedule,
      `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.xlsx`
    )
  }, [exportExcel, employees, shifts])

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Horarios Mensuales</h2>
          <p className="text-muted-foreground">
            Vista jerárquica de todos los horarios organizados por mes y semana
          </p>
        </div>

        {dataLoading ? (
          <Card className="p-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Cargando datos...</p>
          </Card>
        ) : employees.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No hay empleados registrados. Agrega empleados para crear horarios.</p>
          </Card>
        ) : shifts.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No hay turnos configurados. Agrega turnos para crear horarios.</p>
          </Card>
        ) : monthGroups.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No hay horarios disponibles. Crea horarios para verlos aquí.</p>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            {monthGroups.map((month) => {
              const monthRange = getCustomMonthRange(month.monthDate, monthStartDay)
              const employeeStats = calculateMonthlyStats(month.monthDate)

              return (
                <AccordionItem
                  key={month.monthKey}
                  value={month.monthKey}
                  className="border rounded-lg px-4 bg-card"
                >
                  <AccordionTrigger className="text-xl font-semibold hover:no-underline py-4">
                    <div className="flex items-center justify-between w-full pr-4">
                      <span>{month.monthName}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {month.weeks.length} {month.weeks.length === 1 ? "semana" : "semanas"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Accordion type="multiple" className="space-y-3 mt-2">
                      {month.weeks.map((week) => (
                        <AccordionItem
                          key={week.weekStartStr}
                          value={week.weekStartStr}
                          className="border rounded-md px-3 bg-background"
                        >
                          <AccordionTrigger className="text-lg font-medium hover:no-underline py-3">
                            <span>
                              Semana del {format(week.weekStartDate, "d", { locale: es })} -{" "}
                              {format(week.weekEndDate, "d 'de' MMMM", { locale: es })}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            {(() => {
                              // Calcular horas extras para esta semana específica
                              const weekStats: Record<string, EmployeeMonthlyStats> = {}
                              employees.forEach((employee) => {
                                weekStats[employee.id] = {
                                  ...employeeStats[employee.id],
                                  horasExtrasSemana: 0,
                                }
                              })

                              if (week.schedule?.assignments) {
                                week.weekDays.forEach((day) => {
                                  const dateStr = format(day, "yyyy-MM-dd")
                                  const dateAssignments = week.schedule?.assignments[dateStr]
                                  if (!dateAssignments) return

                                  Object.entries(dateAssignments).forEach(([employeeId, assignmentValue]) => {
                                    if (!weekStats[employeeId]) {
                                      weekStats[employeeId] = {
                                        ...employeeStats[employeeId],
                                        horasExtrasSemana: 0,
                                      }
                                    }

                                    const normalizedAssignments = normalizeAssignments(assignmentValue)
                                    if (normalizedAssignments.length === 0) {
                                      return
                                    }

                                    // Calcular horas extras para este día
                                    const extraHours = calculateExtraHours(normalizedAssignments, shifts)
                                    if (extraHours > 0) {
                                      weekStats[employeeId].horasExtrasSemana += extraHours
                                    }
                                  })
                                })
                              }

                              return (
                                <WeekSchedule
                                  weekDays={week.weekDays}
                                  weekIndex={0}
                                  weekSchedule={week.schedule}
                                  employees={employees}
                                  shifts={shifts}
                                  monthRange={monthRange}
                                  onExportImage={handleExportWeekImage}
                                  onExportPDF={handleExportWeekPDF}
                                  onExportExcel={() => handleExportWeekExcel(week.weekStartDate, week.weekDays, week.schedule)}
                                  exporting={exporting}
                                  mediosTurnos={config?.mediosTurnos}
                                  employeeStats={weekStats}
                                  readonly={true}
                                />
                              )
                            })()}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </div>
    </DashboardLayout>
  )
}

