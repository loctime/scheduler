"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2, ChevronDown, ChevronUp, CheckCircle2, Circle, Copy, Trash2 } from "lucide-react"
import { format, subDays, startOfWeek, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { ScheduleGrid, type EmployeeMonthlyStats } from "@/components/schedule-grid"
import { Empleado, Turno, Horario, MedioTurno, ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore"

interface WeekScheduleProps {
  weekDays: Date[]
  weekIndex: number
  weekSchedule: Horario | null
  employees: Empleado[]
  allEmployees?: Empleado[]
  shifts: Turno[]
  monthRange: { startDate: Date; endDate: Date }
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: any[], options?: { scheduleId?: string }) => void
  onExportImage?: (weekStartDate: Date, weekEndDate: Date) => void
  onExportPDF?: (weekStartDate: Date, weekEndDate: Date) => void
  onExportExcel?: () => void
  exporting: boolean
  mediosTurnos?: MedioTurno[]
  employeeStats?: Record<string, EmployeeMonthlyStats>
  readonly?: boolean
  showActions?: boolean
  title?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  user?: any
  onMarkComplete?: (weekStartDate: Date, completed: boolean) => Promise<void>
  lastCompletedWeekStart?: string | null
  getWeekSchedule?: (weekStartDate: Date) => Horario | null
}

// Función helper para normalizar asignaciones
const normalizeAssignments = (value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  if (typeof value[0] === "string") {
    return (value as string[]).map((shiftId) => ({ shiftId, type: "shift" as const }))
  }
  return (value as ShiftAssignment[]).map((assignment) => ({
    ...assignment,
    type: assignment.type || "shift",
  }))
}

export function WeekSchedule({
  weekDays,
  weekIndex,
  weekSchedule,
  employees,
  allEmployees,
  shifts,
  monthRange,
  onAssignmentUpdate,
  onExportImage,
  onExportPDF,
  onExportExcel,
  exporting,
  mediosTurnos = [],
  employeeStats,
  readonly = false,
  showActions = true,
  title,
  open,
  onOpenChange,
  user,
  onMarkComplete,
  lastCompletedWeekStart,
  getWeekSchedule,
}: WeekScheduleProps) {
  const weekStartDate = weekDays[0]
  const weekEndDate = weekDays[weekDays.length - 1]
  const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
  const headerTitle =
    title ||
    `Semana del ${format(weekDays[0], "d", { locale: es })} - ${format(
      weekDays[weekDays.length - 1],
      "d 'de' MMMM",
      { locale: es },
    )}`
  const hasExportHandlers = Boolean(onExportImage && onExportPDF)
  const canShowActions = showActions && hasExportHandlers
  const isCompleted = weekSchedule?.completada === true
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const { toast } = useToast()

  // Si no se proporciona open/onOpenChange, usar estado interno
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open !== undefined ? open : internalOpen
  const handleOpenChange = onOpenChange || setInternalOpen

  const handleMarkComplete = async () => {
    if (!onMarkComplete) return
    setIsMarkingComplete(true)
    try {
      await onMarkComplete(weekStartDate, !isCompleted)
    } catch (error) {
      console.error("Error al marcar semana como completada:", error)
    } finally {
      setIsMarkingComplete(false)
    }
  }

  // Función para copiar semana anterior
  const handleCopyPreviousWeek = useCallback(async () => {
    if (!getWeekSchedule || readonly || !db || !user) {
      return
    }

    setIsCopying(true)
    try {
      // Calcular la semana anterior (7 días antes)
      const previousWeekStartDate = subDays(weekStartDate, 7)
      const previousWeekSchedule = getWeekSchedule(previousWeekStartDate)

      console.log("[Copiar semana] Semana anterior encontrada:", previousWeekSchedule ? "Sí" : "No")
      console.log("[Copiar semana] Fecha inicio semana anterior:", format(previousWeekStartDate, "yyyy-MM-dd"))

      if (!previousWeekSchedule || !previousWeekSchedule.assignments) {
        toast({
          title: "No hay semana anterior",
          description: "No se encontró un horario para la semana anterior.",
          variant: "destructive",
        })
        return
      }

      // Crear un mapa de empleados actuales para verificación rápida
      const currentEmployeeIds = new Set(employees.map((emp) => emp.id))
      console.log("[Copiar semana] Empleados actuales:", currentEmployeeIds.size, Array.from(currentEmployeeIds))
      
      // Obtener todos los IDs de empleados que tienen asignaciones en la semana anterior
      const previousWeekEmployeeIds = new Set<string>()
      Object.values(previousWeekSchedule.assignments).forEach((dayAssignments) => {
        if (dayAssignments && typeof dayAssignments === 'object') {
          Object.keys(dayAssignments).forEach((employeeId) => {
            previousWeekEmployeeIds.add(employeeId)
          })
        }
      })
      console.log("[Copiar semana] Empleados con asignaciones en semana anterior:", previousWeekEmployeeIds.size, Array.from(previousWeekEmployeeIds))
      
      // Encontrar empleados que coinciden
      const matchingEmployeeIds = Array.from(previousWeekEmployeeIds).filter(id => currentEmployeeIds.has(id))
      console.log("[Copiar semana] Empleados que coinciden (existen en ambas semanas):", matchingEmployeeIds.length, matchingEmployeeIds)
      
      // Contar cuántas celdas se copiarán
      let skippedEmployees = 0
      let skippedDays = 0

      // Recolectar todas las actualizaciones a realizar
      const updatesToPerform: Array<{
        date: string
        employeeId: string
        assignments: ShiftAssignment[]
      }> = []

      // Primero, recolectar todas las actualizaciones
      for (let i = 0; i < weekDays.length; i++) {
        const currentDay = weekDays[i]
        const previousDay = subDays(currentDay, 7)
        const currentDateStr = format(currentDay, "yyyy-MM-dd")
        const previousDateStr = format(previousDay, "yyyy-MM-dd")

        console.log(`[Copiar semana] Procesando día ${i + 1}/7: ${currentDateStr} <- ${previousDateStr}`)

        const previousDayAssignments = previousWeekSchedule.assignments[previousDateStr]
        if (!previousDayAssignments) {
          console.log(`[Copiar semana] No hay asignaciones para ${previousDateStr}`)
          skippedDays++
          continue
        }

        const previousDayEmployeeIds = Object.keys(previousDayAssignments)
        console.log(`[Copiar semana] Asignaciones encontradas para ${previousDateStr}:`, previousDayEmployeeIds.length, "empleados")
        console.log(`[Copiar semana] IDs de empleados en semana anterior para ${previousDateStr}:`, previousDayEmployeeIds)
        console.log(`[Copiar semana] IDs de empleados actuales:`, Array.from(currentEmployeeIds))

        // Recolectar asignaciones de cada empleado
        for (const [employeeId, assignmentValue] of Object.entries(previousDayAssignments)) {
          // Solo copiar si el empleado existe actualmente
          if (!currentEmployeeIds.has(employeeId)) {
            console.log(`[Copiar semana] Empleado ${employeeId} no existe actualmente, omitiendo`)
            skippedEmployees++
            continue
          }
          
          console.log(`[Copiar semana] ✓ Empleado ${employeeId} existe actualmente, procesando...`)

          // Normalizar las asignaciones
          const normalizedAssignments = normalizeAssignments(assignmentValue)
          console.log(`[Copiar semana] Preparando celda ${currentDateStr} - empleado ${employeeId}:`, normalizedAssignments.length, "asignaciones")
          
          if (normalizedAssignments.length > 0) {
            updatesToPerform.push({
              date: currentDateStr,
              employeeId,
              assignments: normalizedAssignments,
            })
          } else {
            console.log(`[Copiar semana] Sin asignaciones para copiar en ${currentDateStr} - ${employeeId}`)
          }
        }
      }

      console.log(`[Copiar semana] Total de celdas a copiar: ${updatesToPerform.length}`)

      if (updatesToPerform.length === 0) {
        toast({
          title: "No se copió nada",
          description: "No se encontraron asignaciones para empleados actuales en la semana anterior.",
          variant: "default",
        })
        return
      }

      // Obtener el schedule actual directamente de Firestore para tener el estado más reciente
      const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
      let currentSchedule = weekSchedule
      let scheduleId: string | null = null

      if (currentSchedule?.id) {
        scheduleId = currentSchedule.id
        // Leer directamente de Firestore para obtener el estado más reciente
        try {
          const scheduleDoc = await getDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId))
          if (scheduleDoc.exists()) {
            currentSchedule = { id: scheduleDoc.id, ...scheduleDoc.data() } as Horario
            console.log(`[Copiar semana] Schedule leído directamente de Firestore`)
          }
        } catch (error) {
          console.error(`[Copiar semana] Error al leer schedule de Firestore:`, error)
        }
      }

      // Construir el objeto completo de assignments aplicando todas las actualizaciones
      const newAssignments: Record<string, Record<string, ShiftAssignment[]>> = currentSchedule?.assignments 
        ? JSON.parse(JSON.stringify(currentSchedule.assignments)) // Deep copy
        : {}

      // Aplicar todas las actualizaciones al objeto de assignments
      for (const update of updatesToPerform) {
        if (!newAssignments[update.date]) {
          newAssignments[update.date] = {}
        }
        newAssignments[update.date][update.employeeId] = update.assignments
        console.log(`[Copiar semana] Aplicada actualización en memoria: ${update.date} - ${update.employeeId}`)
      }

      // Si no existe schedule, crearlo
      if (!currentSchedule) {
        const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")
        const userName = user?.displayName || user?.email || "Usuario desconocido"
        const userId = user?.uid || ""

        const newScheduleData = {
          nombre: `Semana del ${weekStartStr}`,
          weekStart: weekStartStr,
          semanaInicio: weekStartStr,
          semanaFin: weekEndStr,
          assignments: newAssignments,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userId,
          createdByName: userName,
        }

        const scheduleRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), newScheduleData)
        scheduleId = scheduleRef.id

        // Guardar en historial
        await addDoc(collection(db, COLLECTIONS.HISTORIAL), {
          horarioId: scheduleId,
          nombre: newScheduleData.nombre,
          semanaInicio: weekStartStr,
          semanaFin: weekEndStr,
          assignments: newAssignments,
          createdAt: serverTimestamp(),
          createdBy: userId,
          createdByName: userName,
          accion: "creado" as const,
          versionAnterior: false,
        })

        console.log(`[Copiar semana] Schedule creado con ID: ${scheduleId}`)
      } else {
        // Actualizar schedule existente
        scheduleId = currentSchedule.id
        const userName = user?.displayName || user?.email || "Usuario desconocido"
        const userId = user?.uid || ""

        // Guardar versión anterior en historial
        await addDoc(collection(db, COLLECTIONS.HISTORIAL), {
          horarioId: scheduleId,
          nombre: currentSchedule.nombre || `Semana del ${weekStartStr}`,
          semanaInicio: currentSchedule.semanaInicio || weekStartStr,
          semanaFin: currentSchedule.semanaFin || format(addDays(weekStartDate, 6), "yyyy-MM-dd"),
          assignments: currentSchedule.assignments || {},
          createdAt: currentSchedule.updatedAt || currentSchedule.createdAt || serverTimestamp(),
          createdBy: currentSchedule.createdBy || currentSchedule.modifiedBy || userId,
          createdByName: currentSchedule.createdByName || currentSchedule.modifiedByName || userName,
          accion: "modificado" as const,
          versionAnterior: true,
        })

        // Preparar datos de actualización
        const updateData: any = {
          assignments: newAssignments,
          updatedAt: serverTimestamp(),
          modifiedBy: userId,
          modifiedByName: userName,
        }

        // Preservar campos existentes
        if (currentSchedule.createdAt !== undefined && currentSchedule.createdAt !== null) {
          updateData.createdAt = currentSchedule.createdAt
        }
        if (currentSchedule.createdBy !== undefined) {
          updateData.createdBy = currentSchedule.createdBy
        }
        if (currentSchedule.createdByName !== undefined) {
          updateData.createdByName = currentSchedule.createdByName
        }
        if (currentSchedule.completada !== undefined) {
          updateData.completada = currentSchedule.completada
        }
        if (currentSchedule.completadaPor !== undefined) {
          updateData.completadaPor = currentSchedule.completadaPor
        }
        if (currentSchedule.completadaPorNombre !== undefined) {
          updateData.completadaPorNombre = currentSchedule.completadaPorNombre
        }
        if (currentSchedule.completadaEn !== undefined) {
          updateData.completadaEn = currentSchedule.completadaEn
        }
        if (currentSchedule.empleadosSnapshot !== undefined) {
          updateData.empleadosSnapshot = currentSchedule.empleadosSnapshot
        }
        if (currentSchedule.ordenEmpleadosSnapshot !== undefined) {
          updateData.ordenEmpleadosSnapshot = currentSchedule.ordenEmpleadosSnapshot
        }

        // Actualizar en Firestore
        await updateDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId), updateData)
        console.log(`[Copiar semana] Schedule actualizado con todas las asignaciones de una vez`)
      }

      toast({
        title: "Semana copiada",
        description: `Se copiaron ${updatesToPerform.length} celda${updatesToPerform.length !== 1 ? 's' : ''} de la semana anterior.`,
      })
    } catch (error: any) {
      console.error("[Copiar semana] Error general:", error)
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al copiar la semana anterior",
        variant: "destructive",
      })
    } finally {
      setIsCopying(false)
    }
  }, [getWeekSchedule, weekStartDate, weekDays, employees, weekSchedule, user, readonly, toast])

  // Función para limpiar toda la semana
  const handleClearWeek = useCallback(async () => {
    if (readonly || !db || !user) {
      return
    }

    setIsClearing(true)
    try {
      // Recolectar todas las celdas que necesitan ser limpiadas
      const updatesToClear: Array<{ date: string; employeeId: string }> = []

      for (const day of weekDays) {
        const dateStr = format(day, "yyyy-MM-dd")
        
        for (const employee of employees) {
          // Verificar si el empleado tiene asignaciones en este día
          const hasAssignments = weekSchedule?.assignments?.[dateStr]?.[employee.id]
          
          if (hasAssignments) {
            updatesToClear.push({ date: dateStr, employeeId: employee.id })
          }
        }
      }

      console.log(`[Limpiar semana] Total de celdas a limpiar: ${updatesToClear.length}`)

      if (updatesToClear.length === 0) {
        toast({
          title: "No hay asignaciones",
          description: "La semana no tiene asignaciones para limpiar.",
          variant: "default",
        })
        return
      }

      // Obtener el schedule actual directamente de Firestore para tener el estado más reciente
      const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
      let currentSchedule = weekSchedule
      let scheduleId: string | null = null

      if (currentSchedule?.id) {
        scheduleId = currentSchedule.id
        // Leer directamente de Firestore para obtener el estado más reciente
        try {
          const scheduleDoc = await getDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId))
          if (scheduleDoc.exists()) {
            currentSchedule = { id: scheduleDoc.id, ...scheduleDoc.data() } as Horario
            console.log(`[Limpiar semana] Schedule leído directamente de Firestore`)
          }
        } catch (error) {
          console.error(`[Limpiar semana] Error al leer schedule de Firestore:`, error)
        }
      }

      if (!currentSchedule) {
        toast({
          title: "Error",
          description: "No se encontró el horario de esta semana.",
          variant: "destructive",
        })
        return
      }

      // Construir el objeto completo de assignments eliminando las asignaciones
      const newAssignments: Record<string, Record<string, ShiftAssignment[]>> = currentSchedule.assignments 
        ? JSON.parse(JSON.stringify(currentSchedule.assignments)) // Deep copy
        : {}

      // Eliminar todas las asignaciones de las celdas que se van a limpiar
      for (const { date, employeeId } of updatesToClear) {
        if (newAssignments[date] && newAssignments[date][employeeId]) {
          delete newAssignments[date][employeeId]
          console.log(`[Limpiar semana] Eliminada asignación en memoria: ${date} - ${employeeId}`)
        }
        // Si la fecha queda vacía, eliminarla también
        if (newAssignments[date] && Object.keys(newAssignments[date]).length === 0) {
          delete newAssignments[date]
        }
      }

      // Actualizar schedule en Firestore
      scheduleId = currentSchedule.id
      const userName = user?.displayName || user?.email || "Usuario desconocido"
      const userId = user?.uid || ""

      // Guardar versión anterior en historial
      await addDoc(collection(db, COLLECTIONS.HISTORIAL), {
        horarioId: scheduleId,
        nombre: currentSchedule.nombre || `Semana del ${weekStartStr}`,
        semanaInicio: currentSchedule.semanaInicio || weekStartStr,
        semanaFin: currentSchedule.semanaFin || format(addDays(weekStartDate, 6), "yyyy-MM-dd"),
        assignments: currentSchedule.assignments || {},
        createdAt: currentSchedule.updatedAt || currentSchedule.createdAt || serverTimestamp(),
        createdBy: currentSchedule.createdBy || currentSchedule.modifiedBy || userId,
        createdByName: currentSchedule.createdByName || currentSchedule.modifiedByName || userName,
        accion: "modificado" as const,
        versionAnterior: true,
      })

      // Preparar datos de actualización
      const updateData: any = {
        assignments: newAssignments,
        updatedAt: serverTimestamp(),
        modifiedBy: userId,
        modifiedByName: userName,
      }

      // Preservar campos existentes
      if (currentSchedule.createdAt !== undefined && currentSchedule.createdAt !== null) {
        updateData.createdAt = currentSchedule.createdAt
      }
      if (currentSchedule.createdBy !== undefined) {
        updateData.createdBy = currentSchedule.createdBy
      }
      if (currentSchedule.createdByName !== undefined) {
        updateData.createdByName = currentSchedule.createdByName
      }
      if (currentSchedule.completada !== undefined) {
        updateData.completada = currentSchedule.completada
      }
      if (currentSchedule.completadaPor !== undefined) {
        updateData.completadaPor = currentSchedule.completadaPor
      }
      if (currentSchedule.completadaPorNombre !== undefined) {
        updateData.completadaPorNombre = currentSchedule.completadaPorNombre
      }
      if (currentSchedule.completadaEn !== undefined) {
        updateData.completadaEn = currentSchedule.completadaEn
      }
      if (currentSchedule.empleadosSnapshot !== undefined) {
        updateData.empleadosSnapshot = currentSchedule.empleadosSnapshot
      }
      if (currentSchedule.ordenEmpleadosSnapshot !== undefined) {
        updateData.ordenEmpleadosSnapshot = currentSchedule.ordenEmpleadosSnapshot
      }

      // Actualizar en Firestore
      await updateDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId), updateData)
      console.log(`[Limpiar semana] Schedule actualizado con todas las asignaciones eliminadas de una vez`)

      toast({
        title: "Semana limpiada",
        description: `Se limpiaron ${updatesToClear.length} celda${updatesToClear.length !== 1 ? 's' : ''} de la semana.`,
      })
    } catch (error: any) {
      console.error("Error al limpiar semana:", error)
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al limpiar la semana",
        variant: "destructive",
      })
    } finally {
      setIsClearing(false)
    }
  }, [weekDays, employees, weekSchedule, weekStartDate, user, readonly, toast])

  // Función para limpiar la fila de un empleado específico
  const handleClearEmployeeRow = useCallback(async (employeeId: string): Promise<boolean> => {
    if (readonly || !db || !user || !weekSchedule) {
      return false
    }

    try {
      const employee = employees.find((emp) => emp.id === employeeId)
      const employeeName = employee?.name || "empleado"

      // Recolectar todas las celdas que necesitan ser limpiadas
      const updatesToClear: Array<{ date: string }> = []

      for (const day of weekDays) {
        const dateStr = format(day, "yyyy-MM-dd")
        
        // Verificar si el empleado tiene asignaciones en este día
        const hasAssignments = weekSchedule.assignments?.[dateStr]?.[employeeId]
        
        if (hasAssignments) {
          updatesToClear.push({ date: dateStr })
        }
      }

      console.log(`[Limpiar fila empleado] Total de celdas a limpiar para ${employeeName}: ${updatesToClear.length}`)

      if (updatesToClear.length === 0) {
        toast({
          title: "No hay asignaciones",
          description: `${employeeName} no tiene asignaciones para limpiar.`,
          variant: "default",
        })
        return false
      }

      // Obtener el schedule actual directamente de Firestore para tener el estado más reciente
      const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
      let currentSchedule = weekSchedule
      let scheduleId: string | null = null

      if (currentSchedule?.id) {
        scheduleId = currentSchedule.id
        // Leer directamente de Firestore para obtener el estado más reciente
        try {
          const scheduleDoc = await getDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId))
          if (scheduleDoc.exists()) {
            currentSchedule = { id: scheduleDoc.id, ...scheduleDoc.data() } as Horario
            console.log(`[Limpiar fila empleado] Schedule leído directamente de Firestore`)
          }
        } catch (error) {
          console.error(`[Limpiar fila empleado] Error al leer schedule de Firestore:`, error)
        }
      }

      // Construir el objeto completo de assignments eliminando las asignaciones del empleado
      const newAssignments: Record<string, Record<string, ShiftAssignment[]>> = currentSchedule.assignments 
        ? JSON.parse(JSON.stringify(currentSchedule.assignments)) // Deep copy
        : {}

      // Eliminar todas las asignaciones del empleado
      for (const { date } of updatesToClear) {
        if (newAssignments[date] && newAssignments[date][employeeId]) {
          delete newAssignments[date][employeeId]
          console.log(`[Limpiar fila empleado] Eliminada asignación en memoria: ${date} - ${employeeId}`)
        }
        // Si la fecha queda vacía, eliminarla también
        if (newAssignments[date] && Object.keys(newAssignments[date]).length === 0) {
          delete newAssignments[date]
        }
      }

      // Actualizar schedule en Firestore
      scheduleId = currentSchedule.id
      const userName = user?.displayName || user?.email || "Usuario desconocido"
      const userId = user?.uid || ""

      // Guardar versión anterior en historial
      await addDoc(collection(db, COLLECTIONS.HISTORIAL), {
        horarioId: scheduleId,
        nombre: currentSchedule.nombre || `Semana del ${weekStartStr}`,
        semanaInicio: currentSchedule.semanaInicio || weekStartStr,
        semanaFin: currentSchedule.semanaFin || format(addDays(weekStartDate, 6), "yyyy-MM-dd"),
        assignments: currentSchedule.assignments || {},
        createdAt: currentSchedule.updatedAt || currentSchedule.createdAt || serverTimestamp(),
        createdBy: currentSchedule.createdBy || currentSchedule.modifiedBy || userId,
        createdByName: currentSchedule.createdByName || currentSchedule.modifiedByName || userName,
        accion: "modificado" as const,
        versionAnterior: true,
      })

      // Preparar datos de actualización
      const updateData: any = {
        assignments: newAssignments,
        updatedAt: serverTimestamp(),
        modifiedBy: userId,
        modifiedByName: userName,
      }

      // Preservar campos existentes
      if (currentSchedule.createdAt !== undefined && currentSchedule.createdAt !== null) {
        updateData.createdAt = currentSchedule.createdAt
      }
      if (currentSchedule.createdBy !== undefined) {
        updateData.createdBy = currentSchedule.createdBy
      }
      if (currentSchedule.createdByName !== undefined) {
        updateData.createdByName = currentSchedule.createdByName
      }
      if (currentSchedule.completada !== undefined) {
        updateData.completada = currentSchedule.completada
      }
      if (currentSchedule.completadaPor !== undefined) {
        updateData.completadaPor = currentSchedule.completadaPor
      }
      if (currentSchedule.completadaPorNombre !== undefined) {
        updateData.completadaPorNombre = currentSchedule.completadaPorNombre
      }
      if (currentSchedule.completadaEn !== undefined) {
        updateData.completadaEn = currentSchedule.completadaEn
      }
      if (currentSchedule.empleadosSnapshot !== undefined) {
        updateData.empleadosSnapshot = currentSchedule.empleadosSnapshot
      }
      if (currentSchedule.ordenEmpleadosSnapshot !== undefined) {
        updateData.ordenEmpleadosSnapshot = currentSchedule.ordenEmpleadosSnapshot
      }

      // Actualizar en Firestore
      await updateDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId), updateData)
      console.log(`[Limpiar fila empleado] Schedule actualizado con todas las asignaciones del empleado eliminadas de una vez`)

      toast({
        title: "Fila limpiada",
        description: `Se limpiaron todas las asignaciones de ${employeeName}.`,
      })

      return true
    } catch (error: any) {
      console.error("Error al limpiar fila del empleado:", error)
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al limpiar la fila del empleado",
        variant: "destructive",
      })
      return false
    }
  }, [weekDays, employees, weekSchedule, weekStartDate, user, readonly, toast])

  // Handler para exportar que abre la semana si está cerrada
  const handleExportImage = async () => {
    if (!isOpen && handleOpenChange) {
      // Abrir la semana primero
      handleOpenChange(true)
      // Esperar a que la animación termine (300ms según la duración de la animación)
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    onExportImage?.(weekStartDate, weekEndDate)
  }

  const handleExportPDF = async () => {
    if (!isOpen && handleOpenChange) {
      // Abrir la semana primero
      handleOpenChange(true)
      // Esperar a que la animación termine
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    onExportPDF?.(weekStartDate, weekEndDate)
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className="space-y-2"
    >
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm transition-colors">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="h-auto p-0 hover:bg-accent/50 flex-1 justify-start text-left bg-transparent border-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
            aria-label={isOpen ? "Contraer semana" : "Expandir semana"}
          >
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
              )}
              <h3 className="text-2xl font-semibold text-foreground">{headerTitle}</h3>
              {isCompleted && (
                <Badge variant="default" className="ml-2 bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completada
                </Badge>
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
          {!readonly && getWeekSchedule && onAssignmentUpdate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPreviousWeek}
              disabled={isCopying || exporting || isClearing}
              aria-label="Copiar semana anterior"
            >
              {isCopying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Copiando...
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar semana anterior
                </>
              )}
            </Button>
          )}
          {!readonly && onAssignmentUpdate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearWeek}
              disabled={isClearing || exporting || isCopying}
              aria-label="Limpiar semana"
            >
              {isClearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Limpiando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpiar semana
                </>
              )}
            </Button>
          )}
          {!readonly && user && onMarkComplete && (
            <Button
              variant={isCompleted ? "default" : "outline"}
              size="sm"
              onClick={handleMarkComplete}
              disabled={isMarkingComplete}
              aria-label={isCompleted ? "Desmarcar semana como completada" : "Marcar semana como completada"}
              className={isCompleted ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {isMarkingComplete ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isCompleted ? "Desmarcando..." : "Marcando..."}
                </>
              ) : (
                <>
                  {isCompleted ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Listo
                    </>
                  ) : (
                    <>
                      <Circle className="mr-2 h-4 w-4" />
                      Marcar como listo
                    </>
                  )}
                </>
              )}
            </Button>
          )}
          {canShowActions && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportImage}
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
                onClick={handleExportPDF}
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
            </>
          )}
        </div>
      </div>
      <CollapsibleContent 
        id={weekId} 
        className="overflow-hidden transition-all duration-300 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      >
        <div className="pt-2">
          <ScheduleGrid
            weekDays={weekDays}
            employees={employees}
            allEmployees={allEmployees || employees}
            shifts={shifts}
            schedule={weekSchedule}
            onAssignmentUpdate={onAssignmentUpdate}
            monthRange={monthRange}
            mediosTurnos={mediosTurnos}
            employeeStats={employeeStats}
            readonly={readonly}
            isScheduleCompleted={isCompleted}
            lastCompletedWeekStart={lastCompletedWeekStart}
            onClearEmployeeRow={!readonly && user ? handleClearEmployeeRow : undefined}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

