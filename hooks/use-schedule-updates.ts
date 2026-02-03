import { useCallback, useState } from "react"
import { collection, addDoc, doc, serverTimestamp, getDoc, updateDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { format, startOfWeek, addDays } from "date-fns"
import { Empleado, Turno, Horario, ShiftAssignment, Configuracion } from "@/lib/types"
import { validateScheduleAssignments, validateDailyHours } from "@/lib/validations"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"
import { createHistoryEntry, saveHistoryEntry, updateSchedulePreservingFields } from "@/lib/firestore-helpers"
import { updateAssignmentInAssignments, normalizeAssignments, hydrateAssignmentsWithShiftTimes } from "@/lib/schedule-utils"
import { logger } from "@/lib/logger"
import { isAssignmentIncomplete, getIncompletenessReason } from "@/lib/assignment-utils"
import { validateBeforePersist, validateCellAssignments } from "@/lib/assignment-validators"
import { useFixedRulesEngine } from "@/hooks/use-fixed-rules-engine"

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
  const { buildAssignmentsFromLegacyFixedSchedules } = useFixedRulesEngine()

  // Función para aplicar horarios fijos automáticamente al crear una nueva semana
  const applyFixedSchedules = async (
    weekStartDate: Date,
    weekStartStr: string,
    employees: Empleado[],
    schedules: Horario[],
    config: Configuracion | null,
    weekStartsOn: number
  ): Promise<Record<string, Record<string, ShiftAssignment[]>>> => {
    return buildAssignmentsFromLegacyFixedSchedules({
      weekStartDate,
      weekStartStr,
      employees,
      schedules,
      fixedSchedules: config?.fixedSchedules,
      shifts,
    })
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
        // MANEJO ESPECIAL: Detectar y procesar dayStatus para Franco y Medio Franco
        const assignment = assignments[0]
        if (assignment && (assignment.type === "franco" || assignment.type === "medio_franco")) {
          // Determinar la semana basada en la fecha
          const dateObj = new Date(date)
          const weekStartDate = startOfWeek(dateObj, { weekStartsOn })
          const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
          const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")
          const userName = user?.displayName || user?.email || "Usuario desconocido"
          const userId = user?.uid || ""

          // Obtener o crear el horario de la semana
          let targetSchedule = getWeekSchedule(weekStartDate)
          if (options?.scheduleId) {
            targetSchedule = schedules.find((s) => s.id === options.scheduleId) || null
          }

          if (!targetSchedule) {
            // Crear nuevo horario si no existe
            if (!db) {
              toast({
                title: "Error",
                description: "Firebase no está configurado",
                variant: "destructive",
              })
              return
            }

            const newScheduleData = {
              nombre: `Semana del ${weekStartStr}`,
              weekStart: weekStartStr,
              semanaInicio: weekStartStr,
              semanaFin: weekEndStr,
              assignments: {},
              dayStatus: {
                [date]: {
                  [employeeId]: assignment.type as "franco" | "medio_franco"
                }
              },
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdBy: userId,
              createdByName: userName,
            }

            const scheduleRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), newScheduleData)
            const scheduleId = scheduleRef.id

            toast({
              title: assignment.type === "franco" ? "Franco asignado" : "Medio franco asignado",
              description: assignment.type === "franco" ? "Se asignó franco correctamente" : "Se asignó medio franco correctamente",
            })
            return
          }

          // Actualizar horario existente
          const currentDayStatus = targetSchedule.dayStatus || {}
          const updatedDayStatus = {
            ...currentDayStatus,
            [date]: {
              ...currentDayStatus[date],
              [employeeId]: assignment.type as "franco" | "medio_franco"
            }
          }

          console.log("🔧 [handleAssignmentUpdateInternal] Guardando dayStatus:", {
            date,
            employeeId,
            assignmentType: assignment.type,
            currentDayStatus,
            updatedDayStatus,
            targetScheduleId: targetSchedule.id
          })

          // Limpiar assignments para este día/empleado (solo turnos reales)
          const updatedAssignments = { ...targetSchedule.assignments }
          if (updatedAssignments[date]?.[employeeId]) {
            delete updatedAssignments[date][employeeId]
            if (Object.keys(updatedAssignments[date]).length === 0) {
              delete updatedAssignments[date]
            }
          }

          const updateData = {
            assignments: updatedAssignments,
            dayStatus: updatedDayStatus,
            updatedAt: serverTimestamp(),
            modifiedBy: userId || null,
            modifiedByName: userName || null,
          }

          console.log("🔧 [handleAssignmentUpdateInternal] UpdateData con dayStatus:", updateData)

          await updateSchedulePreservingFields(targetSchedule.id, targetSchedule, updateData)

          toast({
            title: assignment.type === "franco" ? "Franco asignado" : "Medio franco asignado",
            description: assignment.type === "franco" ? "Se asignó franco correctamente" : "Se asignó medio franco correctamente",
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

        // MANEJO ESPECIAL: Si se está guardando un turno normal, limpiar dayStatus
        if (assignment && assignment.type === "shift" && assignment.shiftId) {
          // Obtener el horario para limpiar dayStatus si existe
          let targetSchedule = getWeekSchedule(weekStartDate)
          if (options?.scheduleId) {
            targetSchedule = schedules.find((s) => s.id === options.scheduleId) || null
          }

          if (targetSchedule?.dayStatus?.[date]?.[employeeId]) {
            // Limpiar dayStatus para este día/empleado
            const updatedDayStatus = { ...targetSchedule.dayStatus }
            delete updatedDayStatus[date][employeeId]
            if (Object.keys(updatedDayStatus[date]).length === 0) {
              delete updatedDayStatus[date]
            }

            // Actualizar solo dayStatus sin afectar assignments
            const updateData = {
              dayStatus: updatedDayStatus,
              updatedAt: serverTimestamp(),
              modifiedBy: userId || null,
              modifiedByName: userName || null,
            }

            await updateSchedulePreservingFields(targetSchedule.id, targetSchedule, updateData)
          }
        }

        let scheduleId: string
        let currentAssignments: Record<string, Record<string, any>> = {}
        let scheduleNombre = `Semana del ${weekStartStr}`
        
        // CRÍTICO: Hidratar assignments con horarios del turno ANTES de cualquier procesamiento
        // Crear Map de turnos para búsqueda rápida
        const shiftsById = new Map(shifts.map((s) => [s.id, s]))
        
        // Log temporal: antes de hidratar
        const assignmentsWithoutTimes = assignments.filter(
          (a) => a.type === "shift" && a.shiftId && (!a.startTime || !a.endTime)
        )
        if (assignmentsWithoutTimes.length > 0) {
          console.debug("[use-schedule-updates] Assignments sin horarios antes de hidratar:", {
            count: assignmentsWithoutTimes.length,
            assignments: assignmentsWithoutTimes.map((a) => ({
              shiftId: a.shiftId,
              hasStartTime: !!a.startTime,
              hasEndTime: !!a.endTime,
            })),
          })
        }
        
        // Hidratar assignments con horarios del turno
        const hydratedAssignments = hydrateAssignmentsWithShiftTimes(assignments, shiftsById)
        
        // Log temporal: después de hidratar
        const assignmentsStillWithoutTimes = hydratedAssignments.filter(
          (a) => a.type === "shift" && a.shiftId && (!a.startTime || !a.endTime)
        )
        if (assignmentsStillWithoutTimes.length > 0) {
          console.debug("[use-schedule-updates] Assignments aún sin horarios después de hidratar (huérfanos):", {
            count: assignmentsStillWithoutTimes.length,
            assignments: assignmentsStillWithoutTimes.map((a) => ({
              shiftId: a.shiftId,
              shiftExists: shiftsById.has(a.shiftId!),
            })),
          })
        } else if (assignmentsWithoutTimes.length > 0) {
          console.debug("[use-schedule-updates] Todos los assignments fueron hidratados correctamente")
        }
        
        let finalAssignments: ShiftAssignment[] = hydratedAssignments

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
          
          // Limpiar campos undefined de los assignments antes de guardar (Firestore no acepta undefined)
          // CRÍTICO: NUNCA reconstruir assignments, solo eliminar undefined para preservar autosuficiencia
          // Usar hydratedAssignments en lugar de assignments originales
          const cleanedAssignments = finalAssignments.map((assignment) => {
            return Object.fromEntries(
              Object.entries(assignment).filter(([, v]) => v !== undefined)
            ) as ShiftAssignment
          })
          
          // CRÍTICO: Validar assignments SOLO si están completos
          // Según el contrato: assignments pueden estar incompletos durante creación/edición (draft)
          // pero deben validarse cuando están completos antes de persistir
          const hasIncompleteAssignments = cleanedAssignments.some(a => isAssignmentIncomplete(a))
          
          if (!hasIncompleteAssignments) {
            // Solo validar si todos los assignments están completos
            const validationResult = validateCellAssignments(cleanedAssignments)
            if (!validationResult.valid) {
              toast({
                title: "Error de validación",
                description: validationResult.errors.join(". "),
                variant: "destructive",
              })
              return
            }
          }
          // Si hay assignments incompletos, permitir guardar como draft sin validación estricta
          
          // Nota: En horarios nuevos no hay medio_franco previo que proteger,
          // así que se usa assignments directamente
          currentAssignments[date][employeeId] = cleanedAssignments
          finalAssignments = cleanedAssignments

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

          // Proteger medio_franco: si existe en asignaciones actuales, asegurarse de que no se elimine
          // PERO solo si el usuario no está limpiando explícitamente la celda o asignando un turno nuevo
          // NUEVO MODELO SIMPLE: Pasar turnos para copiar horarios al convertir desde string[]
          const currentEmployeeAssignments = normalizeAssignments(
            weekSchedule.assignments[date]?.[employeeId],
            shifts
          )
          const existingMedioFranco = currentEmployeeAssignments.find(
            (a) => a.type === "medio_franco"
          )
          
          // Si existe medio_franco actual y no está en las nuevas asignaciones:
          // - NO preservarlo si assignments está vacío (usuario está limpiando)
          // - NO preservarlo si el usuario está asignando un turno nuevo explícitamente (sin medio_franco)
          // - Solo preservarlo si hay otras asignaciones (como franco, nota) que sugieren que el usuario
          //   solo está modificando parcialmente el día, no reemplazando todo
          // Usar hydratedAssignments en lugar de assignments originales
          finalAssignments = [...finalAssignments]
          
          // Verificar si el usuario está limpiando explícitamente (array vacío) o asignando solo un turno nuevo
          const isClearingCell = assignments.length === 0
          const isAssigningOnlyNewShift = assignments.length > 0 && 
                                          assignments.every(a => a.type === "shift" && a.shiftId) &&
                                          !assignments.some(a => a.type === "medio_franco")
          
          // Solo preservar medio_franco si NO se está limpiando y NO se está asignando solo un turno nuevo
          // Además, asegurarse de que el medio_franco preservado no tenga shiftId de turnos nuevos
          if (existingMedioFranco && 
              !assignments.some((a) => a.type === "medio_franco") &&
              !isClearingCell &&
              !isAssigningOnlyNewShift) {
            // Crear una copia limpia del medio_franco sin shiftId para evitar confusiones
            // El medio_franco debe usar solo sus propios horarios (startTime/endTime), no los de un turno
            const preservedMedioFranco: ShiftAssignment = {
              type: "medio_franco",
            }
            // Solo agregar campos que tienen valor (no undefined ni null)
            if (existingMedioFranco.startTime) {
              preservedMedioFranco.startTime = existingMedioFranco.startTime
            }
            if (existingMedioFranco.endTime) {
              preservedMedioFranco.endTime = existingMedioFranco.endTime
            }
            if (existingMedioFranco.startTime2) {
              preservedMedioFranco.startTime2 = existingMedioFranco.startTime2
            }
            if (existingMedioFranco.endTime2) {
              preservedMedioFranco.endTime2 = existingMedioFranco.endTime2
            }
            // No preservar shiftId para evitar que se mezcle con turnos
            finalAssignments.push(preservedMedioFranco)
          }

          // Limpiar campos undefined de los assignments antes de guardar (Firestore no acepta undefined)
          // CRÍTICO: NUNCA reconstruir assignments, solo eliminar undefined para preservar autosuficiencia
          const cleanedFinalAssignments = finalAssignments.map((assignment) => {
            return Object.fromEntries(
              Object.entries(assignment).filter(([, v]) => v !== undefined)
            ) as ShiftAssignment
          })

          // CRÍTICO: Validar assignments SOLO si están completos
          // Según el contrato: assignments pueden estar incompletos durante creación/edición (draft)
          // pero deben validarse cuando están completos antes de persistir
          const hasIncompleteAssignments = cleanedFinalAssignments.some(a => isAssignmentIncomplete(a))
          
          if (!hasIncompleteAssignments) {
            // Solo validar si todos los assignments están completos
            // Esto valida solapamientos entre TODOS los tipos (shifts, licencias, medio_francos)
            const cellValidationResult = validateCellAssignments(cleanedFinalAssignments)
            if (!cellValidationResult.valid) {
              toast({
                title: "Error de validación",
                description: cellValidationResult.errors.join(". "),
                variant: "destructive",
              })
              return
            }
          }
          // Si hay assignments incompletos, permitir guardar como draft sin validación estricta

          // Actualizar assignments usando helper
          currentAssignments = updateAssignmentInAssignments(
            weekSchedule.assignments as any,
            date,
            employeeId,
            cleanedFinalAssignments
          )
        }
        
        // Validación adicional usando validateScheduleAssignments para compatibilidad
        // (solo valida shifts, no licencias ni medio_francos)
        const shiftIds = finalAssignments
          .filter((a) => a.type !== "franco" && a.type !== "medio_franco" && a.type !== "licencia" && a.shiftId)
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

          // Usar finalAssignments para validación (incluye medio_franco protegido si aplica)
          // Pasar las asignaciones completas para que calculateDailyHours maneje francos
          const dailyValidation = validateDailyHours(
            finalAssignments,
            shifts,
            horasMaximasPorDia,
            minutosDescanso,
            horasMinimasParaDescanso,
            config
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
            
            // Validar que el usuario tenga un rol válido (incluyendo los nuevos roles)
            const rolesValidos = ['user', 'admin', 'maxdev', 'branch', 'factory', 'manager']
            if (!userRole || !rolesValidos.includes(userRole)) {
              throw new Error(`El usuario no tiene un rol válido. Rol actual: ${userRole || 'ninguno'}. Se requiere uno de: ${rolesValidos.join(', ')}`)
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
