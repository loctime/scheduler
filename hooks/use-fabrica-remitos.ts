"use client"

import { useState, useCallback, useEffect } from "react"
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { Remito, Pedido } from "@/lib/types"

export function useFabricaRemitos(user: any) {
  const { toast } = useToast()
  const [remitos, setRemitos] = useState<Remito[]>([])
  const [loading, setLoading] = useState(true)
  const [pedidosMap, setPedidosMap] = useState<Record<string, Pedido>>({})
  const [usuariosMap, setUsuariosMap] = useState<Record<string, { displayName?: string; email?: string }>>({})

  // Cargar información de pedidos y usuarios
  const cargarInfoAdicional = useCallback(async (remitosData: Remito[]) => {
    if (!db || remitosData.length === 0) return

    const pedidos: Record<string, Pedido> = {}
    const usuarios: Record<string, { displayName?: string; email?: string }> = {}
    const userIdsUnicos = new Set<string>()

    try {
      // Cargar pedidos
      const promesasPedidos = remitosData.map(async (remito) => {
        if (remito.pedidoId && !pedidos[remito.pedidoId]) {
          try {
            const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, remito.pedidoId))
            if (pedidoDoc.exists()) {
              const pedidoData = { id: pedidoDoc.id, ...pedidoDoc.data() } as Pedido
              pedidos[remito.pedidoId] = pedidoData
              if (pedidoData.userId) {
                userIdsUnicos.add(pedidoData.userId)
              }
            }
          } catch (error) {
            logger.warn(`Error al cargar pedido ${remito.pedidoId}:`, error)
          }
        }
      })

      await Promise.all(promesasPedidos)

      // Cargar usuarios
      const promesasUsuarios = Array.from(userIdsUnicos).map(async (userId) => {
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

      await Promise.all(promesasUsuarios)

      setPedidosMap(pedidos)
      setUsuariosMap(usuarios)
    } catch (error) {
      logger.error("Error al cargar información adicional:", error)
    }
  }, [])

  // Cargar remitos finales
  const loadRemitos = useCallback(async () => {
    if (!db || !user) return

    try {
      setLoading(true)

      // Cargar remitos con final: true y tipo: "recepcion"
      // Nota: Firestore requiere índice compuesto para múltiples where + orderBy
      // Por ahora, cargar todos los remitos de tipo recepcion y filtrar en cliente
      const remitosQuery = query(
        collection(db, COLLECTIONS.REMITOS),
        where("tipo", "==", "recepcion")
      )

      const snapshot = await getDocs(remitosQuery)
      const remitosData = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Remito[]
        .filter((r) => r.final === true) // Filtrar remitos finales en cliente
        .sort((a, b) => {
          // Ordenar por fecha descendente
          const fechaA = a.fecha?.toDate?.() || new Date(0)
          const fechaB = b.fecha?.toDate?.() || new Date(0)
          return fechaB.getTime() - fechaA.getTime()
        })

      setRemitos(remitosData)
      await cargarInfoAdicional(remitosData)
    } catch (error: any) {
      logger.error("Error al cargar remitos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los remitos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast, cargarInfoAdicional])

  // Cargar remitos al montar y configurar listener
  useEffect(() => {
    if (!db || !user) return

    loadRemitos()

    // Configurar listener en tiempo real
    const remitosQuery = query(
      collection(db, COLLECTIONS.REMITOS),
      where("tipo", "==", "recepcion")
    )

    const unsubscribe = onSnapshot(
      remitosQuery,
      async (snapshot) => {
        const remitosData = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Remito[]
          .filter((r) => r.final === true) // Filtrar remitos finales en cliente
          .sort((a, b) => {
            // Ordenar por fecha descendente
            const fechaA = a.fecha?.toDate?.() || new Date(0)
            const fechaB = b.fecha?.toDate?.() || new Date(0)
            return fechaB.getTime() - fechaA.getTime()
          })

        setRemitos(remitosData)
        await cargarInfoAdicional(remitosData)
      },
      (error) => {
        logger.error("Error en listener de remitos:", error)
      }
    )

    return () => unsubscribe()
  }, [user, loadRemitos, cargarInfoAdicional])

  // Obtener nombre del pedido
  const obtenerNombrePedido = useCallback((remito: Remito) => {
    if (!remito.pedidoId) return "Sin pedido"
    const pedido = pedidosMap[remito.pedidoId]
    return pedido?.nombre || "Pedido desconocido"
  }, [pedidosMap])

  // Obtener nombre de la sucursal
  const obtenerNombreSucursal = useCallback((remito: Remito) => {
    if (!remito.pedidoId) return "Sin sucursal"
    const pedido = pedidosMap[remito.pedidoId]
    if (!pedido?.userId) return "Sin sucursal"
    const usuario = usuariosMap[pedido.userId]
    return usuario?.displayName || usuario?.email?.split("@")[0] || "Sucursal desconocida"
  }, [pedidosMap, usuariosMap])

  // Verificar si tiene firma
  const tieneFirma = useCallback((remito: Remito) => {
    return !!(remito.firmaEnvio || remito.firmaRecepcion)
  }, [])

  return {
    remitos,
    loading,
    obtenerNombrePedido,
    obtenerNombreSucursal,
    tieneFirma,
    refreshRemitos: loadRemitos,
  }
}

