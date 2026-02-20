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
      collectionConstant: COLLECTIONS.SCHEDULES,
      ownerId,
      tipoOwnerId: typeof ownerId,
      userData,
      user: {
        uid: user?.uid,
        email: user?.email,
        displayName: user?.displayName
      },
      startDate,
      endDate
    })

    // 🔍 AUDITORÍA: Verificar consistencia de ownerId
    if (userData?.role === "invited" && userData?.ownerId) {
      console.log("🔍 [useSchedulesListener] USUARIO INVITED - ownerId desde userData:", {
        ownerIdFromUserData: userData.ownerId,
        ownerIdCalculado: ownerId,
        userUid: user.uid,
        coinciden: userData.ownerId === ownerId
      })
    } else {
      console.log("🔍 [useSchedulesListener] USUARIO NORMAL - ownerId desde user.uid:", {
        ownerIdFromUser: user.uid,
        ownerIdCalculado: ownerId,
        coinciden: user.uid === ownerId
      })
    }

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
          snapshotSize: snapshot.size,
          schedules: schedulesData.map(s => ({
            id: s.id,
            weekStart: s.weekStart,
            tipoWeekStart: typeof s.weekStart,
            ownerId: s.ownerId,
            coincideOwnerId: s.ownerId === ownerId,
            buildScheduleDocId: buildScheduleDocId(s.ownerId || '', s.weekStart || ''),
            idCoincideConDocId: s.id === buildScheduleDocId(s.ownerId || '', s.weekStart || ''),
            completada: s.completada,
            createdBy: s.createdBy,
            createdAt: s.createdAt
          }))
        })

        // 🔍 AUDITORÍA: Verificar tipos de weekStart
        const weekStartTypes = schedulesData.reduce((acc, s) => {
          const type = typeof s.weekStart
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        if (Object.keys(weekStartTypes).length > 1) {
          console.warn("⚠️ [useSchedulesListener] TIPOS INCONSISTENTES de weekStart:", weekStartTypes)
        } else {
          console.log("✅ [useSchedulesListener] Tipos de weekStart consistentes:", weekStartTypes)
        }

        // 🔍 AUDITORÍA: Verificar si hay documentos con ownerId diferente
        const ownerIdInconsistencias = schedulesData.filter(s => s.ownerId !== ownerId)
        if (ownerIdInconsistencias.length > 0) {
          console.warn("⚠️ [useSchedulesListener] DOCUMENTOS CON ownerId DIFERENTE:", {
            ownerIdEsperado: ownerId,
            documentosInconsistentes: ownerIdInconsistencias.map(s => ({
              id: s.id,
              weekStart: s.weekStart,
              ownerIdGuardado: s.ownerId,
              createdBy: s.createdBy
            }))
          })
        }

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
      console.log("🔍 [getWeekSchedule] Búsqueda local:", {
        weekStartStr,
        totalSchedules: schedules.length,
        ownerId,
        schedulesDisponibles: schedules.map(s => ({
          id: s.id,
          weekStart: s.weekStart,
          coincide: s.weekStart === weekStartStr
        }))
      })

      const matches = schedules.filter((s) => s.weekStart === weekStartStr)

      console.log("🔍 [getWeekSchedule] Resultados coincidentes:", {
        weekStartStr,
        matchesCount: matches.length,
        matches: matches.map(m => ({
          id: m.id,
          weekStart: m.weekStart,
          ownerId: m.ownerId,
          completada: m.completada
        }))
      })

      if (matches.length > 1) {
        console.warn("⚠️ [getWeekSchedule] Duplicados detectados para ownerId+weekStart", {
          ownerId,
          weekStartStr,
          ids: matches.map((m) => m.id),
        })
      }

      const deterministicId = ownerId ? buildScheduleDocId(ownerId, weekStartStr) : null
      const preferred = deterministicId ? matches.find((m) => m.id === deterministicId) : null

      console.log("🔍 [getWeekSchedule] Selección final:", {
        weekStartStr,
        deterministicId,
        preferredId: preferred?.id,
        fallbackId: matches[0]?.id,
        selectedId: (preferred || matches[0])?.id
      })

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
        collectionConstant: COLLECTIONS.SCHEDULES,
        ownerId,
        weekStartStr,
        tipoOwnerId: typeof ownerId,
        tipoWeekStartStr: typeof weekStartStr,
        buildScheduleDocId: buildScheduleDocId(ownerId, weekStartStr)
      })

      // 🔍 AUDITORÍA: Verificar consistencia de tipos
      if (typeof weekStartStr !== 'string') {
        console.warn("⚠️ [getWeekScheduleFromFirestore] weekStartStr no es string:", {
          weekStartStr,
          tipo: typeof weekStartStr
        })
      }

      if (typeof ownerId !== 'string') {
        console.warn("⚠️ [getWeekScheduleFromFirestore] ownerId no es string:", {
          ownerId,
          tipo: typeof ownerId
        })
      }

      // Query directa a Firestore por ownerId + weekStart
      const q = query(
        collection(db, COLLECTIONS.SCHEDULES),
        where("ownerId", "==", ownerId),
        where("weekStart", "==", weekStartStr),
      )

      const querySnapshot = await getDocs(q)
      
      console.log("🔍 [getWeekScheduleFromFirestore] Resultado query directa:", {
        querySize: querySnapshot.size,
        empty: querySnapshot.empty,
        weekStartStr,
        ownerId
      })
      
      if (querySnapshot.empty) {
        console.log("🔍 [getWeekScheduleFromFirestore] No se encontró documento para:", { weekStartStr, ownerId })
        
        // 🔍 AUDITORÍA: Intentar buscar SIN filtro de weekStart para ver qué existe
        const debugQuery = query(
          collection(db, COLLECTIONS.SCHEDULES),
          where("ownerId", "==", ownerId)
        )
        const debugSnapshot = await getDocs(debugQuery)
        
        console.log("🔍 [getWeekScheduleFromFirestore] DEBUG - Todos los documentos del ownerId:", {
          totalDocumentos: debugSnapshot.size,
          documentos: debugSnapshot.docs.map(doc => ({
            id: doc.id,
            weekStart: doc.data().weekStart,
            tipoWeekStart: typeof doc.data().weekStart,
            weekStartBuscado: weekStartStr,
            coincidenciaExacta: doc.data().weekStart === weekStartStr
          }))
        })
        
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
        completada: scheduleData.completada,
        deterministicId,
        coincideId: scheduleData.id === deterministicId,
        ownerIdGuardado: scheduleData.ownerId,
        ownerIdEsperado: ownerId
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

