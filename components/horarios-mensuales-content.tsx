"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { collection, query, orderBy, onSnapshot, where, doc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Horario, Empleado, Turno, Configuracion } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { getCustomMonthRange, getMonthWeeks } from "@/lib/utils"
import { useExportSchedule } from "@/hooks/use-export-schedule"
import { ExportOverlay } from "@/components/export-overlay"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { calculateHoursBreakdown } from "@/lib/validations"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"
import { ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"

const normalizeAssignments = (value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  return (value as ShiftAssignment[]).map((assignment) => ({
    ...assignment,
    type: assignment.type || "shift",
  }))
}

interface MonthGroup {
  monthKey: string
  monthName: string
  monthDate: Date
  weeks: WeekGroup[]
}

interface WeekGroup {
  weekStartDate: Date
  weekEndDate: Date
  weekStartStr: string
  schedule: Horario | null
  weekDays: Date[]
}

// Configuración por defecto para la vista pública
const defaultConfig: Configuracion = {
  nombreEmpresa: "Empresa",
  colorEmpresa: undefined,
  mesInicioDia: 1,
  horasMaximasPorDia: 8,
  semanaInicioDia: 1,
  mostrarFinesDeSemana: true,
  formatoHora24: true,
  minutosDescanso: 30,
  horasMinimasParaDescanso: 6,
  mediosTurnos: [],
}

interface HorariosMensualesContentProps {
  ownerIdOverride?: string | null
}

export function HorariosMensualesContent({ ownerIdOverride = null }: HorariosMensualesContentProps) {
  const searchParams = useSearchParams()
  const ownerId = ownerIdOverride ?? searchParams.get("ownerId")

  const [schedules, setSchedules] = useState<Horario[]>([])
  const [employees, setEmployees] = useState<Empleado[]>([])
  const [shifts, setShifts] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { exporting, exportImage } = useExportSchedule()
  const [config, setConfig] = useState<Configuracion>(defaultConfig)

  // Cargar configuración del usuario
  useEffect(() => {
    if (!db || !ownerId) return

    const configRef = doc(db, COLLECTIONS.CONFIG, ownerId)
    const unsubscribeConfig = onSnapshot(
      configRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setConfig(snapshot.data() as Configuracion)
        } else {
          setConfig(defaultConfig)
        }
      },
      (error) => {
        console.error("Error loading config:", error)
        setConfig(defaultConfig)
      }
    )

    return () => unsubscribeConfig()
  }, [ownerId])

  const weekStartsOn = (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const monthStartDay = config?.mesInicioDia || 1

  // Cargar empleados filtrados por userId
  useEffect(() => {
    if (!db || !ownerId) {
      if (!ownerId) {
        setLoading(false)
      }
      return
    }

    const employeesQuery = query(
      collection(db, COLLECTIONS.EMPLOYEES),
      where("ownerId", "==", ownerId),
      orderBy("name")
    )
    const unsubscribeEmployees = onSnapshot(
      employeesQuery,
      (snapshot) => {
        const employeesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Empleado[]
        setEmployees(employeesData)
      },
      (error) => {
        console.error("Error en listener de empleados:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los empleados.",
          variant: "destructive",
        })
      }
    )

    return () => unsubscribeEmployees()
  }, [ownerId, toast])

  // Cargar turnos filtrados por userId
  useEffect(() => {
    if (!db || !ownerId) return

    const shiftsQuery = query(
      collection(db, COLLECTIONS.SHIFTS),
      where("ownerId", "==", ownerId),
      orderBy("name")
    )
    const unsubscribeShifts = onSnapshot(
      shiftsQuery,
      (snapshot) => {
        const shiftsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Turno[]
        setShifts(shiftsData)
      },
      (error) => {
        console.error("Error en listener de turnos:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los turnos.",
          variant: "destructive",
        })
      }
    )

    return () => unsubscribeShifts()
  }, [ownerId, toast])

  // Cargar horarios filtrados por userId
  useEffect(() => {
    if (!db || !ownerId) return

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
        setLoading(false)
      },
      (error) => {
        console.error("Error en listener de horarios:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los horarios.",
          variant: "destructive",
        })
        setLoading(false)
      }
    )

    return () => unsubscribeSchedules()
  }, [ownerId, toast])

  // Mostrar mensaje si no hay userId
  if (!ownerId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <Card className="p-6 sm:p-8 md:p-12 text-center space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Enlace de Horarios</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Para ver los horarios, necesitas un enlace compartido válido.
            </p>
            <p className="text-sm sm:text-base text-muted-foreground">
              Si eres administrador, ve a <strong>Dashboard → Horarios Mensuales</strong> y haz clic en <strong>"Compartir enlace"</strong> para obtener tu enlace personalizado.
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-4">
              El enlace debe tener el formato: <code className="bg-muted px-2 py-1 rounded">/horarios-mensuales?userId=...</code>
            </p>
          </Card>
        </div>
      </div>
    )
  }

  // Agrupar horarios por mes y semana
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

  const handleExportWeekImage = useCallback(async (weekStartDate: Date) => {
    const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
    await exportImage(weekId, `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.png`, {
      nombreEmpresa: config?.nombreEmpresa,
      colorEmpresa: config?.colorEmpresa,
    })
  }, [exportImage, config])

  return (
    <>
      <ExportOverlay isExporting={exporting} message="Exportando horario..." />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="space-y-4 sm:space-y-6">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
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
              </div>
            </div>

            {loading ? (
              <Card className="p-6 sm:p-8 md:p-12 text-center">
                <Loader2 className="mx-auto h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                <p className="mt-4 text-sm sm:text-base text-muted-foreground">Cargando datos...</p>
              </Card>
            ) : employees.length === 0 ? (
              <Card className="p-6 sm:p-8 md:p-12 text-center">
                <p className="text-sm sm:text-base text-muted-foreground">No hay empleados registrados.</p>
              </Card>
            ) : shifts.length === 0 ? (
              <Card className="p-6 sm:p-8 md:p-12 text-center">
                <p className="text-sm sm:text-base text-muted-foreground">No hay turnos configurados.</p>
              </Card>
            ) : monthGroups.length === 0 ? (
              <Card className="p-6 sm:p-8 md:p-12 text-center">
                <p className="text-sm sm:text-base text-muted-foreground">No hay horarios disponibles.</p>
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

                                  // Calcular horas extras usando el nuevo servicio de dominio
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
                                onExportPDF={undefined}
                                onExportExcel={undefined}
                                onExportEmployeeImage={undefined}
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
        </div>
      </div>
    </>
  )
}

export function HorariosMensualesLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <Card className="p-6 sm:p-8 md:p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm sm:text-base text-muted-foreground">Cargando...</p>
        </Card>
      </div>
    </div>
  )
}
