// Hook de Actualizaciones Híbridido - Sistema de Semanas
// Implementa reglas arquitectónicas estrictas para evitar doble fuente de verdad

import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"
import { useData } from "@/contexts/data-context"
import { HybridWeekService } from "@/lib/hybrid-week-service-simple"
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

  /**
   * REGLA 2: Marcar como LISTO (solo creación, nunca desmarcar)
   */
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

        // REGLA: Prohibido desmarcar
        if (existingWeek?.completada === true && !completed) {
          throw new Error("Semana ya está completada. No se puede desmarcar.")
        }

        // Si está marcando como completada, usar servicio híbrido
        if (completed) {
          const ownerId = actor?.role === "invited" && actor?.ownerId
            ? actor.ownerId
            : actor?.ownerId || actor?.uid

          if (!ownerId) {
            throw new Error("No se pudo determinar ownerId")
          }

          // Usar el servicio híbrido para crear versión
          const result = await HybridWeekService.markWeekComplete(
            weekStartStr,
            ownerId,
            employees,
            shifts,
            existingWeek?.assignments || {},
            existingWeek?.dayStatus || {},
            actor?.uid || "",
            actor?.displayName || actor?.email || "Usuario"
          )

          if (result.success) {
            toast({
              title: "Semana completada",
              description: `Versión ${result.completedVersionNumber} creada correctamente. Para editar debes crear una nueva versión.`,
            })
          } else {
            throw new Error(result.error || "Error al completar semana")
          }

          return
        }

        // Si está intentando desmarcar, lanzar error
        if (!completed && existingWeek?.completada === true) {
          throw new Error("Semana completada: crear nueva versión para editar. No se puede desmarcar.")
        }

        // Para semanas no versionadas, permitir marcar como completada (legacy)
        if (!existingWeek?.baseWeekId) {
          await scheduleApplication.markWeekComplete(weekStartStr, true, actor, employees, shifts, config)
          
          toast({
            title: "Semana finalizada",
            description: "La semana fue marcada como lista. Para editar debes crear una nueva versión.",
          })
          return
        }

        // Si llegamos aquí, es un caso no manejado
        throw new Error("Estado de semana no manejado")
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

  /**
   * REGLA 4: Editar semana versionada (siempre crea nueva versión)
   * REGLA 5: Editar semana legacy (usa scheduleApplication)
   */
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
        
        // Parsear la fecha de forma segura
        const [year, month, day] = date.split('-').map(Number)
        const dateObj = new Date(year, month - 1, day, 12, 0, 0)
        const computedWeekStartDate = startOfWeek(dateObj, { weekStartsOn })
        const computedWeekStartUI = format(computedWeekStartDate, "yyyy-MM-dd")
        
        // Buscar el schedule
        let foundSchedule = getWeekSchedule(computedWeekStartUI)
        
        // FALLBACK: Si no se encuentra y se pasó un scheduleId
        if (!foundSchedule && options?.scheduleId) {
          foundSchedule = schedules.find(s => s.id === options.scheduleId) || null
        }
        
        if (!foundSchedule) {
          throw new Error("No se encontró el schedule para la fecha especificada")
        }

        // REGLA: Verificar si está versionado
        const isVersioned = HybridWeekService.isWeekVersioned(foundSchedule)
        const weekStatus = HybridWeekService.getWeekStatus(foundSchedule)

        console.log("[useScheduleUpdates] Assignment update:", {
          date,
          employeeId,
          isVersioned,
          weekStatus,
          scheduleId: foundSchedule.id,
          baseWeekId: (foundSchedule as any).baseWeekId
        })

        // REGLA 4: Si está versionada y está completada, crear nueva versión
        if (isVersioned && weekStatus === 'completed') {
          const baseWeekId = (foundSchedule as any).baseWeekId
          if (!baseWeekId) {
            throw new Error("Error: baseWeekId no encontrado en schedule versionado")
          }

          const result = await HybridWeekService.editVersionedWeek(
            baseWeekId,
            actor?.uid || "",
            actor?.displayName || actor?.email || "Usuario"
          )

          if (result.success) {
            toast({
              title: "Nueva versión creada",
              description: `Se creó la versión ${result.newVersionNumber} y la semana ya se puede editar.`,
            })
          } else {
            throw new Error(result.error || "Error al crear nueva versión")
          }

          // Bridge legacy: actualizar schedule para que sea editable
          const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, foundSchedule.id)
          await setDoc(scheduleRef, {
            completada: false,
            updatedAt: serverTimestamp(),
          }, { merge: true })

          return
        }

        // REGLA 5: Si no está versionada, usar sistema legacy
        if (!isVersioned) {
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
          return
        }

        // REGLA 4: Si está versionada pero en modo draft, permitir edición directa
        if (isVersioned && weekStatus === 'draft') {
          // Permitir edición directa en schedules (bridge legacy)
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
          return
        }

        throw new Error("Estado de semana no manejado para edición")
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

// Importación necesaria para scheduleApplication
import { scheduleApplication } from "@/lib/schedule-application"
