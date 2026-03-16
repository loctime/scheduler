import { useEffect, useState } from "react"
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Task, TaskType } from "@/types/task"

export function useTasks(employeeId?: string, ownerId?: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [todayTasks, setTodayTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db) {
      setIsLoading(false)
      return
    }

    // Si no se proporciona ownerId, no podemos continuar
    if (!ownerId) {
      console.log("useTasks: ownerId no proporcionado, ownerId:", ownerId)
      setIsLoading(false)
      setError("No se proporcionó ownerId")
      return
    }

    console.log("useTasks: ownerId recibido:", ownerId)

    setIsLoading(true)
    setError(null)

    const q = query(
      collection(db, "apps", "horarios", "tasks"),
      where("ownerId", "==", ownerId),
      where("active", "==", true),
      orderBy("createdAt", "desc")
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasksData: Task[] = []
        
        snapshot.forEach((doc) => {
          const taskData = doc.data() as Omit<Task, 'id'>
          
          // Filtrar por employeeId si existe
          if (taskData.employeeIds && employeeId) {
            if (!taskData.employeeIds.includes(employeeId)) {
              return
            }
          }
          
          tasksData.push({
            id: doc.id,
            ...taskData
          })
        })

        setTasks(tasksData)

        // Calcular tareas del día con nueva lógica
        const today = new Date()
        const todayDayNumber = today.getDay()
        const todayString = today.getFullYear().toString() + 
                           (today.getMonth() + 1).toString().padStart(2, '0') + 
                           today.getDate().toString().padStart(2, '0')
        
        const todayTasksData = tasksData.filter(task => {
          const taskType = task.taskType || "weekly" // Compatibilidad hacia atrás
          
          switch (taskType) {
            case "daily":
              return true // Aparecen todos los días
            case "weekly":
              return task.daysOfWeek?.includes(todayDayNumber) || false
            case "specific":
              return task.specificDate === todayString
            default:
              return task.daysOfWeek?.includes(todayDayNumber) || false
          }
        })

        setTodayTasks(todayTasksData)
        setIsLoading(false)
      },
      (err) => {
        setError("Error al cargar las tareas")
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [ownerId, employeeId])

  return {
    tasks,
    todayTasks,
    isLoading,
    error
  }
}
