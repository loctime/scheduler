"use client"

import { useState, useEffect, useCallback } from "react"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, subMonths, addMonths } from "date-fns"
import { useData } from "@/contexts/data-context"
import { Horario } from "@/lib/types"
import { useConfig } from "@/hooks/use-config"
import { getCustomMonthRange, getMonthWeeks } from "@/lib/utils"
import { useExportSchedule } from "@/hooks/use-export-schedule"
import { useScheduleUpdates } from "@/hooks/use-schedule-updates"
import { MonthHeader } from "@/components/schedule-calendar/month-header"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"

interface ScheduleCalendarProps {
  user: any
}

export function ScheduleCalendar({ user }: ScheduleCalendarProps) {
  const [schedules, setSchedules] = useState<Horario[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const { employees, shifts, loading: dataLoading } = useData()
  const { config } = useConfig()
  const { toast } = useToast()
  const { exporting, exportImage, exportPDF, exportExcel } = useExportSchedule()

  // Calcular rango del mes basado en mesInicioDia
  const monthStartDay = config?.mesInicioDia || 1
  const weekStartsOn = (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6

  // Calcular rango y semanas del mes
  const monthRange = getCustomMonthRange(currentMonth, monthStartDay)
  const monthWeeks = getMonthWeeks(currentMonth, monthStartDay, weekStartsOn)

  // Función helper para obtener el horario de una semana específica
  const getWeekSchedule = useCallback((weekStartDate: Date) => {
    const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
    return schedules.find((s) => s.weekStart === weekStartStr) || null
  }, [schedules])

  // Hook para manejar actualizaciones
  const { handleAssignmentUpdate } = useScheduleUpdates({
    user,
    employees,
    shifts,
    schedules,
    weekStartsOn,
    getWeekSchedule,
  })

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <MonthHeader
        monthRange={monthRange}
        onPreviousMonth={() => setCurrentMonth(subMonths(currentMonth, 1))}
        onNextMonth={() => setCurrentMonth(addMonths(currentMonth, 1))}
        onExportImage={handleExportMonthImage}
        onExportPDF={handleExportMonthPDF}
        exporting={exporting}
      />

      {/* Schedule Grid */}
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
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
