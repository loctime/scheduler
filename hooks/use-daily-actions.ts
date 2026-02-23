"use client"

import { useState, useEffect } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface DailyAction {
  id: string
  title: string
  description?: string
  daysOfWeek: number[] // Array de días 0-6 (domingo-sábado)
  employeeIds?: string[] // opcional
  active: boolean
  createdAt: any
}

export interface DailyActionsData {
  actions: DailyAction[]
  isLoading: boolean
  error?: Error
}

/**
 * Hook para obtener acciones diarias configuradas por el owner
 * Filtra por día de la semana y empleado específico si corresponde
 */
export function useDailyActions(ownerId: string, employeeId?: string): DailyActionsData {
  const [actions, setActions] = useState<DailyAction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()

  useEffect(() => {
    if (!ownerId) return

    const unsubscribe = onSnapshot(
      doc(db!, "apps", "horarios", "dailyActions", ownerId),
      (docSnapshot) => {
        try {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data()
            const allActions = data?.actions || []
            const today = new Date().getDay()
            
            // Filtrar acciones que estén activas, incluyan el día actual y sean para el empleado correcto
            const filteredActions = allActions.filter((action: DailyAction) => {
              // Verificar que esté activa y que el día actual esté en el array de días
              const isActiveAndToday = action.active && action.daysOfWeek.includes(today)
              
              // Si no hay employeeIds, es para todos los empleados
              // Si hay employeeIds, verificar que el empleado actual esté incluido
              const isForEmployee = !action.employeeIds || action.employeeIds.includes(employeeId!)
              
              return isActiveAndToday && isForEmployee
            })
            
            setActions(filteredActions)
          } else {
            setActions([])
          }
          setIsLoading(false)
        } catch (err) {
          console.error("Error processing daily actions:", err)
          setError(err instanceof Error ? err : new Error("Unknown error"))
          setActions([])
          setIsLoading(false)
        }
      },
      (err) => {
        console.error("Error fetching daily actions:", err)
        setError(err instanceof Error ? err : new Error("Unknown error"))
        setActions([])
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [ownerId, employeeId])

  return {
    actions,
    isLoading,
    error
  }
}
