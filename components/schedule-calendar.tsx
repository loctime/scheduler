"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { format, subMonths, addMonths, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { usePublicPublisher } from "@/hooks/use-public-publisher"
import { useData } from "@/contexts/data-context"
import { useConfig } from "@/hooks/use-config"
import { Horario, ShiftAssignment, ShiftAssignmentValue, Turno } from "@/lib/types"
import { getCustomMonthRange, getMonthWeeks, getInitialMonthForRange } from "@/lib/utils"
import { useExportSchedule } from "@/hooks/use-export-schedule"
import { useScheduleUpdates } from "@/hooks/use-schedule-updates"
import { useSchedulesListener } from "@/hooks/use-schedules-listener"
import { useImplicitFixedRules } from "@/hooks/use-implicit-fixed-rules"
import { calculateHoursBreakdown } from "@/lib/validations"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"
import { logger } from "@/lib/logger"
import { toPng } from "html-to-image"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import type { EmployeeMonthStats, EmployeeWeekStats, EmployeeStatsView } from "@/types/employee-stats"
import { useEmployeeMonthStats } from "@/hooks/use-employee-month-stats"
import { useEmployeeWeekStats } from "@/hooks/use-employee-week-stats"
import { createEmployeeStatsViewForUI, convertToLegacyStats } from "@/lib/employee-stats-utils"
import { GeneralView } from "@/components/schedule-calendar/general-view"
import { ExportOverlay } from "@/components/export-overlay"
import { ScheduleGridCapture } from "@/components/schedule-grid-capture"
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
  return (value as ShiftAssignment[]).map((assignment) => ({
    ...assignment,
    type: assignment.type || "shift",
  }))
}

