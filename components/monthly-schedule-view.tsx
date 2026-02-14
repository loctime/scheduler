"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { getCustomMonthRange } from "@/lib/utils"
import type { Empleado, Horario, Turno } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"
import { normalizeAssignments } from "@/lib/domain/normalize-assignments"
import type { Configuracion } from "@/lib/types"

export interface MonthGroup {
  monthKey: string
  monthName: string
  monthDate: Date
  weeks: {
    weekStartDate: Date
    weekEndDate: Date
    weekStartStr: string
    schedule: Horario | null
    weekDays: Date[]
  }[]
}

export interface MonthlyScheduleViewProps {
  monthGroups: MonthGroup[]
  companyName?: string
  employees: Empleado[]
  shifts: Turno[]
  config?: Configuracion | null
  monthStartDay?: number
  isLoading?: boolean
  calculateMonthlyStats: (monthDate: Date) => Record<string, EmployeeMonthlyStats>
  onExportImage?: (weekStartDate: Date, weekEndDate: Date) => void
  onExportPDF?: (weekStartDate: Date, weekEndDate: Date) => void
  onExportExcel?: (weekStartDate: Date, weekDays: Date[], weekSchedule: Horario | null) => void
  exporting?: boolean
  readonly?: boolean
  /** En móvil mostrar solo vista individual (sin Grilla completa). */
  mobileIndividualOnly?: boolean
}

/**
 * Vista compartida de horarios mensuales.
 * Reutilizable en dashboard (con auth) y PWA (sin auth).
 */
export function MonthlyScheduleView({
  monthGroups,
  companyName,
  employees,
  shifts,
  config,
  monthStartDay = 1,
  isLoading = false,
  calculateMonthlyStats,
  onExportImage,
  onExportPDF,
  onExportExcel,
  exporting = false,
  readonly = true,
  mobileIndividualOnly = false,
}: MonthlyScheduleViewProps) {
  if (isLoading) {
    return (
      <Card className="p-6 sm:p-8 md:p-12 text-center">
        <Loader2 className="mx-auto h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm sm:text-base text-muted-foreground">Cargando datos...</p>
      </Card>
    )
  }

  if (monthGroups.length === 0) {
    return (
      <Card className="p-6 sm:p-8 md:p-12 text-center">
        <p className="text-sm sm:text-base text-muted-foreground">No hay horarios disponibles.</p>
      </Card>
    )
  }

  return (
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
                  const weekEmps: Empleado[] = employees.length > 0
                    ? employees
                    : ((week.schedule as any)?.employeesSnapshot ?? (week.schedule as any)?.empleadosSnapshot ?? [])
                  const weekStats: Record<string, EmployeeMonthlyStats> = {}
                  weekEmps.forEach((emp) => {
                    weekStats[emp.id] = {
                      ...(employeeStats[emp.id] || {
                        francos: 0,
                        francosSemana: 0,
                        horasExtrasSemana: 0,
                        horasExtrasMes: 0,
                        horasComputablesMes: 0,
                        horasSemana: 0,
                        horasLicenciaEmbarazo: 0,
                        horasMedioFranco: 0,
                      }),
                      horasExtrasSemana: 0,
                    }
                  })

                  if (week.schedule?.assignments && config) {
                    const workingConfig = toWorkingHoursConfig(config)
                    week.weekDays.forEach((day) => {
                      const dateStr = format(day, "yyyy-MM-dd")
                      const dateAssignments = week.schedule?.assignments[dateStr]
                      if (!dateAssignments) return

                      Object.entries(dateAssignments).forEach(([employeeId, assignmentValue]) => {
                        if (!weekStats[employeeId]) {
                          weekStats[employeeId] = {
                            ...employeeStats[employeeId],
                            horasExtrasSemana: 0,
                          } as EmployeeMonthlyStats
                        }
                        const normalized = normalizeAssignments(assignmentValue)
                        if (normalized.length === 0) return
                        const { horasExtra } = calculateTotalDailyHours(normalized, workingConfig)
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
                      employees={weekEmps}
                      allEmployees={weekEmps}
                      shifts={shifts}
                      monthRange={{ start: monthRange.startDate, end: monthRange.endDate }}
                      onExportImage={onExportImage}
                      onExportPDF={onExportPDF}
                      onExportExcel={
                        onExportExcel
                          ? () => onExportExcel(week.weekStartDate, week.weekDays, week.schedule)
                          : undefined
                      }
                      exporting={exporting}
                      mediosTurnos={config?.mediosTurnos}
                      employeeStats={Object.values(weekStats)}
                      readonly={readonly}
                      mobileIndividualOnly={mobileIndividualOnly}
                    />
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
