"use client"

import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Configuracion } from "@/lib/types"

export function useConfig() {
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configRef = doc(db, COLLECTIONS.CONFIG, "general")
        const configSnap = await getDoc(configRef)

        if (configSnap.exists()) {
          setConfig(configSnap.data() as Configuracion)
        } else {
          // Configuración por defecto
          setConfig({
            mesInicioDia: 1,
            horasMaximasPorDia: 8,
            semanaInicioDia: 1,
            mostrarFinesDeSemana: true,
            formatoHora24: true,
            minutosDescanso: 30,
            horasMinimasParaDescanso: 6,
            mediosTurnos: [],
          })
        }
      } catch (error) {
        console.error("Error loading config:", error)
        // Usar valores por defecto en caso de error
        setConfig({
          mesInicioDia: 1,
          horasMaximasPorDia: 8,
          semanaInicioDia: 1,
          mostrarFinesDeSemana: true,
          formatoHora24: true,
          minutosDescanso: 30,
          horasMinimasParaDescanso: 6,
          mediosTurnos: [],
        })
      } finally {
        setLoading(false)
      }
    }

    if (db) {
      loadConfig()
    } else {
      setLoading(false)
    }
  }, [])

  return { config, loading }
}

