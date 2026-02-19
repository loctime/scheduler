import { useState, useMemo, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { scheduleApplication } from "@/lib/schedule-application"
import type { Horario, Empleado, Turno, ShiftAssignment } from "@/lib/types"

interface UseScheduleUpdatesProps {
  user: any
  employees: Empleado[]
  shifts: Turno[]
  schedules: Horario[]
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
  getWeekSchedule: (weekStartStr: string) => Horario | null
  getWeekScheduleFromFirestore: (weekStartStr: string) => Promise<Horario | null>
}

export function useScheduleUpdates({
  user,
  employees,
  shifts,
  schedules,
  weekStartsOn,
  getWeekSchedule,
  getWeekScheduleFromFirestore,
}: UseScheduleUpdatesProps) {
  const DEBUG = false
  const { toast } = useToast()
  const { config } = useConfig(user)
  const { userData } = useData()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  
  const [pendingEdit, setPendingEdit] = useState<{
    date: string
    employeeId: string
    assignments: ShiftAssignment[]
    options?: { scheduleId?: string }
    resolve: (value: boolean) => void
  } | null>(null)

  const handleMarkWeekComplete = useCallback(
    async (weekStartStr: string, completed: boolean) => {
      try {
        if (DEBUG) {
          console.log("🔍 [handleMarkWeekComplete] Iniciando con weekStartStr:", weekStartStr)
        }

        await scheduleApplication.markWeekComplete(weekStartStr, completed, user, employees, config)

        toast({
          title: completed ? "Semana marcada como completada" : "Semana desmarcada",
          description: completed
            ? "La semana ha sido marcada como finalizada"
            : "La semana ya no está marcada como completada",
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
    [user, employees, config, toast, DEBUG],
  )

  const handleAssignmentUpdate = useCallback(
    async (
      date: string,
      employeeId: string,
      assignments: ShiftAssignment[],
      options?: { scheduleId?: string },
    ) => {
      try {
        await scheduleApplication.updateAssignment(
          { date, employeeId, assignments, options },
          user,
          employees,
          shifts,
          config,
          schedules,
          getWeekSchedule
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
    [user, employees, shifts, config, schedules, getWeekSchedule, toast],
  )

  const handleAssignmentUpdateInternal = useCallback(
    async (
      date: string,
      employeeId: string,
      assignments: ShiftAssignment[],
      options?: { scheduleId?: string },
    ) => {
      try {
        await scheduleApplication.updateAssignment(
          { date, employeeId, assignments, options },
          user,
          employees,
          shifts,
          config,
          schedules,
          getWeekSchedule
        )
      } catch (error: any) {
        console.error("Error en actualización interna:", error)
        throw error
      }
    },
    [user, employees, shifts, config, schedules, getWeekSchedule],
  )

  const resolvePendingEdit = useCallback((shouldContinue: boolean) => {
    if (pendingEdit) {
      if (shouldContinue) {
        handleAssignmentUpdateInternal(
          pendingEdit.date,
          pendingEdit.employeeId,
          pendingEdit.assignments,
          pendingEdit.options
        )
          .then(() => {
            setPendingEdit(null)
          })
          .catch((error) => {
            console.error("Error al resolver edición pendiente:", error)
            setPendingEdit(null)
          })
      } else {
        setPendingEdit(null)
      }
    }
  }, [pendingEdit, handleAssignmentUpdateInternal])

  return {
    handleMarkWeekComplete,
    handleAssignmentUpdate,
    handleAssignmentUpdateInternal,
    pendingEdit,
    setPendingEdit: setPendingEdit as any,
    resolvePendingEdit,
  }
}
