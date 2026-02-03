import { useState, useCallback } from "react"
import { format, subDays, addDays } from "date-fns"
import { serverTimestamp, addDoc, collection } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import type { Empleado, Horario, ShiftAssignment } from "@/lib/types"
import {
  normalizeAssignments,
  cloneAssignments,
  removeAssignmentFromAssignments,
  shouldRequestConfirmation,
} from "@/lib/schedule-utils"
import {
  createHistoryEntry,
  saveHistoryEntry,
  updateSchedulePreservingFields,
} from "@/lib/firestore-helpers"

interface UseWeekActionsProps {
  weekDays: Date[]
  weekStartDate: Date
  weekSchedule: Horario | null
  employees: Empleado[]
  user: any
  readonly: boolean
  getWeekSchedule?: (weekStartDate: Date) => Horario | null
}

export interface WeekActionsReturn {
  // Estados de loading
  isCopying: boolean
  isClearing: boolean
  
  // Funciones de acción
  executeCopyPreviousWeek: () => Promise<void>
  executeClearWeek: () => Promise<void>
  executeClearEmployeeRow: (employeeId: string) => Promise<boolean>
  
  // Funciones wrapper que manejan confirmaciones
  handleCopyPreviousWeek: () => Promise<void>
  handleClearWeek: () => Promise<void>
  handleClearEmployeeRow: (employeeId: string) => Promise<boolean>
}

export function useWeekActions({
  weekDays,
  weekStartDate,
  weekSchedule,
  employees,
  user,
  readonly,
  getWeekSchedule,
}: UseWeekActionsProps): WeekActionsReturn {
  const { toast } = useToast()
  const [isCopying, setIsCopying] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

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
      const dayStatusToApply: Record<string, Record<string, "normal" | "franco" | "medio_franco">> = {}

      // Recolectar todas las actualizaciones
      for (let i = 0; i < weekDays.length; i++) {
        const currentDay = weekDays[i]
        const previousDay = subDays(currentDay, 7)
        const currentDateStr = format(currentDay, "yyyy-MM-dd")
        const previousDateStr = format(previousDay, "yyyy-MM-dd")

        const previousDayAssignments = previousWeekSchedule.assignments[previousDateStr]
        if (!previousDayAssignments) {
          // Aún podemos tener dayStatus para este día
          const previousDayStatus = previousWeekSchedule.dayStatus?.[previousDateStr] || {}
          for (const [employeeId, status] of Object.entries(previousDayStatus)) {
            if (!currentEmployeeIds.has(employeeId)) {
              continue
            }
            if (!dayStatusToApply[currentDateStr]) {
              dayStatusToApply[currentDateStr] = {}
            }
            dayStatusToApply[currentDateStr][employeeId] = status
          }
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

          const previousDayStatus = previousWeekSchedule.dayStatus?.[previousDateStr]?.[employeeId]
          if (!dayStatusToApply[currentDateStr]) {
            dayStatusToApply[currentDateStr] = {}
          }
          dayStatusToApply[currentDateStr][employeeId] = previousDayStatus || "normal"
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
          dayStatus: dayStatusToApply,
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
      const updatedDayStatus = { ...(currentSchedule.dayStatus || {}) }
      Object.entries(dayStatusToApply).forEach(([date, statuses]) => {
        updatedDayStatus[date] = {
          ...(updatedDayStatus[date] || {}),
          ...statuses,
        }
      })

      const updateData: any = {
        assignments: newAssignments,
        dayStatus: updatedDayStatus,
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

      const hasDayStatusEntries = weekDays.some((day) => {
        const dateStr = format(day, "yyyy-MM-dd")
        return !!weekSchedule?.dayStatus?.[dateStr]
      })

      if (updatesToClear.length === 0 && !hasDayStatusEntries) {
        toast({
          title: "No hay asignaciones",
          description: "La semana no tiene asignaciones para limpiar.",
          variant: "default",
        })
        return
      }

      const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
      const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")

      // Si no existe schedule, crear uno vacío primero
      if (!weekSchedule) {
        const userName = user?.displayName || user?.email || "Usuario desconocido"
        const userId = user?.uid || ""

        const newScheduleData = {
          nombre: `Semana del ${weekStartStr}`,
          weekStart: weekStartStr,
          semanaInicio: weekStartStr,
          semanaFin: weekEndStr,
          assignments: {},
          dayStatus: {},
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
          title: "Semana limpiada",
          description: "La semana fue creada y limpiada correctamente.",
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

      const updatedDayStatus = { ...(weekSchedule.dayStatus || {}) }
      for (const day of weekDays) {
        const dateStr = format(day, "yyyy-MM-dd")
        if (updatedDayStatus[dateStr]) {
          delete updatedDayStatus[dateStr]
        }
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
        dayStatus: updatedDayStatus,
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

        const hasDayStatusEntries = weekDays.some((day) => {
          const dateStr = format(day, "yyyy-MM-dd")
          return !!weekSchedule?.dayStatus?.[dateStr]?.[employeeId]
        })

        if (updatesToClear.length === 0 && !hasDayStatusEntries) {
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

        const updatedDayStatus = { ...(weekSchedule.dayStatus || {}) }
        for (const { date } of updatesToClear) {
          if (updatedDayStatus[date]?.[employeeId]) {
            delete updatedDayStatus[date][employeeId]
            if (Object.keys(updatedDayStatus[date]).length === 0) {
              delete updatedDayStatus[date]
            }
          }
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
          dayStatus: updatedDayStatus,
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

  return {
    isCopying,
    isClearing,
    executeCopyPreviousWeek,
    executeClearWeek,
    executeClearEmployeeRow,
    handleCopyPreviousWeek,
    handleClearWeek,
    handleClearEmployeeRow,
  }
}
