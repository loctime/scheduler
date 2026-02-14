"use client"

import { useState, useEffect } from "react"
import { collection, query, where, orderBy, doc, onSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { resolvePublicCompany } from "@/lib/public-companies"
import type { Empleado, Turno, Configuracion } from "@/lib/types"

/**
 * Resuelve companySlug a ownerId (uid) usando publicCompanies.
 * Útil para construir enlaces a /pwa/mensual?uid=XXX desde el panel PWA.
 */
export function useOwnerIdFromSlug(companySlug: string | null) {
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!companySlug)

  useEffect(() => {
    if (!companySlug) {
      setOwnerId(null)
      setLoading(false)
      return
    }
    setLoading(true)
    resolvePublicCompany(companySlug)
      .then((company) => {
        setOwnerId(company?.ownerId ?? null)
      })
      .catch(() => setOwnerId(null))
      .finally(() => setLoading(false))
  }, [companySlug])

  return { ownerId, loading }
}

/**
 * Carga empleados por ownerId (misma query que DataContext).
 * Reutilizable en PWA mensual y cualquier vista que necesite datos por uid sin auth.
 */
export function useEmployeesByOwnerId(ownerId: string | null) {
  const [employees, setEmployees] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db || !ownerId) {
      setEmployees([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(
      collection(db, COLLECTIONS.EMPLOYEES),
      where("ownerId", "==", ownerId),
      orderBy("name")
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Empleado[]
        setEmployees(data)
        setError(null)
        setLoading(false)
      },
      (err) => {
        console.error("useEmployeesByOwnerId:", err)
        setError(err.message ?? "Error al cargar empleados")
        setEmployees([])
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [ownerId])

  return { employees, loading, error }
}

/**
 * Carga turnos por ownerId (misma query que DataContext).
 */
export function useShiftsByOwnerId(ownerId: string | null) {
  const [shifts, setShifts] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db || !ownerId) {
      setShifts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(
      collection(db, COLLECTIONS.SHIFTS),
      where("ownerId", "==", ownerId),
      orderBy("name")
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Turno[]
        setShifts(data)
        setError(null)
        setLoading(false)
      },
      (err) => {
        console.error("useShiftsByOwnerId:", err)
        setError(err.message ?? "Error al cargar turnos")
        setShifts([])
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [ownerId])

  return { shifts, loading, error }
}

const defaultConfig: Configuracion = {
  nombreEmpresa: "Empleado",
  colorEmpresa: undefined,
  mesInicioDia: 1,
  horasMaximasPorDia: 8,
  semanaInicioDia: 1,
  mostrarFinesDeSemana: true,
  formatoHora24: true,
  minutosDescanso: 30,
  horasMinimasParaDescanso: 6,
  mediosTurnos: [],
}

/**
 * Carga configuración por ownerId (mismo documento que useConfig: doc CONFIG/ownerId).
 */
export function useConfigByOwnerId(ownerId: string | null) {
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db || !ownerId) {
      setConfig(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const configRef = doc(db, COLLECTIONS.CONFIG, ownerId)

    const unsubscribe = onSnapshot(
      configRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Configuracion
          setConfig({
            ...defaultConfig,
            ...data,
            mediosTurnos: Array.isArray(data.mediosTurnos) ? data.mediosTurnos : defaultConfig.mediosTurnos ?? [],
          })
        } else {
          setConfig(defaultConfig)
        }
        setError(null)
        setLoading(false)
      },
      (err) => {
        console.error("useConfigByOwnerId:", err)
        setConfig(defaultConfig)
        setError(err.message ?? "Error al cargar configuración")
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [ownerId])

  return { config, loading, error }
}
