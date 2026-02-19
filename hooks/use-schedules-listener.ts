import { useEffect, useState, useMemo, useCallback } from "react"
import { collection, query, orderBy, onSnapshot, where, getDocs } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { Horario } from "@/lib/types"
import { format, subMonths, addMonths } from "date-fns"
import { logger } from "@/lib/logger"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { buildScheduleDocId } from "@/lib/firestore-helpers"

interface UseSchedulesListenerProps {
  user: any
  monthRange?: { startDate: Date; endDate: Date }
  enabled?: boolean // Para poder habilitar/deshabilitar el listener
}

interface UseSchedulesListenerReturn {
  schedules: Horario[]
  loading: boolean
  error: Error | null
  getWeekSchedule: (weekStartStr: string) => Horario | null // 🔥 Cambio: string en lugar de Date
  getWeekScheduleFromFirestore: (weekStartStr: string) => Promise<Horario | null> // 🔥 Cambio: string en lugar de Date
}

/**
 * Hook centralizado para listener de schedules
 * Maneja filtros, límites y optimizaciones
 */
export function useSchedulesListener({
  user,
  monthRange,
  enabled = true,
}: UseSchedulesListenerProps): UseSchedulesListenerReturn {
  const [schedules, setSchedules] = useState<Horario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { userData } = useData()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])

  useEffect(() => {
    if (!enabled || !user || !db || !ownerId) {
      setSchedules([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    // Calcular rango de fechas para filtrar
    // Si no se proporciona monthRange, usar rango por defecto (últimos 3 meses hasta 6 meses futuros)
    const defaultStartDate = subMonths(new Date(), 3)
    const defaultEndDate = addMonths(new Date(), 6)
    
    const startDate = monthRange
      ? format(subMonths(monthRange.startDate, 2), "yyyy-MM-dd")
      : format(defaultStartDate, "yyyy-MM-dd")
    const endDate = monthRange
      ? format(addMonths(monthRange.endDate, 3), "yyyy-MM-dd")
      : format(defaultEndDate, "yyyy-MM-dd")

    // Query base - filtrado por ownerId y ordenado por weekStart descendente
    const schedulesQuery = query(
      collection(db, COLLECTIONS.SCHEDULES),
      where("ownerId", "==", ownerId),
      orderBy("weekStart", "desc"),
    )

    // 🔍 AUDITORÍA: Loguear parámetros de query
    console.log("🔍 [useSchedulesListener] AUDITORÍA - Query:", {
      collection: "apps/horarios/schedules",
      ownerId,
      tipoOwnerId: typeof ownerId,
      startDate,
      endDate
    })

    const unsubscribe = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        const schedulesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Horario[]

        // 🔍 AUDITORÍA: Loguear todos los weekStart del listener
        console.log("🔍 [useSchedulesListener] AUDITORÍA - Schedules recibidos:", {
          ownerIdActual: ownerId,
          schedulesCount: schedulesData.length,
          schedules: schedulesData.map(s => ({
            id: s.id,
            weekStart: s.weekStart,
            tipoWeekStart: typeof s.weekStart,
            ownerId: s.ownerId,
            coincideOwnerId: s.ownerId === ownerId
          }))
        })

        // Filtrar schedules por rango de fechas en el cliente
        // Ya están filtrados por createdBy en la query, solo necesitamos filtrar por fecha
        // Mantener todas las semanas completadas (para historial)
        const filteredSchedules = schedulesData.filter((schedule) => {
          if (!schedule.weekStart) return false
          // Mantener todas las semanas completadas
          if (schedule.completada === true) return true
          // Filtrar semanas no completadas fuera del rango
          return schedule.weekStart >= startDate && schedule.weekStart <= endDate
        })

        setSchedules(filteredSchedules)
        setLoading(false)
        logger.debug(`[useSchedulesListener] Cargados ${filteredSchedules.length} schedules (de ${schedulesData.length} totales)`)
      },
      (err) => {
        logger.error("Error en listener de schedules:", err)
        setError(err as Error)
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [user, ownerId, enabled, monthRange?.startDate, monthRange?.endDate])

  // Función para obtener schedule de una semana específica
  const getWeekSchedule = useMemo(
    () => (weekStartStr: string) => {
      // � AUDITORÍA: Loguear valores reales
      console.log("🔍 [getWeekSchedule] AUDITORÍA:", {
        weekStartStr,
        tipoWeekStartStr: typeof weekStartStr,
        schedulesCount: schedules.length
      })
      
      const matches = schedules.filter((s) => s.weekStart === weekStartStr)

      if (matches.length > 1) {
        console.warn("⚠️ [getWeekSchedule] Duplicados detectados para ownerId+weekStart", {
          ownerId,
          weekStartStr,
          ids: matches.map((m) => m.id),
        })
      }

      const deterministicId = ownerId ? buildScheduleDocId(ownerId, weekStartStr) : null
      const preferred = deterministicId ? matches.find((m) => m.id === deterministicId) : null

      return preferred || matches[0] || null
    },
    [schedules, ownerId]
  )

  // 🔥 FUNCIÓN CRÍTICA: Buscar documento real en Firestore (sin depender de array filtrado)
  const getWeekScheduleFromFirestore = useCallback(async (weekStartStr: string): Promise<Horario | null> => {
    if (!db || !ownerId) {
      console.warn("🔍 [getWeekScheduleFromFirestore] No hay db u ownerId")
      return null
    }

    try {
      console.log("🔍 [getWeekScheduleFromFirestore] Query directa:", {
        collection: "apps/horarios/schedules",
        ownerId,
        weekStartStr,
        tipoOwnerId: typeof ownerId,
        tipoWeekStartStr: typeof weekStartStr
      })

      // Query directa a Firestore por ownerId + weekStart
      const q = query(
        collection(db, COLLECTIONS.SCHEDULES),
        where("ownerId", "==", ownerId),
        where("weekStart", "==", weekStartStr),
      )

      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        console.log("🔍 [getWeekScheduleFromFirestore] No se encontró documento para:", { weekStartStr, ownerId })
        return null
      }

      const matches = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Horario))
      if (matches.length > 1) {
        console.warn("⚠️ [getWeekScheduleFromFirestore] Duplicados detectados para ownerId+weekStart", {
          ownerId,
          weekStartStr,
          ids: matches.map((m) => m.id),
        })
      }

      const deterministicId = buildScheduleDocId(ownerId, weekStartStr)
      const scheduleData = matches.find((s) => s.id === deterministicId) || matches[0]

      console.log("🔍 [getWeekScheduleFromFirestore] Documento encontrado:", {
        id: scheduleData.id,
        weekStart: scheduleData.weekStart,
        tipoWeekStart: typeof scheduleData.weekStart,
        completada: scheduleData.completada
      })

      return scheduleData
    } catch (error) {
      console.error("🔍 [getWeekScheduleFromFirestore] Error en query directa:", error)
      return null
    }
  }, [db, ownerId])

  return {
    schedules,
    loading,
    error,
    getWeekSchedule,
    getWeekScheduleFromFirestore, // 🔥 Nueva función para query directa
  }
}

