import { useState } from "react"
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Task } from "@/types/task"
import { Empleado } from "@/lib/types"
import { TaskType } from "@/types/task"
import { useOwnerId } from "@/hooks/use-owner-id"
import { useToast } from "@/hooks/use-toast"

export interface TaskFormData {
  title: string
  description?: string
  detailedContent: string
  instructions: string
  employeeIds?: string[]
  daysOfWeek?: number[]
  taskType?: TaskType
  specificDate?: string // YYYY-MM-DD
  active: boolean
}

export function useTaskManagement() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ownerId = useOwnerId()
  const { toast } = useToast()

  const createTask = async (data: TaskFormData): Promise<string | null> => {
    if (!ownerId || !db) {
      setError("No se encontró el ownerId o conexión a la base de datos")
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const docRef = await addDoc(collection(db, "apps", "horarios", "tasks"), {
        ...data,
        ownerId,
        createdAt: serverTimestamp(),
      })

      toast({
        title: "Tarea creada",
        description: "La tarea se ha creado exitosamente",
      })

      return docRef.id
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al crear la tarea"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const updateTask = async (taskId: string, data: Partial<TaskFormData>): Promise<boolean> => {
    if (!ownerId || !db) {
      setError("No se encontró el ownerId o conexión a la base de datos")
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      await updateDoc(doc(db, "apps", "horarios", "tasks", taskId), {
        ...data,
        updatedAt: serverTimestamp(),
      })

      toast({
        title: "Tarea actualizada",
        description: "La tarea se ha actualizado exitosamente",
      })

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al actualizar la tarea"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const deleteTask = async (taskId: string): Promise<boolean> => {
    if (!ownerId || !db) {
      setError("No se encontró el ownerId o conexión a la base de datos")
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      await deleteDoc(doc(db, "apps", "horarios", "tasks", taskId))

      toast({
        title: "Tarea eliminada",
        description: "La tarea se ha eliminado exitosamente",
      })

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al eliminar la tarea"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const toggleTaskActive = async (taskId: string, currentActive: boolean): Promise<boolean> => {
    return await updateTask(taskId, { active: !currentActive })
  }

  return {
    createTask,
    updateTask,
    deleteTask,
    toggleTaskActive,
    isLoading,
    error,
  }
}
