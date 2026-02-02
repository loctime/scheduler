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

export interface UseWeekDataDashboardReturn {
  weekData: WeekDocument | null
  isLoading: boolean
  error: string | null
  saveWeekData: (data: Partial<WeekDocument>) => Promise<void>
  refreshWeekData: () => Promise<void>
}

export function useWeekDataDashboard(weekId: string | null): UseWeekDataDashboardReturn {
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
      console.warn("🔧 [useWeekDataDashboard] ownerId not available yet - skipping load")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("🔧 [useWeekDataDashboard] Loading week data (EDIT MODE):", { weekId, ownerId, role: userData?.role })
      
      // Usar path válido: apps/horarios_weeks/{ownerId}_{weekId}
      const weekRef = createWeekRef(db, ownerId, weekId)
      console.log("🔧 [useWeekDataDashboard] Week ref created for EDIT access")
      
      const weekDoc = await getDoc(weekRef)

      if (weekDoc.exists()) {
        console.log("🔧 [useWeekDataDashboard] Week data found")
        setWeekData(weekDoc.data() as WeekDocument)
      } else {
        console.log("🔧 [useWeekDataDashboard] No week data found - creating basic document in dashboard")
        
        // Verificar si el usuario puede crear documentos
        const canCreate = userData?.role !== 'invited' // Los invitados no pueden crear
        
        if (canCreate) {
          console.log("🔧 [useWeekDataDashboard] Creating basic document (user has permission)")
          // Si no existe, crear documento básico
          const basicWeekData: WeekDocument = {
            weekId,
            startDate: "", // Se llenaría desde el hook de navegación
            endDate: "",   // Se llenaría desde el hook de navegación
            weekNumber: 0,
            year: 0,
            month: 0,
            createdBy: user?.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }
          
          await setDoc(weekRef, basicWeekData)
          console.log("🔧 [useWeekDataDashboard] Basic week document created")
          setWeekData(basicWeekData)
        } else {
          console.log("🔧 [useWeekDataDashboard] User cannot create documents, showing empty state")
          // Mostrar estado vacío si no puede crear
          setWeekData(null)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      console.error("🔧 [useWeekDataDashboard] Error loading week data:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWeekData()
  }, [weekId, ownerId, userData]) // Disparar cuando weekId, ownerId o userData cambien

  const saveWeekData = async (data: Partial<WeekDocument>) => {
    if (!weekId || !db) {
      throw new Error("WeekId o Firestore no disponible")
    }

    if (!ownerId) {
      throw new Error("ownerId not available")
    }

    try {
      console.log("🔧 [useWeekDataDashboard] Saving week data:", { weekId, ownerId })
      
      const weekRef = createWeekRef(db, ownerId, weekId)
      
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      }

      await setDoc(weekRef, updateData, { merge: true })
      
      console.log("🔧 [useWeekDataDashboard] Week data saved successfully")
      
      // Actualizar estado local
      setWeekData(prev => prev ? { ...prev, ...updateData } : null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al guardar"
      setError(errorMessage)
      console.error("🔧 [useWeekDataDashboard] Error saving week data:", err)
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
