import { useState, useEffect } from "react"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useData } from "@/contexts/data-context"
import { useOwnerId } from "./use-owner-id"
import { createValidDocRef, normalizeFirestoreId } from "@/lib/firestore-helpers"
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
      console.warn("🔧 [useWeekData] ownerId not available yet")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("🔧 [useWeekData] Loading week data:", { weekId, ownerId, role: userData?.role })
      
      // Normalizar weekId y usar path consistente: apps/horarios/{ownerId}/weeks/{weekId}
      const normalizedWeekId = normalizeFirestoreId(weekId)
      console.log("🔧 [useWeekData] Normalized weekId:", weekId, '→', normalizedWeekId)
      
      const weekRef = createValidDocRef(db, "apps", "horarios", normalizeFirestoreId(ownerId), "weeks", normalizedWeekId)
      console.log("🔧 [useWeekData] Week ref created successfully")
      
      const weekDoc = await getDoc(weekRef)

      if (weekDoc.exists()) {
        console.log("🔧 [useWeekData] Week data found")
        setWeekData(weekDoc.data() as WeekDocument)
      } else {
        console.log("🔧 [useWeekData] No week data found")
        
        // Verificar si el usuario puede crear documentos
        const canCreate = userData?.role !== 'invited' // Los invitados no pueden crear
        
        if (canCreate) {
          console.log("🔧 [useWeekData] Creating basic document (user has permission)")
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
          console.log("🔧 [useWeekData] Basic week document created")
          setWeekData(basicWeekData)
        } else {
          console.log("🔧 [useWeekData] User cannot create documents, showing empty state")
          // Mostrar estado vacío si no puede crear
          setWeekData(null)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      console.error("🔧 [useWeekData] Error loading week data:", err)
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
      console.log("🔧 [useWeekData] Saving week data:", { weekId, ownerId })
      
      const normalizedWeekId = normalizeFirestoreId(weekId)
      const weekRef = createValidDocRef(db, "apps", "horarios", normalizeFirestoreId(ownerId), "weeks", normalizedWeekId)
      
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      }

      await setDoc(weekRef, updateData, { merge: true })
      
      console.log("🔧 [useWeekData] Week data saved successfully")
      
      // Actualizar estado local
      setWeekData(prev => prev ? { ...prev, ...updateData } : null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al guardar"
      setError(errorMessage)
      console.error("🔧 [useWeekData] Error saving week data:", err)
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
