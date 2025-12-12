"use client"

import { useState, useEffect, useCallback } from "react"
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, getDoc, serverTimestamp, query, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { Group } from "@/lib/types"

export function useGroups(user: any) {
  const { toast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  // Cargar todos los grupos
  const loadGroups = useCallback(async () => {
    if (!db || !user) return

    try {
      setLoading(true)
      const groupsQuery = query(collection(db, COLLECTIONS.GROUPS))
      const snapshot = await getDocs(groupsQuery)
      const groupsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Group[]
      
      // Ordenar por nombre
      groupsData.sort((a, b) => a.nombre.localeCompare(b.nombre))
      
      setGroups(groupsData)
    } catch (error: any) {
      logger.error("Error al cargar grupos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los grupos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  // Crear nuevo grupo
  const crearGrupo = useCallback(async (nombre: string, managerId: string, managerEmail?: string) => {
    if (!db || !user) return null

    try {
      const grupoRef = await addDoc(collection(db, COLLECTIONS.GROUPS), {
        nombre,
        managerId,
        managerEmail: managerEmail || null,
        userIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      toast({
        title: "Grupo creado",
        description: `El grupo "${nombre}" ha sido creado exitosamente`,
      })

      await loadGroups()
      return grupoRef.id
    } catch (error: any) {
      logger.error("Error al crear grupo:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el grupo",
        variant: "destructive",
      })
      return null
    }
  }, [user, toast, loadGroups])

  // Actualizar grupo
  const actualizarGrupo = useCallback(async (grupoId: string, datos: Partial<Group>) => {
    if (!db || !user) return false

    try {
      await updateDoc(doc(db, COLLECTIONS.GROUPS, grupoId), {
        ...datos,
        updatedAt: serverTimestamp(),
      })

      toast({
        title: "Grupo actualizado",
        description: "El grupo ha sido actualizado exitosamente",
      })

      await loadGroups()
      return true
    } catch (error: any) {
      logger.error("Error al actualizar grupo:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el grupo",
        variant: "destructive",
      })
      return false
    }
  }, [user, toast, loadGroups])

  // Eliminar grupo
  const eliminarGrupo = useCallback(async (grupoId: string) => {
    if (!db || !user) return false

    try {
      await deleteDoc(doc(db, COLLECTIONS.GROUPS, grupoId))

      toast({
        title: "Grupo eliminado",
        description: "El grupo ha sido eliminado exitosamente",
      })

      await loadGroups()
      return true
    } catch (error: any) {
      logger.error("Error al eliminar grupo:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el grupo",
        variant: "destructive",
      })
      return false
    }
  }, [user, toast, loadGroups])

  // Agregar usuario a grupo
  const agregarUsuarioAGrupo = useCallback(async (grupoId: string, userId: string) => {
    if (!db || !user) return false

    try {
      const grupoRef = doc(db, COLLECTIONS.GROUPS, grupoId)
      const grupoDoc = await getDoc(grupoRef)
      
      if (!grupoDoc.exists()) {
        toast({
          title: "Error",
          description: "El grupo no existe",
          variant: "destructive",
        })
        return false
      }

      const grupoData = grupoDoc.data() as Group
      const userIds = grupoData.userIds || []
      
      if (userIds.includes(userId)) {
        toast({
          title: "Usuario ya en grupo",
          description: "El usuario ya pertenece a este grupo",
          variant: "default",
        })
        return false
      }

      await updateDoc(grupoRef, {
        userIds: [...userIds, userId],
        updatedAt: serverTimestamp(),
      })

      // Actualizar grupoIds del usuario
      const userRef = doc(db, COLLECTIONS.USERS, userId)
      const userDoc = await getDoc(userRef)
      
      if (userDoc.exists()) {
        const userData = userDoc.data()
        const grupoIds = userData.grupoIds || []
        
        if (!grupoIds.includes(grupoId)) {
          await updateDoc(userRef, {
            grupoIds: [...grupoIds, grupoId],
            updatedAt: serverTimestamp(),
          })
        }
      }

      toast({
        title: "Usuario agregado",
        description: "El usuario ha sido agregado al grupo",
      })

      await loadGroups()
      return true
    } catch (error: any) {
      logger.error("Error al agregar usuario a grupo:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar el usuario al grupo",
        variant: "destructive",
      })
      return false
    }
  }, [user, toast, loadGroups])

  // Remover usuario de grupo
  const removerUsuarioDeGrupo = useCallback(async (grupoId: string, userId: string) => {
    if (!db || !user) return false

    try {
      const grupoRef = doc(db, COLLECTIONS.GROUPS, grupoId)
      const grupoDoc = await getDoc(grupoRef)
      
      if (!grupoDoc.exists()) {
        toast({
          title: "Error",
          description: "El grupo no existe",
          variant: "destructive",
        })
        return false
      }

      const grupoData = grupoDoc.data() as Group
      const userIds = (grupoData.userIds || []).filter(id => id !== userId)

      await updateDoc(grupoRef, {
        userIds,
        updatedAt: serverTimestamp(),
      })

      // Actualizar grupoIds del usuario
      const userRef = doc(db, COLLECTIONS.USERS, userId)
      const userDoc = await getDoc(userRef)
      
      if (userDoc.exists()) {
      const userData = userDoc.data()
      const grupoIds = (userData.grupoIds || []).filter((id: string) => id !== grupoId)
        
        await updateDoc(userRef, {
          grupoIds,
          updatedAt: serverTimestamp(),
        })
      }

      toast({
        title: "Usuario removido",
        description: "El usuario ha sido removido del grupo",
      })

      await loadGroups()
      return true
    } catch (error: any) {
      logger.error("Error al remover usuario de grupo:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo remover el usuario del grupo",
        variant: "destructive",
      })
      return false
    }
  }, [user, toast, loadGroups])

  // Obtener grupos de un usuario
  const obtenerGruposDeUsuario = useCallback((userId: string): Group[] => {
    return groups.filter(grupo => grupo.userIds.includes(userId) || grupo.managerId === userId)
  }, [groups])

  // Obtener grupos donde el usuario es manager
  const obtenerGruposComoManager = useCallback((userId: string): Group[] => {
    return groups.filter(grupo => grupo.managerId === userId)
  }, [groups])

  useEffect(() => {
    if (user) {
      loadGroups()
    }
  }, [loadGroups, user])

  return {
    groups,
    loading,
    crearGrupo,
    actualizarGrupo,
    eliminarGrupo,
    agregarUsuarioAGrupo,
    removerUsuarioDeGrupo,
    obtenerGruposDeUsuario,
    obtenerGruposComoManager,
    recargarGrupos: loadGroups,
  }
}

