"use client"

import { useState, useEffect, useMemo } from "react"
import { format, addDays, parseISO } from "date-fns"
import { Calendar, Check, Copy, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScheduleGrid } from "@/components/schedule-grid"
import { SimplifiedScheduleView } from "@/components/simplified-schedule-view"
import { WeekNavigation } from "@/components/week-navigation"
import { useWeekNavigation } from "@/hooks/useWeekNavigation"
import { useToast } from "@/hooks/use-toast"
import type { Empleado, Horario, Turno, ShiftAssignment } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"

interface PublicSchedulesPageProps {
  ownerId: string
}

// Funciones helper (reutilizadas del componente original)
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
    nombre: `Empleado ${employeeId}`,
    name: `Empleado ${employeeId}`,
    userId: ownerId,
  })) as unknown as Empleado[]
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
            if (assignment && typeof assignment === 'object' && 'turnoId' in assignment) {
              shiftIds.add((assignment as any).turnoId)
            }
          })
        })
      }
    })
  }

  return Array.from(shiftIds).map((shiftId) => ({
    id: shiftId,
    nombre: shiftId,
    name: shiftId,
    color: "#6B7280",
    userId: ownerId,
  })) as unknown as Turno[]
}

export function PublicSchedulesPage({ ownerId }: PublicSchedulesPageProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [weekData, setWeekData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Hook de navegación de semanas
  const {
    selectedWeek,
    weekType,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    weekLabel,
    canGoToPrevious,
    canGoToNext,
  } = useWeekNavigation()

  // Cargar datos de la semana seleccionada
  useEffect(() => {
    const loadWeekData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const weekStartDate = selectedWeek.toISOString().split('T')[0]
        // Aquí deberías cargar los datos de la semana desde tu backend
        // Por ahora, simulo datos
        
        // Simulación - reemplazar con llamada real a tu API
        const response = await fetch(`/api/schedules/${ownerId}?week=${weekStartDate}`)
        if (!response.ok) {
          throw new Error('No se pudieron cargar los datos')
        }
        
        const data = await response.json()
        setWeekData(data)
      } catch (err) {
        console.error('Error cargando datos de la semana:', err)
        setError('No se pudieron cargar los datos del horario')
      } finally {
        setLoading(false)
      }
    }

    loadWeekData()
  }, [selectedWeek, ownerId])

  const handleCopyUrl = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast({
      title: "Enlace copiado",
      description: "El enlace del horario ha sido copiado al portapapeles",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  // Generar días de la semana
  const weekDays = weekData ? Array.from({ length: 7 }, (_, i) => {
    return addDays(selectedWeek, i)
  }) : []

  // Construir datos para los componentes
  const employees = weekData?.employees || buildFallbackEmployees(ownerId, weekData?.days)
  const shifts = weekData?.shifts || buildShiftsFromAssignments(ownerId, weekData?.days)
  
  // Transformar assignments al formato esperado
  const transformedAssignments = useMemo(() => {
    if (!weekData?.days) return {}
    
    const assignments: { [date: string]: { [empleadoId: string]: ShiftAssignment[] | string[] } } = {}
    
    Object.entries(weekData.days).forEach(([date, dayAssignments]) => {
      if (!Array.isArray(dayAssignments)) {
        assignments[date] = dayAssignments as { [empleadoId: string]: ShiftAssignment[] | string[] }
      }
    })
    
    return assignments
  }, [weekData?.days])

  // Crear employeeStats vacío para mantener layout
  const employeeStats = useMemo(() => {
    const stats: { [employeeId: string]: EmployeeMonthlyStats } = {}
    employees.forEach((emp: Empleado) => {
      stats[emp.id] = {
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
  }, [employees])

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-8 w-full mb-4" />
          <Card>
            <CardContent className="pt-6">
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

  if (error || !weekData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-gray-500 mb-4">
              <Calendar className="h-12 w-12 mx-auto" />
            </div>
            <h1 className="text-lg font-semibold mb-2">No hay horario disponible</h1>
            <p className="text-gray-600 text-sm mb-4">
              {error || 'No hay datos disponibles para esta semana.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Calendar className="h-6 w-6" />
              Horarios Semanales
            </h1>
            <div className="mt-1 text-sm text-gray-500">
              Navegación de horarios públicos
            </div>
          </div>
          <div className="flex items-center gap-3">
            {weekData.isPublished && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Publicado
              </Badge>
            )}
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

      {/* Navegación de semanas */}
      <div className="w-full px-6 py-6">
        <WeekNavigation
          weekLabel={weekLabel}
          weekType={weekType}
          canGoToPrevious={canGoToPrevious}
          canGoToNext={canGoToNext}
          onPreviousWeek={goToPreviousWeek}
          onNextWeek={goToNextWeek}
          onCurrentWeek={goToCurrentWeek}
          isCurrentWeek={weekType === "current"}
        />
      </div>

      {/* Contenido principal */}
      <div className="w-full px-6 pb-6">
        {weekData.publicImageUrl && (weekType === "past" || weekType === "current") ? (
          // Mostrar imagen publicada para semanas pasadas y actual
          <div className="w-full overflow-x-auto">
            <img
              src={weekData.publicImageUrl}
              alt={`Horario ${weekLabel}`}
              className="w-full h-auto"
              style={{ maxWidth: '100%' }}
            />
          </div>
        ) : weekType === "future" ? (
          // Vista simplificada para semanas futuras
          <SimplifiedScheduleView
            weekStartDate={selectedWeek.toISOString().split('T')[0]}
            employees={employees}
            assignments={transformedAssignments}
          />
        ) : (
          // Mensaje para semanas pasadas sin imagen publicada
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Horario no publicado</h3>
              <p className="text-gray-600">
                Este horario no ha sido publicado aún.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
