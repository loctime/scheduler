"use client"

import { useState, useCallback } from "react"
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
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
import { useContext } from "react"
import { DataContext } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

// Helper para obtener userData de forma segura sin lanzar error
function useUserDataSafe() {
  try {
    const context = useContext(DataContext)
    return context?.userData || null
  } catch {
    // Si el contexto no está disponible, retornar null
    return null
  }
}

export function useEnlacePublico(user: any) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  
  // Obtener userData de forma segura (puede ser null si no hay DataProvider)
  const userData = useUserDataSafe()
  
  // Determinar el userId a usar: si es invitado, usar ownerId, sino usar su propio uid
  const ownerId = getOwnerIdForActor(user, userData)

  // Crear enlace público
  const crearEnlacePublico = useCallback(async (
    pedidoId: string,
    cantidadesPedidas?: Record<string, number> // Mapa de productoId -> cantidad a pedir
  ): Promise<EnlacePublico | null> => {
    if (!db || !user || !ownerId) return null

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
      // Verificar que el pedido pertenece al usuario o a su ownerId (si es invitado)
      if (!ownerId || pedidoData.ownerId !== ownerId) {
        throw new Error("No tienes permiso para crear enlaces de este pedido")
      }

      // Verificar si el pedido está en proceso (enviado o recibido, pero permitir completado para nuevo pedido)
      if (pedidoData.estado === "enviado" || pedidoData.estado === "recibido") {
        throw new Error("No se puede generar un enlace para un pedido que está en proceso de envío o recepción")
      }

      // Si el pedido está completado, actualizar su estado a "creado" para que aparezca en el panel de la fábrica
      if (pedidoData.estado === "completado") {
        await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId), {
          estado: "creado",
          updatedAt: serverTimestamp(),
        })
        logger.info("Pedido completado actualizado a 'creado' para regenerar enlace", { pedidoId })
      }

      // Verificar si hay otro pedido en estado "creado" o "processing" para este usuario
      const pedidosActivosQuery = query(
        collection(db, COLLECTIONS.PEDIDOS),
        where("ownerId", "==", ownerId),
        where("estado", "in", ["creado", "processing"])
      )
      const pedidosActivosSnapshot = await getDocs(pedidosActivosQuery)
      const pedidosActivos = pedidosActivosSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as { id: string; nombre?: string; estado?: string; assignedToNombre?: string }))
        .filter(p => p.id !== pedidoId) // Excluir el pedido actual
      
      if (pedidosActivos.length > 0) {
        // En lugar de bloquear, marcar los pedidos activos anteriores como "completado"
        // y desactivar sus enlaces para permitir crear un nuevo enlace.
        try {
          await Promise.all(pedidosActivos.map(async (p: any) => {
            if (!db) return
            try {
              await updateDoc(doc(db, COLLECTIONS.PEDIDOS, p.id), {
                estado: "completado",
                updatedAt: serverTimestamp(),
              })
            } catch (err) {
              logger.error("No se pudo actualizar estado del pedido activo:", err)
            }

            // Intentar desactivar enlace asociado a ese pedido (no bloquear si falla)
            try {
              const enlacePrevId = p.enlacePublicoId
              if (enlacePrevId) {
                await setDoc(doc(db, COLLECTIONS.ENLACES_PUBLICOS, enlacePrevId), { activo: false }, { merge: true })
              }
            } catch (err) {
              logger.error("No se pudieron desactivar enlaces del pedido activo:", err)
            }
          }))

          toast({
            title: "Pedidos previos archivados",
            description: "Se archivaron pedidos previos en estado 'creado' para poder generar este enlace",
            variant: "default",
          })
        } catch (err) {
          logger.error("Error al archivar pedidos activos:", err)
        }
      }

      // Verificar si hay un pedido en "processing" y mostrar warning (no bloquear)
      if (pedidoData.estado === "processing" && pedidoData.assignedTo) {
        const assignedToNombre = pedidoData.assignedToNombre || "otro usuario"
        toast({
          title: "Pedido en proceso",
          description: `Tenés un pedido en proceso tomado por: ${assignedToNombre}. ¿Deseas crear un nuevo enlace?`,
          variant: "default",
        })
        // No bloquear, solo advertir - continuar con la creación del enlace
      }

      // Desactivar enlace activo anterior si existe
      if (pedidoData.enlacePublicoId) {
        await setDoc(doc(db, COLLECTIONS.ENLACES_PUBLICOS, pedidoData.enlacePublicoId), { activo: false }, { merge: true })
      }

      // Obtener productos del pedido para guardar snapshot
      // Filtrar por pedidoId Y userId para que las reglas de seguridad permitan la lectura
      const productosQuery = query(
        collection(db, COLLECTIONS.PRODUCTS),
        where("pedidoId", "==", pedidoId),
        where("ownerId", "==", ownerId)
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
        token: idSimple, // Usar el mismo ID como token
        activo: true,
        ownerId,
        userId: user?.uid, // Auditoría del actor real
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
            if (value.cantidadEnviar !== undefined) {
              cleanedValue.cantidadEnviar = value.cantidadEnviar
            }
            const valueAny = value as any
            if (valueAny.observaciones !== undefined && valueAny.observaciones !== null && valueAny.observaciones !== "") {
              cleanedValue.observaciones = valueAny.observaciones
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

  // Desactivar todos los enlaces activos de un pedido
  const desactivarEnlacesPorPedido = useCallback(async (
    pedidoId: string
  ): Promise<boolean> => {
    if (!db || !user) return false
    if (!ownerId) return false

    try {
      const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId))
      if (!pedidoDoc.exists()) return false
      const pedidoData = pedidoDoc.data()
      if (pedidoData.ownerId !== ownerId) return false

      if (pedidoData.enlacePublicoId) {
        await setDoc(doc(db, COLLECTIONS.ENLACES_PUBLICOS, pedidoData.enlacePublicoId), { activo: false }, { merge: true })
        logger.info(`Desactivado enlace del pedido ${pedidoId}`)
      }
      
      return true
    } catch (error: any) {
      logger.error("Error al desactivar enlaces del pedido:", error)
      return false
    }
  }, [user, ownerId])

  // Buscar enlaces públicos activos por pedidoId
  const buscarEnlacesActivosPorPedido = useCallback(async (
    pedidoId: string
  ): Promise<EnlacePublico[]> => {
    if (!db || !user) return []
    if (!ownerId) return []

    try {
      const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId))
      if (!pedidoDoc.exists()) return []
      const pedidoData = pedidoDoc.data()
      if (pedidoData.ownerId !== ownerId) return []

      if (!pedidoData.enlacePublicoId) return []
      const enlaceDoc = await getDoc(doc(db, COLLECTIONS.ENLACES_PUBLICOS, pedidoData.enlacePublicoId))
      if (!enlaceDoc.exists()) return []
      const enlaceData = enlaceDoc.data() as EnlacePublico
      if (!enlaceData.activo) return []
      return [{ id: enlaceDoc.id, ...enlaceData }]
    } catch (error: any) {
      logger.error("Error al buscar enlaces activos:", error)
      return []
    }
  }, [user, ownerId])

  return {
    loading,
    crearEnlacePublico,
    obtenerEnlacePublico,
    actualizarProductosDisponibles,
    desactivarEnlace,
    desactivarEnlacesPorPedido,
    buscarEnlacesActivosPorPedido,
  }
}
