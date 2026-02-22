import { useEffect, useState, useMemo } from "react"
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore"
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
  enabled?: boolean
}

interface UseSchedulesListenerReturn {
  schedules: Horario[]
  visibleSchedules: Horario[]
  loading: boolean
  error: Error | null
  getWeekSchedule: (weekStartStr: string) => Horario | null
}

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

    const schedulesQuery = query(
      collection(db, COLLECTIONS.SCHEDULES),
      where("ownerId", "==", ownerId),
      orderBy("weekStart", "desc"),
    )

    const unsubscribe = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        const schedulesData = snapshot.docs.map((scheduleDoc) => ({
          id: scheduleDoc.id,
          ...scheduleDoc.data(),
        })) as Horario[]

        // LOG TEMPORAL - Detectar cambios
        const changedDocs = snapshot.docChanges().map(change => ({
          type: change.type,
          docId: change.doc.id,
          weekStart: change.doc.data().weekStart,
          hasAssignments: !!change.doc.data().assignments,
          assignmentsKeys: change.doc.data().assignments ? Object.keys(change.doc.data().assignments) : []
        }))
        
        console.log('[useSchedulesListener] SNAPSHOT RECIBIDO:', {
          docsCount: snapshot.docs.length,
          schedulesCount: schedulesData.length,
          changedDocs
        })

        console.log("👂 LISTENER UPDATE:", {
          scheduleIds: schedulesData.map(s => s.id),
          weeks: schedulesData.map(s => s.weekStart),
          completadas: schedulesData.map(s => s.completada),
        })

        setSchedules(schedulesData)
        setLoading(false)
        logger.debug(`[useSchedulesListener] Cargados ${schedulesData.length} schedules`)
      },
      (err) => {
        logger.error("Error en listener de schedules:", err)
        setError(err as Error)
        setLoading(false)
      },
    )

    return () => unsubscribe()
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
