import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"
import { useData } from "@/contexts/data-context"
import { scheduleApplication } from "@/lib/schedule-application"
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
        await scheduleApplication.markWeekComplete(weekStartStr, completed, actor)

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
    [actor, toast],
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
