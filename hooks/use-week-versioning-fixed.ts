import { useState, useCallback, useEffect } from "react"
import { 
  WeekVersion, 
  WeekVersionState, 
  CreateVersionResult, 
  CompleteWeekResult,
  WeekVersioningRules
} from "@/lib/types/week-versioning"
import { 
  WeekVersioningService 
} from "@/lib/week-versioning-service-fixed"
import { Empleado, ShiftAssignment } from "@/lib/types"

interface UseWeekVersioningProps {
  baseWeekId: string
  employees: Empleado[]
  shifts: any[]
  userId: string
  userName: string
}

export function useWeekVersioning({
  baseWeekId,
  employees,
  shifts,
  userId,
  userName
}: UseWeekVersioningProps) {
  const [state, setState] = useState<WeekVersionState>({
    currentVersion: null,
    availableVersions: [],
    isLoading: true,
    isCreatingNewVersion: false,
  })

  // Cargar versión actual - PERFORMANCE OPTIMIZADO
  const loadCurrentVersion = useCallback(async () => {
    if (!baseWeekId) return

    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const currentVersion = await WeekVersioningService.getCurrentVersion(baseWeekId)
      
      setState({
        currentVersion,
        availableVersions: [], // Solo cargar cuando se necesite
        isLoading: false,
        isCreatingNewVersion: false,
      })
    } catch (error) {
      console.error("Error loading week versions:", error)
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: error instanceof Error ? error.message : "Error desconocido"
      }))
    }
  }, [baseWeekId])

  // Crear nueva versión - CLONA DESDE FIRESTORE, NO DESDE UI
  const createNewVersion = useCallback(async (
    isCompleted: boolean = false
  ): Promise<CreateVersionResult> => {
    if (!baseWeekId) {
      return {
        success: false,
        newVersionNumber: 0,
        error: "No se proporcionó baseWeekId",
      }
    }

    setState(prev => ({ ...prev, isCreatingNewVersion: true }))

    try {
      // Crear snapshot de empleados desde versión actual
      const employeesSnapshot = employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
      }))

      const result = await WeekVersioningService.createNewVersion(baseWeekId, {
        isCompleted,
        employeesSnapshot,
        createdBy: userId,
        createdByName: userName,
      })

      if (result.success) {
        // Recargar versión actual
        await loadCurrentVersion()
      }

      setState(prev => ({ ...prev, isCreatingNewVersion: false }))
      return result
    } catch (error) {
      console.error("Error creating new version:", error)
      setState(prev => ({ ...prev, isCreatingNewVersion: false }))
      return {
        success: false,
        newVersionNumber: 0,
        error: error instanceof Error ? error.message : "Error desconocido",
      }
    }
  }, [baseWeekId, employees, userId, userName, loadCurrentVersion])

  // Completar semana actual - CREA NUEVA VERSIÓN COMPLETADA
  const completeWeek = useCallback(async (
    assignments: WeekVersion["assignments"],
    dayStatus: WeekVersion["dayStatus"]
  ): Promise<CompleteWeekResult> => {
    if (!baseWeekId) {
      return {
        success: false,
        completedVersionNumber: 0,
        error: "No se proporcionó baseWeekId",
      }
    }

    setState(prev => ({ ...prev, isCreatingNewVersion: true }))

    try {
      const result = await WeekVersioningService.completeCurrentWeek(
        baseWeekId,
        employees,
        shifts,
        assignments,
        dayStatus,
        userId,
        userName
      )

      if (result.success) {
        // Recargar versión actual
        await loadCurrentVersion()
      }

      setState(prev => ({ ...prev, isCreatingNewVersion: false }))
      return result
    } catch (error) {
      console.error("Error completing week:", error)
      setState(prev => ({ ...prev, isCreatingNewVersion: false }))
      return {
        success: false,
        completedVersionNumber: 0,
        error: error instanceof Error ? error.message : "Error desconocido",
      }
    }
  }, [baseWeekId, employees, shifts, userId, userName, loadCurrentVersion])

  // Cargar todas las versiones - LAZY LOADING
  const loadAllVersions = useCallback(async () => {
    if (!baseWeekId) return

    try {
      const allVersions = await WeekVersioningService.getAllVersions(baseWeekId)
      
      setState(prev => ({
        ...prev,
        availableVersions: allVersions,
      }))
    } catch (error) {
      console.error("Error loading all versions:", error)
    }
  }, [baseWeekId])

  // Verificar si necesita migración
  const checkMigrationNeeded = useCallback(async () => {
    if (!baseWeekId) return false

    try {
      const needsMigration = await WeekVersioningService.needsMigration(baseWeekId)
      return needsMigration
    } catch (error) {
      console.error("Error checking migration:", error)
      return false
    }
  }, [baseWeekId])

  // Migrar desde formato legado - IDEMPOTENTE
  const migrateFromLegacy = useCallback(async (legacyWeekData: any) => {
    if (!baseWeekId) return false

    try {
      const success = await WeekVersioningService.migrateFromLegacy(baseWeekId, legacyWeekData)
      if (success) {
        // Recargar versión actual después de migración
        await loadCurrentVersion()
      }
      return success
    } catch (error) {
      console.error("Error migrating from legacy:", error)
      return false
    }
  }, [baseWeekId, loadCurrentVersion])

  // Cargar datos al montar el hook
  useEffect(() => {
    loadCurrentVersion()
  }, [loadCurrentVersion])

  // Obtener datos de la versión actual para UI
  const getCurrentVersionData = useCallback(() => {
    if (!state.currentVersion) return null

    return {
      assignments: state.currentVersion.assignments,
      dayStatus: state.currentVersion.dayStatus,
      employeesSnapshot: state.currentVersion.employeesSnapshot,
      isCompleted: state.currentVersion.isCompleted,
      versionNumber: state.currentVersion.versionNumber,
    }
  }, [state.currentVersion])

  // Verificar si la semana está completada
  const isWeekCompleted = useCallback(() => {
    return state.currentVersion?.isCompleted || false
  }, [state.currentVersion])

  // Validar si se puede editar versión actual
  const canEditCurrentVersion = useCallback(() => {
    if (!state.currentVersion) return false
    return WeekVersioningRules.canEditVersion(state.currentVersion)
  }, [state.currentVersion])

  // Obtener texto para botón principal
  const getPrimaryButtonText = useCallback(() => {
    if (isWeekCompleted()) {
      return "Crear nueva versión"
    }
    return "Completar semana"
  }, [isWeekCompleted])

  return {
    // Estado
    ...state,
    
    // Datos actuales
    currentVersionData: getCurrentVersionData(),
    isWeekCompleted: isWeekCompleted(),
    canEditCurrentVersion: canEditCurrentVersion(),
    primaryButtonText: getPrimaryButtonText(),
    
    // Acciones
    createNewVersion,
    completeWeek,
    checkMigrationNeeded,
    migrateFromLegacy,
    loadAllVersions,
    reloadVersions: loadCurrentVersion,
  }
}
