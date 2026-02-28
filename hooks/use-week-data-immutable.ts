// Hook de Datos de Semana Refactorizado - Sistema de Versionado Inmutable
// Reemplaza use-week-data.ts para usar nueva arquitectura

import { useState, useEffect, useCallback } from "react"
import { WeekVersioningService } from "@/lib/week-versioning-service-immutable"
import { 
  WeekDocument, 
  WeekVersion, 
  UseWeekDataReturn,
  EditWeekResult,
  WeekVersioningRules
} from "@/lib/types/week-versioning-new"
import { useData } from "@/contexts/data-context"
import { useOwnerId } from "./use-owner-id"
import { serverTimestamp } from "firebase/firestore"

export function useWeekDataImmutable(weekId: string | null): UseWeekDataReturn {
  const [weekData, setWeekData] = useState<WeekVersion | null>(null)
  const [weekDocument, setWeekDocument] = useState<WeekDocument | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { userData, user } = useData()
  const ownerId = useOwnerId()

  // Cargar datos de la semana y versión actual
  const loadWeekData = useCallback(async () => {
    if (!weekId || !ownerId) {
      setWeekData(null)
      setWeekDocument(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("[useWeekDataImmutable] Loading week data (READ-ONLY MODE):", { weekId, ownerId })
      
      // Usar nuevo servicio de versionado
      const { weekDocument: doc, currentVersion: version } = 
        await WeekVersioningService.getWeekWithCurrentVersion(weekId)
      
      if (doc && version) {
        setWeekDocument(doc)
        setWeekData(version)
        
        console.log("[useWeekDataImmutable] Week data found (READ-ONLY)")
      } else {
        console.log("[useWeekDataImmutable] No week data found - READ-ONLY mode")
        setWeekData(null)
        setWeekDocument(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      console.error("[useWeekDataImmutable] Error loading week data (READ-ONLY):", err)
    } finally {
      setIsLoading(false)
    }
  }, [weekId, ownerId])

  // Guardar datos de la semana (SIEMPRE crea nueva versión)
  const saveWeekData = useCallback(async (data: Partial<WeekVersion>) => {
    if (!weekId || !user || !weekData) {
      throw new Error("Datos insuficientes para guardar semana")
    }

    // EN MODO SOLO LECTURA, ESTA FUNCIÓN NO DEBERÍA USARSE FUERA DEL DASHBOARD
    console.error("[useWeekDataImmutable] saveWeekData called in READ-ONLY mode - this should only be used in dashboard")
    throw new Error("saveWeekData is disabled in READ-ONLY mode. Use dashboard for editing.")
  }, [weekId, user, weekData])

  // Crear nueva versión para edición
  const createNewVersionForEdit = useCallback(async (): Promise<EditWeekResult> => {
    if (!weekId || !user) {
      return {
        success: false,
        newVersionNumber: 0,
        error: "Datos insuficientes para crear versión de edición"
      }
    }

    try {
      // Validar si se necesita crear nueva versión
      if (weekData && WeekVersioningRules.isVersionImmutable(weekData)) {
        console.log("[useWeekDataImmutable] Creating new version for editing completed week")
        
        const result = await WeekVersioningService.editWeek(
          weekId,
          user.uid,
          user.displayName || user.email || "Usuario"
        )

        if (result.success) {
          // Recargar datos para obtener la nueva versión
          await loadWeekData()
        }

        return result
      } else {
        console.log("[useWeekDataImmutable] Current version is already editable")
        return {
          success: true,
          newVersionNumber: weekData?.versionNumber || 0
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      return {
        success: false,
        newVersionNumber: 0,
        error: errorMessage
      }
    }
  }, [weekId, user, weekData, loadWeekData])

  // Refrescar datos de la semana
  const refreshWeekData = useCallback(async () => {
    await loadWeekData()
  }, [loadWeekData])

  // Efecto para cargar datos iniciales
  useEffect(() => {
    loadWeekData()
  }, [loadWeekData])

  return {
    weekData,
    weekDocument,
    isLoading,
    error,
    saveWeekData,
    refreshWeekData,
    createNewVersionForEdit
  }
}
