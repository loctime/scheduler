"use client"

import { useMemo, useState, useEffect } from "react"
import { addDays, format, parseISO } from "date-fns"
import { Calendar, Check, Copy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScheduleGrid } from "@/components/schedule-grid"
import { usePublicHorario } from "@/hooks/use-public-horario"
import { useToast } from "@/hooks/use-toast"
import type { Empleado, Horario, Turno, ShiftAssignment } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"

interface PublicHorarioPageProps {
  scheduleId: string
}

const buildFallbackEmployees = (ownerId: string, days?: Record<string, any>) => {
  const employeeIds = new Set<string>()
  if (days) {
    Object.values(days).forEach((dayAssignments) => {
      if (dayAssignments && typeof dayAssignments === "object") {
        Object.keys(dayAssignments as Record<string, unknown>).forEach((employeeId) => {
          employeeIds.add(employeeId)
        })
      }
    })
  }

  return Array.from(employeeIds).map((employeeId) => ({
    id: employeeId,
    name: `Empleado ${employeeId}`,
    userId: ownerId,
  })) as Empleado[]
}

const buildShiftsFromAssignments = (ownerId: string, days?: Record<string, any>) => {
  const shiftIds = new Set<string>()
  if (days) {
    Object.values(days).forEach((dayAssignments) => {
      if (dayAssignments && typeof dayAssignments === "object") {
        Object.values(dayAssignments as Record<string, any>).forEach((assignments) => {
          if (!Array.isArray(assignments)) return
          assignments.forEach((assignment) => {
            if (typeof assignment === "string") {
              shiftIds.add(assignment)
              return
            }
            if (assignment && typeof assignment === "object" && "shiftId" in assignment && assignment.shiftId) {
              shiftIds.add(assignment.shiftId)
            }
          })
        })
      }
    })
  }

  return Array.from(shiftIds).map((shiftId) => ({
    id: shiftId,
    name: `Turno ${shiftId}`,
    color: "#9ca3af",
    userId: ownerId,
  })) as Turno[]
}

