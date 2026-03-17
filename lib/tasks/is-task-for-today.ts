import { Task } from "@/types/task"

/**
 * Determina si una tarea corresponde al día actual.
 * 
 * @param task - Tarea a evaluar
 * @param today - Fecha actual (new Date())
 * @returns true si la tarea debe mostrarse hoy
 * 
 * Lógica:
 * - daily: siempre true (aparece todos los días)
 * - weekly: true si daysOfWeek incluye el día de la semana actual
 * - specific: true si specificDate coincide con la fecha actual (YYYYMMDD)
 * 
 * Compatibilidad:
 * - taskType undefined → asumir "weekly" (comportamiento legacy)
 */
export function isTaskForToday(task: Task, today: Date): boolean {
  const taskType = task.taskType || "weekly" // Compatibilidad hacia atrás
  const todayDayNumber = today.getDay() // 0=Domingo, 6=Sábado
  const todayString = today.getFullYear().toString() + 
                     (today.getMonth() + 1).toString().padStart(2, '0') + 
                     today.getDate().toString().padStart(2, '0') // YYYYMMDD

  switch (taskType) {
    case "daily":
      return true // Aparecen todos los días
    
    case "weekly":
      return task.daysOfWeek?.includes(todayDayNumber) || false
    
    case "specific":
      return task.specificDate === todayString
    
    default:
      // Comportamiento legacy: si no tiene taskType, tratar como weekly
      return task.daysOfWeek?.includes(todayDayNumber) || false
  }
}
