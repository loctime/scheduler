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
import { generarNumeroRemito, generarPDFRemito } from "@/lib/remito-utils"

export function useRemitos(user: any) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // Crear remito
  const crearRemito = useCallback(async (
    remitoData: Omit<Remito, "id" | "numero" | "createdAt">
  ): Promise<Remito | null> => {
    if (!db || !user) return null

    setLoading(true)
    try {
      // Generar número de remito
      const numero = await generarNumeroRemito(db, COLLECTIONS)

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
      const remitosQuery = query(
        collection(db, COLLECTIONS.REMITOS),
        where("pedidoId", "==", pedidoId),
        where("userId", "==", user.uid)
      )
      const snapshot = await getDocs(remitosQuery)
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Remito[]
    } catch (error: any) {
      logger.error("Error al obtener remitos:", error)
      return []
    }
  }, [user])

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
