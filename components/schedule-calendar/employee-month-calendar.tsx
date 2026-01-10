"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown } from "lucide-react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import type { Empleado, Turno, Horario, MedioTurno, ShiftAssignmentValue } from "@/lib/types"
import { cn } from "@/lib/utils"

interface EmployeeMonthCalendarProps {
  selectedEmployeeId: string
  selectedEmployeeName?: string
  monthRange: { startDate: Date; endDate: Date }
  employees: Empleado[]
  shifts: Turno[]
  mediosTurnos?: MedioTurno[]
  getWeekSchedule: (weekStartDate: Date) => Horario | null
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

const normalizeAssignments = (value: ShiftAssignmentValue | null | undefined): Array<{ shiftId?: string; type?: string; texto?: string }> => {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  if (typeof value[0] === "string") {
    return (value as string[]).map((shiftId) => ({ shiftId, type: "shift" }))
  }
  return (value as Array<{ shiftId?: string; type?: string; texto?: string }>).map((assignment) => ({
    ...assignment,
    type: assignment.type || "shift",
  }))
}

export function EmployeeMonthCalendar({
  selectedEmployeeId,
  selectedEmployeeName,
  monthRange,
  employees,
  shifts,
  mediosTurnos = [],
  getWeekSchedule,
  weekStartsOn,
}: EmployeeMonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(monthRange.startDate))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Obtener el primer y último día del mes actual
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  
  // Obtener el inicio y fin de la semana que contiene el inicio del mes
  const calendarStart = startOfWeek(monthStart, { weekStartsOn })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn })
  
  // Generar todos los días del calendario
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Función para obtener las asignaciones de un día específico
  const getDateAssignments = (date: Date) => {
    const weekStartDate = startOfWeek(date, { weekStartsOn })
    const weekSchedule = getWeekSchedule(weekStartDate)
    if (!weekSchedule?.assignments) return null
    const dateStr = format(date, "yyyy-MM-dd")
    return weekSchedule.assignments[dateStr]?.[selectedEmployeeId] || null
  }

  // Función para obtener el nombre del turno
  const getShiftName = (shiftId: string) => {
    return shifts.find((s) => s.id === shiftId)?.name || shiftId
  }

  // Función para obtener el color del turno
  const getShiftColor = (shiftId: string) => {
    return shifts.find((s) => s.id === shiftId)?.color || "#6b7280"
  }

  // Organizar días en semanas
  const weeks = useMemo(() => {
    const weeksArray: Date[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeksArray.push(calendarDays.slice(i, i + 7))
    }
    return weeksArray
  }, [calendarDays])

  // Nombres de los días de la semana abreviados
  const weekDayNames = useMemo(() => {
    const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
    const startIndex = weekStartsOn
    const reordered = [...days.slice(startIndex), ...days.slice(0, startIndex)]
    return reordered.map((day) => day.substring(0, 2).toUpperCase())
  }, [weekStartsOn])

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: es })

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleCurrentMonth = () => {
    setCurrentMonth(startOfMonth(new Date()))
  }

  return (
    <Card className="p-4 md:p-6">
      <div className="space-y-4">
        {/* Encabezado del calendario. */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold capitalize flex items-center gap-2">
            {monthLabel}
            <div className="flex flex-col gap-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-5 w-5 p-0"
                aria-label="Mes siguiente"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePreviousMonth}
                className="h-5 w-5 p-0"
                aria-label="Mes anterior"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </h2>
          <Button variant="outline" size="sm" onClick={handleCurrentMonth}>
            Mes actual
          </Button>
        </div>

        {/* Grid del calendario */}
        <div className="space-y-2">
          {/* Encabezado de días de la semana */}
          <div className="grid grid-cols-7 gap-1">
            {weekDayNames.map((dayName, index) => (
              <div
                key={index}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Días del calendario */}
          <div className="space-y-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-1">
                {week.map((day, dayIndex) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isToday = isSameDay(day, new Date())
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const assignments = getDateAssignments(day)
                  const normalizedAssignments = normalizeAssignments(assignments)

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "relative min-h-[80px] p-2 rounded-md border-2 border-gray-300 dark:border-gray-600 transition-colors text-left",
                        "hover:bg-accent/50 hover:border-gray-400 dark:hover:border-gray-500",
                        !isCurrentMonth && "opacity-40 text-muted-foreground bg-muted/30",
                        isToday && !isSelected && "border-primary border-2",
                        isSelected && "bg-primary/10 border-primary border-2"
                      )}
                    >
                      {/* Número del día */}
                      <div
                        className={cn(
                          "text-sm font-medium mb-1 inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors",
                          !isCurrentMonth && "text-muted-foreground",
                          isToday && !isSelected && "text-primary font-semibold",
                          isSelected && "bg-primary text-primary-foreground font-bold shadow-sm"
                        )}
                      >
                        {format(day, "d")}
                      </div>

                      {/* Asignaciones de turnos */}
                      <div className="space-y-0.5 mt-1">
                        {normalizedAssignments.slice(0, 2).map((assignment, idx) => {
                          if (assignment.type === "nota") {
                            return (
                              <div
                                key={idx}
                                className="text-[10px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground text-center truncate italic"
                              >
                                {assignment.texto || "Nota"}
                              </div>
                            )
                          }
                          if (assignment.type === "franco") {
                            return (
                              <div
                                key={idx}
                                className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground text-center truncate"
                              >
                                Franco
                              </div>
                            )
                          }
                          if (assignment.type === "medio_franco") {
                            return (
                              <div
                                key={idx}
                                className="text-[10px] px-1 py-0.5 rounded bg-green-100 dark:bg-green-900 text-center truncate"
                              >
                                1/2
                              </div>
                            )
                          }
                          if (assignment.shiftId) {
                            const shift = shifts.find((s) => s.id === assignment.shiftId)
                            return (
                              <div
                                key={idx}
                                className="text-[10px] px-1 py-0.5 rounded text-center truncate font-medium"
                                style={{
                                  backgroundColor: shift?.color
                                    ? `${shift.color}30`
                                    : undefined,
                                  color: shift?.color || undefined,
                                }}
                              >
                                {shift?.name || assignment.shiftId}
                              </div>
                            )
                          }
                          return null
                        })}
                        {normalizedAssignments.length > 2 && (
                          <div className="text-[10px] text-muted-foreground text-center">
                            +{normalizedAssignments.length - 2}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

