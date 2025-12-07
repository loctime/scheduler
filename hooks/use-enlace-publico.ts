"use client"

import { useState, useCallback } from "react"
import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { EnlacePublico } from "@/lib/types"

export function useEnlacePublico(user: any) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // Crear enlace público
  const crearEnlacePublico = useCallback(async (
    pedidoId: string
  ): Promise<EnlacePublico | null> => {
    if (!db || !user) return null

    setLoading(true)
    try {
      // Generar ID simple (usar últimos 8 caracteres del pedidoId + timestamp)
      const idSimple = `${pedidoId.slice(-8)}-${Date.now().toString(36)}`

      const enlaceData: Omit<EnlacePublico, "id"> = {
        pedidoId,
        activo: true,
        createdAt: serverTimestamp(),
      }

      await setDoc(doc(db, COLLECTIONS.ENLACES_PUBLICOS, idSimple), enlaceData)

      const nuevoEnlace: EnlacePublico = {
        id: idSimple,
        ...enlaceData,
      }

      toast({
        title: "Enlace creado",
        description: "El enlace público se ha generado correctamente",
      })

      return nuevoEnlace
    } catch (error: any) {
      logger.error("Error al crear enlace público:", error)
      toast({
        title: "Error",
        description: "No se pudo crear el enlace público",
        variant: "destructive",
      })
      return null
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  // Obtener enlace público por ID
  const obtenerEnlacePublico = useCallback(async (
    enlaceId: string
  ): Promise<EnlacePublico | null> => {
    if (!db) return null

    try {
      const enlaceDoc = await getDoc(doc(db, COLLECTIONS.ENLACES_PUBLICOS, enlaceId))
      if (!enlaceDoc.exists()) return null
      return {
        id: enlaceDoc.id,
        ...enlaceDoc.data(),
      } as EnlacePublico
    } catch (error: any) {
      logger.error("Error al obtener enlace público:", error)
      return null
    }
  }, [])

  // Actualizar productos disponibles en el enlace
  const actualizarProductosDisponibles = useCallback(async (
    enlaceId: string,
    productosDisponibles: EnlacePublico["productosDisponibles"]
  ): Promise<boolean> => {
    if (!db) return false

    try {
      await setDoc(
        doc(db, COLLECTIONS.ENLACES_PUBLICOS, enlaceId),
        {
          productosDisponibles,
          fechaAcceso: serverTimestamp(),
        },
        { merge: true }
      )
      return true
    } catch (error: any) {
      logger.error("Error al actualizar productos disponibles:", error)
      return false
    }
  }, [])

  return {
    loading,
    crearEnlacePublico,
    obtenerEnlacePublico,
    actualizarProductosDisponibles,
  }
}
