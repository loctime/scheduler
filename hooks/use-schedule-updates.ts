import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"
import { useData } from "@/contexts/data-context"
import { scheduleApplication } from "@/lib/schedule-application"
import { WeekVersioningService } from "@/lib/week-versioning-service-fixed"
import { buildScheduleDocId } from "@/lib/firestore-helpers"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
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
          const ownerId = actor?.role === "invited" && actor?.ownerId
            ? actor.ownerId
            : actor?.ownerId || actor?.uid

          if (!ownerId || !db) {
            throw new Error("No se pudo crear una nueva versión para editar")
          }

          const baseWeekId = buildScheduleDocId(ownerId, weekStartStr)

          console.log("[useScheduleUpdates] creando nueva versión editable", {
            baseWeekId,
            ownerId,
            weekStartStr,
          })

          // Paso 1: asegurar migración de la semana legada al modelo versionado
          await WeekVersioningService.migrateFromLegacy(baseWeekId, {
            ...existingWeek,
            ownerId,
            weekStart: weekStartStr,
          })

          // Paso 2: crear nueva versión draft clonada desde la actual (incluye completed)
          const createResult = await WeekVersioningService.createNewVersion(baseWeekId, {
            isCompleted: false,
            createdBy: actor?.uid || ownerId,
            createdByName: actor?.name || actor?.displayName || actor?.email || "Usuario",
          })

          if (!createResult.success) {
            throw new Error(createResult.error || "No se pudo crear la nueva versión")
          }

          // Paso 3 (bridge legacy): habilitar edición en la UI actual basada en collection schedules
          const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, baseWeekId)
          await setDoc(
            scheduleRef,
            {
              completada: false,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          )

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