export default function ScheduleCalendar({ user: userProp }: ScheduleCalendarProps) {
  const { toast } = useToast()
  const { employees, shifts, loading: dataLoading, user: contextUser } = useData() 
  const { config } = useConfig(contextUser || userProp)
  const { exporting, exportImage, exportPDF, exportExcel, exportMonthPDF } = useExportSchedule()
  const { publishToPublic, isPublishing, error: publishError } = usePublicPublisher(contextUser || userProp)

  // Para compatibilidad con el código existente
  const userData = contextUser || userProp

  // Estado para PWA publishing
  const [publishingWeekId, setPublishingWeekId] = useState<string | null>(null)
  const [copiedWeekData, setCopiedWeekData] = useState<{
    assignments: Horario["assignments"]
    dayStatus: Horario["dayStatus"]
    weekStartDate: string
    copiedAt: string
  } | null>(null)
  const [isPastingWeek, setIsPastingWeek] = useState(false)

  const monthStartDay = config?.mesInicioDia || 1
  const weekStartsOn = (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6

  // Rastrear si ya se inicializó para evitar sobrescribir cuando el usuario navega
  const isInitialized = useRef(false)
  
  // Ref para capturar el ScheduleGrid actual (enfoque simplificado)
  const scheduleGridRef = useRef<HTMLDivElement>(null)
  
  // Ref para el componente de captura robusto
  const captureRef = useRef<HTMLDivElement>(null)
  
  // Inicializar con el mes correcto basado en la fecha actual y mesInicioDia
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  // Refs para WeekSchedule components
  const weekScheduleRefs = useRef<Record<string, HTMLDivElement>>({})

  // Handler para recibir refs de WeekSchedule
  const handleWeekScheduleRef = useCallback((weekKey: string, element: HTMLDivElement | null) => {
    if (element) {
      weekScheduleRefs.current[weekKey] = element
    } else {
      delete weekScheduleRefs.current[weekKey]
    }
  }, [])

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
    user: userData,
    monthRange,
    enabled: !!userData,
  })

  // Hook para generación implícita de reglas fijas
  const { applyFixedRulesIfWeekEmpty, hasFixedRules } = useImplicitFixedRules({
    user: userData,
    employees,
    shifts,
    weekStartsOn,
    getWeekSchedule,
    onWeekScheduleCreated: (newSchedule) => {
      // Actualizar el estado local cuando se crea un nuevo schedule
      // Esto asegura que el UI se actualice inmediatamente
      logger.info("[ScheduleCalendar] Nuevo schedule creado por reglas fijas", {
        weekStart: newSchedule.weekStart
      })
    }
  })

  // Efecto para aplicar reglas fijas implícitamente cuando el usuario navega a semanas
  // Solo se ejecuta si hay reglas fijas configuradas
  useEffect(() => {
    if (!hasFixedRules || employees.length === 0 || !userData) {
      return
    }

    // Para cada semana visible en el mes actual
    const applyRulesForVisibleWeeks = async () => {
      for (const weekDays of monthWeeks) {
        const weekStartDate = weekDays[0]
        
        // Para cada empleado, verificar si la semana está vacía y aplicar reglas si es necesario
        for (const employee of employees) {
          try {
            await applyFixedRulesIfWeekEmpty(weekStartDate, employee.id)
          } catch (error) {
            logger.error("[ScheduleCalendar] Error aplicando reglas fijas", {
              employeeId: employee.id,
              weekStart: format(weekStartDate, "yyyy-MM-dd"),
              error
            })
          }
        }
      }
    }

    // Ejecutar de forma asíncrona para no bloquear el UI
    applyRulesForVisibleWeeks()
  }, [hasFixedRules, employees, userData, monthWeeks, applyFixedRulesIfWeekEmpty])

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
    user: userData,
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
      : userData?.uid
    await exportImage(weekId, `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.png`, {
      nombreEmpresa: config?.nombreEmpresa,
      colorEmpresa: config?.colorEmpresa,
      ownerId,
    })
  }, [exportImage, config, userData])

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

  const copyCurrentWeek = useCallback((weekStartDate: Date) => {
    const weekSchedule = getWeekSchedule(weekStartDate)

    if (!weekSchedule?.assignments && !weekSchedule?.dayStatus) {
      toast({
        title: "Error",
        description: "No hay datos para copiar en esta semana",
        variant: "destructive",
      })
      return
    }

    const assignments = weekSchedule?.assignments
      ? JSON.parse(JSON.stringify(weekSchedule.assignments))
      : {}
    const dayStatus = weekSchedule?.dayStatus
      ? JSON.parse(JSON.stringify(weekSchedule.dayStatus))
      : {}

    setCopiedWeekData({
      assignments,
      dayStatus,
      weekStartDate: weekStartDate.toISOString(),
      copiedAt: new Date().toISOString(),
    })

    toast({
      title: "Semana copiada",
      description: "La semana ha sido copiada exitosamente",
      duration: 2000,
    })
  }, [getWeekSchedule, toast])

  const pasteCopiedWeek = useCallback(async (targetWeekStartDate: Date) => {
    if (!copiedWeekData) {
      toast({
        title: "Error",
        description: "No hay una semana copiada para pegar",
        variant: "destructive",
      })
      return
    }

    if (!handleAssignmentUpdate) {
      toast({
        title: "Error",
        description: "No se puede pegar en esta semana",
        variant: "destructive",
      })
      return
    }

    setIsPastingWeek(true)

    try {
      const targetWeekDates = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(targetWeekStartDate)
        date.setDate(date.getDate() + i)
        targetWeekDates.push(date)
      }

      const copiedWeekStartDate = new Date(copiedWeekData.weekStartDate)
      const copiedWeekDates = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(copiedWeekStartDate)
        date.setDate(date.getDate() + i)
        copiedWeekDates.push(date)
      }

      const assignmentsByDayOfWeek: Record<number, Record<string, ShiftAssignment[]>> = {}
      const dayStatusByDayOfWeek: Record<number, Record<string, "normal" | "franco" | "medio_franco">> = {}

      copiedWeekDates.forEach((date, index) => {
        const dateStr = format(date, "yyyy-MM-dd")
        const assignments = copiedWeekData.assignments[dateStr]
        if (assignments && typeof assignments === "object") {
          assignmentsByDayOfWeek[index] = assignments as Record<string, ShiftAssignment[]>
        }

        const dayStatus = copiedWeekData.dayStatus?.[dateStr]
        if (dayStatus && typeof dayStatus === "object") {
          dayStatusByDayOfWeek[index] = dayStatus
        }
      })

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const targetDate = targetWeekDates[dayIndex]
        const targetDateStr = format(targetDate, "yyyy-MM-dd")
        const assignments = assignmentsByDayOfWeek[dayIndex]
        const dayStatuses = dayStatusByDayOfWeek[dayIndex]

        if (assignments) {
          for (const [employeeId, assignmentValue] of Object.entries(assignments)) {
            await handleAssignmentUpdate(targetDateStr, employeeId, assignmentValue)
          }
        }

        if (dayStatuses) {
          for (const [employeeId, status] of Object.entries(dayStatuses)) {
            if (status === "franco") {
              await handleAssignmentUpdate(targetDateStr, employeeId, [{ type: "franco" }])
            }

            if (status === "medio_franco") {
              const sourceAssignments = assignments?.[employeeId] || []
              const medioFrancoAssignment = sourceAssignments.find((assignment) => assignment.type === "medio_franco")
              await handleAssignmentUpdate(
                targetDateStr,
                employeeId,
                medioFrancoAssignment ? [medioFrancoAssignment] : [{ type: "medio_franco" }]
              )
            }
          }
        }
      }

      toast({
        title: "Semana pegada",
        description: "La semana copiada ha sido aplicada exitosamente",
        duration: 2000,
      })
    } catch (error) {
      logger.error("Error al pegar semana:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al pegar la semana",
        variant: "destructive",
      })
    } finally {
      setIsPastingWeek(false)
    }
  }, [copiedWeekData, handleAssignmentUpdate, toast])

  const handlePublishPwa = useCallback(async (weekStartDate: Date, weekEndDate: Date) => {
    console.log("🔧 [ScheduleCalendar] handlePublishPwa iniciado")
    console.log("🔧 [ScheduleCalendar] Fechas:", {
      weekStartDate: weekStartDate.toISOString(),
      weekEndDate: weekEndDate.toISOString(),
      userData: { role: userData?.role, uid: userData?.uid }
    })

    // Verificar que sea la semana actual
    const today = new Date()
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
    const isCurrentWeek = format(weekStartDate, "yyyy-MM-dd") === format(currentWeekStart, "yyyy-MM-dd")
    
    if (!isCurrentWeek) {
      toast({
        title: "Error",
        description: "Solo se puede publicar la semana actual",
        variant: "destructive",
      })
      return
    }
    
    // Obtener datos de la semana actual
    const weekSchedule = getWeekSchedule(weekStartDate)
    console.log("🔧 [ScheduleCalendar] weekSchedule obtenido:", {
      hasData: !!weekSchedule,
      keys: weekSchedule ? Object.keys(weekSchedule) : []
    })

    if (!weekSchedule) {
      console.error("🔧 [ScheduleCalendar] Error: No hay datos de la semana")
      toast({
        title: "Error",
        description: "No hay datos de la semana para publicar",
        variant: "destructive",
      })
      return
    }

    const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
    setPublishingWeekId(weekId)
    
    try {
      console.log("🔧 [ScheduleCalendar] Capturando WeekSchedule visible...")
      
      // Obtener el WeekSchedule visible usando las refs existentes
      const weekKey = format(weekStartDate, "yyyy-MM-dd")
      const visibleWeekSchedule = weekScheduleRefs.current[weekKey]
      
      if (!visibleWeekSchedule) {
        console.error("🔧 [ScheduleCalendar] Error: No se encontró el WeekSchedule visible para la semana", weekKey)
        toast({
          title: "Error",
          description: "No se encontró el horario visible para capturar",
          variant: "destructive",
        })
        return
      }
      
      console.log("🔧 [ScheduleCalendar] WeekSchedule visible encontrado:", {
        weekKey,
        hasElement: !!visibleWeekSchedule,
        elementTag: visibleWeekSchedule.tagName,
        elementClass: visibleWeekSchedule.className
      })
      
      // Esperar un frame para asegurar renderizado
      await new Promise(resolve => requestAnimationFrame(resolve))
      
      // Validar dimensiones del elemento visible
      const elementRect = visibleWeekSchedule.getBoundingClientRect()
      if (elementRect.width === 0 || elementRect.height === 0) {
        console.error("🔧 [ScheduleCalendar] Error: WeekSchedule visible sin dimensiones", {
          width: elementRect.width,
          height: elementRect.height
        })
        toast({
          title: "Error",
          description: "El horario visible no tiene dimensiones válidas",
          variant: "destructive",
        })
        return
      }
      
      console.log("🔧 [ScheduleCalendar] Generando imagen del WeekSchedule visible...")
      console.log("🔧 [ScheduleCalendar] Dimensiones del elemento:", {
        width: elementRect.width,
        height: elementRect.height
      })
      
      // Generar imagen del WeekSchedule visible
      const dataUrl = await toPng(visibleWeekSchedule, {
        cacheBust: true,
        backgroundColor: "#ffffff"
      })

      console.log("🔧 [ScheduleCalendar] Imagen generada exitosamente")
      console.log("🔧 [ScheduleCalendar] Tamaño del dataUrl:", dataUrl.length)
      console.log("🔧 [ScheduleCalendar] Primeros 100 caracteres:", dataUrl.substring(0, 100))

      // Validar que la imagen se generó correctamente
      if (!dataUrl || dataUrl.length === 0) {
        console.error("🔧 [ScheduleCalendar] Error: Imagen generada vacía o inválida")
        toast({
          title: "Error",
          description: "No se pudo generar la imagen del horario",
          variant: "destructive",
        })
        return
      }

      // Usar el dataURL directamente como publicImageUrl
      const publicImageUrl = dataUrl
      
      console.log("🔧 [ScheduleCalendar] publicImageUrl generado, llamando a publishToPublic...")
      
      // Llamar a publishToPublic con la imagen generada y empleados con nombres
      console.log("🔧 [ScheduleCalendar] weekSchedule completo:", weekSchedule)
      console.log("🔧 [ScheduleCalendar] weekSchedule.employees:", (weekSchedule as any).employees)
      console.log("🔧 [ScheduleCalendar] weekSchedule keys:", Object.keys(weekSchedule))
      console.log("🔧 [ScheduleCalendar] employees from context:", employees)
      
      // Usar empleados del contexto con nombres reales
      const employeesToPublish = employees?.map((e: any) => ({
        id: e.id,
        name: e.name,
      }))
      
      console.log("🔧 [ScheduleCalendar] employeesToPublish:", employeesToPublish)
      
      const publishedOwnerId = await publishToPublic({
        weekId,
        weekData: {
          ...weekSchedule,
          startDate: format(weekStartDate, "dd/MM/yyyy"),
          endDate: format(weekEndDate, "dd/MM/yyyy"),
        },
        publicImageUrl: publicImageUrl, // Pasar la imagen generada
        employees: employeesToPublish,
      })

      console.log("🔧 [ScheduleCalendar] publishToPublic completado:", {
        publishedOwnerId,
        hasImage: !!publicImageUrl,
      })
      
      // Actualizar el documento en Firestore con la imagen y estado de publicación
      if (!db) {
        throw new Error("Firestore no está inicializado")
      }
      
      const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, weekSchedule.id)
      await updateDoc(scheduleRef, {
        isPublished: true,
        publicImageUrl: publicImageUrl,
        publicImageUpdatedAt: serverTimestamp(),
      })

      console.log("🔧 [ScheduleCalendar] publicImageUrl guardado en Firestore:", {
        scheduleId: weekSchedule.id,
        hasImage: !!publicImageUrl,
      })

      toast({
        title: "Horario publicado",
        description: "El horario ahora está disponible públicamente con imagen",
      })

    } catch (error) {
      console.error("🔧 [ScheduleCalendar] Error publicando horario:", error)
      toast({
        title: "Error",
        description: "No se pudo publicar el horario",
        variant: "destructive",
      })
    } finally {
      setPublishingWeekId(null)
    }
  }, [userData, getWeekSchedule, toast, publishToPublic])

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
      userId: userData?.uid || '',
      createdAt: null,
      updatedAt: null,
    } as Turno))
  }, [shifts, schedules, userData])

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

  // Usar nuevo sistema de estadísticas refactorizado
  const employeeMonthStats = useEmployeeMonthStats({
    employees,
    shifts: shiftsToUse,
    monthWeeks,
    monthRange,
    getWeekSchedule,
    config,
    mediosTurnos: config?.mediosTurnos,
  })

  // Convertir a formato legado para compatibilidad con componentes existentes
  const employeeMonthlyStats = useMemo<Record<string, EmployeeMonthlyStats>>(() => {
    const legacyStats: Record<string, EmployeeMonthlyStats> = {}
    
    Object.entries(employeeMonthStats).forEach(([employeeId, monthStats]) => {
      // Crear stats semanales vacías por ahora (se calcularán por semana)
      const weekStats: EmployeeWeekStats = {
        francosSemana: 0,
        horasNormalesSemana: 0,
        horasExtrasSemana: 0,
        horasLicenciaEmbarazoSemana: 0,
        horasMedioFrancoSemana: 0,
        diasTrabajadosSemana: 0,
        diasLicenciaSemana: 0,
      }
      
      const statsView: EmployeeStatsView = {
        month: monthStats,
        week: weekStats,
      }
      
      legacyStats[employeeId] = convertToLegacyStats(statsView)
    })
    
    return legacyStats
  }, [employeeMonthStats])

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
        user={userData}
        onMarkWeekComplete={handleMarkWeekComplete}
        lastCompletedWeekStart={lastCompletedWeekStart}
        allSchedules={schedules}
        config={config}
        onPublishSchedule={handlePublishPwa}
        isPublishingSchedule={isPublishing || publishingWeekId !== null}
        onWeekScheduleRef={handleWeekScheduleRef}
        copiedWeekData={copiedWeekData}
        onCopyCurrentWeek={copyCurrentWeek}
        onPasteCopiedWeek={pasteCopiedWeek}
        isPastingWeek={isPastingWeek}
      />
      </div>
      
      {/* Componente de captura robusto - siempre montado pero fuera de pantalla */}
      <ScheduleGridCapture
        ref={captureRef}
        weekDays={monthWeeks[0] || []}
        employees={employees}
        shifts={shifts}
        schedule={getWeekSchedule(monthWeeks[0]?.[0])}
        allEmployees={employees}
      />
    </>
  )
}
