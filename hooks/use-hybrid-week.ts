// Hook Híbrido Controlado - Sistema de Semanas
// Implementa reglas arquitectónicas estrictas para lectura/escritura

import { useState, useEffect, useCallback, useMemo } from "react"
import { HybridWeekService } from "@/lib/hybrid-week-service-simple"
import { useData } from "@/contexts/data-context"
import { useOwnerId } from "./use-owner-id"
import { Empleado, Horario } from "@/lib/types"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface UseHybridWeekReturn {
  weekData: Horario | any | null
  source: 'schedules' | 'versions' | null
  isLoading: boolean
  error: string | null
  isVersioned: boolean
  weekStatus: 'legacy' | 'draft' | 'completed' | null
  markWeekComplete: (
    weekStart: string,
    employees: Empleado[],
    shifts: any[],
    assignments: any,
    dayStatus: any
  ) => Promise<{ success: boolean; error?: string }>
  editVersionedWeek: (baseWeekId: string) => Promise<{ success: boolean; error?: string }>
}

export function useHybridWeek(weekStart: string | null): UseHybridWeekReturn {
  const [weekData, setWeekData] = useState<Horario | any | null>(null)
  const [source, setSource] = useState<'schedules' | 'versions' | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { userData, user } = useData()
  const ownerId = useOwnerId()

  // Cargar datos de la semana con lógica híbrida
  const loadWeekData = useCallback(async () => {
    if (!weekStart || !ownerId) {
      setWeekData(null)
      setSource(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("[useHybridWeek] Loading week data:", { weekStart, ownerId })
      
      // Obtener baseWeekId si existe
      const scheduleId = `${ownerId}__${weekStart}`
      let baseWeekId: string | null = null
      
      // Para obtener el baseWeekId, necesitamos leer el schedule primero
      if (db) {
        const scheduleRef = doc(db, "schedules", scheduleId)
        const scheduleDoc = await getDoc(scheduleRef)
        if (scheduleDoc.exists()) {
          const scheduleData = scheduleDoc.data() as any
          baseWeekId = scheduleData.baseWeekId || null
        }
      }
      
      // Usar servicio híbrido para obtener datos
      const result = await HybridWeekService.getWeekData(baseWeekId, weekStart, ownerId)
      
      if (result) {
        setWeekData(result.data)
        setSource(result.source)
        console.log("[useHybridWeek] Week data loaded from:", result.source)
      } else {
        setWeekData(null)
        setSource(null)
        console.log("[useHybridWeek] No week data found")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      console.error("[useHybridWeek] Error loading week data:", err)
    } finally {
      setIsLoading(false)
    }
  }, [weekStart, ownerId])

  // Marcar semana como completada
  const markWeekComplete = useCallback(async (
    weekStart: string,
    employees: Empleado[],
    shifts: any[],
    assignments: any,
    dayStatus: any
  ) => {
    if (!ownerId || !user) {
      return { success: false, error: "Datos insuficientes" }
    }

    try {
      setIsLoading(true)
      setError(null)

      const result = await HybridWeekService.markWeekComplete(
        weekStart,
        ownerId,
        employees,
        shifts,
        assignments,
        dayStatus,
        user.uid,
        user.displayName || user.email || "Usuario"
      )

      if (result.success) {
        // Recargar datos para obtener la nueva versión
        await loadWeekData()
        console.log("[useHybridWeek] Week marked as complete:", result.completedVersionNumber)
      }

      return {
        success: result.success,
        error: result.error
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [ownerId, user, loadWeekData])

  // Editar semana versionada
  const editVersionedWeek = useCallback(async (baseWeekId: string) => {
    if (!user) {
      return { success: false, error: "Usuario no autenticado" }
    }

    try {
      setIsLoading(true)
      setError(null)

      const result = await HybridWeekService.editVersionedWeek(
        baseWeekId,
        user.uid,
        user.displayName || user.email || "Usuario"
      )

      if (result.success) {
        // Recargar datos para obtener la nueva versión
        await loadWeekData()
        console.log("[useHybridWeek] Week edited, new version:", result.newVersionNumber)
      }

      return {
        success: result.success,
        error: result.error
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [user, loadWeekData])

  // Determinar estado y si está versionado
  const { isVersioned, weekStatus } = useMemo(() => {
    if (!weekData) {
      return { isVersioned: false, weekStatus: null }
    }

    const isVersioned = HybridWeekService.isWeekVersioned(weekData as Horario)
    const weekStatus = HybridWeekService.getWeekStatus(weekData as Horario)

    return { isVersioned, weekStatus }
  }, [weekData])

  // Efecto para cargar datos iniciales
  useEffect(() => {
    loadWeekData()
  }, [loadWeekData])

  return {
    weekData,
    source,
    isLoading,
    error,
    isVersioned,
    weekStatus,
    markWeekComplete,
    editVersionedWeek
  }
}
