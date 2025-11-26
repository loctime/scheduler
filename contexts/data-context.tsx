"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { collection, query, orderBy, onSnapshot, getDocs } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Empleado, Turno } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface DataContextType {
  employees: Empleado[]
  shifts: Turno[]
  loading: boolean
  error: string | null
  user: any
  refreshEmployees: () => Promise<void>
  refreshShifts: () => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children, user }: { children: React.ReactNode; user: any }) {
  const [employees, setEmployees] = useState<Empleado[]>([])
  const [shifts, setShifts] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Cache en localStorage
  const CACHE_KEY_EMPLOYEES = "horarios_employees_cache"
  const CACHE_KEY_SHIFTS = "horarios_shifts_cache"
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

  const loadFromCache = (key: string) => {
    try {
      const cached = localStorage.getItem(key)
      if (!cached) return null
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data
      }
      localStorage.removeItem(key)
      return null
    } catch {
      return null
    }
  }

  const saveToCache = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
    } catch (error) {
      console.error("Error saving to cache:", error)
    }
  }

  const refreshEmployees = useCallback(async () => {
    if (!user || !db) return

    try {
      // Intentar cargar desde cache primero
      const cached = loadFromCache(CACHE_KEY_EMPLOYEES)
      if (cached) {
        setEmployees(cached)
      }

      // Cargar desde Firestore
      const employeesQuery = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy("name"))
      const snapshot = await getDocs(employeesQuery)
      const employeesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Empleado[]

      setEmployees(employeesData)
      saveToCache(CACHE_KEY_EMPLOYEES, employeesData)
      setError(null)
    } catch (err: any) {
      console.error("Error loading employees:", err)
      setError(err.message)
      toast({
        title: "Error",
        description: "No se pudieron cargar los empleados",
        variant: "destructive",
      })
    }
  }, [user, toast])

  const refreshShifts = useCallback(async () => {
    if (!user || !db) return

    try {
      // Intentar cargar desde cache primero
      const cached = loadFromCache(CACHE_KEY_SHIFTS)
      if (cached) {
        setShifts(cached)
      }

      // Cargar desde Firestore
      const shiftsQuery = query(collection(db, COLLECTIONS.SHIFTS), orderBy("name"))
      const snapshot = await getDocs(shiftsQuery)
      const shiftsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Turno[]

      setShifts(shiftsData)
      saveToCache(CACHE_KEY_SHIFTS, shiftsData)
      setError(null)
    } catch (err: any) {
      console.error("Error loading shifts:", err)
      setError(err.message)
      toast({
        title: "Error",
        description: "No se pudieron cargar los turnos",
        variant: "destructive",
      })
    }
  }, [user, toast])

  useEffect(() => {
    if (!user || !db) {
      setEmployees([])
      setShifts([])
      setLoading(false)
      return
    }

    setLoading(true)

    // Cargar datos iniciales
    Promise.all([refreshEmployees(), refreshShifts()]).finally(() => {
      setLoading(false)
    })

    // Configurar listeners en tiempo real (pero con menos frecuencia)
    // Solo para cambios críticos, no para cada actualización
    const employeesQuery = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy("name"))
    const shiftsQuery = query(collection(db, COLLECTIONS.SHIFTS), orderBy("name"))

    const unsubscribeEmployees = onSnapshot(
      employeesQuery,
      (snapshot) => {
        const employeesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Empleado[]
        setEmployees(employeesData)
        saveToCache(CACHE_KEY_EMPLOYEES, employeesData)
      },
      (error) => {
        console.error("Error en listener de empleados:", error)
        // No mostrar toast en cada error de listener, solo log
      }
    )

    const unsubscribeShifts = onSnapshot(
      shiftsQuery,
      (snapshot) => {
        const shiftsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Turno[]
        setShifts(shiftsData)
        saveToCache(CACHE_KEY_SHIFTS, shiftsData)
      },
      (error) => {
        console.error("Error en listener de turnos:", error)
      }
    )

    return () => {
      unsubscribeEmployees()
      unsubscribeShifts()
    }
  }, [user, refreshEmployees, refreshShifts])

  return (
    <DataContext.Provider value={{ employees, shifts, loading, error, user, refreshEmployees, refreshShifts }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}

