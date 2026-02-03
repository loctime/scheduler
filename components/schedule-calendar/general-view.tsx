"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { MonthHeader } from "@/components/schedule-calendar/month-header"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { EmptyStateCard, LoadingStateCard } from "@/components/schedule-calendar/state-card"
import type { Horario, Empleado, Turno, MedioTurno, ShiftAssignment, ShiftAssignmentValue, Configuracion } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { format } from "date-fns"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"

type AssignmentUpdateHandler = (
  date: string,
  employeeId: string,
  assignments: ShiftAssignment[],
  options?: { scheduleId?: string },
) => Promise<void>

interface GeneralViewProps {
  dataLoading: boolean
  employees: Empleado[]
  shifts: Turno[]
  monthRange: { startDate: Date; endDate: Date }
  currentMonth: Date
  monthWeeks: Date[][]
  exporting: boolean
  mediosTurnos?: MedioTurno[]
  employeeMonthlyStats: Record<string, EmployeeMonthlyStats>
  getWeekSchedule: (weekStartDate: Date) => Horario | null
  onAssignmentUpdate?: AssignmentUpdateHandler
  onExportMonthPDF: () => Promise<void>
  onExportWeekImage: (weekStartDate: Date, weekEndDate: Date) => Promise<void>
  onExportWeekPDF: (weekStartDate: Date, weekEndDate: Date) => Promise<void>
  onExportWeekExcel: (weekStartDate: Date, weekDays: Date[], weekSchedule: Horario | null) => Promise<void>
  onPreviousMonth: () => void
  onNextMonth: () => void
  user?: any
  onMarkWeekComplete?: (weekStartDate: Date, completed: boolean) => Promise<void>
  lastCompletedWeekStart?: string | null
  allSchedules?: Horario[]
  config?: Configuracion | null
  copiedWeekData?: any
  onCopyCurrentWeek?: (weekStartDate: Date) => void
  onPasteCopiedWeek?: (targetWeekStartDate: Date) => Promise<void>
  onPublishSchedule?: (weekStartDate: Date, weekEndDate: Date) => Promise<void> | void
  isPublishingSchedule?: boolean
  onWeekScheduleRef?: (weekKey: string, element: HTMLDivElement) => void
}

