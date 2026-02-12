"use client"

import { useState, useEffect, useContext } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Configuracion } from "@/lib/types"
import { DataContext } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

export function useConfig(user?: { uid: string } | null) {
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Usar useContext directamente para evitar el error si no hay DataProvider
  const dataContext = useContext(DataContext)
  const userData = dataContext?.userData || null
  const ownerId = getOwnerIdForActor(user, userData)

  useEffect(() => {
    if (!db || !ownerId) {
      setLoading(false)
      return
    }

    // Usar ownerId como ID del documento de configuración
    const configRef = doc(db, COLLECTIONS.CONFIG, ownerId)
    
    // Configuración por defecto
    const defaultConfig: Configuracion = {
      nombreEmpresa: "Empleado",
      colorEmpresa: undefined, // Sin color por defecto
      mesInicioDia: 1,
      horasMaximasPorDia: 8,
      semanaInicioDia: 1,
      mostrarFinesDeSemana: true,
      formatoHora24: true,
      minutosDescanso: 30,
      horasMinimasParaDescanso: 6,
      mediosTurnos: [],
    }

    // Escuchar cambios en tiempo real
    const unsubscribe = onSnapshot(
      configRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setConfig(snapshot.data() as Configuracion)
        } else {
          setConfig(defaultConfig)
        }
        setLoading(false)
      },
      (error) => {
        console.error("Error loading config:", error)
        // Usar valores por defecto en caso de error
        setConfig(defaultConfig)
        setLoading(false)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [ownerId])

  return { config, loading }
}
