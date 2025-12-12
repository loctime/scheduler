"use client"

import { useState, useEffect, useCallback } from "react"
import { collection, getDocs, doc, updateDoc, query, where, serverTimestamp, getDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"

export type UserRole = "branch" | "factory" | "admin" | "invited" | "manager"

export interface UserData {
  id: string
  uid: string
  email?: string
  displayName?: string
  photoURL?: string
  role?: UserRole
  ownerId?: string // Para usuarios invitados
  grupoIds?: string[] // IDs de grupos a los que pertenece (puede estar en múltiples grupos)
  createdAt?: any
  updatedAt?: any
}

export function useAdminUsers(user: any) {
  const { toast } = useToast()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)

  // Cargar todos los usuarios
  const loadUsers = useCallback(async () => {
    if (!db || !user) return

    try {
      setLoading(true)
      const usersQuery = query(collection(db, COLLECTIONS.USERS))
      const snapshot = await getDocs(usersQuery)
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as UserData[]
      
      // Ordenar por fecha de creación descendente
      usersData.sort((a, b) => {
        const aTime = a.createdAt?.toDate()?.getTime() || 0
        const bTime = b.createdAt?.toDate()?.getTime() || 0
        return bTime - aTime
      })
      
      setUsers(usersData)
    } catch (error: any) {
      logger.error("Error al cargar usuarios:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  // Cambiar rol de un usuario
  const cambiarRol = useCallback(async (userId: string, nuevoRol: UserRole) => {
    if (!db || !user) return false

    try {
      const userRef = doc(db, COLLECTIONS.USERS, userId)
      const userDoc = await getDoc(userRef)
      
      if (!userDoc.exists()) {
        toast({
          title: "Error",
          description: "El usuario no existe",
          variant: "destructive",
        })
        return false
      }

      const updateData: any = {
        role: nuevoRol,
        updatedAt: serverTimestamp(),
      }

      // Si se cambia a un rol que no es "invited", eliminar ownerId
      if (nuevoRol !== "invited") {
        updateData.ownerId = null
      }

      await updateDoc(userRef, updateData)
      
      toast({
        title: "Rol actualizado",
        description: `El rol del usuario ha sido cambiado a "${nuevoRol}"`,
      })

      // Recargar usuarios
      await loadUsers()
      return true
    } catch (error: any) {
      logger.error("Error al cambiar rol:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar el rol del usuario",
        variant: "destructive",
      })
      return false
    }
  }, [user, toast, loadUsers])

  // Eliminar usuario
  const eliminarUsuario = useCallback(async (userId: string) => {
    if (!db || !user) return false

    try {
      await deleteDoc(doc(db, COLLECTIONS.USERS, userId))
      
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado exitosamente",
      })

      await loadUsers()
      return true
    } catch (error: any) {
      logger.error("Error al eliminar usuario:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario",
        variant: "destructive",
      })
      return false
    }
  }, [user, toast, loadUsers])

  // Buscar usuario por email
  const buscarUsuarioPorEmail = useCallback(async (email: string): Promise<UserData | null> => {
    if (!db || !email) return null

    try {
      const usersQuery = query(
        collection(db, COLLECTIONS.USERS),
        where("email", "==", email.toLowerCase().trim())
      )
      const snapshot = await getDocs(usersQuery)
      
      if (snapshot.empty) {
        return null
      }

      const userDoc = snapshot.docs[0]
      return {
        id: userDoc.id,
        ...userDoc.data(),
      } as UserData
    } catch (error: any) {
      logger.error("Error al buscar usuario:", error)
      return null
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadUsers()
    }
  }, [loadUsers, user])

  return {
    users,
    loading,
    cambiarRol,
    eliminarUsuario,
    buscarUsuarioPorEmail,
    recargarUsuarios: loadUsers,
  }
}

