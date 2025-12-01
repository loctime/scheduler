import { useEffect, useState, useMemo } from "react"
import { collection, query, orderBy, onSnapshot, where, limit } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { Horario } from "@/lib/types"
import { format, subMonths, addMonths } from "date-fns"
import { logger } from "@/lib/logger"

interface UseSchedulesListenerProps {
  user: any
  monthRange?: { startDate: Date; endDate: Date }
  enabled?: boolean // Para poder habilitar/deshabilitar el listener
}

/**
 * Hook centralizado para listener de schedules
 * Maneja filtros, límites y optimizaciones
 */
export function useSchedulesListener({
  user,
  monthRange,
  enabled = true,
}: UseSchedulesListenerProps) {
  const [schedules, setSchedules] = useState<Horario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled || !user || !db) {
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

    // Query base - ordenado por weekStart descendente
    const schedulesQuery = query(
      collection(db, COLLECTIONS.SCHEDULES),
      orderBy("weekStart", "desc"),
      // Nota: limit y where juntos requieren índice compuesto
      // Por ahora filtramos en cliente para mantener flexibilidad
    )

    const unsubscribe = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        const schedulesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Horario[]

        // Filtrar schedules por rango de fechas en el cliente
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
  }, [user, enabled, monthRange?.startDate, monthRange?.endDate])

  // Función para obtener schedule de una semana específica
  const getWeekSchedule = useMemo(
    () => (weekStartDate: Date) => {
      const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
      return schedules.find((s) => s.weekStart === weekStartStr) || null
    },
    [schedules]
  )

  return {
    schedules,
    loading,
    error,
    getWeekSchedule,
  }
}


