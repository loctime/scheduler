"use client"

import { useCallback } from "react"
import { doc, setDoc, serverTimestamp, getDoc, Timestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { Separador } from "@/lib/types"

// Helper para eliminar campos undefined de un objeto (Firebase no acepta undefined)
function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const cleaned = { ...obj }
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key]
    }
  })
  return cleaned
}

export function useEmployeeOrder() {
  const { user } = useData()
  const { toast } = useToast()

  const updateEmployeeOrder = useCallback(
    async (orderedItemIds: string[]) => {
      if (!user || !db) {
        console.warn("No se puede actualizar el orden: usuario o Firebase no disponible")
        return
      }

      try {
        const configRef = doc(db, COLLECTIONS.CONFIG, "general")
        
        // Obtener la configuración actual para preservar otros campos
        const configSnap = await getDoc(configRef)
        const currentConfig = configSnap.exists() ? configSnap.data() : {}

        await setDoc(
          configRef,
          {
            ...currentConfig,
            ordenEmpleados: orderedItemIds,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
            updatedByName: user.displayName || user.email || "",
          },
          { merge: true }
        )
      } catch (error) {
        console.error("Error actualizando orden de empleados:", error)
        toast({
          title: "Error",
          description: "No se pudo guardar el orden de empleados",
          variant: "destructive",
        })
      }
    },
    [user, toast]
  )

  const addSeparator = useCallback(
    async (nombre: string, puestoId?: string, color?: string): Promise<Separador | null> => {
      if (!user || !db) {
        console.warn("No se puede agregar separador: usuario o Firebase no disponible")
        return null
      }

      try {
        const configRef = doc(db, COLLECTIONS.CONFIG, "general")
        const configSnap = await getDoc(configRef)
        const currentConfig = configSnap.exists() ? configSnap.data() : {}
        const currentSeparadores: Separador[] = currentConfig.separadores || []

        const now = Timestamp.now()
        const newSeparator: Separador = {
          id: `separador-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          nombre: nombre.toUpperCase(),
          tipo: puestoId ? "puesto" : "personalizado",
          createdAt: now,
          updatedAt: now,
        }
        
        // Solo agregar puestoId si existe (no undefined)
        if (puestoId) {
          newSeparator.puestoId = puestoId
        }
        
        // Solo agregar color si existe (no undefined)
        if (color) {
          newSeparator.color = color
        }

        const updatedSeparadores = [...currentSeparadores, removeUndefinedFields(newSeparator)]

        await setDoc(
          configRef,
          {
            ...currentConfig,
            separadores: updatedSeparadores.map(s => removeUndefinedFields(s)),
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
            updatedByName: user.displayName || user.email || "",
          },
          { merge: true }
        )

        return newSeparator
      } catch (error) {
        console.error("Error agregando separador:", error)
        toast({
          title: "Error",
          description: "No se pudo agregar el separador",
          variant: "destructive",
        })
        return null
      }
    },
    [user, toast]
  )

  const updateSeparator = useCallback(
    async (separatorId: string, updatedSeparator: Separador): Promise<boolean> => {
      if (!user || !db) {
        console.warn("No se puede actualizar separador: usuario o Firebase no disponible")
        return false
      }

      try {
        const configRef = doc(db, COLLECTIONS.CONFIG, "general")
        const configSnap = await getDoc(configRef)
        const currentConfig = configSnap.exists() ? configSnap.data() : {}
        const currentSeparadores: Separador[] = currentConfig.separadores || []

        const updatedSeparadores = currentSeparadores.map((s) => {
          if (s.id === separatorId) {
            const cleaned = removeUndefinedFields(updatedSeparator)
            return { ...cleaned, updatedAt: Timestamp.now() }
          }
          return s
        })

        // Limpiar todos los separadores de campos undefined antes de guardar
        const cleanedSeparadores = updatedSeparadores.map(s => removeUndefinedFields(s))

        await setDoc(
          configRef,
          {
            ...currentConfig,
            separadores: cleanedSeparadores,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
            updatedByName: user.displayName || user.email || "",
          },
          { merge: true }
        )

        return true
      } catch (error) {
        console.error("Error actualizando separador:", error)
        toast({
          title: "Error",
          description: "No se pudo actualizar el separador",
          variant: "destructive",
        })
        return false
      }
    },
    [user, toast]
  )

  const deleteSeparator = useCallback(
    async (separatorId: string): Promise<boolean> => {
      if (!user || !db) {
        console.warn("No se puede eliminar separador: usuario o Firebase no disponible")
        return false
      }

      try {
        const configRef = doc(db, COLLECTIONS.CONFIG, "general")
        const configSnap = await getDoc(configRef)
        const currentConfig = configSnap.exists() ? configSnap.data() : {}
        const currentSeparadores: Separador[] = currentConfig.separadores || []

        const updatedSeparadores = currentSeparadores.filter((s) => s.id !== separatorId)

        await setDoc(
          configRef,
          {
            ...currentConfig,
            separadores: updatedSeparadores,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
            updatedByName: user.displayName || user.email || "",
          },
          { merge: true }
        )

        return true
      } catch (error) {
        console.error("Error eliminando separador:", error)
        toast({
          title: "Error",
          description: "No se pudo eliminar el separador",
          variant: "destructive",
        })
        return false
      }
    },
    [user, toast]
  )

  return { 
    updateEmployeeOrder,
    addSeparator,
    updateSeparator,
    deleteSeparator,
  }
}



