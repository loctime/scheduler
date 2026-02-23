import { useEffect, useState } from "react"
import { doc, setDoc, onSnapshot, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

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

export function useDailyTaskStatus(ownerId: string | null, viewer: any) {
  const [completedMap, setCompletedMap] = useState<Record<string, CompletedTask>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!ownerId || !viewer?.employeeId || !db) {
      setIsLoading(false)
      return
    }

    // Obtener fecha actual en formato YYYYMMDD
    const today = new Date()
    const dateStr = today.getFullYear().toString() + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0')
    
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
  }, [ownerId, viewer?.employeeId])

  const toggleTask = async (taskId: string) => {
    if (!ownerId || !viewer?.employeeId || !db) {
      console.error("No se puede marcar tarea: falta ownerId, employeeId o db")
      return
    }

    // Obtener fecha actual en formato YYYYMMDD
    const today = new Date()
    const dateStr = today.getFullYear().toString() + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0')
    
    const docId = `${ownerId}_${dateStr}`
    const docRef = doc(db, "apps", "horarios", "dailyTaskStatus", docId)

    const isCompleted = !!completedMap[taskId]
    let newCompleted: Record<string, CompletedTask>

    if (isCompleted) {
      // Desmarcar: remover la tarea
      newCompleted = { ...completedMap }
      delete newCompleted[taskId]
    } else {
      // Marcar: agregar la tarea
      newCompleted = {
        ...completedMap,
        [taskId]: {
          employeeId: viewer.employeeId,
          completedAt: Timestamp.now()
        }
      }
    }

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
    completedMap,
    toggleTask,
    isLoading
  }
}