const getWeekStartDate = (weekId?: string, days?: Record<string, any>) => {
  if (weekId?.startsWith("schedule-week-")) {
    const dateStr = weekId.replace("schedule-week-", "")
    const parsed = parseISO(dateStr)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  const dayKeys = Object.keys(days || {}).sort()
  if (dayKeys.length > 0) {
    const parsed = parseISO(dayKeys[0])
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return null
}

export default function PublicHorarioPage({ scheduleId }: PublicHorarioPageProps) {
  const { horario, isLoading, error } = usePublicHorario(scheduleId)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const weekStartDate = useMemo(
    () => {
      if (!horario) return null
      
      // Obtener la semana publicada actual
      const currentWeek = horario.weeks?.[horario.publishedWeekId]
      if (currentWeek) {
        return getWeekStartDate(currentWeek.weekId, currentWeek.days)
      }
      
      // Fallback a estructura antigua - no hay weekId directo en PublicHorarioData
      return null
    },
    [horario],
  )

  const weekDays = useMemo(() => {
    if (!weekStartDate) return []
    return Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i))
  }, [weekStartDate])

  const schedule = useMemo(() => {
    if (!horario || !weekStartDate) return null
    const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
    const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")

    // Obtener datos de la semana actual desde la nueva estructura
    const currentWeek = horario.weeks?.[horario.publishedWeekId]
    const days = currentWeek?.days

    // Transform horario.days to match Horario.assignments structure
    const transformedAssignments: { [date: string]: { [empleadoId: string]: ShiftAssignment[] | string[] } } = {}
    
    if (days) {
      Object.entries(days).forEach(([date, dayAssignments]) => {
        if (dayAssignments && typeof dayAssignments === 'object' && !Array.isArray(dayAssignments)) {
          // If it's already in the correct format (nested object)
          transformedAssignments[date] = dayAssignments as { [empleadoId: string]: ShiftAssignment[] | string[] }
        }
      })
    }

    return {
      id: currentWeek?.weekId || horario.publishedWeekId,
      nombre: currentWeek?.weekLabel || `Semana ${weekStartStr}`,
      weekStart: weekStartStr,
      semanaInicio: weekStartStr,
      semanaFin: weekEndStr,
      assignments: transformedAssignments,
    } as Horario
  }, [horario, weekStartDate])

  const employees = useMemo(() => {
    if (!horario) return []
    
    // Obtener datos de la semana actual desde la nueva estructura
    const currentWeek = horario.weeks?.[horario.publishedWeekId]
    const employeesData = currentWeek?.employees
    
    if (employeesData?.length) {
      return employeesData.map((employee: any, index: number) => ({
        id: employee.id || employee.uid || `employee-${index}`,
        name: employee.name || employee.nombre || `Empleado ${index + 1}`,
        email: employee.email,
        phone: employee.phone,
        userId: employee.userId || horario.ownerId,
      })) as Empleado[]
    }
    return buildFallbackEmployees(horario.ownerId, currentWeek?.days)
  }, [horario])

  const shifts = useMemo(() => {
    if (!horario) return []
    
    // Obtener datos de la semana actual desde la nueva estructura
    const currentWeek = horario.weeks?.[horario.publishedWeekId]
    return buildShiftsFromAssignments(horario.ownerId, currentWeek?.days)
  }, [horario])

  // Crear employeeStats vacío pero con estructura correcta para activar layout completo
  const employeeStats = useMemo(() => {
    if (!horario) return {}
    
    const stats: Record<string, EmployeeMonthlyStats> = {}
    employees.forEach((employee) => {
      stats[employee.id] = {
        francos: 0,
        francosSemana: 0,
        horasExtrasSemana: 0,
        horasExtrasMes: 0,
        horasComputablesMes: 0,
        horasSemana: 0,
        horasLicenciaEmbarazo: 0,
        horasMedioFranco: 0,
      }
    })
    return stats
  }, [horario, employees])

  const ownerUser = useMemo(() => {
    if (!horario?.ownerId) return null
    return { uid: horario.ownerId }
  }, [horario?.ownerId])

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      toast({
        title: "Enlace copiado",
        description: "El enlace del horario ha sido copiado al portapapeles",
      })
    } catch (copyError) {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    console.log("🔧 [PublicHorarioPage] Debug state:", {
      hasHorario: !!horario,
      hasSchedule: !!schedule,
      hasWeekStartDate: !!weekStartDate,
      horarioKeys: horario ? Object.keys(horario) : null,
      publishedWeekId: horario?.publishedWeekId,
      currentWeek: horario ? horario.weeks?.[horario.publishedWeekId] : null,
      weekDays: weekDays,
      weekStartDate: weekStartDate?.toISOString()
    })
  }, [horario, schedule, weekStartDate, weekDays])

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
    }
  }, [error, toast])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-6xl space-y-4">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-24" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!horario || !schedule || !weekStartDate) {
    console.log("🔧 [PublicHorarioPage] Rendering 'No hay horario' message", {
      hasHorario: !!horario,
      hasSchedule: !!schedule,
      hasWeekStartDate: !!weekStartDate
    })
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-gray-500 mb-4">
              <Calendar className="h-12 w-12 mx-auto" />
            </div>
            <h1 className="text-lg font-semibold mb-2">No hay horario publicado</h1>
            <p className="text-gray-600 text-sm mb-4">
              No hay ningún horario publicado para este identificador.
            </p>
            <p className="text-gray-500 text-xs">
              El administrador debe publicar un horario desde el dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  console.log("🔧 [PublicHorarioPage] Rendering main content", {
    scheduleId: schedule.id,
    scheduleName: schedule.nombre,
    weekDaysCount: weekDays.length,
    employeesCount: employees.length,
    shiftsCount: shifts.length
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header único unificado */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Calendar className="h-6 w-6" />
              Horario Semanal
            </h1>
            <div className="mt-1 flex items-center gap-4">
              <div className="font-semibold text-gray-900">
                {(() => {
                  const currentWeek = horario.weeks?.[horario.publishedWeekId]
                  return currentWeek?.weekLabel || 'Semana sin etiqueta'
                })()}
              </div>
              <div className="text-sm text-gray-500">
                {format(weekStartDate, "dd/MM/yyyy")} – {format(addDays(weekStartDate, 6), "dd/MM/yyyy")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Publicado
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUrl}
              className="flex items-center gap-2"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar enlace"}
            </Button>
          </div>
        </div>
      </div>

      {/* Calendario como foco principal - mostrar imagen si existe, sino ScheduleGrid */}
      <div className="w-full px-2 py-6">
        {(() => {
          const currentWeek = horario.weeks?.[horario.publishedWeekId]
          const hasImage = currentWeek?.publicImageUrl
          
          if (hasImage && currentWeek.publicImageUrl) {
            // Mostrar imagen publicada con scroll controlado
            return (
              <div className="w-full overflow-x-auto">
                <img 
                  src={currentWeek.publicImageUrl} 
                  alt={`Horario ${currentWeek.weekLabel || 'semanal'}`}
                  style={{ 
                    width: '100%', 
                    maxWidth: '100%', 
                    height: 'auto', 
                    display: 'block' 
                  }}
                />
              </div>
            )
          }
          
          // Fallback a ScheduleGrid si no hay imagen
          return weekDays.length > 0 ? (
            <ScheduleGrid
              weekDays={weekDays}
              employees={employees}
              allEmployees={employees}
              shifts={shifts}
              schedule={schedule}
              monthRange={undefined}
              mediosTurnos={[]}
              employeeStats={employeeStats}
              readonly={true}
              allSchedules={[]}
              isScheduleCompleted={false}
              lastCompletedWeekStart={undefined}
              onClearEmployeeRow={undefined}
              user={ownerUser}
              onExportEmployeeImage={undefined}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay asignaciones para esta semana</p>
            </div>
          )
        })()}
      </div>

      {/* Footer discreto */}
      <div className="border-t bg-gray-50">
        <div className="w-full px-2 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              Publicado:{" "}
              {(() => {
                const currentWeek = horario.weeks?.[horario.publishedWeekId]
                const publishedAt = currentWeek?.publishedAt
                return publishedAt ? new Date(publishedAt.toDate()).toLocaleDateString("es-AR") : "Desconocido"
              })()}
            </div>
            <div>Este horario es de solo lectura</div>
          </div>
        </div>
      </div>
    </div>
  )
}
