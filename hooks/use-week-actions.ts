import { useState, useCallback } from "react"
import { format, subDays, addDays, getDay, parseISO } from "date-fns"
import { serverTimestamp, addDoc, collection } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import type { Empleado, Horario, ShiftAssignment, ShiftAssignmentValue, Configuracion } from "@/lib/types"
import {
  normalizeAssignments,
  cloneAssignments,
  updateAssignmentInAssignments,
  removeAssignmentFromAssignments,
  isScheduleCompleted,
  shouldRequestConfirmation,
} from "@/lib/schedule-utils"
import {
  getLatestScheduleFromFirestore,
  createHistoryEntry,
  saveHistoryEntry,
  updateSchedulePreservingFields,
} from "@/lib/firestore-helpers"
import { getSuggestionForDay } from "@/lib/pattern-learning"

interface UseWeekActionsProps {
  weekDays: Date[]
  weekStartDate: Date
  weekSchedule: Horario | null
  employees: Empleado[]
  user: any
  readonly: boolean
  getWeekSchedule?: (weekStartDate: Date) => Horario | null
  config?: Configuracion | null
  allSchedules?: Horario[]
  weekStartsOn?: number
}

export interface WeekActionsReturn {
  // Estados de loading
  isCopying: boolean
  isClearing: boolean
  isSuggesting: boolean
  isPasting: boolean
  
  // Funciones de acción
  executeCopyPreviousWeek: () => Promise<void>
  executeClearWeek: () => Promise<void>
  executeClearEmployeeRow: (employeeId: string) => Promise<boolean>
  executeSuggestSchedules: () => Promise<void>
  executeReplaceWeekAssignments: (targetWeekStart: Date, weekData: any) => Promise<void>
  
  // Funciones wrapper que manejan confirmaciones
  handleCopyPreviousWeek: () => Promise<void>
  handleClearWeek: () => Promise<void>
  handleClearEmployeeRow: (employeeId: string) => Promise<boolean>
  handleSuggestSchedules: () => Promise<void>
}

