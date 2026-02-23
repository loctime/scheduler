"use client"

import { useState, useEffect } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface DailyAction {
  id: string
  title: string
  description?: string
  dayOfWeek: number // 0-6 (domingo-sábado)
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
    if (!ownerId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(undefined)

    const unsubscribe = onSnapshot(
      doc(db!, "dailyActions", ownerId),
      (docSnapshot) => {
        try {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data()
            const allActions = data?.actions || []
            
            // Filtrar acciones
            const today = new Date().getDay() // 0 = domingo, 6 = sábado
            const filteredActions = allActions.filter((action: any) => {
              // Solo acciones activas
              if (!action.active) return false
              
              // Solo del día de hoy
              if (action.dayOfWeek !== today) return false
              
              // Si tiene employeeIds, verificar que incluya al empleado actual
              if (action.employeeIds && Array.isArray(action.employeeIds) && employeeId) {
                return action.employeeIds.includes(employeeId)
              }
              
              // Si no tiene employeeIds, es visible para todos
              return true
            })

            setActions(filteredActions)
          } else {
            setActions([])
          }
        } catch (err) {
          console.error("Error processing daily actions:", err)
          setError(err instanceof Error ? err : new Error("Unknown error"))
          setActions([])
        } finally {
          setIsLoading(false)
        }
      },
      (err) => {
        console.error("Error fetching daily actions:", err)
        setError(err)
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
