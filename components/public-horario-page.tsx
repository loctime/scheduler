"use client"

import { useMemo, useState, useEffect } from "react"
import { addDays, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar, Check, Copy, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScheduleGrid } from "@/components/schedule-grid"
import { usePublicHorario } from "@/hooks/use-public-horario"
import { useConfig } from "@/hooks/use-config"
import { useToast } from "@/hooks/use-toast"
import type { Empleado, Horario, Turno, ShiftAssignment } from "@/lib/types"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"

// Importar getMainMonth desde month-header
function getMainMonth(startDate: Date, endDate: Date): Date {
  const monthDays: Map<string, number> = new Map()
  
  let currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const monthKey = format(currentDate, "yyyy-MM")
    monthDays.set(monthKey, (monthDays.get(monthKey) || 0) + 1)
    currentDate = addDays(currentDate, 1)
  }
  
  let maxDays = 0
  let mainMonthKey = ""
  
  monthDays.forEach((days, monthKey) => {
    if (days > maxDays) {
      maxDays = days
      mainMonthKey = monthKey
    }
  })
  
  return parseISO(mainMonthKey + "-01")
}

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

export default function PublicHorarioPage({ scheduleId }: PublicHorarioPageProps) {
  const { horario, isLoading, error } = usePublicHorario(scheduleId)
  const { config } = useConfig()
  const [copied, setCopied] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallButton, setShowInstallButton] = useState(false)
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

  // PWA: Registrar service worker y manejar instalación
  useEffect(() => {
    // Limpiar cualquier manifest existente
    const existingManifest = document.querySelector('link[rel="manifest"]')
    if (existingManifest) {
      existingManifest.remove()
    }
    
    // Agregar manifest exclusivo para horario
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = '/manifest-horario.json'
    document.head.appendChild(link)

    // Registrar service worker exclusivo para horario
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-horario.js', { scope: '/horario/' })
        .then((registration) => {
          console.log('SW Horario registrado:', registration)
        })
        .catch((error) => {
          console.error('Error al registrar SW Horario:', error)
        })
    }

    // Manejar beforeinstallprompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallButton(true)
      console.log('beforeinstallprompt capturado para horario')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      // Limpiar manifest
      const manifestLink = document.querySelector('link[rel="manifest"][href="/manifest-horario.json"]')
      if (manifestLink) {
        document.head.removeChild(manifestLink)
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

  // Calcular el mes principal usando getMainMonth
  const mainMonth = useMemo(() => {
    if (!weekStartDate) return null
    const weekEndDate = addDays(weekStartDate, 6)
    return getMainMonth(weekStartDate, weekEndDate)
  }, [weekStartDate])

  const monthLabel = useMemo(() => {
    if (!mainMonth) return ""
    return format(mainMonth, "MMMM", { locale: es }).toUpperCase()
  }, [mainMonth])

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

  // PWA: Manejar instalación
  const handleInstallApp = async () => {
    if (!deferredPrompt) return

    try {
      console.log('Iniciando instalación PWA horario...')
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      console.log('Resultado instalación:', outcome)
      
      if (outcome === 'accepted') {
        toast({
          title: "Horario instalado",
          description: "La app del horario se ha instalado correctamente",
        })
      } else {
        toast({
          title: "Instalación cancelada",
          description: "La instalación fue cancelada",
        })
      }
      
      setDeferredPrompt(null)
      setShowInstallButton(false)
    } catch (error) {
      console.error('Error en instalación:', error)
      toast({
        title: "Error",
        description: "No se pudo instalar la app del horario",
        variant: "destructive",
      })
    }
  }

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
      {/* Header único unificado */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex-1">
            {/* Nombre de la empresa */}
            {config?.nombreEmpresa && (
              <div className="text-sm font-semibold text-gray-700 mb-2 sm:mb-1">
                {config.nombreEmpresa}
              </div>
            )}
            
            {/* Saludo personalizado */}
            {currentViewer && (
              <div className="text-sm text-gray-600 mb-1">
                Hola, <span className="font-medium">{currentViewer.employeeName}</span>
              </div>
            )}
            
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Calendar className="h-6 w-6" />
              Horario Semanal
            </h1>
            <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
              {/* Mobile: rango corto + mes en misma línea */}
              <div className="flex items-center gap-2 sm:hidden">
                <span className="text-sm text-gray-500">
                  {format(weekStartDate, "dd/MM")} – {format(addDays(weekStartDate, 6), "dd/MM")}
                </span>
                {monthLabel && (
                  <>
                    <span className="text-sm text-gray-400">-</span>
                    <span className="text-sm font-medium text-gray-700">
                      {monthLabel}
                    </span>
                  </>
                )}
              </div>
              
              {/* Desktop: rango completo + mes separados */}
              <div className="hidden sm:flex sm:items-center sm:justify-between w-full">
                <div className="text-sm text-gray-500">
                  {format(weekStartDate, "dd/MM/yyyy")} – {format(addDays(weekStartDate, 6), "dd/MM/yyyy")}
                </div>
                {monthLabel && (
                  <div className="text-sm font-medium text-gray-700">
                    {monthLabel}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Botón de instalación PWA */}
            {showInstallButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleInstallApp}
                className="text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
                </svg>
                Instalar Horario
              </Button>
            )}
            
            {/* Botón Vista Individual */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleIndividualView}
              className="text-xs"
            >
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"/>
              </svg>
              Vista individual
            </Button>
            
            {/* Botón Cambiar Persona */}
            {currentViewer && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangePerson}
                className="text-xs"
              >
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                </svg>
                Cambiar persona
              </Button>
            )}
            
            {/* Ocultar chip "Publicado" y botón "Copiar enlace" en móvil */}
            <div className="hidden sm:flex sm:items-center sm:gap-3">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Publicado
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                className="text-xs"
              >
                <Copy className="mr-2 h-3 w-3" />
                Copiar enlace
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
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-blue-900">HORARIO DE HOY</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-sm text-blue-700 mb-2">
                  {currentViewer.employeeName}
                </p>
                <p className="text-xs text-blue-600">
                  {(() => {
                    const today = new Date()
                    const todayStr = format(today, "yyyy-MM-dd")
                    const currentWeek = horario.weeks?.[horario.publishedWeekId]
                    const dayData = currentWeek?.days?.[todayStr] as any
                    const todayAssignments = dayData?.[currentViewer.employeeId]
                    
                    if (!todayAssignments || todayAssignments.length === 0) {
                      return "🎉 Hoy tenés franco"
                    }
                    
                    // Usar la misma lógica que ScheduleGrid para renderizar
                    if (Array.isArray(todayAssignments)) {
                      console.log("🔧 [PublicHorarioPage] Debug assignments:", {
                        todayAssignments,
                        shiftsAvailable: shifts.length,
                        shiftsData: shifts,
                        firstAssignment: todayAssignments[0],
                        firstAssignmentType: typeof todayAssignments[0],
                        firstAssignmentKeys: Object.keys(todayAssignments[0] || {})
                      })
                      
                      return todayAssignments.map((assignment: any) => {
                        console.log("🔧 [PublicHorarioPage] Procesando assignment:", assignment)
                        
                        // Si es objeto ShiftAssignment
                        if (assignment && typeof assignment === 'object') {
                          console.log("🔧 [PublicHorarioPage] Assignment object keys:", Object.keys(assignment))
                          
                          if (assignment.type === 'franco') {
                            return 'Franco'
                          }
                          if (assignment.type === 'medio-franco') {
                            return 'Medio franco'
                          }
                          if (assignment.type === 'shift') {
                            // Si tiene startTime y endTime, usarlos directamente
                            if (assignment.startTime && assignment.endTime) {
                              return `${assignment.startTime} a ${assignment.endTime}`
                            }
                            // Sino, buscar en shifts por shiftId
                            if (assignment.shiftId) {
                              console.log("🔧 [PublicHorarioPage] Buscando shift por ID:", assignment.shiftId)
                              const shift = shifts.find(s => s.id === assignment.shiftId)
                              console.log("🔧 [PublicHorarioPage] Shift encontrado:", shift)
                              if (shift) {
                                return `${shift.startTime} a ${shift.endTime}`
                              }
                            }
                          }
                          return assignment.shiftId || 'Turno'
                        }
                        
                        // Si es string, buscar en shifts
                        if (typeof assignment === 'string') {
                          console.log("🔧 [PublicHorarioPage] Buscando shift:", assignment)
                          const shift = shifts.find(s => s.id === assignment)
                          console.log("🔧 [PublicHorarioPage] Shift encontrado:", shift)
                          if (shift) {
                            return `${shift.startTime} a ${shift.endTime}`
                          }
                          return assignment
                        }
                        
                        return 'Turno'
                      }).join(' • ')
                    }
                    
                    // Si no es array, tratar como string simple
                    if (typeof todayAssignments === 'string') {
                      const shift = shifts.find(s => s.id === todayAssignments)
                      if (shift) {
                        return `${shift.startTime} a ${shift.endTime}`
                      }
                      return todayAssignments
                    }
                    
                    return todayAssignments
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>
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
                {employees.map((employee) => (
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
