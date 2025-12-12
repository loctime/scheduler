"use client"

import { useState, useCallback, useEffect } from "react"
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
import { Pedido } from "@/lib/types"

export function useFabricaPedidos(user: any) {
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [usuariosMap, setUsuariosMap] = useState<Record<string, { displayName?: string; email?: string }>>({})

  // Cargar información de usuarios para mostrar nombres de sucursales
  const cargarUsuarios = useCallback(async (userIds: string[]) => {
    if (!db || userIds.length === 0) return {}

    const usuarios: Record<string, { displayName?: string; email?: string }> = {}
    
    try {
      const promesas = userIds.map(async (userId) => {
        try {
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

      // Ordenar por fecha de creación (más recientes primero)
      pedidosData.sort((a, b) => {
        const fechaA = a.createdAt?.toDate?.() || new Date(0)
        const fechaB = b.createdAt?.toDate?.() || new Date(0)
        return fechaB.getTime() - fechaA.getTime()
      })

      setPedidos(pedidosData)

      // Cargar información de usuarios únicos
      const userIdsUnicos = [...new Set(pedidosData.map(p => p.userId).filter(Boolean))]
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
  }, [user, toast, cargarUsuarios])

  // Cargar pedidos al montar y configurar listener
  useEffect(() => {
    if (!db || !user) return

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

        pedidosData.sort((a, b) => {
          const fechaA = a.createdAt?.toDate?.() || new Date(0)
          const fechaB = b.createdAt?.toDate?.() || new Date(0)
          return fechaB.getTime() - fechaA.getTime()
        })

        setPedidos(pedidosData)

        // Actualizar usuarios si hay nuevos
        const userIdsUnicos = [...new Set(pedidosData.map(p => p.userId).filter(Boolean))]
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
  }, [user, loadPedidos, cargarUsuarios])

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

