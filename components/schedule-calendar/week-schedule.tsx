"use client"

import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ScheduleGrid, type EmployeeMonthlyStats } from "@/components/schedule-grid"
import { Empleado, Turno, Horario, MedioTurno } from "@/lib/types"

interface WeekScheduleProps {
  weekDays: Date[]
  weekIndex: number
  weekSchedule: Horario | null
  employees: Empleado[]
  shifts: Turno[]
  monthRange: { startDate: Date; endDate: Date }
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: any[]) => void
  onExportImage: (weekStartDate: Date, weekEndDate: Date) => void
  onExportPDF: (weekStartDate: Date, weekEndDate: Date) => void
  onExportExcel?: () => void
  exporting: boolean
  mediosTurnos?: MedioTurno[]
  employeeStats?: Record<string, EmployeeMonthlyStats>
  readonly?: boolean
}

export function WeekSchedule({
  weekDays,
  weekIndex,
  weekSchedule,
  employees,
  shifts,
  monthRange,
  onAssignmentUpdate,
  onExportImage,
  onExportPDF,
  onExportExcel,
  exporting,
  mediosTurnos,
  employeeStats,
  readonly = false,
}: WeekScheduleProps) {
  const weekStartDate = weekDays[0]
  const weekEndDate = weekDays[weekDays.length - 1]
  const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`

  return (
    <div key={weekIndex} id={weekId} className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold text-foreground">
          Semana del {format(weekDays[0], "d", { locale: es })} -{" "}
          {format(weekDays[weekDays.length - 1], "d 'de' MMMM", { locale: es })}
        </h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onExportImage(weekStartDate, weekEndDate)} 
            disabled={exporting}
            aria-label="Exportar semana como imagen"
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Imagen
              </>
            )}
          </Button>
          {onExportExcel && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onExportExcel} 
              disabled={exporting}
              aria-label="Exportar semana como Excel"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </>
              )}
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onExportPDF(weekStartDate, weekEndDate)} 
            disabled={exporting}
            aria-label="Exportar semana como PDF"
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </>
            )}
          </Button>
        </div>
      </div>
      <ScheduleGrid
        weekDays={weekDays}
        employees={employees}
        shifts={shifts}
        schedule={weekSchedule}
        onAssignmentUpdate={onAssignmentUpdate}
        monthRange={monthRange}
        mediosTurnos={mediosTurnos}
        employeeStats={employeeStats}
        readonly={readonly}
      />
    </div>
  )
}

