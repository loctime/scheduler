import { useCallback } from "react"
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { format, startOfWeek, addDays } from "date-fns"
import { Empleado, Turno, Horario, ShiftAssignment } from "@/lib/types"
import { validateScheduleAssignments, validateDailyHours } from "@/lib/validations"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"

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
  const { config } = useConfig()

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
        let currentAssignments: Record<string, Record<string, any>> = {}
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

          // Actualizar assignments
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

        // Validar solapamientos (filtrar francos y medio francos)
        const shiftIds = assignments
          .filter((a) => a.type !== "franco" && a.type !== "medio_franco" && a.shiftId)
          .map((a) => a.shiftId!)
        if (shiftIds.length > 0) {
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
            console.error('[ScheduleCalendar] Error verificando rol:', roleError)
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
          
          // Incluir campos inmutables
          if (weekSchedule.createdAt !== undefined && weekSchedule.createdAt !== null) {
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
      } catch (error: any) {
        console.error("Error al actualizar asignaciones:", error)
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al actualizar los turnos",
          variant: "destructive",
        })
      }
    },
    [user, employees, shifts, config, toast, getWeekSchedule, weekStartsOn],
  )

  return {
    handleAssignmentUpdate,
  }
}

