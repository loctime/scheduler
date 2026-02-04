"use client"

import { useState, useCallback } from "react"
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { Recepcion } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

export function useRecepciones(user: any) {
  const { toast } = useToast()
  const { userData } = useData()
  const ownerId = getOwnerIdForActor(user, userData)
  const [loading, setLoading] = useState(false)

  // Crear recepción
  const crearRecepcion = useCallback(async (
    recepcionData: Omit<Recepcion, "id" | "createdAt">
  ): Promise<Recepcion | null> => {
    if (!db || !user || !ownerId) return null

    setLoading(true)
    try {
      // Limpiar productos: eliminar campos undefined
      const productosLimpios = recepcionData.productos.map((producto: any) => {
        const productoLimpio: any = {
          productoId: producto.productoId,
          productoNombre: producto.productoNombre,
          cantidadEnviada: producto.cantidadEnviada,
          cantidadRecibida: producto.cantidadRecibida,
          estado: producto.estado || "ok",
          esDevolucion: producto.esDevolucion || false,
        }
        
        // Solo incluir campos opcionales si tienen valor
        if (producto.cantidadDevolucion !== undefined && producto.cantidadDevolucion > 0) {
          productoLimpio.cantidadDevolucion = producto.cantidadDevolucion
        }
        
        if (producto.observaciones && producto.observaciones.trim()) {
          productoLimpio.observaciones = producto.observaciones.trim()
        }
        
        return productoLimpio
      })
      
      // Filtrar campos undefined antes de enviar a Firestore
      const recepcionDataLimpio: any = {
        pedidoId: recepcionData.pedidoId,
        fecha: recepcionData.fecha || serverTimestamp(),
        productos: productosLimpios,
        esParcial: recepcionData.esParcial || false,
        completada: recepcionData.completada !== undefined ? recepcionData.completada : true,
        ownerId,
        userId: user.uid,
        createdAt: serverTimestamp(),
      }
      
      // Solo incluir campos opcionales si tienen valor
      if (recepcionData.observaciones && recepcionData.observaciones.trim()) {
        recepcionDataLimpio.observaciones = recepcionData.observaciones.trim()
      }
      
      const recepcionRef = await addDoc(collection(db, COLLECTIONS.RECEPCIONES), recepcionDataLimpio)

      const nuevaRecepcion: Recepcion = {
        id: recepcionRef.id,
        ...recepcionData,
        fecha: recepcionData.fecha || new Date(),
      }

      toast({
        title: "Recepción registrada",
        description: "La recepción se ha registrado exitosamente",
      })

      return nuevaRecepcion
    } catch (error: any) {
      logger.error("Error al crear recepción:", error)
      toast({
        title: "Error",
        description: "No se pudo registrar la recepción",
        variant: "destructive",
      })
      return null
    } finally {
      setLoading(false)
    }
  }, [user, ownerId, toast])

  // Obtener recepciones de un pedido
  const obtenerRecepcionesPorPedido = useCallback(async (
    pedidoId: string
  ): Promise<Recepcion[]> => {
    if (!db || !user || !ownerId) return []

    try {
      const recepcionesQuery = query(
        collection(db, COLLECTIONS.RECEPCIONES),
        where("pedidoId", "==", pedidoId),
        where("ownerId", "==", ownerId)
      )
      const snapshot = await getDocs(recepcionesQuery)
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Recepcion[]
    } catch (error: any) {
      logger.error("Error al obtener recepciones:", error)
      return []
    }
  }, [user, ownerId])

  return {
    loading,
    crearRecepcion,
    obtenerRecepcionesPorPedido,
  }
}
