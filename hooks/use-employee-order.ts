"use client"

import { useCallback } from "react"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"

export function useEmployeeOrder() {
  const { user } = useData()
  const { toast } = useToast()

  const updateEmployeeOrder = useCallback(
    async (orderedEmployeeIds: string[]) => {
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
            ordenEmpleados: orderedEmployeeIds,
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

  return { updateEmployeeOrder }
}


