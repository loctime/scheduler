"use client"

import { useState, useEffect, useCallback } from "react"
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { ScheduleGrid } from "@/components/schedule-grid"
import { useToast } from "@/hooks/use-toast"
import { format, startOfWeek, addDays, addWeeks, subWeeks, subMonths, addMonths, startOfMonth, endOfMonth, setDate } from "date-fns"
import { es } from "date-fns/locale"
import { useData } from "@/contexts/data-context"
import { Horario, ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"
import { validateScheduleAssignments, validateDailyHours } from "@/lib/validations"
import { useConfig } from "@/hooks/use-config"

interface ScheduleCalendarProps {
  user: any
}

export function ScheduleCalendar({ user }: ScheduleCalendarProps) {
  const [schedules, setSchedules] = useState<Horario[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedSchedule, setSelectedSchedule] = useState<Horario | null>(null)
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()
  const { employees, shifts, loading: dataLoading } = useData()
  const { config } = useConfig()

  // Calcular rango del mes basado en mesInicioDia
  const monthStartDay = config?.mesInicioDia || 1
  const weekStartsOn = (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6

  // Calcular inicio y fin del mes personalizado
  const getCustomMonthRange = useCallback((date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    
    // Fecha de inicio: mesInicioDia del mes actual
    const startDate = setDate(new Date(year, month, 1), monthStartDay)
    
    // Fecha de fin: día anterior al mesInicioDia del mes siguiente
    const nextMonth = addMonths(new Date(year, month, 1), 1)
    const endDate = addDays(setDate(nextMonth, monthStartDay), -1)
    
    return { startDate, endDate }
  }, [monthStartDay])

  // Generar todas las semanas del mes
  const getMonthWeeks = useCallback((date: Date): Date[][] => {
    const { startDate, endDate } = getCustomMonthRange(date)
    const weeks: Date[][] = []
    
    // Encontrar el inicio de la semana que contiene el startDate
    // La semana debe comenzar en el día configurado (semanaInicioDia)
    let weekStart = startOfWeek(startDate, { weekStartsOn })
    
    // Generar semanas hasta cubrir todo el rango
    while (weekStart <= endDate) {
      const week: Date[] = []
      
      // Generar 7 días completos de la semana
      for (let i = 0; i < 7; i++) {
        const day = addDays(weekStart, i)
        week.push(new Date(day))
      }
      
      // Verificar si la semana tiene al menos un día dentro del rango del mes
      const hasDaysInRange = week.some((day) => day >= startDate && day <= endDate)
      
      if (hasDaysInRange) {
        weeks.push(week)
      }
      
      // Mover a la siguiente semana
      weekStart = addWeeks(weekStart, 1)
      
      // Si el inicio de la siguiente semana ya pasó el endDate, terminar
      if (weekStart > endDate && week[week.length - 1] > endDate) {
        break
      }
    }
    
    return weeks
  }, [getCustomMonthRange, weekStartsOn])

  const monthRange = getCustomMonthRange(currentMonth)
  const monthWeeks = getMonthWeeks(currentMonth)

  useEffect(() => {
    // Solo crear listeners si el usuario está autenticado
    if (!user) {
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

        // Los horarios se cargan por semana individual, no necesitamos buscar uno específico aquí
        // setSelectedSchedule se manejará por semana individual
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

  const handleExportImage = useCallback(async () => {
    const element = document.getElementById("schedule-month-container")
    if (!element) return

    setExporting(true)
    try {
      // Lazy load html2canvas
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
      })
      const link = document.createElement("a")
      link.download = `horario-${format(monthRange.startDate, "yyyy-MM-dd")}.png`
      link.href = canvas.toDataURL()
      link.click()
      toast({
        title: "Imagen exportada",
        description: "El horario se ha exportado como imagen",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al exportar la imagen",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }, [monthRange.startDate, toast])

  const handleExportPDF = useCallback(async () => {
    const element = document.getElementById("schedule-month-container")
    if (!element) return

    setExporting(true)
    try {
      // Lazy load ambas librerías
      const [html2canvas, jsPDF] = await Promise.all([
        import("html2canvas").then((m) => m.default),
        import("jspdf").then((m) => m.default),
      ])

      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
      })
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("l", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
      pdf.save(`horario-${format(monthRange.startDate, "yyyy-MM-dd")}.pdf`)
      toast({
        title: "PDF exportado",
        description: "El horario se ha exportado como PDF",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al exportar el PDF",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }, [monthRange.startDate, toast])

  // Función helper para obtener el horario de una semana específica
  const getWeekSchedule = useCallback((weekStartDate: Date) => {
    const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
    return schedules.find((s) => s.weekStart === weekStartStr) || null
  }, [schedules])

  const handleShiftUpdate = useCallback(
    async (date: string, employeeId: string, shiftIds: string[], weekStartDate?: Date) => {
      try {
        // Validaciones básicas
        if (employees.length === 0) {
          toast({
            title: "Error",
            description: "Debes tener al menos un empleado registrado",
            variant: "destructive",
          })
          return
        }

        if (shifts.length === 0) {
          toast({
            title: "Error",
            description: "Debes tener al menos un turno configurado",
            variant: "destructive",
          })
          return
        }

        // Determinar la semana basada en la fecha o la fecha proporcionada
        const dateObj = weekStartDate ? weekStartDate : startOfWeek(new Date(date), { weekStartsOn })
        const weekStartStr = format(dateObj, "yyyy-MM-dd")
        const weekEndStr = format(addDays(dateObj, 6), "yyyy-MM-dd")
        
        // Obtener el horario de esa semana específica
        const weekSchedule = getWeekSchedule(dateObj)
        const userName = user?.displayName || user?.email || "Usuario desconocido"
        const userId = user?.uid || ""

        let scheduleId: string
        let currentAssignments: Record<string, Record<string, string[]>> = {}
        let scheduleNombre = `Semana del ${weekStartStr}`

        // Si no existe horario, crearlo. Si existe, actualizarlo
        if (!selectedSchedule) {
          // Crear nuevo horario
          currentAssignments = {
            [date]: {
              [employeeId]: shiftIds,
            },
          }

          const newScheduleData = {
            nombre: scheduleNombre,
            weekStart: weekStartStr,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            assignments: currentAssignments,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
          }

          const scheduleRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), newScheduleData)
          scheduleId = scheduleRef.id

          // Guardar en historial como "creado"
          await addDoc(collection(db, COLLECTIONS.HISTORIAL), {
            horarioId: scheduleId,
            nombre: scheduleNombre,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            assignments: currentAssignments,
            createdAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
            accion: "creado" as const,
            versionAnterior: false,
          })

          toast({
            title: "Horario creado",
            description: "El horario se ha creado correctamente",
          })
        } else {
          // Actualizar horario existente
          scheduleId = weekSchedule.id
          scheduleNombre = weekSchedule.nombre || scheduleNombre

          // Guardar versión anterior en historial antes de actualizar
          const historyData = {
            horarioId: weekSchedule.id,
            nombre: scheduleNombre,
            semanaInicio: weekSchedule.semanaInicio || weekStartStr,
            semanaFin: weekSchedule.semanaFin || weekEndStr,
            assignments: { ...weekSchedule.assignments },
            createdAt: weekSchedule.updatedAt || weekSchedule.createdAt || serverTimestamp(),
            createdBy: weekSchedule.createdBy || weekSchedule.modifiedBy || userId,
            createdByName: weekSchedule.createdByName || weekSchedule.modifiedByName || userName,
            accion: "modificado" as const,
            versionAnterior: true,
          }

          await addDoc(collection(db, COLLECTIONS.HISTORIAL), historyData)

          // Actualizar assignments
          currentAssignments = {
            ...weekSchedule.assignments,
          }
          if (!currentAssignments[date]) {
            currentAssignments[date] = {}
          }
          currentAssignments[date] = {
            ...currentAssignments[date],
            [employeeId]: shiftIds,
          }
        }

        // Validar solapamientos solo para este empleado y fecha
        const overlaps = validateScheduleAssignments(currentAssignments, employees, shifts)
        const relevantOverlaps = overlaps.filter(
          (o) => o.employeeId === employeeId && o.date === date,
        )
        if (relevantOverlaps.length > 0) {
          const overlapMessages = relevantOverlaps.map((o) => o.message).join("\n")
          toast({
            title: "Advertencia: Solapamientos detectados",
            description: overlapMessages,
            variant: "destructive",
          })
          // Continuar de todas formas, pero informar al usuario
        }

        // Validar horas máximas por día
        if (config) {
          const minutosDescanso = config.minutosDescanso || 30
          const horasMinimasParaDescanso = config.horasMinimasParaDescanso || 6
          const horasMaximasPorDia = config.horasMaximasPorDia || 8

          const employeeShifts = currentAssignments[date]?.[employeeId] || []
          if (employeeShifts.length > 0) {
            const dailyValidation = validateDailyHours(
              employeeShifts,
              shifts,
              horasMaximasPorDia,
              minutosDescanso,
              horasMinimasParaDescanso
            )
            if (!dailyValidation.valid) {
              const employee = employees.find((e) => e.id === employeeId)
              toast({
                title: "Advertencia: Horas máximas por día excedidas",
                description: `${employee?.name || "Empleado"} - ${dailyValidation.message}`,
                variant: "destructive",
              })
            }
          }
        }

        // Actualizar o crear en Firestore
        if (weekSchedule) {
          // Actualizar existente - incluir todos los campos requeridos por las reglas de Firestore
          // Asegurar que todos los campos tengan valores válidos (no vacíos)
          // Incluir campos inmutables para que las reglas puedan verificar unchanged()
          // Preservar valores originales exactos (null si es null, no incluir si es undefined)
          const updateData: any = {
            nombre: (weekSchedule.nombre?.trim() && weekSchedule.nombre.trim()) || scheduleNombre,
            weekStart: (weekSchedule.weekStart?.trim() && weekSchedule.weekStart.trim()) || weekStartStr,
            semanaInicio: (weekSchedule.semanaInicio?.trim() && weekSchedule.semanaInicio.trim()) || weekStartStr,
            semanaFin: (weekSchedule.semanaFin?.trim() && weekSchedule.semanaFin.trim()) || weekEndStr,
            assignments: currentAssignments,
            updatedAt: serverTimestamp(),
            modifiedBy: userId || null,
            modifiedByName: userName || null,
          }
          
          // Incluir campos inmutables solo si existen en el documento original
          // Esto asegura que unchanged() funcione correctamente
          if (weekSchedule.createdAt !== undefined) {
            updateData.createdAt = weekSchedule.createdAt
          }
          if (weekSchedule.createdBy !== undefined) {
            updateData.createdBy = weekSchedule.createdBy
          }
          if (weekSchedule.createdByName !== undefined) {
            updateData.createdByName = weekSchedule.createdByName
          }
          
          await updateDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId), updateData)

          toast({
            title: "Turnos actualizados",
            description: "Los turnos se han actualizado correctamente",
          })
        }
        // Si no existe, ya se creó arriba
      } catch (error: any) {
        console.error("Error al actualizar turnos:", error)
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al actualizar los turnos",
          variant: "destructive",
        })
      }
    },
    [user, employees, shifts, config, toast, getWeekSchedule],
  )

  // Nueva función para manejar asignaciones con horarios ajustados
  const handleAssignmentUpdate = useCallback(
    async (date: string, employeeId: string, assignments: ShiftAssignment[]) => {
      try {
        // Validaciones básicas
        if (employees.length === 0) {
          toast({
            title: "Error",
            description: "Debes tener al menos un empleado registrado",
            variant: "destructive",
          })
          return
        }

        if (shifts.length === 0) {
          toast({
            title: "Error",
            description: "Debes tener al menos un turno configurado",
            variant: "destructive",
          })
          return
        }

        if (!db) {
          toast({
            title: "Error",
            description: "Firebase no está configurado",
            variant: "destructive",
          })
          return
        }

        // Determinar la semana basada en la fecha
        const dateObj = new Date(date)
        const weekStartDate = startOfWeek(dateObj, { weekStartsOn })
        const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
        const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")
        const userName = user?.displayName || user?.email || "Usuario desconocido"
        const userId = user?.uid || ""

        let scheduleId: string
        let currentAssignments: Record<string, Record<string, ShiftAssignmentValue>> = {}
        let scheduleNombre = `Semana del ${weekStartStr}`

        // Obtener el horario de esa semana específica
        const weekSchedule = getWeekSchedule(weekStartDate)

        // Si no existe horario, crearlo. Si existe, actualizarlo
        if (!weekSchedule) {
          // Crear nuevo horario con formato nuevo
          currentAssignments = {
            [date]: {
              [employeeId]: assignments,
            },
          }

          const newScheduleData = {
            nombre: scheduleNombre,
            weekStart: weekStartStr,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            assignments: currentAssignments,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
          }

          const scheduleRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), newScheduleData)
          scheduleId = scheduleRef.id

          // Guardar en historial como "creado"
          await addDoc(collection(db, COLLECTIONS.HISTORIAL), {
            horarioId: scheduleId,
            nombre: scheduleNombre,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            assignments: currentAssignments,
            createdAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
            accion: "creado" as const,
            versionAnterior: false,
          })

          toast({
            title: "Horario creado",
            description: "El horario se ha creado correctamente",
          })
        } else {
          // Actualizar horario existente
          scheduleId = weekSchedule.id
          scheduleNombre = weekSchedule.nombre || scheduleNombre

          // Guardar versión anterior en historial antes de actualizar
          const historyData = {
            horarioId: weekSchedule.id,
            nombre: scheduleNombre,
            semanaInicio: weekSchedule.semanaInicio || weekStartStr,
            semanaFin: weekSchedule.semanaFin || weekEndStr,
            assignments: { ...weekSchedule.assignments },
            createdAt: weekSchedule.updatedAt || weekSchedule.createdAt || serverTimestamp(),
            createdBy: weekSchedule.createdBy || weekSchedule.modifiedBy || userId,
            createdByName: weekSchedule.createdByName || weekSchedule.modifiedByName || userName,
            accion: "modificado" as const,
            versionAnterior: true,
          }

          await addDoc(collection(db, COLLECTIONS.HISTORIAL), historyData)

          // Actualizar assignments (convertir asignaciones antiguas al nuevo formato si es necesario)
          currentAssignments = {
            ...weekSchedule.assignments,
          }
          if (!currentAssignments[date]) {
            currentAssignments[date] = {}
          }
          currentAssignments[date] = {
            ...currentAssignments[date],
            [employeeId]: assignments,
          }
        }

        // Validar solapamientos (necesita convertir a formato compatible)
        // Por ahora mantenemos la validación básica
        const shiftIds = assignments.map((a) => a.shiftId)
        const overlaps = validateScheduleAssignments(
          { [date]: { [employeeId]: shiftIds } },
          employees,
          shifts
        )
        const relevantOverlaps = overlaps.filter(
          (o) => o.employeeId === employeeId && o.date === date,
        )
        if (relevantOverlaps.length > 0) {
          const overlapMessages = relevantOverlaps.map((o) => o.message).join("\n")
          toast({
            title: "Advertencia: Solapamientos detectados",
            description: overlapMessages,
            variant: "destructive",
          })
        }

        // Validar horas máximas por día (necesita adaptar para horarios ajustados)
        if (config) {
          const minutosDescanso = config.minutosDescanso || 30
          const horasMinimasParaDescanso = config.horasMinimasParaDescanso || 6
          const horasMaximasPorDia = config.horasMaximasPorDia || 8

          // Por ahora validamos con los IDs de turnos (las validaciones necesitarán actualizarse)
          const dailyValidation = validateDailyHours(
            shiftIds,
            shifts,
            horasMaximasPorDia,
            minutosDescanso,
            horasMinimasParaDescanso
          )
          if (!dailyValidation.valid) {
            const employee = employees.find((e) => e.id === employeeId)
            toast({
              title: "Advertencia: Horas máximas por día excedidas",
              description: `${employee?.name || "Empleado"} - ${dailyValidation.message}`,
              variant: "destructive",
            })
          }
        }

        // Actualizar o crear en Firestore
        if (weekSchedule) {
          // Verificar que el usuario tenga el rol correcto
          if (!userId) {
            throw new Error("Usuario no autenticado")
          }
          
          // Verificar rol del usuario (para diagnóstico)
          try {
            const userDocRef = doc(db, COLLECTIONS.USERS, userId)
            const userDoc = await getDoc(userDocRef)
            if (!userDoc.exists()) {
              throw new Error(`El usuario ${userId} no tiene un documento en ${COLLECTIONS.USERS}. Por favor, cierra sesión y vuelve a iniciar sesión.`)
            }
            const userData = userDoc.data()
            const userRole = userData?.role
            console.log('[ScheduleCalendar] Verificación de usuario:', {
              userId,
              userRole,
              hasRole: !!userRole,
              userData: { ...userData, createdAt: userData?.createdAt ? 'timestamp' : undefined, updatedAt: userData?.updatedAt ? 'timestamp' : undefined },
            })
            
            if (!userRole || (userRole !== 'user' && userRole !== 'admin' && userRole !== 'maxdev')) {
              throw new Error(`El usuario no tiene un rol válido. Rol actual: ${userRole || 'ninguno'}. Se requiere: 'user', 'admin' o 'maxdev'`)
            }
          } catch (roleError: any) {
            console.error('[ScheduleCalendar] Error verificando rol:', roleError)
            if (roleError.message.includes('no tiene un documento')) {
              throw roleError
            }
            // Continuar de todas formas, pero registrar el error
          }
          
          // Actualizar existente - incluir todos los campos requeridos por las reglas de Firestore
          // Asegurar que todos los campos tengan valores válidos (no vacíos)
          // Incluir campos inmutables para que las reglas puedan verificar unchanged()
          // Preservar valores originales exactos (null si es null, no incluir si es undefined)
          const updateData: any = {
            nombre: (weekSchedule.nombre?.trim() && weekSchedule.nombre.trim()) || scheduleNombre,
            weekStart: (weekSchedule.weekStart?.trim() && weekSchedule.weekStart.trim()) || weekStartStr,
            semanaInicio: (weekSchedule.semanaInicio?.trim() && weekSchedule.semanaInicio.trim()) || weekStartStr,
            semanaFin: (weekSchedule.semanaFin?.trim() && weekSchedule.semanaFin.trim()) || weekEndStr,
            assignments: currentAssignments,
            updatedAt: serverTimestamp(),
            modifiedBy: userId || null,
            modifiedByName: userName || null,
          }
          
          // Incluir campos inmutables - createdAt siempre debe estar presente
          // createdBy y createdByName solo si existen en el documento original
          if (weekSchedule.createdAt !== undefined && weekSchedule.createdAt !== null) {
            updateData.createdAt = weekSchedule.createdAt
          }
          if (weekSchedule.createdBy !== undefined) {
            updateData.createdBy = weekSchedule.createdBy
          }
          if (weekSchedule.createdByName !== undefined) {
            updateData.createdByName = weekSchedule.createdByName
          }
          
          console.log('[ScheduleCalendar] Actualizando asignaciones:', {
            scheduleId,
            hasCreatedAt: weekSchedule.createdAt !== undefined,
            hasCreatedBy: weekSchedule.createdBy !== undefined,
            hasCreatedByName: weekSchedule.createdByName !== undefined,
            updateDataKeys: Object.keys(updateData),
            userId,
          })
          
          await updateDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId), updateData)

          toast({
            title: "Turnos actualizados",
            description: "Los turnos se han actualizado correctamente",
          })
        }
        // Si no existe, ya se creó arriba
      } catch (error: any) {
        console.error("Error al actualizar asignaciones:", error)
        console.error("Error details:", {
          code: error.code,
          message: error.message,
          stack: error.stack,
        })
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al actualizar los turnos",
          variant: "destructive",
        })
      }
    },
    [user, employees, shifts, config, toast, getWeekSchedule],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold text-foreground">
            {format(monthRange.startDate, "d 'de' MMMM", { locale: es })} -{" "}
            {format(monthRange.endDate, "d 'de' MMMM, yyyy", { locale: es })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportImage} disabled={exporting} aria-label="Exportar como imagen">
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
          <Button variant="outline" onClick={handleExportPDF} disabled={exporting || !selectedSchedule} aria-label="Exportar como PDF">
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
              <div key={weekIndex} className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Semana del {format(weekDays[0], "d", { locale: es })} -{" "}
                  {format(weekDays[weekDays.length - 1], "d 'de' MMMM", { locale: es })}
                </h3>
                <ScheduleGrid
                  weekDays={weekDays}
                  employees={employees}
                  shifts={shifts}
                  schedule={weekSchedule}
                  onAssignmentUpdate={handleAssignmentUpdate}
                  monthRange={monthRange}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
