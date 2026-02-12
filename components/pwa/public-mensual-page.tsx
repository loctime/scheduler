"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { usePublicMonthlySchedules } from "@/hooks/use-public-monthly-schedules"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { getCustomMonthRange } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Empleado, Turno } from "@/lib/types"

export function PublicMensualPage({ companySlug }: { companySlug: string }) {
  // Extraer empleados y turnos desde los schedules públicos
  const {
    monthGroups,
    companyName,
    isLoading,
    error,
    calculateMonthlyStats
  } = usePublicMonthlySchedules({
    companySlug,
    employees: [], // Se extraerán dinámicamente de los schedules
    shifts: [], // Se extraerán dinámicamente de los schedules
    config: undefined // Se extraerá dinámicamente de los schedules
  })

  // Extraer empleados únicos de todos los schedules
  const employees: Empleado[] = useMemo(() => {
    const employeeMap = new Map<string, Empleado>()
    monthGroups.forEach(month => {
      month.weeks.forEach(week => {
        if (week.schedule?.assignments) {
          Object.values(week.schedule.assignments).forEach((dayAssignments: any) => {
            if (dayAssignments) {
              Object.keys(dayAssignments).forEach(employeeId => {
                if (!employeeMap.has(employeeId)) {
                  employeeMap.set(employeeId, {
                    id: employeeId,
                    name: employeeId, // En vista pública usamos el ID como nombre
                    ownerId: "",
                    userId: ""
                  })
                }
              })
            }
          })
        }
      })
    })
    return Array.from(employeeMap.values())
  }, [monthGroups])

  // Extraer turnos únicos de todos los schedules
  const shifts: Turno[] = useMemo(() => {
    const shiftMap = new Map<string, Turno>()
    monthGroups.forEach(month => {
      month.weeks.forEach(week => {
        if (week.schedule?.assignments) {
          Object.values(week.schedule.assignments).forEach((dayAssignments: any) => {
            if (dayAssignments) {
              Object.values(dayAssignments).forEach((assignment: any) => {
                if (Array.isArray(assignment)) {
                  assignment.forEach((a: any) => {
                    if (a.shiftId && !shiftMap.has(a.shiftId)) {
                      shiftMap.set(a.shiftId, {
                        id: a.shiftId,
                        name: a.shiftId,
                        startTime: a.startTime || "",
                        endTime: a.endTime || "",
                        color: "#666",
                        ownerId: "",
                        userId: ""
                      })
                    }
                  })
                }
              })
            }
          })
        }
      })
    })
    return Array.from(shiftMap.values())
  }, [monthGroups])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const monthStartDay = 1
  const config = { mediosTurnos: [] } // Config básica para vista pública

  return (
    <div className="min-h-screen bg-muted/20 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{companyName || "Vista mensual"}</h1>
            <p className="text-sm text-muted-foreground">
              Vista jerárquica de todos los horarios organizados por mes y semana
            </p>
          </div>
          <Badge variant="secondary">Público</Badge>
        </div>

        {monthGroups.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No hay horarios disponibles.</p>
            </CardContent>
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
                        const weekStats: Record<string, any> = {}
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

                              // Para la vista pública, simplificamos el cálculo de horas extras
                              // ya que no tenemos acceso a toda la configuración
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
                            onExportImage={undefined}
                            onExportPDF={undefined}
                            onExportExcel={undefined}
                            exporting={false}
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
  )
}
