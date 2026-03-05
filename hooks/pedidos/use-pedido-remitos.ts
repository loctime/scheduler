"use client"

import { useState, useEffect, useCallback } from "react"
import { getDoc, doc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { Remito, Recepcion, Pedido, Producto } from "@/lib/types"
import { crearRemitoPedido } from "@/lib/remito-utils"

export interface UsePedidoRemitosParams {
  selectedPedido: Pedido | null
  products: Producto[]
  stockActual: Record<string, number>
  ajustesPedido: Record<string, number>
  obtenerRemitosPorPedido: (pedidoId: string) => Promise<Remito[]>
  obtenerRecepcionesPorPedido: (pedidoId: string) => Promise<Recepcion[]>
  buscarEnlacesActivosPorPedido: (pedidoId: string) => Promise<Array<{ id: string; createdAt?: any }>>
  crearRemito: (
    data: Omit<Remito, "id" | "numero" | "createdAt" | "ownerId" | "userId">,
    nombrePedido?: string
  ) => Promise<Remito | null>
  updateRemitoEnvio: (pedidoId: string, remitoId: string) => Promise<boolean | void>
  updatePedidoEstado: (
    pedidoId: string,
    estado: "creado" | "enviado" | "recibido" | "completado",
    fechaEnvio?: Date,
    fechaRecepcion?: Date
  ) => Promise<boolean | void>
  descargarPDFRemito: (remito: Remito) => Promise<void>
  setEnlaceActivo: (enlace: { id: string } | null) => void
  setSelectedPedido: (p: Pedido | null) => void
  calcularPedido: (stockMinimo: number, stockActualValue?: number) => number
}

export function usePedidoRemitos(params: UsePedidoRemitosParams) {
  const {
    selectedPedido,
    products,
    stockActual,
    ajustesPedido,
    obtenerRemitosPorPedido,
    obtenerRecepcionesPorPedido,
    buscarEnlacesActivosPorPedido,
    crearRemito,
    updateRemitoEnvio,
    updatePedidoEstado,
    descargarPDFRemito,
    setEnlaceActivo,
    setSelectedPedido,
    calcularPedido
  } = params

  const [remitos, setRemitos] = useState<Remito[]>([])
  const [recepciones, setRecepciones] = useState<Recepcion[]>([])

  useEffect(() => {
    const cargarDatos = async () => {
      if (!selectedPedido?.id) {
        setRemitos([])
        setRecepciones([])
        setEnlaceActivo(null)
        return
      }

      try {
        const [remitosData, recepcionesData, enlacesActivos] = await Promise.all([
          obtenerRemitosPorPedido(selectedPedido.id),
          obtenerRecepcionesPorPedido(selectedPedido.id),
          buscarEnlacesActivosPorPedido(selectedPedido.id)
        ])

        setRemitos(remitosData)
        setRecepciones(recepcionesData)

        if (enlacesActivos.length > 0) {
          const enlaceMasReciente = enlacesActivos.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0
            const bTime = b.createdAt?.toMillis?.() || 0
            return bTime - aTime
          })[0]
          setEnlaceActivo({ id: enlaceMasReciente.id })
        } else {
          setEnlaceActivo(null)
        }
      } catch (error) {
        console.error("Error al cargar datos:", error)
        setRemitos([])
        setRecepciones([])
        setEnlaceActivo(null)
      }
    }

    cargarDatos()
  }, [
    selectedPedido?.id,
    obtenerRemitosPorPedido,
    obtenerRecepcionesPorPedido,
    buscarEnlacesActivosPorPedido,
    setEnlaceActivo
  ])

  const handleGenerarRemitoEnvio = useCallback(async () => {
    if (!selectedPedido || !products.length) return

    const remitoData = crearRemitoPedido(
      selectedPedido,
      products,
      stockActual,
      calcularPedido,
      ajustesPedido
    )
    const remito = await crearRemito(remitoData, selectedPedido.nombre)

    if (remito) {
      await updateRemitoEnvio(selectedPedido.id, remito.id)
      await updatePedidoEstado(selectedPedido.id, "enviado", new Date())
      await descargarPDFRemito(remito)

      const remitosData = await obtenerRemitosPorPedido(selectedPedido.id)
      setRemitos(remitosData)

      if (db) {
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id))
        if (pedidoDoc.exists()) {
          setSelectedPedido({ id: pedidoDoc.id, ...pedidoDoc.data() } as Pedido)
        }
      }
    }
  }, [
    selectedPedido,
    products,
    stockActual,
    ajustesPedido,
    calcularPedido,
    crearRemito,
    updateRemitoEnvio,
    updatePedidoEstado,
    descargarPDFRemito,
    obtenerRemitosPorPedido,
    setRemitos,
    setSelectedPedido
  ])

  return {
    remitos,
    setRemitos,
    recepciones,
    setRecepciones,
    handleGenerarRemitoEnvio
  }
}
