// Hook de Semanas Simplificado - Modelo Final
// Solo dos tipos: Legacy (schedules) y Versionado (weeks/{baseWeekId}/versions/{n})

import { useState, useEffect, useCallback } from "react"
import { WeekService } from "@/lib/week-service-simple"
import { useData } from "@/contexts/data-context"
import { useOwnerId } from "./use-owner-id"
import { Empleado, Horario } from "@/lib/types"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { buildScheduleDocId } from "@/lib/firestore-helpers"

interface UseWeekReturn {
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
  ) => Promise<{ success: boolean; error?: string; versionNumber?: number }>
  editVersionedWeek: (baseWeekId: string) => Promise<{ success: boolean; error?: string; newVersionNumber?: number }>
  updateAssignment: (
    date: string,
    employeeId: string,
    assignments: any[],
    options?: { scheduleId?: string }
  ) => Promise<void>
}

export function useWeek(weekStart: string | null): UseWeekReturn {
  const [weekData, setWeekData] = useState<Horario | any | null>(null)
  const [source, setSource] = useState<'schedules' | 'versions' | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { userData, user } = useData()
  const ownerId = useOwnerId()
  const actor = userData || user

  // Cargar datos de la semana con lógica única
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
      console.log("[useWeek] Loading week data:", { weekStart, ownerId })
      
      const result = await WeekService.getWeekData(null, weekStart, ownerId)
      
      if (result) {
        setWeekData(result.data)
        setSource(result.source)
        console.log("[useWeek] Week data loaded from:", result.source)
      } else {
        setWeekData(null)
        setSource(null)
        console.log("[useWeek] No week data found")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      console.error("[useWeek] Error loading week data:", err)
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

      const result = await WeekService.markWeekComplete(
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
        console.log("[useWeek] Week marked as complete:", result.versionNumber)
      }

      return {
        success: result.success,
        error: result.error,
        versionNumber: result.versionNumber
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

      const result = await WeekService.editVersionedWeek(
        baseWeekId,
        user.uid,
        user.displayName || user.email || "Usuario"
      )

      if (result.success) {
        // Recargar datos para obtener la nueva versión
        await loadWeekData()
        console.log("[useWeek] Week edited, new version:", result.newVersionNumber)
      }

      return {
        success: result.success,
        error: result.error,
        newVersionNumber: result.newVersionNumber
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [user, loadWeekData])

  // Actualizar asignación
  const updateAssignment = useCallback(async (
    date: string,
    employeeId: string,
    assignments: any[],
    options?: { scheduleId?: string }
  ) => {
    if (!ownerId) {
      throw new Error("No se pudo determinar ownerId")
    }

    try {
      // Obtener el schedule para determinar el tipo
      const { startOfWeek, format } = await import("date-fns")
      const weekStartsOn = 1 as 0 | 1 | 2 | 3 | 4 | 5 | 6
      
      const [year, month, day] = date.split('-').map(Number)
      const dateObj = new Date(year, month - 1, day, 12, 0, 0)
      const computedWeekStartDate = startOfWeek(dateObj, { weekStartsOn })
      const computedWeekStartUI = format(computedWeekStartDate, "yyyy-MM-dd")
      
      let foundSchedule: Horario | null = null
      
      // Buscar el schedule actual
      if (options?.scheduleId) {
        foundSchedule = await getDoc(doc(db, COLLECTIONS.SCHEDULES, options.scheduleId)).then(doc => 
          doc.exists() ? { id: doc.id, ...doc.data() } as Horario : null
        )
      } else {
        // Intentar obtener usando el hook actual
        const scheduleId = buildScheduleDocId(ownerId, computedWeekStartUI)
        foundSchedule = await getDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId)).then(doc => 
          doc.exists() ? { id: doc.id, ...doc.data() } as Horario : null
        )
      }
      
      if (!foundSchedule) {
        throw new Error("No se encontró el schedule para la fecha especificada")
      }

      // REGLA: Verificar si está versionado
      const isVersioned = WeekService.isWeekVersioned(foundSchedule)
      const weekStatus = WeekService.getWeekStatus(foundSchedule)

      console.log("[useWeek] Assignment update:", {
        date,
        employeeId,
        isVersioned,
        weekStatus,
        scheduleId: foundSchedule.id,
        baseWeekId: foundSchedule.baseWeekId
      })

      // REGLA: Si está versionada y está completada, crear nueva versión
      if (isVersioned && weekStatus === 'completed') {
        const baseWeekId = foundSchedule.baseWeekId
        if (!baseWeekId) {
          throw new Error("Error: baseWeekId no encontrado en schedule versionado")
        }

        const result = await WeekService.editVersionedWeek(
          baseWeekId,
          user.uid,
          user.displayName || user.email || "Usuario"
        )

        if (result.success) {
          console.log("[useWeek] New version created:", result.newVersionNumber)
          
          // Bridge legacy: actualizar schedule para que sea editable
          await setDoc(doc(db, COLLECTIONS.SCHEDULES, foundSchedule.id), {
            completada: false,
            updatedAt: serverTimestamp(),
          }, { merge: true })
        } else {
          throw new Error(result.error || "Error al crear nueva versión")
        }

        return
      }

      // REGLA: Si no está versionada, usar sistema legacy
      if (!isVersioned) {
        // Importar scheduleApplication dinámicamente para evitar dependencia circular
        const { scheduleApplication } = await import("@/lib/schedule-application")
        const { useConfig } = await import("@/hooks/use-config")
        const config = useConfig(user)
        
        await scheduleApplication.updateAssignment(
          { date, employeeId, assignments, options },
          actor,
          employees: [], // Se pasará como parámetro
          shifts: [], // Se pasará como parámetro
          config,
          schedules: [], // Se pasará como parámetro
          getWeekSchedule: () => foundSchedule, // Usar el schedule encontrado
        )

        console.log("[useWeek] Legacy assignment updated")
        return
      }

      // REGLA: Si está versionada pero en modo draft, permitir edición directa
      if (isVersioned && weekStatus === 'draft') {
        // Permitir edición directa en schedules (bridge legacy)
        const { scheduleApplication } = await import("@/lib/schedule-application")
        const { useConfig } = await import("@/hooks/use-config")
        const config = useConfig(user)
        
        await scheduleApplication.updateAssignment(
          { date, employeeId, assignments, options },
          actor,
          employees: [], // Se pasará como parámetro
          shifts: [], // Se pasará como parámetro
          config,
          schedules: [], // Se pasará como parámetro
          getWeekSchedule: () => foundSchedule, // Usar el schedule encontrado
        )

        console.log("[useWeek] Draft assignment updated")
        return
      }

      throw new Error("Estado de semana no manejado para edición")
    } catch (error: any) {
      console.error("Error al actualizar asignaciones:", error)
      throw error
    }
  }, [ownerId, user])

  // Determinar estado y si está versionado
  const { isVersioned, weekStatus } = (() => {
    if (!weekData) {
      return { isVersioned: false, weekStatus: null }
    }

    const isVersioned = WeekService.isWeekVersioned(weekData as Horario)
    const weekStatus = WeekService.getWeekStatus(weekData as Horario)

    return { isVersioned, weekStatus }
  })()

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
    editVersionedWeek,
    updateAssignment
  }
}
