import { useEffect, useState } from "react"
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Task } from "@/types/task"

export function useTasks(employeeId?: string, ownerId?: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [todayTasks, setTodayTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log("🔍 useTasks - Iniciando con:", { employeeId, ownerId })
    
    if (!db) {
      console.log("🔍 useTasks - No db")
      setIsLoading(false)
      return
    }

    // Si no se proporciona ownerId, no podemos continuar
    if (!ownerId) {
      console.log("🔍 useTasks - No ownerId")
      setIsLoading(false)
      setError("No se proporcionó ownerId")
      return
    }

    setIsLoading(true)
    setError(null)

    const q = query(
      collection(db, "apps", "horarios", "tasks"),
      where("ownerId", "==", ownerId),
      where("active", "==", true),
      orderBy("createdAt", "desc")
    )

    console.log("🔍 useTasks - Query creada para ownerId:", ownerId)

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("🔍 useTasks - Snapshot recibido, docs:", snapshot.size)
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

        console.log("🔍 useTasks - Tareas procesadas:", tasksData.length)
        console.log("🔍 useTasks - Títulos:", tasksData.map(t => t.title))
        
        setTasks(tasksData)

        // Calcular tareas del día
        const today = new Date().getDay()
        const todayTasksData = tasksData.filter(task => {
          const isToday = task.daysOfWeek?.includes(today)
          return isToday
        })

        console.log("🔍 useTasks - Tareas de hoy:", todayTasksData.length)

        setTodayTasks(todayTasksData)
        setIsLoading(false)
      },
      (err) => {
        console.error("🔍 useTasks - Error:", err)
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
