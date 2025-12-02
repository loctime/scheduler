import { useCallback, useState } from "react"
import { collection, addDoc, doc, serverTimestamp, getDoc, updateDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { format, startOfWeek, addDays, getDay, parseISO } from "date-fns"
import { Empleado, Turno, Horario, ShiftAssignment, Configuracion } from "@/lib/types"
import { validateScheduleAssignments, validateDailyHours } from "@/lib/validations"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"
import { createHistoryEntry, saveHistoryEntry, updateSchedulePreservingFields } from "@/lib/firestore-helpers"
import { updateAssignmentInAssignments, normalizeAssignments } from "@/lib/schedule-utils"
import { logger } from "@/lib/logger"
import { getSuggestionForDay } from "@/lib/pattern-learning"

interface UseScheduleUpdatesProps {
  user: any
  employees: Empleado[]
  shifts: Turno[]
  schedules: Horario[]
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
  getWeekSchedule: (weekStartDate: Date) => Horario | null
}

export function useScheduleUpdates({
  user,
  employees,
  shifts,
  schedules,
  weekStartsOn,
  getWeekSchedule,
}: UseScheduleUpdatesProps) {
  const { toast } = useToast()
  const { config } = useConfig(user)

  // Función para aplicar horarios fijos automáticamente al crear una nueva semana
  const applyFixedSchedules = async (
    weekStartDate: Date,
    weekStartStr: string,
    employees: Empleado[],
    schedules: Horario[],
    config: Configuracion | null,
    weekStartsOn: number
  ): Promise<Record<string, Record<string, ShiftAssignment[]>>> => {
    const assignments: Record<string, Record<string, ShiftAssignment[]>> = {}
    
    if (!config?.fixedSchedules || config.fixedSchedules.length === 0) {
      return assignments
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

          let assignmentsToApply: ShiftAssignment[] | null = null

          // 1. Primero verificar si hay asignaciones guardadas cuando se marcó como fijo
          if (fixed.assignments && fixed.assignments.length > 0) {
            assignmentsToApply = fixed.assignments
          }
          // 2. Si no, buscar sugerencia automática
          else {
            const suggestion = getSuggestionForDay(fixed.employeeId, dayOfWeek, schedules, weekStartStr)
            if (suggestion && suggestion.assignments.length > 0) {
              assignmentsToApply = suggestion.assignments
            }
          }

          // 3. Si aún no hay, buscar en la última semana completada
          if (!assignmentsToApply || assignmentsToApply.length === 0) {
            const completedSchedules = schedules
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

          // Aplicar si encontramos asignaciones
          if (assignmentsToApply && assignmentsToApply.length > 0) {
            if (!assignments[dateStr]) {
              assignments[dateStr] = {}
            }
            assignments[dateStr][fixed.employeeId] = assignmentsToApply
          }
        }
    }

    return assignments
  }
  const [pendingEdit, setPendingEdit] = useState<{
    date: string
    employeeId: string
    assignments: ShiftAssignment[]
    options?: { scheduleId?: string }
    resolve: (value: boolean) => void
  } | null>(null)

  const handleMarkWeekComplete = useCallback(
    async (weekStartDate: Date, completed: boolean) => {
      if (!db || !user) {
        toast({
          title: "Error",
          description: "Firebase no está configurado o no hay usuario autenticado",
          variant: "destructive",
        })
        return
      }

      try {
        const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
        const weekSchedule = getWeekSchedule(weekStartDate)

        if (!weekSchedule) {
          toast({
            title: "Error",
            description: "No se encontró el horario de esta semana",
            variant: "destructive",
          })
          return
        }

        const userName = user?.displayName || user?.email || "Usuario desconocido"
        const userId = user?.uid || ""

        const updateData: any = {
          updatedAt: serverTimestamp(),
          modifiedBy: userId || null,
          modifiedByName: userName || null,
        }

        if (completed) {
          updateData.completada = true
          updateData.completadaPor = userId
          updateData.completadaPorNombre = userName
          updateData.completadaEn = serverTimestamp()
          
          // Guardar snapshot de empleados que estaban visibles cuando se completó
          const empleadosEnSemana = new Set<string>()
          
          // Obtener IDs de empleados que tienen asignaciones
          if (weekSchedule.assignments) {
            Object.values(weekSchedule.assignments).forEach((dateAssignments) => {
              if (dateAssignments && typeof dateAssignments === 'object') {
                Object.keys(dateAssignments).forEach((employeeId) => {
                  empleadosEnSemana.add(employeeId)
                })
              }
            })
          }
          
          // Agregar empleados del orden personalizado (para mantener estructura visual)
          if (config?.ordenEmpleados) {
            config.ordenEmpleados.forEach((id) => {
              if (employees.some((emp) => emp.id === id)) {
                empleadosEnSemana.add(id)
              }
            })
          }
          
          // Crear snapshot de empleados (solo incluir campos que tienen valor)
          const empleadosSnapshot = employees
            .filter((emp) => empleadosEnSemana.has(emp.id))
            .map((emp) => {
              const snapshot: any = {
                id: emp.id,
                name: emp.name,
              }
              if (emp.email) snapshot.email = emp.email
              if (emp.phone) snapshot.phone = emp.phone
              return snapshot
            })
          
          updateData.empleadosSnapshot = empleadosSnapshot
          updateData.ordenEmpleadosSnapshot = config?.ordenEmpleados || []
        } else {
          updateData.completada = false
          updateData.completadaPor = null
          updateData.completadaPorNombre = null
          updateData.completadaEn = null
          // Limpiar snapshot cuando se desmarca
          updateData.empleadosSnapshot = null
          updateData.ordenEmpleadosSnapshot = null
        }

        // Actualizar usando helper que preserva campos automáticamente
        await updateSchedulePreservingFields(weekSchedule.id, weekSchedule, updateData)

        toast({
          title: completed ? "Semana marcada como completada" : "Semana desmarcada",
          description: completed
            ? "La semana ha sido marcada como finalizada"
            : "La semana ya no está marcada como completada",
        })
      } catch (error: any) {
        logger.error("Error al marcar semana como completada:", error)
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al actualizar el estado de la semana",
          variant: "destructive",
        })
      }
    },
    [user, getWeekSchedule, toast],
  )

  const handleAssignmentUpdate = useCallback(
    async (
      date: string,
      employeeId: string,
      assignments: ShiftAssignment[],
      options?: { scheduleId?: string },
    ) => {
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
        let currentAssignments: Record<string, Record<string, any>> = {}
        let scheduleNombre = `Semana del ${weekStartStr}`

        // Obtener el horario de esa semana específica
        let weekSchedule: Horario | null = null
        if (options?.scheduleId) {
          weekSchedule = schedules.find((s) => s.id === options.scheduleId) || null
        }
        if (!weekSchedule) {
          weekSchedule = getWeekSchedule(weekStartDate)
        }

        // Verificar si la semana está completada y mostrar diálogo de confirmación
        if (weekSchedule?.completada === true) {
          return new Promise<void>((resolve, reject) => {
            setPendingEdit({
              date,
              employeeId,
              assignments,
              options,
              resolve: (shouldContinue: boolean) => {
                if (shouldContinue) {
                  handleAssignmentUpdateInternal(date, employeeId, assignments, options)
                    .then(() => resolve())
                    .catch(reject)
                } else {
                  resolve()
                }
              },
            })
          })
        }

        return handleAssignmentUpdateInternal(date, employeeId, assignments, options)
      } catch (error: any) {
        logger.error("Error al actualizar asignaciones:", error)
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al actualizar los turnos",
          variant: "destructive",
        })
      }
    },
    [user, employees, shifts, config, toast, getWeekSchedule, weekStartsOn, schedules],
  )

  const handleAssignmentUpdateInternal = useCallback(
    async (
      date: string,
      employeeId: string,
      assignments: ShiftAssignment[],
      options?: { scheduleId?: string },
    ) => {
      // Declarar weekSchedule fuera del try para que esté disponible en el catch
      let weekSchedule: Horario | null = null
      
      try {
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
        let currentAssignments: Record<string, Record<string, any>> = {}
        let scheduleNombre = `Semana del ${weekStartStr}`

        // Obtener el horario de esa semana específica
        if (options?.scheduleId) {
          weekSchedule = schedules.find((s) => s.id === options.scheduleId) || null
        }
        if (!weekSchedule) {
          weekSchedule = getWeekSchedule(weekStartDate)
        }

        // Permitir editar si el usuario confirmó (el modal ya lo maneja)
        // Esta verificación ya no es necesaria porque handleAssignmentUpdate
        // ya muestra el modal y solo llama a esta función si el usuario confirmó

        // Si no existe horario, crearlo. Si existe, actualizarlo
        if (!weekSchedule) {
          // Crear nuevo horario con formato nuevo
          // Primero aplicar horarios fijos automáticamente
          currentAssignments = await applyFixedSchedules(
            weekStartDate,
            weekStartStr,
            employees,
            schedules,
            config,
            weekStartsOn
          )
          
          // Luego agregar/sobrescribir con la asignación actual
          if (!currentAssignments[date]) {
            currentAssignments[date] = {}
          }
          currentAssignments[date][employeeId] = assignments

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

          // Guardar en historial usando helper
          const newSchedule = { id: scheduleId, ...newScheduleData } as Horario
          const historyEntry = createHistoryEntry(newSchedule, "creado", user, weekStartStr, weekEndStr)
          await saveHistoryEntry(historyEntry)

          toast({
            title: "Horario creado",
            description: "El horario se ha creado correctamente",
          })
        } else {
          // Actualizar horario existente
          scheduleId = weekSchedule.id
          scheduleNombre = weekSchedule.nombre || scheduleNombre

          // Guardar versión anterior en historial usando helper
          const historyEntry = createHistoryEntry(weekSchedule, "modificado", user, weekStartStr, weekEndStr)
          await saveHistoryEntry(historyEntry)

          // Actualizar assignments usando helper
          currentAssignments = updateAssignmentInAssignments(
            weekSchedule.assignments as any,
            date,
            employeeId,
            assignments
          )
        }

        // Validar solapamientos (filtrar francos y medio francos)
        const shiftIds = assignments
          .filter((a) => a.type !== "franco" && a.type !== "medio_franco" && a.shiftId)
          .map((a) => a.shiftId!)
        if (shiftIds.length > 0) {
          // Si la semana está completada, usar empleados del snapshot para la validación
          const employeesForValidation = (() => {
            if (weekSchedule?.completada === true && weekSchedule?.empleadosSnapshot) {
              // Combinar empleados activos con snapshot
              const activeEmployeesMap = new Map(employees.map((emp) => [emp.id, emp]))
              return weekSchedule.empleadosSnapshot.map((snapshotEmp) => {
                const activeEmp = activeEmployeesMap.get(snapshotEmp.id)
                return activeEmp || {
                  id: snapshotEmp.id,
                  name: snapshotEmp.name,
                  email: snapshotEmp.email,
                  phone: snapshotEmp.phone,
                  userId: '',
                } as Empleado
              })
            }
            return employees
          })()
          
          const overlaps = validateScheduleAssignments(
            { [date]: { [employeeId]: shiftIds } },
            employeesForValidation,
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
        }

        // Validar horas máximas por día (soporta francos y medio francos)
        if (config) {
          const minutosDescanso = config.minutosDescanso || 30
          const horasMinimasParaDescanso = config.horasMinimasParaDescanso || 6
          const horasMaximasPorDia = config.horasMaximasPorDia || 8

          // Pasar las asignaciones completas para que calculateDailyHours maneje francos
          const dailyValidation = validateDailyHours(
            assignments,
            shifts,
            horasMaximasPorDia,
            minutosDescanso,
            horasMinimasParaDescanso
          )

          // Ya no mostramos toast cuando se exceden las horas máximas diarias, ya que ahora los
          // usuarios pueden extender turnos manualmente y esperan ese comportamiento.
          if (!dailyValidation.valid) {
            logger.debug(
              "[useScheduleUpdates] Horas máximas por día excedidas:",
              employees.find((e) => e.id === employeeId)?.name || employeeId,
              dailyValidation.message
            )
          }
        }

        // Actualizar o crear en Firestore
        if (weekSchedule) {
          // Verificar que el usuario tenga el rol correcto
          if (!userId) {
            throw new Error("Usuario no autenticado")
          }
          
          // Verificar rol del usuario
          try {
            const userDocRef = doc(db, COLLECTIONS.USERS, userId)
            const userDoc = await getDoc(userDocRef)
            if (!userDoc.exists()) {
              throw new Error(`El usuario ${userId} no tiene un documento en ${COLLECTIONS.USERS}. Por favor, cierra sesión y vuelve a iniciar sesión.`)
            }
            const userData = userDoc.data()
            const userRole = userData?.role
            
            if (!userRole || (userRole !== 'user' && userRole !== 'admin' && userRole !== 'maxdev')) {
              throw new Error(`El usuario no tiene un rol válido. Rol actual: ${userRole || 'ninguno'}. Se requiere: 'user', 'admin' o 'maxdev'`)
            }
          } catch (roleError: any) {
            logger.error('[ScheduleCalendar] Error verificando rol:', roleError)
            if (roleError.message.includes('no tiene un documento')) {
              throw roleError
            }
          }
          
          // Actualizar existente
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
          
          // createdBy ya debe estar establecido en schedules existentes
          
          // Los campos inmutables se preservarán automáticamente con updateSchedulePreservingFields
          
          // Si se está editando un horario completado, actualizar el snapshot de empleados
          if (weekSchedule.completada === true) {
            // Obtener IDs de empleados que tienen asignaciones después de la actualización
            const empleadosConAsignaciones = new Set<string>()
            Object.values(currentAssignments).forEach((dateAssignments) => {
              if (dateAssignments && typeof dateAssignments === 'object') {
                Object.keys(dateAssignments).forEach((employeeId) => {
                  empleadosConAsignaciones.add(employeeId)
                })
              }
            })
            
            // Crear mapa de empleados activos para búsqueda rápida
            const activeEmployeesMap = new Map(employees.map((emp) => [emp.id, emp]))
            
            // Crear mapa del snapshot existente para preservar empleados eliminados
            const existingSnapshotMap = new Map()
            if (weekSchedule.empleadosSnapshot) {
              weekSchedule.empleadosSnapshot.forEach((snapshotEmp) => {
                existingSnapshotMap.set(snapshotEmp.id, snapshotEmp)
              })
            }
            
            // Crear set de IDs del snapshot original para validar qué empleados pertenecen
            const originalSnapshotIds = new Set(
              weekSchedule.empleadosSnapshot?.map((e) => e.id) || []
            )
            
            // Solo incluir empleados que:
            // 1. Tienen asignaciones Y estaban en el snapshot original, O
            // 2. Están en el snapshot original (aunque no tengan asignaciones actuales)
            const empleadosSnapshot: any[] = []
            
            // Primero, agregar todos los empleados del snapshot original (preservar historial)
            if (weekSchedule.empleadosSnapshot) {
              weekSchedule.empleadosSnapshot.forEach((snapshotEmp) => {
                const activeEmp = activeEmployeesMap.get(snapshotEmp.id)
                
                if (activeEmp) {
                  // Si el empleado existe activamente, usar datos actuales pero mantener del snapshot
                  const snapshot: any = {
                    id: activeEmp.id,
                    name: activeEmp.name,
                  }
                  if (activeEmp.email !== undefined) snapshot.email = activeEmp.email || null
                  if (activeEmp.phone !== undefined) snapshot.phone = activeEmp.phone || null
                  empleadosSnapshot.push(snapshot)
                } else {
                  // Si el empleado fue eliminado, preservar datos del snapshot original
                  empleadosSnapshot.push({
                    id: snapshotEmp.id,
                    name: snapshotEmp.name,
                    email: snapshotEmp.email || null,
                    phone: snapshotEmp.phone || null,
                  })
                }
              })
            }
            
            // Si hay un empleado con asignaciones que NO está en el snapshot original,
            // agregarlo (caso raro: alguien editó manualmente el documento)
            empleadosConAsignaciones.forEach((employeeId) => {
              if (!originalSnapshotIds.has(employeeId)) {
                const activeEmp = activeEmployeesMap.get(employeeId)
                if (activeEmp) {
                  // Solo agregar si es un empleado activo (no crear genéricos)
                  const snapshot: any = {
                    id: activeEmp.id,
                    name: activeEmp.name,
                  }
                  if (activeEmp.email !== undefined) snapshot.email = activeEmp.email || null
                  if (activeEmp.phone !== undefined) snapshot.phone = activeEmp.phone || null
                  empleadosSnapshot.push(snapshot)
                }
              }
            })
            
            // Preservar el orden del snapshot original, no usar el orden de config
            updateData.empleadosSnapshot = empleadosSnapshot
            updateData.ordenEmpleadosSnapshot = weekSchedule.ordenEmpleadosSnapshot || []
          } else {
            // Preservar snapshot si existe (aunque no esté completado)
            if (weekSchedule.empleadosSnapshot !== undefined) {
              updateData.empleadosSnapshot = weekSchedule.empleadosSnapshot
            }
            if (weekSchedule.ordenEmpleadosSnapshot !== undefined) {
              updateData.ordenEmpleadosSnapshot = weekSchedule.ordenEmpleadosSnapshot
            }
          }
          
          // Actualizar usando helper que preserva campos automáticamente
          logger.debug("Actualizando schedule:", {
            scheduleId,
            userId,
            weekScheduleCreatedBy: weekSchedule.createdBy,
            hasCreatedBy: !!weekSchedule.createdBy,
            updateDataKeys: Object.keys(updateData),
            updateDataCreatedBy: updateData.createdBy,
          })
          
          // Verificar que el schedule tenga createdBy antes de actualizar
          if (!weekSchedule.createdBy) {
            throw new Error(`El schedule ${scheduleId} no tiene createdBy. Esto no debería pasar con schedules nuevos.`)
          }
          
          await updateSchedulePreservingFields(scheduleId, weekSchedule, updateData)

          toast({
            title: "Turnos actualizados",
            description: "Los turnos se han actualizado correctamente",
          })
        }
      } catch (error: any) {
        logger.error("Error al actualizar asignaciones:", error)
        logger.error("Error details:", {
          code: error.code,
          message: error.message,
          userId: user?.uid,
          weekSchedule: weekSchedule ? {
            id: weekSchedule.id,
            createdBy: weekSchedule.createdBy,
            weekStart: weekSchedule.weekStart,
            hasCreatedBy: !!weekSchedule.createdBy,
          } : null,
        })
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al actualizar los turnos",
          variant: "destructive",
        })
      }
    },
    [user, employees, shifts, config, toast, getWeekSchedule, weekStartsOn, schedules],
  )


  return {
    handleAssignmentUpdate,
    handleMarkWeekComplete,
    pendingEdit,
    setPendingEdit,
  }
}

