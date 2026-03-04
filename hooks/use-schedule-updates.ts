import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"
import { useData } from "@/contexts/data-context"
import { scheduleApplication } from "@/lib/schedule-application"
import { WeekVersioningService } from "@/lib/week-versioning-service-fixed"
import { db } from "@/lib/firebase"
import { doc, getDoc, collection, setDoc, serverTimestamp } from "firebase/firestore"
import type { Horario, Empleado, Turno, ShiftAssignment } from "@/lib/types"

interface UseScheduleUpdatesProps {
  user: any
  employees: Empleado[]
  shifts: Turno[]
  schedules: Horario[]
  getWeekSchedule: (weekStartStr: string) => Horario | null
}

export function useScheduleUpdates({
  user,
  employees,
  shifts,
  schedules,
  getWeekSchedule,
}: UseScheduleUpdatesProps) {
  const { toast } = useToast()
  const { config } = useConfig(user)
  const { userData } = useData()
  const actor = userData || user

  const handleMarkWeekComplete = useCallback(
    async (weekStartStr: string, completed: boolean) => {
      try {
        const existingWeek = getWeekSchedule(weekStartStr)

        console.log("[useScheduleUpdates] handleMarkWeekComplete", {
          weekStartStr,
          completed,
          existingWeekId: existingWeek?.id,
          existingWeekCompleted: existingWeek?.completada,
        })

        if (existingWeek?.completada === true && completed) {
          const baseWeekId = existingWeek?.baseWeekId

          if (!baseWeekId) {
            await scheduleApplication.markWeekComplete(weekStartStr, false, actor, employees, shifts, config)
            toast({
              title: "Semana reabierta",
              description: "La semana volvió a borrador. Ya se puede editar con normalidad.",
            })
            return
          }

          if (!db) {
            throw new Error("No se pudo crear una nueva versión para editar")
          }

          console.log("[useScheduleUpdates] creando nueva versión editable", {
            baseWeekId,
            weekStartStr,
          })

          // Paso 1: crear nueva versión draft clonada desde la actual (incluye completed)
          const createResult = await WeekVersioningService.createNewVersion(baseWeekId, {
            isCompleted: false,
            createdBy: actor?.uid || existingWeek?.ownerId || "system",
            createdByName: actor?.name || actor?.displayName || actor?.email || "Usuario",
          })

          if (!createResult.success) {
            throw new Error(createResult.error || "No se pudo crear la nueva versión")
          }

          console.log("[useScheduleUpdates] nueva versión editable creada", {
            baseWeekId,
            newVersionNumber: createResult.newVersionNumber,
          })

          toast({
            title: "Nueva versión creada",
            description: "Se creó una nueva versión borrador y la semana ya se puede editar.",
          })

          return
        }

        if (existingWeek?.baseWeekId && completed) {
          const completeResult = await WeekVersioningService.completeCurrentWeek(
            existingWeek.baseWeekId,
            employees,
            shifts,
            JSON.parse(JSON.stringify(existingWeek.assignments || {})),
            JSON.parse(JSON.stringify(existingWeek.dayStatus || {})),
            actor?.uid || existingWeek.ownerId || "system",
            actor?.name || actor?.displayName || actor?.email || "Usuario",
          )

          if (!completeResult.success) {
            throw new Error(completeResult.error || "No se pudo marcar la semana versionada como lista")
          }

          toast({
            title: "Semana finalizada",
            description: "La semana versionada fue marcada como lista correctamente.",
          })

          return
        }

        await scheduleApplication.markWeekComplete(weekStartStr, completed, actor, employees, shifts, config)

        toast({
          title: "Semana finalizada",
          description: "La semana fue marcada como lista. Para editar debes crear una nueva versión.",
        })
      } catch (error: any) {
        console.error("Error al marcar semana como completada:", error)
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al actualizar el estado de la semana",
          variant: "destructive",
        })
      }
    },
    [actor, employees, shifts, config, toast, getWeekSchedule],
  )

  const handleAssignmentUpdate = useCallback(
    async (
      date: string,
      employeeId: string,
      assignments: ShiftAssignment[],
      options?: { scheduleId?: string },
    ) => {
      try {
        const { startOfWeek, format } = await import("date-fns")
        const weekStartsOn = (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6
        
        // Parsear la fecha de forma segura usando componentes individuales para evitar problemas de zona horaria
        const [year, month, day] = date.split('-').map(Number)
        const dateObj = new Date(year, month - 1, day, 12, 0, 0) // Usar mediodía local para evitar problemas de zona horaria
        const dayOfWeek = dateObj.getDay()
        const computedWeekStartDate = startOfWeek(dateObj, { weekStartsOn })
        const computedWeekStartUI = format(computedWeekStartDate, "yyyy-MM-dd")
        
        // Verificar que el cálculo sea correcto
        const computedWeekStartDayOfWeek = computedWeekStartDate.getDay()
        const weekStartShouldBeMonday = weekStartsOn === 1 && computedWeekStartDayOfWeek === 1
        
        // Buscar el schedule usando el weekStart calculado
        let foundSchedule = getWeekSchedule(computedWeekStartUI)
        
        // FALLBACK: Si no se encuentra y se pasó un scheduleId, buscar ese schedule directamente
        // Esto maneja el caso donde los schedules existentes tienen weekStart incorrecto
        if (!foundSchedule && options?.scheduleId) {
          foundSchedule = schedules.find(s => s.id === options.scheduleId) || null
          if (foundSchedule) {
            console.warn("⚠️ Schedule encontrado por ID pero weekStart no coincide:", {
              scheduleId: options.scheduleId,
              weekStartEnSchedule: foundSchedule.weekStart,
              weekStartCalculado: computedWeekStartUI
            })
          }
        }
        

        if (foundSchedule?.baseWeekId) {
          if (!db) {
            throw new Error("Firestore no está configurado")
          }

          const weekRef = doc(db, "apps/horarios/weeks", foundSchedule.baseWeekId)
          const weekDoc = await getDoc(weekRef)

          if (!weekDoc.exists()) {
            throw new Error("Week document no existe para esta semana versionada")
          }

          const weekData = weekDoc.data() as { currentVersionNumber?: number; status?: "draft" | "completed" }
          const currentVersionNumber = weekData.currentVersionNumber

          if (!currentVersionNumber) {
            throw new Error("La semana versionada no tiene versión actual")
          }

          if (weekData.status === "completed") {
            throw new Error("Semana completada: primero debes crear una nueva versión borrador")
          }

          const versionRef = doc(collection(weekRef, "versions"), String(currentVersionNumber))
          const versionDoc = await getDoc(versionRef)

          if (!versionDoc.exists()) {
            throw new Error("No existe la versión actual de la semana")
          }

          const versionData = versionDoc.data() as {
            assignments?: Horario["assignments"]
            dayStatus?: Horario["dayStatus"]
            isCompleted?: boolean
          }

          if (versionData.isCompleted === true) {
            throw new Error("No se puede modificar una versión completada")
          }

          const nextAssignments = JSON.parse(JSON.stringify(versionData.assignments || {})) as Horario["assignments"]
          const nextDayStatus = JSON.parse(JSON.stringify(versionData.dayStatus || {})) as NonNullable<Horario["dayStatus"]>

          if (!nextAssignments[date]) nextAssignments[date] = {}
          nextAssignments[date][employeeId] = assignments

          if (!nextDayStatus[date]) nextDayStatus[date] = {}
          const assignmentType = assignments[0]?.type
          if (assignmentType === "franco") {
            nextDayStatus[date][employeeId] = "franco"
          } else if (assignmentType === "medio_franco") {
            nextDayStatus[date][employeeId] = "medio_franco"
          } else {
            nextDayStatus[date][employeeId] = "normal"
          }

          await setDoc(
            versionRef,
            {
              assignments: nextAssignments,
              dayStatus: nextDayStatus,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          )

          toast({
            title: "Asignación actualizada",
            description: "Los turnos de la versión borrador fueron actualizados correctamente",
          })

          return
        }

        // LOG CONSOLIDADO - Toda la información de diagnóstico
        console.log("🔍 DIAGNÓSTICO COMPLETO - UPDATE ASSIGNMENT:", {
          // Información de la fecha clickeada
          fechaClickeada: date,
          diaSemana: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dayOfWeek],
          esLunes: dayOfWeek === 1,
          
          // Configuración
          semanaInicioDia: config?.semanaInicioDia,
          weekStartsOn: weekStartsOn,
          
          // Cálculo del weekStart
          weekStartCalculado: computedWeekStartUI,
          weekStartDiaSemana: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][computedWeekStartDayOfWeek],
          weekStartEsLunes: computedWeekStartDayOfWeek === 1,
          weekStartDebeSerLunes: weekStartShouldBeMonday,
          calculoCorrecto: weekStartShouldBeMonday === (computedWeekStartDayOfWeek === 1),
          
          // Schedule encontrado
          scheduleIdPasado: options?.scheduleId,
          scheduleEncontrado: foundSchedule ? {
            id: foundSchedule.id,
            weekStart: foundSchedule.weekStart,
            tieneAssignments: !!foundSchedule.assignments,
            assignmentsKeys: foundSchedule.assignments ? Object.keys(foundSchedule.assignments) : []
          } : null,
          scheduleCoincide: foundSchedule?.weekStart === computedWeekStartUI,
          
          // Schedules disponibles
          schedulesDisponibles: schedules.map(s => ({
            id: s.id,
            weekStart: s.weekStart
          }))
        })

        await scheduleApplication.updateAssignment(
          { date, employeeId, assignments, options },
          actor,
          employees,
          shifts,
          config,
          schedules,
          getWeekSchedule,
        )

        toast({
          title: "Asignación actualizada",
          description: "Los turnos han sido actualizados correctamente",
        })
      } catch (error: any) {
        console.error("Error al actualizar asignaciones:", error)
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al actualizar los turnos",
          variant: "destructive",
        })
      }
    },
    [actor, employees, shifts, config, schedules, getWeekSchedule, toast],
  )

  return {
    handleMarkWeekComplete,
    handleAssignmentUpdate,
  }
}
