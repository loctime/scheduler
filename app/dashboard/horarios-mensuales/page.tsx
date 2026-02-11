"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { Horario } from "@/lib/types"
import { useConfig } from "@/hooks/use-config"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO, startOfWeek, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { getCustomMonthRange, getMonthWeeks } from "@/lib/utils"
import { useExportSchedule } from "@/hooks/use-export-schedule"
import { ExportOverlay } from "@/components/export-overlay"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { calculateDailyHours, calculateHoursBreakdown } from "@/lib/validations"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"
import { ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Share2 } from "lucide-react"

const normalizeAssignments = (value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
  if (!value || !Array.isArray(value) || value.length === 0) return []
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
  const { employees, shifts, loading: dataLoading, user, userData } = useData()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const { config } = useConfig(user)
  const { toast } = useToast()
  const { exporting, exportImage, exportPDF, exportExcel } = useExportSchedule()
  const [publishingWeekId, setPublishingWeekId] = useState<string | null>(null)
  const weekStartsOn = (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const monthStartDay = config?.mesInicioDia || 1


  useEffect(() => {
    if (!user || !db || !ownerId) return

    const schedulesQuery = query(
      collection(db, COLLECTIONS.SCHEDULES),
      where("ownerId", "==", ownerId),
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
  }, [user, ownerId, toast])

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
      stats[employee.id] = { francos: 0, francosSemana: 0, horasExtrasSemana: 0, horasExtrasMes: 0, horasComputablesMes: 0, horasSemana: 0, horasLicenciaEmbarazo: 0, horasMedioFranco: 0 }
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
            // Acumular en la semana actual
            weeklyExtras[weekStartStr][employeeId] = (weeklyExtras[weekStartStr][employeeId] || 0) + horasExtra
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

  const handleShareLink = useCallback(async () => {
    if (!user) return
    
    const shareUrl = `${window.location.origin}/pwa/horario/${user.uid}`
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: "Enlace copiado",
        description: "El enlace PWA se ha copiado al portapapeles. Compártelo con tu equipo.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace. Cópialo manualmente.",
        variant: "destructive",
      })
    }
  }, [user, toast])

  return (
    <>
      <ExportOverlay isExporting={exporting} message="Exportando horario..." />
      <DashboardLayout user={user}>
        <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div>
            {config?.nombreEmpresa && (
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1">
                {config.nombreEmpresa}
              </h1>
            )}
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Horarios Mensuales</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Vista jerárquica de todos los horarios organizados por mes y semana
            </p>
          </div>
          {user && (
            <Button onClick={handleShareLink} variant="outline" size="default" className="shrink-0">
              <Share2 className="mr-2 h-4 w-4" />
              Compartir enlace
            </Button>
          )}
        </div>

        {dataLoading ? (
          <Card className="p-6 sm:p-8 md:p-12 text-center">
            <Loader2 className="mx-auto h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm sm:text-base text-muted-foreground">Cargando datos...</p>
          </Card>
        ) : employees.length === 0 ? (
          <Card className="p-6 sm:p-8 md:p-12 text-center">
            <p className="text-sm sm:text-base text-muted-foreground">No hay empleados registrados. Agrega empleados para crear horarios.</p>
          </Card>
        ) : shifts.length === 0 ? (
          <Card className="p-6 sm:p-8 md:p-12 text-center">
            <p className="text-sm sm:text-base text-muted-foreground">No hay turnos configurados. Agrega turnos para crear horarios.</p>
          </Card>
        ) : monthGroups.length === 0 ? (
          <Card className="p-6 sm:p-8 md:p-12 text-center">
            <p className="text-sm sm:text-base text-muted-foreground">No hay horarios disponibles. Crea horarios para verlos aquí.</p>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-3 sm:space-y-4">
            {monthGroups.map((month) => {
              const monthRange = getCustomMonthRange(month.monthDate, monthStartDay)
              const employeeStats = calculateMonthlyStats(month.monthDate)

              return (
                <AccordionItem
                  key={month.monthKey}
                  value={month.monthKey}
                  className="border rounded-lg px-3 sm:px-4 bg-card"
                >
                  <AccordionTrigger className="text-base sm:text-lg md:text-xl font-semibold hover:no-underline py-3 sm:py-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full pr-2 sm:pr-4 gap-1 sm:gap-0">
                      <span className="truncate">{month.monthName}</span>
                      <span className="text-xs sm:text-sm font-normal text-muted-foreground shrink-0">
                        {month.weeks.length} {month.weeks.length === 1 ? "semana" : "semanas"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 sm:space-y-3 mt-2">
                      {month.weeks.map((week) => {
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

                              // Calcular horas extras para este día usando el nuevo servicio de dominio
                              const workingConfig = toWorkingHoursConfig(config)
                              const { horasExtra } = calculateTotalDailyHours(normalizedAssignments, workingConfig)
                              if (horasExtra > 0) {
                                weekStats[employeeId].horasExtrasSemana += horasExtra
                              }
                            })
                          })
                        }

                        return (
                          <WeekSchedule
                            key={week.weekStartStr}
                            weekDays={week.weekDays}
                            weekIndex={0}
                            weekSchedule={week.schedule}
                            employees={employees}
                            allEmployees={employees}
                            shifts={shifts}
                            monthRange={{ start: monthRange.startDate, end: monthRange.endDate }}
                            onExportImage={handleExportWeekImage}
                            onExportPDF={handleExportWeekPDF}
                            onExportExcel={() => handleExportWeekExcel(week.weekStartDate, week.weekDays, week.schedule)}
                            exporting={exporting}
                            mediosTurnos={config?.mediosTurnos}
                            employeeStats={Object.values(weekStats)}
                            readonly={true}
                          />
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
        </div>
      </DashboardLayout>
    </>
  )
}