export function GeneralView({
  dataLoading,
  employees,
  shifts,
  monthRange,
  currentMonth,
  monthWeeks,
  exporting,
  mediosTurnos,
  employeeMonthlyStats,
  getWeekSchedule,
  onAssignmentUpdate,
  onExportMonthPDF,
  onExportWeekImage,
  onExportWeekPDF,
  onExportWeekExcel,
  onPreviousMonth,
  onNextMonth,
  user,
  onMarkWeekComplete,
  lastCompletedWeekStart,
  allSchedules = [],
  config,
  copiedWeekData,
  onCopyCurrentWeek,
  onPasteCopiedWeek,
  onPublishSchedule,
  isPublishingSchedule,
  onWeekScheduleRef,
}: GeneralViewProps) {
  // Create shift map for efficient lookup
  const shiftMap = useMemo(() => {
    return new Map(shifts.map((s) => [s.id, s]))
  }, [shifts])

  const getShiftInfo = (shiftId: string) => {
    return shiftMap.get(shiftId)
  }

  // Crear un mapa de semanas expandidas usando la fecha de inicio de semana como clave
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => {
    // Por defecto, todas las semanas están cerradas
    return new Set<string>()
  })

  // Sincronizar el estado cuando cambian las semanas del mes
  const weekKeys = useMemo(
    () => monthWeeks.map((weekDays) => format(weekDays[0], "yyyy-MM-dd")),
    [monthWeeks],
  )

  // Limpiar semanas que ya no existen cuando cambian las semanas del mes
  useEffect(() => {
    setExpandedWeeks((prev) => {
      const updated = new Set<string>()
      // Mantener solo las semanas que aún existen
      prev.forEach((key) => {
        if (weekKeys.includes(key)) {
          updated.add(key)
        }
      })
      return updated
    })
  }, [weekKeys])

  const handleWeekToggle = useCallback((weekStartDate: Date, isOpen: boolean) => {
    const weekKey = format(weekStartDate, "yyyy-MM-dd")
    setExpandedWeeks((prev) => {
      const updated = new Set(prev)
      if (isOpen) {
        updated.add(weekKey)
      } else {
        updated.delete(weekKey)
      }
      return updated
    })
  }, [])

  // Función para manejar refs de los ScheduleGrid
  const handleWeekScheduleRef = useCallback((weekStartDate: Date, element: HTMLDivElement | null) => {
    const weekKey = format(weekStartDate, "yyyy-MM-dd")
    console.log("🔧 [GeneralView] Recibiendo ref:", { weekKey, hasElement: !!element })
    if (element && onWeekScheduleRef) {
      // Pasar el ref al componente padre (ScheduleCalendar)
      console.log("🔧 [GeneralView] Pasando ref al padre:", weekKey)
      onWeekScheduleRef(weekKey, element)
    } else {
      console.log("🔧 [GeneralView] No se pasó ref:", { hasElement: !!element, hasCallback: !!onWeekScheduleRef })
    }
  }, [onWeekScheduleRef])

  // Verificar si hay semanas completadas en el rango del mes
  // IMPORTANTE: Este hook debe estar antes de cualquier return condicional
  const hasCompletedWeeks = useMemo(() => {
    return monthWeeks.some((weekDays) => {
      const weekSchedule = getWeekSchedule(weekDays[0])
      return weekSchedule?.completada === true
    })
  }, [monthWeeks, getWeekSchedule])

  if (dataLoading) {
    return <LoadingStateCard />
  }

  // Si no hay empleados ni turnos activos, pero hay semanas completadas, mostrar el calendario
  // (las semanas completadas tienen sus propios snapshots de empleados)
  if (employees.length === 0 && !hasCompletedWeeks) {
    return <EmptyStateCard message="No hay empleados registrados. Agrega empleados para crear horarios." />
  }

  if (shifts.length === 0 && !hasCompletedWeeks) {
    return <EmptyStateCard message="No hay turnos configurados. Agrega turnos para crear horarios." />
  }

  return (
    <div className="space-y-6">
      <MonthHeader
        monthRange={monthRange}
        currentMonth={currentMonth}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        onExportPDF={onExportMonthPDF}
        exporting={exporting}
        user={user}
      />

      <div id="schedule-month-container" className="space-y-6">
        {monthWeeks.map((weekDays, weekIndex) => {
          const weekStartDate = weekDays[0]
          const weekSchedule = getWeekSchedule(weekStartDate)
          const weekKey = format(weekStartDate, "yyyy-MM-dd")
          const isExpanded = expandedWeeks.has(weekKey)

          // Calcular horas extras para esta semana específica
          const weekStats: Record<string, EmployeeMonthlyStats> = {}
          
          // Si la semana está completada y tiene snapshot, usar empleados del snapshot
          // Si no hay empleados activos pero hay snapshot, usar el snapshot
          const employeesForWeek = (() => {
            if (weekSchedule?.completada === true && weekSchedule?.empleadosSnapshot && weekSchedule.empleadosSnapshot.length > 0) {
              // Si hay snapshot, usar empleados del snapshot
              const snapshotEmployees = weekSchedule.empleadosSnapshot.map((snapshotEmp) => ({
                id: snapshotEmp.id,
                name: snapshotEmp.name,
                email: snapshotEmp.email,
                phone: snapshotEmp.phone,
                userId: '', // No disponible en snapshot
              } as Empleado))
              
              // Si hay empleados activos, combinar (priorizar activos)
              if (employees.length > 0) {
                const activeEmployeesMap = new Map(employees.map((emp) => [emp.id, emp]))
                return snapshotEmployees.map((snapshotEmp) => 
                  activeEmployeesMap.get(snapshotEmp.id) || snapshotEmp
                )
              }
              
              return snapshotEmployees
            }
            return employees
          })()
          
          employeesForWeek.forEach((employee) => {
            weekStats[employee.id] = {
              ...employeeMonthlyStats[employee.id] || { francos: 0, francosSemana: 0, horasExtrasSemana: 0, horasExtrasMes: 0, horasComputablesMes: 0, horasSemana: 0 },
              francosSemana: 0,
              horasExtrasSemana: 0,
              horasSemana: 0,
            }
          })

          if (weekSchedule?.assignments) {
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

            weekDays.forEach((day) => {
              const dateStr = format(day, "yyyy-MM-dd")
              const dateAssignments = weekSchedule.assignments[dateStr]
              if (!dateAssignments) return

              Object.entries(dateAssignments).forEach(([employeeId, assignmentValue]) => {
                if (!weekStats[employeeId]) {
                  weekStats[employeeId] = {
                    ...employeeMonthlyStats[employeeId],
                    francosSemana: 0,
                    horasExtrasSemana: 0,
                    horasSemana: 0,
                  }
                }

                const normalizedAssignments = normalizeAssignments(assignmentValue)
                if (normalizedAssignments.length === 0) {
                  // Count as francos if no assignments
                  weekStats[employeeId].francosSemana += 1
                  return
                }

                // Check if all assignments are francos (day off)
                const allFrancos = normalizedAssignments.every(assignment => 
                  assignment.type === 'franco' || assignment.type === 'medio_franco'
                )
                
                if (allFrancos) {
                  weekStats[employeeId].francosSemana += 1
                }

                // Calcular horas extras y horas totales para este día usando el nuevo servicio de dominio
                const workingConfig = toWorkingHoursConfig(config)
                const { horasExtra, horasNormales } = calculateTotalDailyHours(normalizedAssignments, workingConfig)
                
                if (horasExtra > 0) {
                  weekStats[employeeId].horasExtrasSemana += horasExtra
                }
                
                if (horasNormales > 0) {
                  weekStats[employeeId].horasSemana += horasNormales
                }
              })
            })
          }

          return (
            <WeekSchedule
              key={weekIndex}
              ref={(element) => handleWeekScheduleRef(weekStartDate, element)}
              weekDays={weekDays}
              weekIndex={weekIndex}
              weekSchedule={weekSchedule}
              employees={employeesForWeek}
              allEmployees={employees}
              shifts={shifts}
              monthRange={{ start: monthRange.startDate, end: monthRange.endDate }}
              onAssignmentUpdate={onAssignmentUpdate ? (date: string, employeeId: string, shiftId: string, value: string | null) => {
                console.log("🔧 [GeneralView Adaptador] Recibido:", {
                  date,
                  employeeId,
                  shiftId,
                  value,
                  "weekSchedule.id": weekSchedule?.id
                })

                // Detectar valores especiales de dayStatus
                if (value && value.startsWith('DAY_STATUS_')) {
                  console.log("🔧 [GeneralView Adaptador] Detectado dayStatus especial")
                  
                  // Parsear el valor especial: DAY_STATUS_tipo_startTime_endTime
                  const parts = value.split('_')
                  console.log("🔧 [GeneralView Adaptador] Parts del split:", parts)
                  
                  // Unir las partes del tipo (medio_franco está dividido en parts[2] y parts[3])
                  let type: "franco" | "medio_franco"
                  let startTime: string | undefined
                  let endTime: string | undefined
                  
                  if (parts[2] === 'medio' && parts[3] === 'franco') {
                    type = 'medio_franco'
                    startTime = parts[4] || undefined
                    endTime = parts[5] || undefined
                  } else if (parts[2] === 'franco') {
                    type = 'franco'
                    startTime = parts[3] || undefined
                    endTime = parts[4] || undefined
                  } else {
                    type = parts[2] as "franco" | "medio_franco"
                    startTime = parts[3] || undefined
                    endTime = parts[4] || undefined
                  }
                  
                  console.log("🔧 [GeneralView Adaptador] Parseado:", {
                    originalValue: value,
                    parts,
                    type,
                    startTime,
                    endTime
                  })
                  
                  const assignments: ShiftAssignment[] = [{
                    type,
                    ...(startTime && endTime && { startTime, endTime })
                  }]
                  
                  console.log("🔧 [GeneralView Adaptador] Convertido a assignments:", {
                    assignments,
                    "scheduleId para enviar": weekSchedule?.id
                  })
                  onAssignmentUpdate(date, employeeId, assignments, { scheduleId: weekSchedule?.id })
                  return
                }

                // Convertir de firma WeekSchedule a firma GeneralView (comportamiento normal)
                const assignments: ShiftAssignment[] = value ? [{
                  shiftId,
                  type: "shift",
                  startTime: '',
                  endTime: ''
                }] : []
                onAssignmentUpdate(date, employeeId, assignments, { scheduleId: weekSchedule?.id })
              } : undefined}
              onExportImage={onExportWeekImage}
              onExportPDF={onExportWeekPDF}
              onExportExcel={() => onExportWeekExcel(weekStartDate, weekDays, weekSchedule)}
              exporting={exporting}
              mediosTurnos={mediosTurnos}
              employeeStats={Object.values(weekStats)}
              open={isExpanded}
              onOpenChange={(open) => handleWeekToggle(weekStartDate, open)}
              onMarkComplete={undefined}
              lastCompletedWeekStart={undefined}
              getWeekSchedule={getWeekSchedule}
              allSchedules={allSchedules}
              onCopyCurrentWeek={undefined}
              onPasteCopiedWeek={undefined}
              onPublishSchedule={onPublishSchedule}
              isPublishingSchedule={isPublishingSchedule}
            />
          )
        })}
      </div>
    </div>
  )
}
