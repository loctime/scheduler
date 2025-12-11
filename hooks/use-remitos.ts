"use client"

import { useState, useCallback } from "react"
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { Remito } from "@/lib/types"
import { generarNumeroRemito, generarPDFRemito, eliminarRemitosAnteriores } from "@/lib/remito-utils"
import { useData } from "@/contexts/data-context"

export function useRemitos(user: any) {
  const { toast } = useToast()
  const { userData } = useData()
  const [loading, setLoading] = useState(false)

  // Crear remito
  const crearRemito = useCallback(async (
    remitoData: Omit<Remito, "id" | "numero" | "createdAt">,
    nombrePedido?: string
  ): Promise<Remito | null> => {
    if (!db || !user) return null

    setLoading(true)
    try {
      // Obtener nombre del pedido si no se proporciona
      let nombre = nombrePedido
      if (!nombre && remitoData.pedidoId) {
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, remitoData.pedidoId))
        if (pedidoDoc.exists()) {
          nombre = pedidoDoc.data().nombre
        }
      }
      
      // Generar número de remito con nombre del pedido
      const numero = await generarNumeroRemito(db, COLLECTIONS, nombre || "PEDIDO")

      // Crear remito en Firestore
      const remitoRef = await addDoc(collection(db, COLLECTIONS.REMITOS), {
        ...remitoData,
        numero,
        createdAt: serverTimestamp(),
      })

      const nuevoRemito: Remito = {
        id: remitoRef.id,
        ...remitoData,
        numero,
      }

      // Si es un remito final (recepcion), eliminar remitos anteriores
      if (remitoData.final && remitoData.pedidoId) {
        await eliminarRemitosAnteriores(db, COLLECTIONS, remitoData.pedidoId)
      }

      toast({
        title: "Remito creado",
        description: `Remito ${numero} creado exitosamente`,
      })

      return nuevoRemito
    } catch (error: any) {
      logger.error("Error al crear remito:", error)
      toast({
        title: "Error",
        description: "No se pudo crear el remito",
        variant: "destructive",
      })
      return null
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  // Obtener remitos de un pedido
  const obtenerRemitosPorPedido = useCallback(async (
    pedidoId: string
  ): Promise<Remito[]> => {
    if (!db || !user) return []

    try {
      // Si el usuario es invitado, usar ownerId para consultar remitos
      // Si no, usar userId normal
      const userIdToQuery = userData?.role === "invited" && userData?.ownerId 
        ? userData.ownerId 
        : user.uid

      // Primero verificar que el pedido pertenece al usuario
      const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId))
      if (!pedidoDoc.exists()) {
        logger.warn(`Pedido ${pedidoId} no existe`)
        return []
      }

      const pedidoUserId = pedidoDoc.data().userId
      
      // Verificar que el pedido pertenece al usuario o a su ownerId
      if (pedidoUserId !== userIdToQuery) {
        logger.warn(`Pedido ${pedidoId} no pertenece al usuario ${userIdToQuery}`)
        return []
      }

      // Obtener remitos filtrando por pedidoId y userId
      // Si el remito no tiene userId (creado sin autenticación), usar el userId del pedido
      const remitosQuery = query(
        collection(db, COLLECTIONS.REMITOS),
        where("pedidoId", "==", pedidoId),
        where("userId", "==", userIdToQuery)
      )
      const snapshot = await getDocs(remitosQuery)
      const remitos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Remito[]
      
      return remitos
    } catch (error: any) {
      // Si el error es de permisos, loguearlo pero no mostrar error al usuario
      if (error.code === 'permission-denied') {
        logger.warn("Error de permisos al obtener remitos:", error)
      } else {
        logger.error("Error al obtener remitos:", error)
      }
      return []
    }
  }, [user, userData])

  // Obtener un remito por ID
  const obtenerRemito = useCallback(async (
    remitoId: string
  ): Promise<Remito | null> => {
    if (!db) return null

    try {
      const remitoDoc = await getDoc(doc(db, COLLECTIONS.REMITOS, remitoId))
      if (!remitoDoc.exists()) return null
      return {
        id: remitoDoc.id,
        ...remitoDoc.data(),
      } as Remito
    } catch (error: any) {
      logger.error("Error al obtener remito:", error)
      return null
    }
  }, [])

  // Generar y descargar PDF del remito
  const descargarPDFRemito = useCallback(async (remito: Remito) => {
    try {
      await generarPDFRemito(remito)
      toast({
        title: "PDF generado",
        description: "El remito se ha descargado correctamente",
      })
    } catch (error: any) {
      logger.error("Error al generar PDF:", error)
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      })
    }
  }, [toast])

  return {
    loading,
    crearRemito,
    obtenerRemitosPorPedido,
    obtenerRemito,
    descargarPDFRemito,
  }
}
