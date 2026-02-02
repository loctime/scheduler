"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"

interface SimplifiedScheduleViewProps {
  weekStartDate: string
  employees: any[]
  assignments: any
}

export function SimplifiedScheduleView({ 
  weekStartDate, 
  employees, 
  assignments 
}: SimplifiedScheduleViewProps) {
  // Generar días de la semana
  const weekDays = useMemo(() => {
    const start = new Date(weekStartDate)
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      return day
    })
  }, [weekStartDate])

  const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

  return (
    <div className="space-y-4">
      {/* Badge de horario preliminar */}
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
          Horario preliminar
        </Badge>
        <span className="text-sm text-amber-700">
          Sujeto a cambios
        </span>
      </div>

      {/* Lista por empleado */}
      <div className="space-y-3">
        {employees.map((employee) => (
          <Card key={employee.id} className="p-4">
            <div className="font-medium text-sm mb-2">{employee.nombre}</div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {weekDays.map((day, index) => {
                const dateStr = day.toISOString().split('T')[0]
                const employeeAssignments = assignments?.[dateStr]?.[employee.id] || []
                
                return (
                  <div key={index} className="text-center">
                    <div className="font-medium text-gray-500 mb-1">
                      {dayNames[index].substring(0, 3)}
                    </div>
                    <div className="min-h-[40px] p-1 bg-gray-50 rounded border">
                      {employeeAssignments.length > 0 ? (
                        <div className="text-xs">
                          {employeeAssignments.map((assignment: any, idx: number) => (
                            <div key={idx} className="truncate">
                              {assignment.turno?.nombre || assignment}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400">—</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

import { useMemo } from "react"
