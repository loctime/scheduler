import { useEffect, useState } from "react"
import { doc, setDoc, onSnapshot, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useViewer } from "@/components/pwa/PwaViewerBadge"

interface CompletedTask {
  employeeId: string
  completedAt: Timestamp
}

interface DailyTaskStatus {
  ownerId: string
  date: string // YYYYMMDD
  completed: {
    [taskId: string]: CompletedTask
  }
}

/**
 * Hook para manejar el estado diario de completado de tareas.
 * 
 * Usa un único documento por día: apps/horarios/dailyTaskStatus/{ownerId}_{YYYYMMDD}
 * El estado es global del día, no por empleado.
 */
export function useDailyTaskStatus(ownerId: string | null) {
  const [completedMap, setCompletedMap] = useState<Record<string, CompletedTask>>({})
  const [isLoading, setIsLoading] = useState(true)
  const viewer = useViewer()

  useEffect(() => {
    if (!ownerId || !db) {
      setIsLoading(false)
      return
    }

    // Obtener fecha actual en formato YYYYMMDD
    const today = new Date()
    const dateStr = today.getFullYear().toString() + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0')
    
    // Document ID: ownerId_YYYYMMDD (estado global del día, no por empleado)
    const docId = `${ownerId}_${dateStr}`
    const docRef = doc(db, "apps", "horarios", "dailyTaskStatus", docId)

    const unsubscribe = onSnapshot(
      docRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as DailyTaskStatus
          setCompletedMap(data.completed || {})
        } else {
          setCompletedMap({})
        }
        setIsLoading(false)
      },
      (err) => {
        console.error("Error loading daily task status:", err)
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [ownerId])

  const toggleTask = async (taskId: string) => {
    console.log("🔍 TOGGLE TASK INICIO:")
    console.log("  - taskId:", taskId)
    console.log("  - ownerId:", ownerId)
    console.log("  - viewer?.employeeId:", viewer?.employeeId)
    console.log("  - completedMap antes:", completedMap)
    
    if (!ownerId || !viewer?.employeeId || !db) {
      console.error("No se puede marcar tarea: falta ownerId, employeeId o db")
      return
    }

    // Obtener fecha actual en formato YYYYMMDD
    const today = new Date()
    const dateStr = today.getFullYear().toString() + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0')
    
    // Document ID: ownerId_YYYYMMDD (estado global del día)
    const docId = `${ownerId}_${dateStr}`
    const docRef = doc(db, "apps", "horarios", "dailyTaskStatus", docId)

    const isCompleted = !!completedMap[taskId]
    console.log("  - isCompleted (antes):", isCompleted)
    
    let newCompleted: Record<string, CompletedTask>

    if (isCompleted) {
      // Desmarcar: remover la tarea
      console.log("  - Acción: DESMARCAR tarea")
      newCompleted = { ...completedMap }
      delete newCompleted[taskId]
    } else {
      // Marcar: agregar la tarea
      console.log("  - Acción: MARCAR tarea")
      newCompleted = {
        ...completedMap,
        [taskId]: {
          employeeId: viewer.employeeId,
          completedAt: Timestamp.now()
        }
      }
    }

    console.log("  - newCompleted después:", newCompleted)

    // Update local state immediately for better UX
    setCompletedMap(newCompleted)

    try {
      await setDoc(docRef, {
        ownerId,
        date: dateStr,
        completed: newCompleted
      }, { merge: true })
    } catch (error) {
      console.error("Error toggling task:", error)
    }
  }

  return {
    completed: completedMap, // Renombrado para consistencia con el modelo
    completedMap, // Mantener por compatibilidad temporal
    toggleTask,
    isLoading
  }
}
