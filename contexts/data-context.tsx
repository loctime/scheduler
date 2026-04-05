"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { collection, query, orderBy, onSnapshot, getDocs, where, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { auth, db, COLLECTIONS } from "@/lib/firebase"
import { Empleado, Turno } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { compareArraysByIds } from "@/lib/cache/cache-utils"

interface UserData {
  uid: string
  email?: string
  displayName?: string
  photoURL?: string
  role?: "operador" | "admin" | "delivery"
  locationId?: string
  ownerId?: string
  grupoIds?: string[]
}

interface DataContextType {
  employees: Empleado[]
  shifts: Turno[]
  loading: boolean
  error: string | null
  user: any
  userData: UserData | null
  refreshEmployees: () => Promise<void>
  refreshShifts: () => Promise<void>
}

export const DataContext = createContext<DataContextType | undefined>(undefined)

const CUENTA_DESACTIVADA_MSG = "Tu cuenta fue desactivada. Contactá al administrador."
const SESSION_KEY_CUENTA_DESACTIVADA = "horarios_cuenta_desactivada"

export function DataProvider({ children, user }: { children: React.ReactNode; user: any }) {
  const router = useRouter()
  const [employees, setEmployees] = useState<Empleado[]>([])
  const [shifts, setShifts] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const { toast } = useToast()

  const cerrarSesionCuentaDesactivada = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY_CUENTA_DESACTIVADA, CUENTA_DESACTIVADA_MSG)
    } catch {
      /* ignore */
    }
    if (auth) {
      signOut(auth)
        .catch(() => null)
        .finally(() => router.replace("/"))
    } else {
      router.replace("/")
    }
  }, [router])

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

  // Cargar datos del usuario desde Firestore
  const loadUserData = useCallback(async () => {
    if (!user || !db) {
      setUserData(null)
      return
    }

    try {
      const userRef = doc(db, COLLECTIONS.USERS, user.uid)
      const userDoc = await getDoc(userRef)
      
      if (userDoc.exists()) {
        const data = userDoc.data()

        if (data.disabled === true) {
          cerrarSesionCuentaDesactivada()
          return
        }

        const nextRole = data.role === "invited" ? "operador" : (data.role || "operador")
        const nextLocationId = data.locationId || data.location || data.ownerId || user.uid
        setUserData({
          uid: data.uid || user.uid,
          email: data.email || user.email,
          displayName: data.displayName || user.displayName,
          photoURL: data.photoURL || user.photoURL,
          role: nextRole,
          locationId: nextLocationId,
          ownerId: data.ownerId,
          grupoIds: data.grupoIds || [],
        })
        if (data.role === "invited") {
          updateDoc(userRef, {
            role: "operador",
            locationId: nextLocationId,
            updatedAt: serverTimestamp(),
          }).catch(() => null)
        }
      } else {
        // Si no existe el documento, crear uno por defecto
        setUserData({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: "operador",
          locationId: user.uid,
          grupoIds: [],
        })
      }
    } catch (err: any) {
      console.error("Error loading user data:", err)
      // En caso de error, usar datos básicos del auth
      setUserData({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: "operador",
        locationId: user.uid,
        grupoIds: [],
      })
    }
  }, [user, cerrarSesionCuentaDesactivada])

  const refreshEmployees = useCallback(async () => {
    if (!user || !db) return

    try {
      const ownerId = getOwnerIdForActor(user, userData)
      if (!ownerId) return

      // Intentar cargar desde cache primero
      const cached = loadFromCache(CACHE_KEY_EMPLOYEES)
      if (cached && cached.length > 0) {
        setEmployees(cached)
      }

      // Cargar desde Firestore en background
      const employeesQuery = query(
        collection(db, COLLECTIONS.EMPLOYEES),
        where("ownerId", "==", ownerId),
        orderBy("name")
      )
      const snapshot = await getDocs(employeesQuery)
      const employeesData = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((employee: any) => employee.isDeleted !== true) as Empleado[]

      // Solo actualizar si hay cambios
      setEmployees((prev) => {
        if (compareArraysByIds(prev, employeesData)) {
          return prev
        }
        return employeesData
      })
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
  }, [user, userData, toast])

  const refreshShifts = useCallback(async () => {
    if (!user || !db) return

    try {
      const ownerId = getOwnerIdForActor(user, userData)
      if (!ownerId) return

      // Intentar cargar desde cache primero
      const cached = loadFromCache(CACHE_KEY_SHIFTS)
      if (cached && cached.length > 0) {
        setShifts(cached)
      }

      // Cargar desde Firestore en background
      const shiftsQuery = query(
        collection(db, COLLECTIONS.SHIFTS),
        where("ownerId", "==", ownerId),
        orderBy("name")
      )
      const snapshot = await getDocs(shiftsQuery)
      const shiftsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Turno[]

      // Solo actualizar si hay cambios
      setShifts((prev) => {
        if (compareArraysByIds(prev, shiftsData)) {
          return prev
        }
        return shiftsData
      })
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
  }, [user, userData, toast])

  // Cargar datos del usuario primero y configurar listener en tiempo real
  useEffect(() => {
    if (!user || !db) {
      setUserData(null)
      return
    }
    
    // Cargar datos iniciales
    loadUserData()
    
    // Configurar listener en tiempo real para el documento del usuario
    const userRef = doc(db, COLLECTIONS.USERS, user.uid)
    const unsubscribeUser = onSnapshot(
      userRef,
      (userDoc) => {
        if (userDoc.exists()) {
          const data = userDoc.data()

          if (data.disabled === true) {
            cerrarSesionCuentaDesactivada()
            return
          }

          const nextRole = data.role === "invited" ? "operador" : (data.role || "operador")
          const nextLocationId = data.locationId || data.location || data.ownerId || user.uid
          setUserData({
            uid: data.uid || user.uid,
            email: data.email || user.email,
            displayName: data.displayName || user.displayName,
            photoURL: data.photoURL || user.photoURL,
            role: nextRole,
            locationId: nextLocationId,
            ownerId: data.ownerId,
            grupoIds: data.grupoIds || [],
          })
          if (data.role === "invited") {
            updateDoc(userRef, {
              role: "operador",
              locationId: nextLocationId,
              updatedAt: serverTimestamp(),
            }).catch(() => null)
          }
        }
      },
      (error) => {
        console.error("Error en listener de usuario:", error)
      }
    )
    
    return () => {
      unsubscribeUser()
    }
  }, [user, loadUserData, cerrarSesionCuentaDesactivada])

  useEffect(() => {
    if (!user || !db || !userData) {
      setEmployees([])
      setShifts([])
      setLoading(false)
      return
    }

    const ownerId = getOwnerIdForActor(user, userData)
    if (!ownerId) {
      setEmployees([])
      setShifts([])
      setLoading(false)
      return
    }

    // Verificar si hay cache disponible antes de mostrar loading
    const cachedEmployees = loadFromCache(CACHE_KEY_EMPLOYEES)
    const cachedShifts = loadFromCache(CACHE_KEY_SHIFTS)
    
    // Solo mostrar loading si no hay cache
    if (!cachedEmployees || !cachedShifts) {
      setLoading(true)
    }

    // Cargar datos iniciales
    Promise.all([refreshEmployees(), refreshShifts()]).finally(() => {
      setLoading(false)
    })

    // Configurar listeners en tiempo real (pero con menos frecuencia)
    // Solo para cambios críticos, no para cada actualización
    const employeesQuery = query(
      collection(db, COLLECTIONS.EMPLOYEES),
      where("ownerId", "==", ownerId),
      orderBy("name")
    )
    const shiftsQuery = query(
      collection(db, COLLECTIONS.SHIFTS),
      where("ownerId", "==", ownerId),
      orderBy("name")
    )

    const unsubscribeEmployees = onSnapshot(
      employeesQuery,
      (snapshot) => {
        const employeesData = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((employee: any) => employee.isDeleted !== true) as Empleado[]
        
        // Solo actualizar si hay cambios
        setEmployees((prev) => {
          if (compareArraysByIds(prev, employeesData)) {
            return prev
          }
          return employeesData
        })
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
        
        // Solo actualizar si hay cambios
        setShifts((prev) => {
          if (compareArraysByIds(prev, shiftsData)) {
            return prev
          }
          return shiftsData
        })
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
  }, [user, userData, refreshEmployees, refreshShifts])

  return (
    <DataContext.Provider value={{ employees, shifts, loading, error, user, userData, refreshEmployees, refreshShifts }}>
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
