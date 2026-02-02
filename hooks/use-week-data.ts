import { useState, useEffect } from "react"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useData } from "@/contexts/data-context"
import { type WeekData } from "./use-week-navigation"

export interface WeekDocument extends WeekData {
  createdAt?: any
  updatedAt?: any
  createdBy?: string
  scheduleData?: any // Aquí se guardaría el horario real
}

export interface UseWeekDataReturn {
  weekData: WeekDocument | null
  isLoading: boolean
  error: string | null
  saveWeekData: (data: Partial<WeekDocument>) => Promise<void>
  refreshWeekData: () => Promise<void>
}

export function useWeekData(weekId: string | null): UseWeekDataReturn {
  const [weekData, setWeekData] = useState<WeekDocument | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { userData, user } = useData()

  const loadWeekData = async () => {
    if (!weekId || !db) {
      setWeekData(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Determinar el ownerId correcto
      const ownerId = userData?.role === "invited" && userData?.ownerId 
        ? userData.ownerId 
        : user?.uid

      if (!ownerId) {
        throw new Error("No se pudo determinar el ownerId")
      }

      const weekRef = doc(db, "apps/horarios", ownerId, "weeks", weekId)
      const weekDoc = await getDoc(weekRef)

      if (weekDoc.exists()) {
        setWeekData(weekDoc.data() as WeekDocument)
      } else {
        // Si no existe, crear documento básico
        const basicWeekData: WeekDocument = {
          weekId,
          startDate: "", // Se llenaría desde el hook de navegación
          endDate: "",   // Se llenaría desde el hook de navegación
          weekNumber: 0,
          year: 0,
          month: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
        
        await setDoc(weekRef, basicWeekData)
        setWeekData(basicWeekData)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      console.error("Error loading week data:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWeekData()
  }, [weekId])

  const saveWeekData = async (data: Partial<WeekDocument>) => {
    if (!weekId || !db) {
      throw new Error("WeekId o Firestore no disponible")
    }

    try {
      // Determinar el ownerId correcto
      const ownerId = userData?.role === "invited" && userData?.ownerId 
        ? userData.ownerId 
        : user?.uid

      if (!ownerId) {
        throw new Error("No se pudo determinar el ownerId")
      }

      const weekRef = doc(db, "apps/horarios", ownerId, "weeks", weekId)
      
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      }

      await setDoc(weekRef, updateData, { merge: true })
      
      // Actualizar estado local
      setWeekData(prev => prev ? { ...prev, ...updateData } : null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al guardar"
      setError(errorMessage)
      console.error("Error saving week data:", err)
      throw new Error(errorMessage)
    }
  }

  const refreshWeekData = async () => {
    await loadWeekData()
  }

  return {
    weekData,
    isLoading,
    error,
    saveWeekData,
    refreshWeekData
  }
}
