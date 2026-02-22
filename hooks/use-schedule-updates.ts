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
