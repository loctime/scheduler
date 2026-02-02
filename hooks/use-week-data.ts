import { useState, useEffect } from "react"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useData } from "@/contexts/data-context"
import { useOwnerId } from "./use-owner-id"
import { createWeekRef } from "@/lib/firestore-helpers"
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
  const ownerId = useOwnerId()

  const loadWeekData = async () => {
    if (!weekId || !db) {
      setWeekData(null)
      setError(null)
      return
    }

    if (!ownerId) {
      console.warn("🔧 [useWeekData] ownerId not available yet - skipping load")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("🔧 [useWeekData] Loading week data (READ-ONLY MODE):", { weekId, ownerId, role: userData?.role })
      
      // Usar path válido: apps/horarios_weeks/{ownerId}_{weekId}
      const weekRef = createWeekRef(db, ownerId, weekId)
      console.log("🔧 [useWeekData] Week ref created for READ-ONLY access")
      
      const weekDoc = await getDoc(weekRef)

      if (weekDoc.exists()) {
        console.log("🔧 [useWeekData] Week data found (READ-ONLY)")
        setWeekData(weekDoc.data() as WeekDocument)
      } else {
        console.log("🔧 [useWeekData] No week data found - READ-ONLY mode, NOT creating document")
        // EN MODO SOLO LECTURA, NO CREAR DOCUMENTOS
        setWeekData(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      console.error("🔧 [useWeekData] Error loading week data (READ-ONLY):", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWeekData()
  }, [weekId, ownerId, userData]) // Disparar cuando weekId, ownerId o userData cambien

  const saveWeekData = async (data: Partial<WeekDocument>) => {
    // EN MODO SOLO LECTURA, ESTA FUNCIÓN NO DEBERÍA USARSE FUERA DEL DASHBOARD
    console.error("🔧 [useWeekData] saveWeekData called in READ-ONLY mode - this should only be used in dashboard")
    throw new Error("saveWeekData is disabled in READ-ONLY mode. Use dashboard for editing.")
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
