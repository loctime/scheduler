import { useEffect, useState } from "react"
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Task } from "@/types/task"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

export function useTasks(employeeId?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [todayTasks, setTodayTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, userData } = useData()

  useEffect(() => {
    if (!user || !db) {
      setIsLoading(false)
      return
    }

    const ownerId = getOwnerIdForActor(user, userData)
    if (!ownerId) {
      setIsLoading(false)
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

        // Calcular tareas del día
        const today = new Date().getDay()
        const todayTasksData = tasksData.filter(task => {
          const isToday = task.daysOfWeek?.includes(today)
          return isToday
        })

        setTodayTasks(todayTasksData)
        setIsLoading(false)
      },
      (err) => {
        console.error("Error loading tasks:", err)
        setError("Error al cargar las tareas")
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, userData, employeeId])

  return {
    tasks,
    todayTasks,
    isLoading,
    error
  }
}
