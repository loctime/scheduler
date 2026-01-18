"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { format, subMonths, addMonths, startOfWeek } from "date-fns"
import { useData } from "@/contexts/data-context"
import { Horario, ShiftAssignment, ShiftAssignmentValue, Turno } from "@/lib/types"
import { useConfig } from "@/hooks/use-config"
import { getCustomMonthRange, getMonthWeeks, getInitialMonthForRange } from "@/lib/utils"
import { useExportSchedule } from "@/hooks/use-export-schedule"
import { useScheduleUpdates } from "@/hooks/use-schedule-updates"
import { useSchedulesListener } from "@/hooks/use-schedules-listener"
import { calculateTotalExtraHours, calculateHoursBreakdown } from "@/lib/validations"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { GeneralView } from "@/components/schedule-calendar/general-view"
import { ExportOverlay } from "@/components/export-overlay"
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
  const { employees, shifts, loading: dataLoading, userData } = useData()
  const { config } = useConfig(user)
  const { toast } = useToast()
  const { exporting, exportImage, exportPDF, exportExcel, exportMonthPDF } = useExportSchedule()

  const monthStartDay = config?.mesInicioDia || 1
  const weekStartsOn = (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6

  // Rastrear si ya se inicializó para evitar sobrescribir cuando el usuario navega
  const isInitialized = useRef(false)
  
  // Inicializar con el mes correcto basado en la fecha actual y mesInicioDia
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  // Actualizar el mes inicial cuando config esté disponible (si aún no se ha inicializado)
  useEffect(() => {
    if (config && !isInitialized.current) {
      const today = new Date()
      const initialMonth = getInitialMonthForRange(today, monthStartDay)
      setCurrentMonth(initialMonth)
      isInitialized.current = true
    }
  }, [config, monthStartDay])

  const monthRange = useMemo(
    () => getCustomMonthRange(currentMonth, monthStartDay),
    [currentMonth, monthStartDay],
  )
  const monthWeeks = useMemo(
    () => getMonthWeeks(currentMonth, monthStartDay, weekStartsOn),
    [currentMonth, monthStartDay, weekStartsOn],
  )

  // Usar hook centralizado para listener de schedules
  const { schedules, loading: schedulesLoading, getWeekSchedule } = useSchedulesListener({
    user,
    monthRange,
    enabled: !!user,
  })

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

  const handleExportWeekImage = useCallback(async (weekStartDate: Date, weekEndDate: Date) => {
    const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
    const ownerId = userData?.role === "invited" && userData?.ownerId 
      ? userData.ownerId 
      : user?.uid
    await exportImage(weekId, `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.png`, {
      nombreEmpresa: config?.nombreEmpresa,
      colorEmpresa: config?.colorEmpresa,
      ownerId,
    })
  }, [exportImage, config, userData, user])

  const handleExportWeekExcel = useCallback(async (weekStartDate: Date, weekDays: Date[], weekSchedule: Horario | null) => {
    await exportExcel(
      weekDays,
      employees,
      shifts,
      weekSchedule,
      `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.xlsx`,
      {
        separadores: config?.separadores,
        ordenEmpleados: config?.ordenEmpleados,
        colorEmpresa: config?.colorEmpresa,
        nombreEmpresa: config?.nombreEmpresa
      }
    )
  }, [exportExcel, employees, shifts, config])

  const handleExportWeekPDF = useCallback(async (weekStartDate: Date, weekEndDate: Date) => {
    const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
    await exportPDF(weekId, `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.pdf`, {
      nombreEmpresa: config?.nombreEmpresa,
      colorEmpresa: config?.colorEmpresa,
    })
  }, [exportPDF, config])

  // Extraer turnos de semanas completadas si no hay turnos activos
  const shiftsToUse = useMemo(() => {
    if (shifts.length > 0) {
      return shifts
    }
    
    // Si no hay turnos activos, extraer de semanas completadas
    // Los turnos se mostrarán usando los horarios de las asignaciones directamente
    // Crear turnos "fantasma" básicos solo para mantener compatibilidad
    const shiftIdsFromCompleted = new Set<string>()
    schedules.forEach((schedule) => {
      if (schedule.completada === true && schedule.assignments) {
        Object.values(schedule.assignments).forEach((dateAssignments) => {
          if (dateAssignments && typeof dateAssignments === 'object') {
            Object.values(dateAssignments).forEach((assignmentValue) => {
              if (Array.isArray(assignmentValue)) {
                assignmentValue.forEach((assignment) => {
                  if (typeof assignment === 'string') {
                    shiftIdsFromCompleted.add(assignment)
                  } else if (assignment && typeof assignment === 'object' && 'shiftId' in assignment && assignment.shiftId) {
                    shiftIdsFromCompleted.add(assignment.shiftId)
                  }
                })
              }
            })
          }
        })
      }
    })
    
    // Crear turnos "fantasma" básicos para los IDs encontrados
    // Estos turnos solo se usarán para mantener compatibilidad
    // Los horarios reales se obtendrán de las asignaciones (ShiftAssignment)
    return Array.from(shiftIdsFromCompleted).map((shiftId) => ({
      id: shiftId,
      name: `Turno ${shiftId}`,
      startTime: undefined,
      endTime: undefined,
      color: '#808080',
      userId: user?.uid || '',
      createdAt: null,
      updatedAt: null,
    } as Turno))
  }, [shifts, schedules, user])

  // Calcular la última semana completada
  const lastCompletedWeekStart = useMemo(() => {
    const completedSchedules = schedules.filter((s) => s.completada === true && s.weekStart)
    if (completedSchedules.length === 0) return null
    
    // Ordenar por weekStart descendente y tomar la más reciente
    const sorted = completedSchedules
      .filter((s) => s.weekStart)
      .sort((a, b) => {
        if (!a.weekStart || !b.weekStart) return 0
        return b.weekStart.localeCompare(a.weekStart)
      })
    
    return sorted.length > 0 ? sorted[0].weekStart : null
  }, [schedules])

  const employeeMonthlyStats = useMemo<Record<string, EmployeeMonthlyStats>>(() => {
    const stats: Record<string, EmployeeMonthlyStats> = {}
    employees.forEach((employee) => {
      stats[employee.id] = { francos: 0, horasExtrasSemana: 0, horasExtrasMes: 0, horasLicenciaEmbarazo: 0, horasMedioFranco: 0 }
    })

    if (employees.length === 0 || shiftsToUse.length === 0) {
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
            stats[employeeId] = { francos: 0, horasExtrasSemana: 0, horasExtrasMes: 0, horasLicenciaEmbarazo: 0, horasMedioFranco: 0 }
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
            shiftsToUse,
            minutosDescanso,
            horasMinimasParaDescanso
          )
          if (hoursBreakdown.licencia > 0) {
            stats[employeeId].horasLicenciaEmbarazo = (stats[employeeId].horasLicenciaEmbarazo || 0) + hoursBreakdown.licencia
          }
          if (hoursBreakdown.medio_franco > 0) {
            stats[employeeId].horasMedioFranco = (stats[employeeId].horasMedioFranco || 0) + hoursBreakdown.medio_franco
          }

          // Calcular horas extras: simplemente contar los 30 minutos agregados
          const { horasExtra } = calculateTotalExtraHours(
            normalizedAssignments,
            shiftsToUse,
            minutosDescanso,
            horasMinimasParaDescanso
          )
          const extraHours = horasExtra
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
    shiftsToUse,
    monthWeeks,
    monthRange.startDate,
    monthRange.endDate,
    getWeekSchedule,
    config?.minutosDescanso,
    config?.horasMinimasParaDescanso,
  ])

  const handleExportMonthPDF = useCallback(async () => {
    await exportMonthPDF(
      monthWeeks,
      getWeekSchedule,
      employees,
      shiftsToUse,
      `horario-mes-${format(monthRange.startDate, "yyyy-MM-dd")}.pdf`,
      {
        nombreEmpresa: config?.nombreEmpresa,
        colorEmpresa: config?.colorEmpresa,
        monthRange,
        mediosTurnos: config?.mediosTurnos,
        employeeMonthlyStats,
        minutosDescanso: config?.minutosDescanso,
        horasMinimasParaDescanso: config?.horasMinimasParaDescanso,
      }
    )
  }, [exportMonthPDF, monthWeeks, getWeekSchedule, employees, shiftsToUse, monthRange, config, employeeMonthlyStats])

  return (
    <>
      <ExportOverlay isExporting={exporting} message="Exportando horario..." />
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
        shifts={shiftsToUse}
        monthRange={monthRange}
        currentMonth={currentMonth}
        monthWeeks={monthWeeks}
        exporting={exporting}
        mediosTurnos={config?.mediosTurnos}
        employeeMonthlyStats={employeeMonthlyStats}
        getWeekSchedule={getWeekSchedule}
        onAssignmentUpdate={handleAssignmentUpdate}
        onExportMonthPDF={handleExportMonthPDF}
        onExportWeekImage={handleExportWeekImage}
        onExportWeekPDF={handleExportWeekPDF}
        onExportWeekExcel={handleExportWeekExcel}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        user={user}
        onMarkWeekComplete={handleMarkWeekComplete}
        lastCompletedWeekStart={lastCompletedWeekStart}
        allSchedules={schedules}
      />
      </div>
    </>
  )
}
