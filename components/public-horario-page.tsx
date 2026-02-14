"use client"

import { useMemo, useState, useEffect } from "react"
import { addDays, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScheduleGrid } from "@/components/schedule-grid"
import { PwaTodayScheduleCard } from "@/components/pwa-today-schedule-card"
import { usePublicHorario } from "@/hooks/use-public-horario"
import { useConfig } from "@/hooks/use-config"
import { useToast } from "@/hooks/use-toast"
import type { Empleado, Horario, Turno, ShiftAssignment } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"

interface PublicHorarioPageProps {
  companySlug: string
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
    name: employeeId,
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

export default function PublicHorarioPage({ companySlug }: PublicHorarioPageProps) {
  const { horario, isLoading, error } = usePublicHorario(companySlug)
  const { config } = useConfig()
  const [showIndividualView, setShowIndividualView] = useState(false)
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false)
  const [currentViewer, setCurrentViewer] = useState<{employeeId: string, employeeName: string} | null>(null)
  const { toast } = useToast()

  // Detectar vista móvil
  const [isMobile, setIsMobile] = useState(false)
  const [showFullImage, setShowFullImage] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Cargar identificación del localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedViewer = localStorage.getItem('horario.viewer')
        if (savedViewer) {
          const viewer = JSON.parse(savedViewer)
          setCurrentViewer(viewer)
        } else {
          // No hay identificación guardada, mostrar selector
          setShowEmployeeSelector(true)
        }
      } catch (error) {
        console.error('Error al cargar identificación:', error)
        setShowEmployeeSelector(true)
      }
    }
  }, [])

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

  // Estado de carga unificado - SOLO depende de isLoading
  const isDataLoading = isLoading

  const employees = useMemo(() => {
    // MODELO A: Usar empleados de la semana publicada si existen, sino fallback
    const currentWeek = horario?.weeks?.[horario.publishedWeekId]
    
    console.log("🔧 [PublicHorarioPage] Debug employees:", {
      hasHorario: !!horario,
      publishedWeekId: horario?.publishedWeekId,
      currentWeek: currentWeek,
      currentWeekEmployees: currentWeek?.employees,
      hasEmployees: !!(currentWeek?.employees),
      employeesLength: currentWeek?.employees?.length
    })
    
    if (currentWeek?.employees && currentWeek.employees.length > 0) {
      console.log("🔧 [PublicHorarioPage] Using published employees:", currentWeek.employees)
      return currentWeek.employees
    }
    
    // Fallback: construir empleados desde assignments si no hay empleados guardados
    console.log("🔧 [PublicHorarioPage] Building fallback employees from assignments")
    const allEmployeeIds = new Set<string>()
    
    if (currentWeek?.days) {
      Object.values(currentWeek.days).forEach((dayData: any) => {
        if (dayData && typeof dayData === 'object') {
          Object.keys(dayData).forEach(employeeId => {
            allEmployeeIds.add(employeeId)
          })
        }
      })
    }
    
    const builtEmployees = Array.from(allEmployeeIds).map(id => ({
      id,
      name: id, // Fallback: usar ID como nombre
    }))
    
    console.log("🔧 [PublicHorarioPage] Built fallback employees:", builtEmployees)
    return builtEmployees
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
    employees.forEach((employee: any) => {
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

  // Toggle vista individual
  const handleToggleIndividualView = () => {
    setShowIndividualView(!showIndividualView)
  }

  // Manejar selección de empleado
  const handleSelectEmployee = (employeeId: string, employeeName: string) => {
    const viewer = { employeeId, employeeName }
    setCurrentViewer(viewer)
    setShowEmployeeSelector(false)
    
    // Guardar en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('horario.viewer', JSON.stringify(viewer))
    }
    
    toast({
      title: "Identificación guardada",
      description: `Hola, ${employeeName}`,
    })
  }

  // Cambiar persona
  const handleChangePerson = () => {
    setCurrentViewer(null)
    setShowEmployeeSelector(true)
    
    // Limpiar localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('horario.viewer')
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
      weekStartDate: weekStartDate?.toISOString(),
      config: config,
      hasNombreEmpresa: !!config?.nombreEmpresa,
      nombreEmpresa: config?.nombreEmpresa
    })
  }, [horario, schedule, weekStartDate, weekDays, config])

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
    }
  }, [error, toast])

  if (isDataLoading) {
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

  // Si no hay datos, mostrar mensaje simple
  if (!horario || !schedule || !weekStartDate || !horario.publishedWeekId) {
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
    hasHorario: !!horario,
    hasSchedule: !!schedule,
    hasWeekStartDate: !!weekStartDate,
    scheduleId: schedule?.id,
    scheduleName: schedule?.nombre,
    weekDaysCount: weekDays.length,
    employeesCount: employees.length,
    shiftsCount: shifts.length
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header Horario Semanal (mobile-first) */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-3">
          {/* Fila 1: HORARIO — nombre — fecha */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground shrink-0">
                HORARIO
              </span>
              <span className="text-sm font-medium truncate">
                {currentViewer?.employeeName ?? "—"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {format(weekStartDate, "dd/MM")} – {format(addDays(weekStartDate, 6), "dd/MM")}
              <span className="hidden sm:inline"> {format(weekStartDate, "yyyy")}</span>
            </span>
          </div>
          {/* Fila 2: SEMANAL + acciones */}
          <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              SEMANAL
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleIndividualView}
              >
                Vista individual
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangePerson}
              >
                Cambiar persona
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendario como foco principal - mostrar imagen si existe, sino ScheduleGrid */}
      <div className="w-full px-2 py-6">
        {(() => {
          const currentWeek = horario.weeks?.[horario.publishedWeekId]
          const hasImage = currentWeek?.publicImageUrl
          
          console.log("🔧 [PublicHorarioPage] Rendering calendar content:", {
            hasCurrentWeek: !!currentWeek,
            hasImage: !!hasImage,
            imageUrlLength: currentWeek?.publicImageUrl?.length || 0,
            weekDaysCount: weekDays.length,
            employeesCount: employees.length,
            shiftsCount: shifts.length,
            showIndividualView: showIndividualView
          })
          
          // MODELO A: Solo usar publishedWeekId
          if (showIndividualView || !hasImage || !currentWeek.publicImageUrl) {
            // Vista individual o fallback: Mostrar ScheduleGrid readonly
            console.log("🔧 [PublicHorarioPage] Rendering ScheduleGrid individual view")
            return (
              <div className="w-full overflow-x-auto overflow-y-auto bg-white border rounded-lg p-4 sm:p-6"
                   style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
                <div className="text-center text-gray-500 mb-4">
                  <p className="text-sm font-medium">
                    {showIndividualView ? "Vista individual del horario" : "Horario publicado"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {showIndividualView ? "Grilla interactiva de solo lectura" : "Mostrando vista de grilla"}
                  </p>
                </div>
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
              </div>
            )
          }
          
          // Vista por defecto: Imagen publicada
          console.log("🔧 [PublicHorarioPage] Rendering published image")
          return (
            <div className="w-full overflow-x-auto overflow-y-auto bg-white border rounded-lg p-4 sm:p-6"
                 style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
              
              <img 
                src={currentWeek.publicImageUrl} 
                alt={`Horario ${currentWeek.weekLabel || 'semanal'}`}
                style={{ 
                  width: '100%', 
                  maxWidth: '100%', 
                  height: 'auto', 
                  display: 'block',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  touchAction: 'pan-x pan-y pinch-zoom'
                }}
                onError={(e) => {
                  console.error("🔧 [PublicHorarioPage] Image load error:", e)
                  // Si falla la carga, mostrar ScheduleGrid como fallback
                  console.log("🔧 [PublicHorarioPage] Image failed, using ScheduleGrid fallback")
                }}
              />
            </div>
          )
        })()}
      </div>

      {/* Banner "HORARIO DE HOY" - solo si hay empleado identificado */}
      {currentViewer && (
        <div className="w-full px-2 py-4">
          <PwaTodayScheduleCard companySlug={companySlug} horario={horario} shifts={shifts} />
        </div>
      )}

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

      {/* Modal de selección de empleado */}
      {showEmployeeSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">¿Quién sos?</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEmployeeSelector(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {employees.map((employee: any) => (
                  <Button
                    key={employee.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleSelectEmployee(employee.id, employee.name)}
                  >
                    {employee.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
