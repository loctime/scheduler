"use client"

import { useState, useEffect } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Configuracion } from "@/lib/types"

export function useConfig() {
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) {
      setLoading(false)
      return
    }

    const configRef = doc(db, COLLECTIONS.CONFIG, "general")
    
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
  }, [])

  return { config, loading }
}

