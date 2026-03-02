import { useEffect, useState, useMemo, useRef } from "react"
import { collection, query, orderBy, onSnapshot, where, doc, getDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { Horario } from "@/lib/types"
import { format, subMonths, addMonths } from "date-fns"
import { logger } from "@/lib/logger"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { buildScheduleDocId } from "@/lib/firestore-helpers"
import { getCache, setCache } from "@/lib/cache/indexeddb-cache"

interface UseSchedulesListenerProps {
  user: any
  monthRange?: { startDate: Date; endDate: Date }
  enabled?: boolean
}

interface UseSchedulesListenerReturn {
  schedules: Horario[]
  visibleSchedules: Horario[]
  loading: boolean
  error: Error | null
  getWeekSchedule: (weekStartStr: string) => Horario | null
}

const WEEKS_COLLECTION = "apps/horarios/weeks"
const VERSIONS_SUBCOLLECTION = "versions"

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
  const listenerSetupRef = useRef(false)

  useEffect(() => {
    if (!enabled || !user || !db || !ownerId) {
      setSchedules([])
      setLoading(false)
      setError(null)
      listenerSetupRef.current = false
      return
    }

    // Evitar múltiples listeners
    if (listenerSetupRef.current) return
    listenerSetupRef.current = true

    const cacheKey = `schedules-${ownerId}`
    const schedulesQuery = query(
      collection(db, COLLECTIONS.SCHEDULES),
      where("ownerId", "==", ownerId),
      orderBy("weekStart", "desc"),
    )

    let hasCachedData = false

    // 1. Cargar desde cache primero (stale-while-revalidate)
    getCache<Horario[]>(cacheKey)
      .then((cachedSchedules) => {
        if (cachedSchedules && cachedSchedules.length > 0) {
          hasCachedData = true
          setSchedules(cachedSchedules)
          setLoading(false)
          setError(null)
          logger.debug(`[useSchedulesListener] Cargados ${cachedSchedules.length} schedules desde cache`)
        } else {
          // Solo mostrar loading si no hay cache
          setLoading(true)
        }
      })
      .catch(() => {
        // Si falla el cache, mostrar loading
        setLoading(true)
      })

    // 2. Configurar listener en tiempo real
    const unsubscribe = onSnapshot(
      schedulesQuery,
      async (snapshot) => {
        const rawSchedules = snapshot.docs.map((scheduleDoc) => ({
          id: scheduleDoc.id,
          ...scheduleDoc.data(),
        })) as Horario[]

        const schedulesData = await Promise.all(
          rawSchedules.map(async (schedule) => {
            if (!schedule.baseWeekId || !db) {
              return schedule
            }

            try {
              const weekRef = doc(db, WEEKS_COLLECTION, schedule.baseWeekId)
              const weekDoc = await getDoc(weekRef)

              if (!weekDoc.exists()) {
                return schedule
              }

              const weekData = weekDoc.data() as {
                status?: "draft" | "completed"
                currentVersionNumber?: number
              }

              const currentVersionNumber = weekData.currentVersionNumber
              if (!currentVersionNumber) {
                return {
                  ...schedule,
                  completada: weekData.status === "completed",
                } as Horario
              }

              const versionRef = doc(collection(weekRef, VERSIONS_SUBCOLLECTION), String(currentVersionNumber))
              const versionDoc = await getDoc(versionRef)

              if (!versionDoc.exists()) {
                return {
                  ...schedule,
                  completada: weekData.status === "completed",
                } as Horario
              }

              const versionData = versionDoc.data() as {
                assignments?: Horario["assignments"]
                dayStatus?: Horario["dayStatus"]
              }

              return {
                ...schedule,
                assignments: versionData.assignments || {},
                dayStatus: versionData.dayStatus || {},
                completada: weekData.status === "completed",
              } as Horario
            } catch (error) {
              logger.error("[useSchedulesListener] Error hidratando semana versionada", {
                scheduleId: schedule.id,
                baseWeekId: schedule.baseWeekId,
                error,
              })
              return schedule
            }
          })
        )

        // Siempre actualizar con datos hidratados para que stats y UI reflejen
        // assignments/completada correctamente (evita que compareArraysByIds
        // bloquee actualizaciones tras marcar LISTO en semanas versionadas).
        setSchedules(schedulesData)
        logger.debug("[useSchedulesListener] Schedules actualizados desde Firestore", { count: schedulesData.length })
        
        setLoading(false)
        setError(null)

        // 3. Actualizar cache en background
        setCache(cacheKey, schedulesData).catch(() => {
          // Ignorar errores de cache
        })
      },
      (err) => {
        logger.error("Error en listener de schedules:", err)
        setError(err as Error)
        setLoading(false)
        listenerSetupRef.current = false
      },
    )

    return () => {
      unsubscribe()
      listenerSetupRef.current = false
    }
  }, [enabled, ownerId, user])

  const visibleSchedules = useMemo(() => {
    const defaultStartDate = format(subMonths(new Date(), 3), "yyyy-MM-dd")
    const defaultEndDate = format(addMonths(new Date(), 6), "yyyy-MM-dd")

    const startDate = monthRange
      ? format(subMonths(monthRange.startDate, 2), "yyyy-MM-dd")
      : defaultStartDate
    const endDate = monthRange
      ? format(addMonths(monthRange.endDate, 3), "yyyy-MM-dd")
      : defaultEndDate

    return schedules.filter((schedule) => {
      if (!schedule.weekStart) return false
      if (schedule.completada === true) return true
      return schedule.weekStart >= startDate && schedule.weekStart <= endDate
    })
  }, [monthRange, schedules])

  const schedulesByWeekStart = useMemo(() => {
    const index = new Map<string, Horario[]>()

    for (const schedule of schedules) {
      if (!schedule.weekStart) continue
      const current = index.get(schedule.weekStart) || []
      current.push(schedule)
      index.set(schedule.weekStart, current)
    }

    return index
  }, [schedules])

  const getWeekSchedule = useMemo(
    () => (weekStartStr: string) => {
      const matches = schedulesByWeekStart.get(weekStartStr) || []

      if (matches.length > 1) {
        logger.warn("[useSchedulesListener] Duplicados para ownerId+weekStart", {
          ownerId,
          weekStartStr,
          ids: matches.map((m) => m.id),
        })
      }

      const deterministicId = ownerId ? buildScheduleDocId(ownerId, weekStartStr) : null
      const deterministicMatch = deterministicId ? matches.find((match) => match.id === deterministicId) : null
      const result = deterministicMatch || matches[0] || null
      
      console.log("🔎 getWeekSchedule lookup:", {
        requestedWeekStart: weekStartStr,
        availableWeekStarts: schedules.map(s => s.weekStart),
        matched: schedules.find(s => s.weekStart === weekStartStr)?.id,
        matchedSchedule: schedules.find(s => s.weekStart === weekStartStr),
        allSchedules: schedules.map(s => ({ id: s.id, weekStart: s.weekStart, hasAssignments: !!s.assignments }))
      })

      return result
    },
    [ownerId, schedulesByWeekStart, schedules],
  )

  return {
    schedules,
    visibleSchedules,
    loading,
    error,
    getWeekSchedule,
  }
}