export function useWeekActions({
  weekDays,
  weekStartDate,
  weekSchedule,
  employees,
  user,
  readonly,
  getWeekSchedule,
  config,
  allSchedules = [],
  weekStartsOn = 1,
}: UseWeekActionsProps): WeekActionsReturn {
  const { toast } = useToast()
  const [isCopying, setIsCopying] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [isPasting, setIsPasting] = useState(false)

  const executeCopyPreviousWeek = useCallback(async () => {
    if (!getWeekSchedule || readonly || !db || !user) {
      return
    }

    setIsCopying(true)
    try {
      // Calcular la semana anterior (7 días antes)
      const previousWeekStartDate = subDays(weekStartDate, 7)
      const previousWeekSchedule = getWeekSchedule(previousWeekStartDate)

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

      // Recolectar todas las actualizaciones a realizar
      const updatesToPerform: Array<{
        date: string
        employeeId: string
        assignments: ShiftAssignment[]
      }> = []

      // Recolectar todas las actualizaciones
      for (let i = 0; i < weekDays.length; i++) {
        const currentDay = weekDays[i]
        const previousDay = subDays(currentDay, 7)
        const currentDateStr = format(currentDay, "yyyy-MM-dd")
        const previousDateStr = format(previousDay, "yyyy-MM-dd")

        const previousDayAssignments = previousWeekSchedule.assignments[previousDateStr]
        if (!previousDayAssignments) {
          continue
        }

        // Recolectar asignaciones de cada empleado
        for (const [employeeId, assignmentValue] of Object.entries(previousDayAssignments)) {
          // Solo copiar si el empleado existe actualmente
          if (!currentEmployeeIds.has(employeeId)) {
            continue
          }

          // Normalizar las asignaciones
          const normalizedAssignments = normalizeAssignments(assignmentValue)

          if (normalizedAssignments.length > 0) {
            updatesToPerform.push({
              date: currentDateStr,
              employeeId,
              assignments: normalizedAssignments,
            })
          }
        }
      }

      if (updatesToPerform.length === 0) {
        toast({
          title: "No se copió nada",
          description: "No se encontraron asignaciones para empleados actuales en la semana anterior.",
          variant: "default",
        })
        return
      }

      // Usar el schedule del estado, solo leer de Firestore si realmente no existe
      let currentSchedule = weekSchedule
      const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
      const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")

      // Si no existe schedule, necesitamos crearlo
      if (!currentSchedule) {
        // Construir el objeto completo de assignments aplicando todas las actualizaciones
        const newAssignments: Record<string, Record<string, ShiftAssignment[]>> = {}

        // Aplicar todas las actualizaciones al objeto de assignments
        for (const update of updatesToPerform) {
          if (!newAssignments[update.date]) {
            newAssignments[update.date] = {}
          }
          newAssignments[update.date][update.employeeId] = update.assignments
        }

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
        const scheduleId = scheduleRef.id

        // Guardar en historial usando helper
        const historyEntry = createHistoryEntry(
          { id: scheduleId, ...newScheduleData } as Horario,
          "creado",
          user,
          weekStartStr,
          weekEndStr
        )
        await saveHistoryEntry(historyEntry)

        toast({
          title: "Semana copiada",
          description: `Se copiaron ${updatesToPerform.length} celda${updatesToPerform.length !== 1 ? 's' : ''} de la semana anterior.`,
        })
        return
      }

      // Actualizar schedule existente
      // Usar el schedule del estado en lugar de leer de Firestore (el listener ya lo actualiza)
      const scheduleId = currentSchedule.id
      const userName = user?.displayName || user?.email || "Usuario desconocido"
      const userId = user?.uid || ""

      // Construir el objeto completo de assignments aplicando todas las actualizaciones
      const newAssignments = currentSchedule.assignments
        ? cloneAssignments(currentSchedule.assignments)
        : {}

      // Aplicar todas las actualizaciones al objeto de assignments
      for (const update of updatesToPerform) {
        newAssignments[update.date] = {
          ...(newAssignments[update.date] || {}),
          [update.employeeId]: update.assignments,
        }
      }

      // Guardar versión anterior en historial usando helper
      const historyEntry = createHistoryEntry(currentSchedule, "modificado", user, weekStartStr, weekEndStr)
      await saveHistoryEntry(historyEntry)

      // Preparar datos de actualización
      const updateData: any = {
        assignments: newAssignments,
        updatedAt: serverTimestamp(),
        modifiedBy: userId,
        modifiedByName: userName,
      }

      // Actualizar usando helper que preserva campos
      await updateSchedulePreservingFields(scheduleId, currentSchedule, updateData)

      toast({
        title: "Semana copiada",
        description: `Se copiaron ${updatesToPerform.length} celda${updatesToPerform.length !== 1 ? 's' : ''} de la semana anterior.`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al copiar la semana anterior",
        variant: "destructive",
      })
    } finally {
      setIsCopying(false)
    }
  }, [getWeekSchedule, weekStartDate, weekDays, employees, weekSchedule, user, readonly, toast])

  const executeClearWeek = useCallback(async () => {
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

      if (updatesToClear.length === 0) {
        toast({
          title: "No hay asignaciones",
          description: "La semana no tiene asignaciones para limpiar.",
          variant: "default",
        })
        return
      }

      const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
      const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")

      // Usar el schedule del estado en lugar de leer de Firestore
      if (!weekSchedule) {
        toast({
          title: "Error",
          description: "No se encontró el horario de esta semana.",
          variant: "destructive",
        })
        return
      }

      // Construir el objeto completo de assignments eliminando las asignaciones
      let newAssignments = weekSchedule.assignments
        ? cloneAssignments(weekSchedule.assignments)
        : {}

      // Eliminar todas las asignaciones de las celdas que se van a limpiar
      for (const { date, employeeId } of updatesToClear) {
        newAssignments = removeAssignmentFromAssignments(newAssignments, date, employeeId)
      }

      const scheduleId = weekSchedule.id
      const userName = user?.displayName || user?.email || "Usuario desconocido"
      const userId = user?.uid || ""

      // Guardar versión anterior en historial usando helper
      const historyEntry = createHistoryEntry(weekSchedule, "modificado", user, weekStartStr, weekEndStr)
      await saveHistoryEntry(historyEntry)

      // Preparar datos de actualización
      const updateData: any = {
        assignments: newAssignments,
        updatedAt: serverTimestamp(),
        modifiedBy: userId,
        modifiedByName: userName,
      }

      // Actualizar usando helper que preserva campos
      await updateSchedulePreservingFields(scheduleId, weekSchedule, updateData)

      toast({
        title: "Semana limpiada",
        description: `Se limpiaron ${updatesToClear.length} celda${updatesToClear.length !== 1 ? 's' : ''} de la semana.`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al limpiar la semana",
        variant: "destructive",
      })
    } finally {
      setIsClearing(false)
    }
  }, [weekDays, employees, weekSchedule, weekStartDate, user, readonly, toast])

  const executeClearEmployeeRow = useCallback(
    async (employeeId: string): Promise<boolean> => {
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

        if (updatesToClear.length === 0) {
          toast({
            title: "No hay asignaciones",
            description: `${employeeName} no tiene asignaciones para limpiar.`,
            variant: "default",
          })
          return false
        }

        const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
        const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")

        // Construir el objeto completo de assignments eliminando las asignaciones del empleado
        let newAssignments = weekSchedule.assignments
          ? cloneAssignments(weekSchedule.assignments)
          : {}

        // Eliminar todas las asignaciones del empleado
        for (const { date } of updatesToClear) {
          newAssignments = removeAssignmentFromAssignments(newAssignments, date, employeeId)
        }

        const scheduleId = weekSchedule.id
        const userName = user?.displayName || user?.email || "Usuario desconocido"
        const userId = user?.uid || ""

        // Guardar versión anterior en historial usando helper
        const historyEntry = createHistoryEntry(weekSchedule, "modificado", user, weekStartStr, weekEndStr)
        await saveHistoryEntry(historyEntry)

        // Preparar datos de actualización
        const updateData: any = {
          assignments: newAssignments,
          updatedAt: serverTimestamp(),
          modifiedBy: userId,
          modifiedByName: userName,
        }

        // Actualizar usando helper que preserva campos
        await updateSchedulePreservingFields(scheduleId, weekSchedule, updateData)

        toast({
          title: "Fila limpiada",
          description: `Se limpiaron todas las asignaciones de ${employeeName}.`,
        })

        return true
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al limpiar la fila del empleado",
          variant: "destructive",
        })
        return false
      }
    },
    [weekDays, employees, weekSchedule, weekStartDate, user, readonly, toast]
  )

  // Funciones wrapper que manejan confirmaciones para semanas completadas
  const handleCopyPreviousWeek = useCallback(async () => {
    if (!getWeekSchedule || readonly || !db || !user) {
      return
    }

    // Si la semana está completada, retornar señal para mostrar confirmación
    if (shouldRequestConfirmation(weekSchedule, "copy")) {
      throw new Error("NEEDS_CONFIRMATION")
    }

    await executeCopyPreviousWeek()
  }, [getWeekSchedule, readonly, db, user, weekSchedule, executeCopyPreviousWeek])

  const handleClearWeek = useCallback(async () => {
    if (readonly || !db || !user) {
      return
    }

    // Si la semana está completada, retornar señal para mostrar confirmación
    if (shouldRequestConfirmation(weekSchedule, "clear")) {
      throw new Error("NEEDS_CONFIRMATION")
    }

    await executeClearWeek()
  }, [readonly, db, user, weekSchedule, executeClearWeek])

  const handleClearEmployeeRow = useCallback(
    async (employeeId: string): Promise<boolean> => {
      if (readonly || !db || !user || !weekSchedule) {
        return false
      }

      // Si la semana está completada, retornar señal para mostrar confirmación
      if (shouldRequestConfirmation(weekSchedule, "clear")) {
        throw new Error("NEEDS_CONFIRMATION")
      }

      return await executeClearEmployeeRow(employeeId)
    },
    [readonly, db, user, weekSchedule, executeClearEmployeeRow]
  )

  const executeSuggestSchedules = useCallback(async () => {
    if (readonly || !db || !user) {
      return
    }

    setIsSuggesting(true)
    try {
      const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
      const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")

      // Aplicar horarios fijos
      const suggestedAssignments: Record<string, Record<string, ShiftAssignment[]>> = {}
      
      if (!config?.fixedSchedules || config.fixedSchedules.length === 0) {
        toast({
          title: "No hay horarios fijos",
          description: "No hay horarios marcados como fijos para sugerir.",
          variant: "default",
        })
        return
      }

      // Para cada día de la semana
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(weekStartDate)
        date.setDate(date.getDate() + dayOffset)
        const dateStr = format(date, "yyyy-MM-dd")
        const dayOfWeek = getDay(date)

        // Buscar horarios fijos para este día
        const fixedForDay = config.fixedSchedules.filter((fixed) => fixed.dayOfWeek === dayOfWeek)
        
        for (const fixed of fixedForDay) {
          const employee = employees.find((e) => e.id === fixed.employeeId)
          if (!employee) continue

          // Verificar si ya hay una asignación en esta celda (no sobrescribir)
          if (weekSchedule?.assignments?.[dateStr]?.[fixed.employeeId]) {
            const currentAssignments = weekSchedule.assignments[dateStr][fixed.employeeId]
            if (Array.isArray(currentAssignments) && currentAssignments.length > 0) {
              // Ya hay asignaciones, omitir este empleado en este día
              continue
            }
          }

          let assignmentsToApply: ShiftAssignment[] | null = null

          // 1. Primero verificar si hay asignaciones guardadas cuando se marcó como fijo
          if (fixed.assignments && fixed.assignments.length > 0) {
            assignmentsToApply = fixed.assignments
          }
          // 2. Si no, buscar sugerencia automática
          else {
            const suggestion = getSuggestionForDay(fixed.employeeId, dayOfWeek, allSchedules, weekStartStr)
            if (suggestion && suggestion.assignments.length > 0) {
              assignmentsToApply = suggestion.assignments
            }
          }

          // 3. Si aún no hay, buscar en la última semana completada
          if (!assignmentsToApply || assignmentsToApply.length === 0) {
            const completedSchedules = allSchedules
              .filter((s) => s.completada === true && s.weekStart && s.weekStart < weekStartStr)
              .sort((a, b) => {
                const dateA = a.weekStart || a.semanaInicio || ""
                const dateB = b.weekStart || b.semanaInicio || ""
                return dateB.localeCompare(dateA) // Más reciente primero
              })

            // Buscar en la última semana completada
            for (const completedSchedule of completedSchedules) {
              const completedWeekStart = parseISO(completedSchedule.weekStart || completedSchedule.semanaInicio)
              const completedDate = new Date(completedWeekStart)
              completedDate.setDate(completedDate.getDate() + dayOffset)
              const completedDateStr = format(completedDate, "yyyy-MM-dd")
              
              const completedAssignments = completedSchedule.assignments[completedDateStr]
              if (completedAssignments && completedAssignments[fixed.employeeId]) {
                const normalized = normalizeAssignments(completedAssignments[fixed.employeeId])
                if (normalized.length > 0) {
                  assignmentsToApply = normalized
                  break // Usar la primera semana completada que tenga asignaciones
                }
              }
            }
          }

          // 4. Si aún no hay, buscar en la semana actual (si tiene asignaciones)
          if ((!assignmentsToApply || assignmentsToApply.length === 0) && weekSchedule) {
            const currentAssignments = weekSchedule.assignments[dateStr]
            if (currentAssignments && currentAssignments[fixed.employeeId]) {
              const normalized = normalizeAssignments(currentAssignments[fixed.employeeId])
              if (normalized.length > 0) {
                assignmentsToApply = normalized
              }
            }
          }

          // Aplicar si encontramos asignaciones
          if (assignmentsToApply && assignmentsToApply.length > 0) {
            if (!suggestedAssignments[dateStr]) {
              suggestedAssignments[dateStr] = {}
            }
            suggestedAssignments[dateStr][fixed.employeeId] = assignmentsToApply
          }
        }
      }

      if (Object.keys(suggestedAssignments).length === 0) {
        toast({
          title: "No se encontraron sugerencias",
          description: "No se encontraron horarios fijos para aplicar en esta semana.",
          variant: "default",
        })
        return
      }

      // Crear o actualizar el schedule
      const userName = user?.displayName || user?.email || "Usuario desconocido"
      const userId = user?.uid || ""

      if (!weekSchedule) {
        // Crear nuevo schedule
        const newScheduleData = {
          nombre: `Semana del ${weekStartStr}`,
          weekStart: weekStartStr,
          semanaInicio: weekStartStr,
          semanaFin: weekEndStr,
          assignments: suggestedAssignments,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userId,
          createdByName: userName,
        }

        const scheduleRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), newScheduleData)
        const scheduleId = scheduleRef.id

        // Guardar en historial
        const historyEntry = createHistoryEntry(
          { id: scheduleId, ...newScheduleData } as Horario,
          "creado",
          user,
          weekStartStr,
          weekEndStr
        )
        await saveHistoryEntry(historyEntry)

        toast({
          title: "Horarios sugeridos aplicados",
          description: "Se aplicaron los horarios fijos a la semana.",
        })
      } else {
        // Actualizar schedule existente
        const scheduleId = weekSchedule.id

        // Combinar con asignaciones existentes (las sugerencias no sobrescriben)
        const currentAssignments = weekSchedule.assignments
          ? cloneAssignments(weekSchedule.assignments)
          : {}

        // Aplicar solo donde no hay asignaciones existentes
        for (const [date, dateAssignments] of Object.entries(suggestedAssignments)) {
          if (!currentAssignments[date]) {
            currentAssignments[date] = {}
          }
          for (const [employeeId, assignments] of Object.entries(dateAssignments)) {
            // Solo aplicar si no hay asignaciones existentes para este empleado en este día
            if (!currentAssignments[date][employeeId] || 
                (Array.isArray(currentAssignments[date][employeeId]) && 
                 currentAssignments[date][employeeId].length === 0)) {
              currentAssignments[date][employeeId] = assignments
            }
          }
        }

        // Guardar versión anterior en historial
        const historyEntry = createHistoryEntry(weekSchedule, "modificado", user, weekStartStr, weekEndStr)
        await saveHistoryEntry(historyEntry)

        // Actualizar
        const updateData: any = {
          assignments: currentAssignments,
          updatedAt: serverTimestamp(),
          modifiedBy: userId,
          modifiedByName: userName,
        }

        await updateSchedulePreservingFields(scheduleId, weekSchedule, updateData)

        toast({
          title: "Horarios sugeridos aplicados",
          description: "Se aplicaron los horarios fijos donde no había asignaciones.",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al aplicar las sugerencias",
        variant: "destructive",
      })
    } finally {
      setIsSuggesting(false)
    }
  }, [readonly, db, user, weekStartDate, employees, config, allSchedules, weekSchedule, toast])

  const handleSuggestSchedules = useCallback(async () => {
    if (readonly || !db || !user) {
      return
    }

    // Si la semana está completada, retornar señal para mostrar confirmación
    if (shouldRequestConfirmation(weekSchedule, "edit")) {
      throw new Error("NEEDS_CONFIRMATION")
    }

    await executeSuggestSchedules()
  }, [readonly, db, user, weekSchedule, executeSuggestSchedules])

  const executeReplaceWeekAssignments = useCallback(async (targetWeekStart: Date, weekData: any) => {
    if (readonly || !db || !user || !weekData?.assignments) {
      return
    }

    setIsPasting(true)
    try {
      const weekStartStr = format(targetWeekStart, "yyyy-MM-dd")
      const weekEndStr = format(addDays(targetWeekStart, 6), "yyyy-MM-dd")

      // Crear un mapa de empleados actuales para verificación rápida
      const currentEmployeeIds = new Set(employees.map((emp) => emp.id))

      // Obtener las fechas de la semana objetivo (7 días)
      const targetWeekDates: Date[] = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(targetWeekStart)
        date.setDate(date.getDate() + i)
        targetWeekDates.push(date)
      }

      // Obtener las fechas de la semana copiada
      const copiedWeekStartDate = new Date(weekData.weekStartDate)
      const copiedWeekDates: Date[] = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(copiedWeekStartDate)
        date.setDate(date.getDate() + i)
        copiedWeekDates.push(date)
      }

      // Construir el objeto completo de assignments para la semana objetivo
      const newAssignments: Record<string, Record<string, ShiftAssignment[]>> = {}

      // Mapear las asignaciones por día de la semana (lunes, martes, etc.)
      copiedWeekDates.forEach((date, dayIndex) => {
        const dateStr = format(date, "yyyy-MM-dd")
        const assignments = weekData.assignments[dateStr]
        
        if (assignments && typeof assignments === 'object') {
          // Mapear al día correspondiente de la semana objetivo
          const targetDate = targetWeekDates[dayIndex]
          const targetDateStr = format(targetDate, "yyyy-MM-dd")
          
          // Filtrar solo empleados que existen actualmente
          const filteredAssignments: Record<string, ShiftAssignment[]> = {}
          
          for (const [employeeId, assignmentValue] of Object.entries(assignments)) {
            if (currentEmployeeIds.has(employeeId)) {
              const normalizedAssignments = normalizeAssignments(assignmentValue as ShiftAssignmentValue)
              if (normalizedAssignments.length > 0) {
                filteredAssignments[employeeId] = normalizedAssignments
              }
            }
          }
          
          if (Object.keys(filteredAssignments).length > 0) {
            newAssignments[targetDateStr] = filteredAssignments
          }
        }
      })

      if (Object.keys(newAssignments).length === 0) {
        toast({
          title: "No se pegó nada",
          description: "No se encontraron asignaciones válidas para empleados actuales.",
          variant: "default",
        })
        return
      }

      const userName = user?.displayName || user?.email || "Usuario desconocido"
      const userId = user?.uid || ""

      // Crear o actualizar el schedule
      if (!weekSchedule) {
        // Crear nuevo schedule
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
        const scheduleId = scheduleRef.id

        // Guardar en historial
        const historyEntry = createHistoryEntry(
          { id: scheduleId, ...newScheduleData } as Horario,
          "creado",
          user,
          weekStartStr,
          weekEndStr
        )
        await saveHistoryEntry(historyEntry)

        toast({
          title: "Semana pegada",
          description: `Se pegaron ${Object.keys(newAssignments).length} día${Object.keys(newAssignments).length !== 1 ? 's' : ''} con asignaciones.`,
        })
      } else {
        // Actualizar schedule existente
        const scheduleId = weekSchedule.id

        // Guardar versión anterior en historial
        const historyEntry = createHistoryEntry(weekSchedule, "modificado", user, weekStartStr, weekEndStr)
        await saveHistoryEntry(historyEntry)

        // Preparar datos de actualización
        const updateData: any = {
          assignments: newAssignments,
          updatedAt: serverTimestamp(),
          modifiedBy: userId,
          modifiedByName: userName,
        }

        // Actualizar usando helper que preserva campos
        await updateSchedulePreservingFields(scheduleId, weekSchedule, updateData)

        toast({
          title: "Semana pegada",
          description: `Se pegaron ${Object.keys(newAssignments).length} día${Object.keys(newAssignments).length !== 1 ? 's' : ''} con asignaciones.`,
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al pegar la semana",
        variant: "destructive",
      })
    } finally {
      setIsPasting(false)
    }
  }, [readonly, employees, weekSchedule, user, toast])

  return {
    isCopying,
    isClearing,
    isSuggesting,
    isPasting,
    executeCopyPreviousWeek,
    executeClearWeek,
    executeClearEmployeeRow,
    executeSuggestSchedules,
    executeReplaceWeekAssignments,
    handleCopyPreviousWeek,
    handleClearWeek,
    handleClearEmployeeRow,
    handleSuggestSchedules,
  }
}

