"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { Pedido, Group } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { useGroups } from "@/hooks/use-groups"

export function useFabricaPedidos(user: any) {
  const { toast } = useToast()
  const { userData } = useData()
  const { groups, loading: loadingGroups } = useGroups(user)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [usuariosMap, setUsuariosMap] = useState<Record<string, { displayName?: string; email?: string }>>({})
  
  // Obtener los grupos del usuario factory y extraer userIds de sucursales del mismo grupo
  const userIdsDelGrupo = useMemo(() => {
    if (!userData?.grupoIds || userData.grupoIds.length === 0) {
      return []
    }
    
    // Obtener todos los grupos donde el usuario factory está
    const gruposDelUsuario = groups.filter(grupo => 
      userData.grupoIds?.includes(grupo.id)
    )
    
    // Extraer todos los userIds de esos grupos (sucursales del mismo grupo)
    const userIds = new Set<string>()
    gruposDelUsuario.forEach(grupo => {
      grupo.userIds.forEach(userId => {
        userIds.add(userId)
      })
    })
    
    return Array.from(userIds)
  }, [groups, userData?.grupoIds])

  // Cargar información de usuarios para mostrar nombres de sucursales
  const cargarUsuarios = useCallback(async (userIds: string[]) => {
    if (!db || userIds.length === 0) return {}

    const usuarios: Record<string, { displayName?: string; email?: string }> = {}
    
    try {
      const promesas = userIds.map(async (userId) => {
        try {
          if (!db) return
          const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId))
          if (userDoc.exists()) {
            const data = userDoc.data()
            usuarios[userId] = {
              displayName: data.displayName || data.email?.split("@")[0] || "Usuario",
              email: data.email,
            }
          }
        } catch (error) {
          logger.warn(`Error al cargar usuario ${userId}:`, error)
        }
      })
      
      await Promise.all(promesas)
    } catch (error) {
      logger.error("Error al cargar usuarios:", error)
    }
    
    return usuarios
  }, [])

  // Cargar todos los pedidos pendientes (sin filtrar por userId)
  const loadPedidos = useCallback(async () => {
    if (!db || !user) return

    try {
      setLoading(true)
      
      // Cargar pedidos con estado "creado" o "processing"
      const pedidosQuery = query(
        collection(db, COLLECTIONS.PEDIDOS),
        where("estado", "in", ["creado", "processing"])
      )
      
      const snapshot = await getDocs(pedidosQuery)
      const pedidosData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Pedido[]

      // Filtrar pedidos por grupo: solo mostrar pedidos de sucursales del mismo grupo
      let pedidosFiltrados = pedidosData
      if (userIdsDelGrupo.length > 0) {
        pedidosFiltrados = pedidosData.filter(pedido => 
          pedido.userId && userIdsDelGrupo.includes(pedido.userId)
        )
      } else if (userData?.role === "factory") {
        // Si el usuario factory no tiene grupos asignados, no mostrar ningún pedido
        pedidosFiltrados = []
      }

      // Ordenar por fecha de creación (más recientes primero)
      pedidosFiltrados.sort((a, b) => {
        const fechaA = a.createdAt?.toDate?.() || new Date(0)
        const fechaB = b.createdAt?.toDate?.() || new Date(0)
        return fechaB.getTime() - fechaA.getTime()
      })

      setPedidos(pedidosFiltrados)

      // Cargar información de usuarios únicos (solo de los pedidos filtrados)
      const userIdsUnicos = [...new Set(pedidosFiltrados.map(p => p.userId).filter(Boolean))]
      if (userIdsUnicos.length > 0) {
        const usuarios = await cargarUsuarios(userIdsUnicos)
        setUsuariosMap(usuarios)
      }
    } catch (error: any) {
      logger.error("Error al cargar pedidos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los pedidos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast, cargarUsuarios, userIdsDelGrupo, userData?.role])

  // Cargar pedidos al montar y configurar listener
  useEffect(() => {
    if (!db || !user || loadingGroups) return

    loadPedidos()

    // Configurar listener en tiempo real
    const pedidosQuery = query(
      collection(db, COLLECTIONS.PEDIDOS),
      where("estado", "in", ["creado", "processing"])
    )

    const unsubscribe = onSnapshot(
      pedidosQuery,
      async (snapshot) => {
        const pedidosData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Pedido[]

        // Filtrar pedidos por grupo: solo mostrar pedidos de sucursales del mismo grupo
        let pedidosFiltrados = pedidosData
        if (userIdsDelGrupo.length > 0) {
          pedidosFiltrados = pedidosData.filter(pedido => 
            pedido.userId && userIdsDelGrupo.includes(pedido.userId)
          )
        } else if (userData?.role === "factory") {
          // Si el usuario factory no tiene grupos asignados, no mostrar ningún pedido
          pedidosFiltrados = []
        }

        pedidosFiltrados.sort((a, b) => {
          const fechaA = a.createdAt?.toDate?.() || new Date(0)
          const fechaB = b.createdAt?.toDate?.() || new Date(0)
          return fechaB.getTime() - fechaA.getTime()
        })

        setPedidos(pedidosFiltrados)

        // Actualizar usuarios si hay nuevos (solo de los pedidos filtrados)
        const userIdsUnicos = [...new Set(pedidosFiltrados.map(p => p.userId).filter(Boolean))]
        if (userIdsUnicos.length > 0) {
          const usuarios = await cargarUsuarios(userIdsUnicos)
          setUsuariosMap(prev => ({ ...prev, ...usuarios }))
        }
      },
      (error) => {
        logger.error("Error en listener de pedidos:", error)
      }
    )

    return () => unsubscribe()
  }, [user, loadPedidos, cargarUsuarios, userIdsDelGrupo, userData?.role, loadingGroups])

  // Marcar pedido como "processing" y asignar a usuario actual
  const aceptarPedido = useCallback(async (pedidoId: string): Promise<boolean> => {
    if (!db || !user) return false

    try {
      const pedidoRef = doc(db, COLLECTIONS.PEDIDOS, pedidoId)
      const pedidoDoc = await getDoc(pedidoRef)
      
      if (!pedidoDoc.exists()) {
        toast({
          title: "Error",
          description: "El pedido no existe",
          variant: "destructive",
        })
        return false
      }

      const pedidoData = pedidoDoc.data() as Pedido

      // Verificar que el pedido no esté ya asignado a otro usuario
      if (pedidoData.estado === "processing" && pedidoData.assignedTo && pedidoData.assignedTo !== user.uid) {
        toast({
          title: "Pedido ya asignado",
          description: `Este pedido ya fue tomado por: ${pedidoData.assignedToNombre || "otro usuario"}`,
          variant: "destructive",
        })
        return false
      }

      // Obtener nombre del usuario actual
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid))
      const userName = userDoc.exists() 
        ? (userDoc.data().displayName || user.displayName || user.email?.split("@")[0] || "Usuario")
        : (user.displayName || user.email?.split("@")[0] || "Usuario")

      // Actualizar pedido
      await updateDoc(pedidoRef, {
        estado: "processing",
        assignedTo: user.uid,
        assignedToNombre: userName,
        updatedAt: serverTimestamp(),
      })

      toast({
        title: "Pedido aceptado",
        description: "El pedido ha sido marcado como en proceso",
      })

      return true
    } catch (error: any) {
      logger.error("Error al aceptar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo aceptar el pedido",
        variant: "destructive",
      })
      return false
    }
  }, [user, toast])

  // Obtener información del usuario asignado
  const obtenerUsuarioAsignado = useCallback((pedido: Pedido) => {
    if (!pedido.assignedTo) return null
    return usuariosMap[pedido.assignedTo] || null
  }, [usuariosMap])

  return {
    pedidos,
    loading,
    aceptarPedido,
    obtenerUsuarioAsignado,
    usuariosMap,
    refreshPedidos: loadPedidos,
  }
}

