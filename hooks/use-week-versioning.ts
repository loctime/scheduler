import { useState, useCallback, useEffect } from "react"
import { 
  WeekVersion, 
  WeekVersionState, 
  CreateVersionResult, 
  CompleteWeekResult 
} from "@/lib/types/week-versioning"
import { 
  WeekVersioningService 
} from "@/lib/week-versioning-service-new"
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

  // Cargar versión actual
  const loadCurrentVersion = useCallback(async () => {
    if (!baseWeekId) return

    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const currentVersion = await WeekVersioningService.getCurrentVersion(baseWeekId)
      const allVersions = await WeekVersioningService.getAllVersions(baseWeekId)
      
      setState({
        currentVersion,
        availableVersions: allVersions,
        isLoading: false,
        isCreatingNewVersion: false,
      })
    } catch (error) {
      console.error("Error loading week versions:", error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [baseWeekId])

  // Crear nueva versión para edición
  const createNewVersion = useCallback(async (
    assignments: any,
    dayStatus: any,
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
      // Crear snapshot de empleados
      const employeeIdsInWeek = new Set<string>()
      Object.values(assignments).forEach((dayAssignments: any) => {
        if (!dayAssignments || typeof dayAssignments !== "object") return
        Object.keys(dayAssignments).forEach((employeeId) => employeeIdsInWeek.add(employeeId))
      })
      
      const employeesMap = new Map(employees.map((employee) => [employee.id, employee]))
      const employeesSnapshot = Array.from(employeeIdsInWeek).map((id) => {
        const employee = employeesMap.get(id)
        return {
          id,
          name: employee?.name || id,
        }
      })

      const result = await WeekVersioningService.createNewVersion(baseWeekId, {
        isCompleted,
        assignments,
        dayStatus,
        employeesSnapshot,
        createdBy: userId,
        createdByName: userName,
      })

      if (result.success) {
        // Recargar versiones
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

  // Completar semana actual
  const completeWeek = useCallback(async (
    assignments: any,
    dayStatus: any
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
        // Recargar versiones
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

  // Migrar desde formato legado
  const migrateFromLegacy = useCallback(async (legacyWeekData: any) => {
    if (!baseWeekId) return false

    try {
      const success = await WeekVersioningService.migrateFromLegacy(baseWeekId, legacyWeekData)
      if (success) {
        // Recargar versiones después de migración
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

  return {
    // Estado
    ...state,
    
    // Datos actuales
    currentVersionData: getCurrentVersionData(),
    isWeekCompleted: isWeekCompleted(),
    
    // Acciones
    createNewVersion,
    completeWeek,
    checkMigrationNeeded,
    migrateFromLegacy,
    reloadVersions: loadCurrentVersion,
  }
}
