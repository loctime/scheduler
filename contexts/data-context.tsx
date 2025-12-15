"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { collection, query, orderBy, onSnapshot, getDocs, where, doc, getDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { db, COLLECTIONS, auth } from "@/lib/firebase"
import { Empleado, Turno } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface UserData {
  uid: string
  email?: string
  displayName?: string
  photoURL?: string
  role?: string
  ownerId?: string
  grupoIds?: string[]
  permisos?: {
    paginas?: string[]
    crearLinks?: boolean
  }
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

export function DataProvider({ children, user }: { children: React.ReactNode; user: any }) {
  const [employees, setEmployees] = useState<Empleado[]>([])
  const [shifts, setShifts] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
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
        
        // Si el usuario es invitado, verificar que el link de invitación aún existe
        if (data.role === "invited" && data.ownerId) {
          // Buscar si existe algún link de invitación usado por este usuario
          const invitacionesQuery = query(
            collection(db, COLLECTIONS.INVITACIONES),
            where("usadoPor", "==", user.uid),
            where("ownerId", "==", data.ownerId)
          )
          const invitacionesSnapshot = await getDocs(invitacionesQuery)
          
          // Si no existe ningún link de invitación para este usuario, cerrar sesión
          if (invitacionesSnapshot.empty) {
            console.warn("⚠️ Usuario invitado sin link de invitación válido. Cerrando sesión...")
            setUserData(null)
            // Cerrar sesión del usuario
            if (auth) {
              await signOut(auth)
            }
            return
          }
        }
        
        setUserData({
          uid: data.uid || user.uid,
          email: data.email || user.email,
          displayName: data.displayName || user.displayName,
          photoURL: data.photoURL || user.photoURL,
          role: data.role || "user",
          ownerId: data.ownerId,
          grupoIds: data.grupoIds || [],
          permisos: data.permisos,
        })
      } else {
        // Si no existe el documento, crear uno por defecto
        setUserData({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: "user",
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
        role: "user",
        grupoIds: [],
      })
    }
  }, [user])

  const refreshEmployees = useCallback(async () => {
    if (!user || !db) return

    try {
      // Determinar el userId a usar: si es invitado, usar ownerId, sino usar su propio uid
      const userIdToQuery = userData?.role === "invited" && userData?.ownerId 
        ? userData.ownerId 
        : user.uid

      // Intentar cargar desde cache primero
      const cached = loadFromCache(CACHE_KEY_EMPLOYEES)
      if (cached) {
        setEmployees(cached)
      }

      // Cargar desde Firestore
      const employeesQuery = query(
        collection(db, COLLECTIONS.EMPLOYEES),
        where("userId", "==", userIdToQuery),
        orderBy("name")
      )
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
  }, [user, userData, toast])

  const refreshShifts = useCallback(async () => {
    if (!user || !db) return

    try {
      // Determinar el userId a usar: si es invitado, usar ownerId, sino usar su propio uid
      const userIdToQuery = userData?.role === "invited" && userData?.ownerId 
        ? userData.ownerId 
        : user.uid

      // Intentar cargar desde cache primero
      const cached = loadFromCache(CACHE_KEY_SHIFTS)
      if (cached) {
        setShifts(cached)
      }

      // Cargar desde Firestore
      const shiftsQuery = query(
        collection(db, COLLECTIONS.SHIFTS),
        where("userId", "==", userIdToQuery),
        orderBy("name")
      )
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
  }, [user, userData, toast])

  // Cargar datos del usuario primero
  useEffect(() => {
    if (user) {
      loadUserData()
    } else {
      setUserData(null)
    }
  }, [user, loadUserData])

  useEffect(() => {
    if (!user || !db || !userData) {
      setEmployees([])
      setShifts([])
      setLoading(false)
      return
    }

    setLoading(true)

    // Determinar el userId a usar para las queries
    const userIdToQuery = userData.role === "invited" && userData.ownerId 
      ? userData.ownerId 
      : user.uid

    // Cargar datos iniciales
    Promise.all([refreshEmployees(), refreshShifts()]).finally(() => {
      setLoading(false)
    })

    // Configurar listeners en tiempo real (pero con menos frecuencia)
    // Solo para cambios críticos, no para cada actualización
    const employeesQuery = query(
      collection(db, COLLECTIONS.EMPLOYEES),
      where("userId", "==", userIdToQuery),
      orderBy("name")
    )
    const shiftsQuery = query(
      collection(db, COLLECTIONS.SHIFTS),
      where("userId", "==", userIdToQuery),
      orderBy("name")
    )

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

