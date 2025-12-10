"use client"

import { useState, useCallback } from "react"
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { EnlacePublico, Producto } from "@/lib/types"

export function useEnlacePublico(user: any) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // Crear enlace público
  const crearEnlacePublico = useCallback(async (
    pedidoId: string,
    cantidadesPedidas?: Record<string, number> // Mapa de productoId -> cantidad a pedir
  ): Promise<EnlacePublico | null> => {
    if (!db || !user) return null

    setLoading(true)
    try {
      // Generar ID simple (usar últimos 8 caracteres del pedidoId + timestamp)
      const idSimple = `${pedidoId.slice(-8)}-${Date.now().toString(36)}`

      // Obtener el userId del pedido para validación de seguridad
      const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId))
      if (!pedidoDoc.exists()) {
        throw new Error("El pedido no existe")
      }
      const pedidoData = pedidoDoc.data()
      if (pedidoData.userId !== user.uid) {
        throw new Error("No tienes permiso para crear enlaces de este pedido")
      }

      // Verificar si el pedido está en proceso (enviado o recibido, pero permitir completado para nuevo pedido)
      if (pedidoData.estado === "enviado" || pedidoData.estado === "recibido") {
        throw new Error("No se puede generar un enlace para un pedido que está en proceso de envío o recepción")
      }

      // Desactivar todos los enlaces activos anteriores para este pedido
      const enlacesActivosQuery = query(
        collection(db, COLLECTIONS.ENLACES_PUBLICOS),
        where("pedidoId", "==", pedidoId),
        where("activo", "==", true),
        where("userId", "==", user.uid)
      )
      const enlacesActivosSnapshot = await getDocs(enlacesActivosQuery)
      const desactivarPromesas = enlacesActivosSnapshot.docs.map((doc) =>
        setDoc(doc.ref, { activo: false }, { merge: true })
      )
      await Promise.all(desactivarPromesas)

      // Obtener productos del pedido para guardar snapshot
      // Filtrar por pedidoId Y userId para que las reglas de seguridad permitan la lectura
      const productosQuery = query(
        collection(db, COLLECTIONS.PRODUCTS),
        where("pedidoId", "==", pedidoId),
        where("userId", "==", user.uid)
      )
      const productosSnapshot = await getDocs(productosQuery)
      const productosData = productosSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Producto[]

      productosData.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

      // Crear snapshot solo de productos que necesitan ser pedidos (cantidadPedida > 0)
      const productosSnapshotData = productosData
        .filter(p => {
          const cantidadPedida = cantidadesPedidas?.[p.id] ?? 0
          return cantidadPedida > 0 // Solo incluir productos que realmente necesitan ser pedidos
        })
        .map(p => {
          const cantidadPedida = cantidadesPedidas?.[p.id] ?? 0
          console.log(`Snapshot producto ${p.nombre}: stockMinimo=${p.stockMinimo}, cantidadPedida=${cantidadPedida}`)
          return {
            id: p.id,
            nombre: p.nombre,
            stockMinimo: p.stockMinimo,
            cantidadPedida: cantidadPedida, // Solo usar cantidad calculada (ya filtramos los que son 0)
            unidad: p.unidad,
            orden: p.orden,
          }
        })
      console.log("Snapshot de productos creado (solo con cantidadPedida > 0):", productosSnapshotData)

      const enlaceData: Omit<EnlacePublico, "id"> = {
        pedidoId,
        activo: true,
        userId: user.uid, // Incluir userId para las reglas de seguridad
        productosSnapshot: productosSnapshotData, // Guardar snapshot
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
        description: error.message || "No se pudo crear el enlace público",
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
      // Limpiar campos undefined antes de guardar (Firebase no permite undefined)
      const productosDisponiblesLimpios = productosDisponibles 
        ? Object.entries(productosDisponibles).reduce((acc, [key, value]) => {
            const cleanedValue: any = {
              disponible: value.disponible,
            }
            
            // Solo incluir campos que no sean undefined
            if (value.cantidadEnviada !== undefined) {
              cleanedValue.cantidadEnviada = value.cantidadEnviada
            }
            if (value.observaciones !== undefined && value.observaciones !== null && value.observaciones !== "") {
              cleanedValue.observaciones = value.observaciones
            }
            
            acc[key] = cleanedValue
            return acc
          }, {} as Record<string, any>)
        : undefined

      await setDoc(
        doc(db, COLLECTIONS.ENLACES_PUBLICOS, enlaceId),
        {
          productosDisponibles: productosDisponiblesLimpios,
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

  // Desactivar enlace público
  const desactivarEnlace = useCallback(async (
    enlaceId: string
  ): Promise<boolean> => {
    if (!db) return false

    try {
      await setDoc(
        doc(db, COLLECTIONS.ENLACES_PUBLICOS, enlaceId),
        {
          activo: false,
        },
        { merge: true }
      )
      return true
    } catch (error: any) {
      logger.error("Error al desactivar enlace:", error)
      return false
    }
  }, [])

  // Buscar enlaces públicos activos por pedidoId
  const buscarEnlacesActivosPorPedido = useCallback(async (
    pedidoId: string
  ): Promise<EnlacePublico[]> => {
    if (!db || !user) return []

    try {
      const enlacesQuery = query(
        collection(db, COLLECTIONS.ENLACES_PUBLICOS),
        where("pedidoId", "==", pedidoId),
        where("activo", "==", true),
        where("userId", "==", user.uid)
      )
      const snapshot = await getDocs(enlacesQuery)
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as EnlacePublico[]
    } catch (error: any) {
      logger.error("Error al buscar enlaces activos:", error)
      return []
    }
  }, [user])

  return {
    loading,
    crearEnlacePublico,
    obtenerEnlacePublico,
    actualizarProductosDisponibles,
    desactivarEnlace,
    buscarEnlacesActivosPorPedido,
  }
}
