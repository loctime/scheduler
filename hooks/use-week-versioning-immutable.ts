// Hook de Versionado de Semanas - Arquitectura Inmutable
// Reemplaza completamente el sistema isCompleted/weekSnapshot

import { useState, useEffect, useCallback } from "react"
import { WeekVersioningService } from "@/lib/week-versioning-service-immutable"
import { 
  WeekDocument, 
  WeekVersion, 
  UseWeekVersioningReturn,
  CreateVersionResult,
  CompleteWeekResult,
  EditWeekResult,
  WeekVersioningRules
} from "@/lib/types/week-versioning-new"
import { useData } from "@/contexts/data-context"
import { useOwnerId } from "./use-owner-id"
import { Empleado } from "@/lib/types"

export function useWeekVersioning(baseWeekId: string | null): UseWeekVersioningReturn {
  const [currentVersion, setCurrentVersion] = useState<WeekVersion | null>(null)
  const [weekDocument, setWeekDocument] = useState<WeekDocument | null>(null)
  const [availableVersions, setAvailableVersions] = useState<WeekVersion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingVersion, setIsCreatingVersion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { userData, user } = useData()
  const ownerId = useOwnerId()

  // Cargar datos de la semana y versión actual
  const loadWeekData = useCallback(async () => {
    if (!baseWeekId || !ownerId) {
      setCurrentVersion(null)
      setWeekDocument(null)
      setAvailableVersions([])
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("[useWeekVersioning] Loading week data:", { baseWeekId, ownerId })
      
      // Cargar documento base y versión actual en una sola llamada
      const { weekDocument: doc, currentVersion: version } = 
        await WeekVersioningService.getWeekWithCurrentVersion(baseWeekId)
      
      if (doc && version) {
        setWeekDocument(doc)
        setCurrentVersion(version)
        
        // Verificar integridad de los datos
        if (!WeekVersioningRules.validateWeekVersionIntegrity(doc, version)) {
          console.warn("[useWeekVersioning] Week version integrity check failed")
        }
        
        console.log("[useWeekVersioning] Data loaded successfully:", {
          currentVersionNumber: doc.currentVersionNumber,
          status: doc.status,
          versionCompleted: version.isCompleted
        })
      } else {
        console.log("[useWeekVersioning] No week data found")
        setCurrentVersion(null)
        setWeekDocument(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      console.error("[useWeekVersioning] Error loading week data:", err)
    } finally {
      setIsLoading(false)
    }
  }, [baseWeekId, ownerId])

  // Cargar todas las versiones (opcional, para UI de historial)
  const loadAllVersions = useCallback(async () => {
    if (!baseWeekId) return

    try {
      const versions = await WeekVersioningService.getAllVersions(baseWeekId)
      setAvailableVersions(versions)
    } catch (err) {
      console.error("[useWeekVersioning] Error loading all versions:", err)
    }
  }, [baseWeekId])

  // Crear nueva versión
  const createNewVersion = useCallback(async (
    isCompleted: boolean
  ): Promise<CreateVersionResult> => {
    if (!baseWeekId || !user) {
      return {
        success: false,
        newVersionNumber: 0,
        error: "Datos insuficientes para crear versión"
      }
    }

    setIsCreatingVersion(true)
    setError(null)

    try {
      const result = await WeekVersioningService.createNewVersion(baseWeekId, {
        isCompleted,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || "Usuario"
      })

      if (result.success) {
        // Recargar datos para obtener la nueva versión actual
        await loadWeekData()
        await loadAllVersions()
        
        console.log("[useWeekVersioning] New version created:", {
          newVersionNumber: result.newVersionNumber,
          isCompleted
        })
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      return {
        success: false,
        newVersionNumber: 0,
        error: errorMessage
      }
    } finally {
      setIsCreatingVersion(false)
    }
  }, [baseWeekId, user, loadWeekData, loadAllVersions])

  // Completar semana
  const completeWeek = useCallback(async (
    employees: Empleado[],
    shifts: any[],
    assignments: WeekVersion["assignments"],
    dayStatus: WeekVersion["dayStatus"]
  ): Promise<CompleteWeekResult> => {
    if (!baseWeekId || !user) {
      return {
        success: false,
        completedVersionNumber: 0,
        error: "Datos insuficientes para completar semana"
      }
    }

    setIsCreatingVersion(true)
    setError(null)

    try {
      const result = await WeekVersioningService.completeCurrentWeek(
        baseWeekId,
        employees,
        shifts,
        assignments,
        dayStatus,
        user.uid,
        user.displayName || user.email || "Usuario"
      )

      if (result.success) {
        // Recargar datos para obtener la nueva versión completada
        await loadWeekData()
        await loadAllVersions()
        
        console.log("[useWeekVersioning] Week completed:", {
          completedVersionNumber: result.completedVersionNumber
        })
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      return {
        success: false,
        completedVersionNumber: 0,
        error: errorMessage
      }
    } finally {
      setIsCreatingVersion(false)
    }
  }, [baseWeekId, user, loadWeekData, loadAllVersions])

  // Editar semana (siempre crea nueva versión)
  const editWeek = useCallback(async (): Promise<EditWeekResult> => {
    if (!baseWeekId || !user) {
      return {
        success: false,
        newVersionNumber: 0,
        error: "Datos insuficientes para editar semana"
      }
    }

    setIsCreatingVersion(true)
    setError(null)

    try {
      // Validar si se puede editar la versión actual
      if (currentVersion && WeekVersioningRules.isVersionImmutable(currentVersion)) {
        console.log("[useWeekVersioning] Creating new version to edit completed week")
      }

      const result = await WeekVersioningService.editWeek(
        baseWeekId,
        user.uid,
        user.displayName || user.email || "Usuario"
      )

      if (result.success) {
        // Recargar datos para obtener la nueva versión draft
        await loadWeekData()
        await loadAllVersions()
        
        console.log("[useWeekVersioning] Week edited (new version created):", {
          newVersionNumber: result.newVersionNumber
        })
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      return {
        success: false,
        newVersionNumber: 0,
        error: errorMessage
      }
    } finally {
      setIsCreatingVersion(false)
    }
  }, [baseWeekId, user, currentVersion, loadWeekData, loadAllVersions])

  // Refrescar todas las versiones
  const refreshVersions = useCallback(async () => {
    await loadWeekData()
    await loadAllVersions()
  }, [loadWeekData, loadAllVersions])

  // Efecto para cargar datos iniciales
  useEffect(() => {
    loadWeekData()
  }, [loadWeekData])

  // Efecto para cargar todas las versiones cuando cambia la versión actual
  useEffect(() => {
    if (currentVersion) {
      loadAllVersions()
    }
  }, [currentVersion, loadAllVersions])

  return {
    // Estado actual
    currentVersion,
    weekDocument,
    availableVersions,
    
    // Estados de loading
    isLoading,
    isCreatingVersion,
    
    // Acciones principales
    createNewVersion,
    completeWeek,
    editWeek,
    
    // Utilidades
    refreshVersions,
    error
  }
}
