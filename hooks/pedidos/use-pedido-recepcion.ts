"use client"

import { useState, useEffect } from "react"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import type { Remito, Recepcion } from "@/lib/types"
import { crearRemitoRecepcion } from "@/lib/remito-utils"

export type ProductoEnviado = {
  productoId: string
  productoNombre: string
  cantidadPedida: number
  cantidadEnviada: number
  observacionesEnvio?: string
  modoCompra?: "unidad" | "pack" | string
  cantidadPorPack?: number
}

export interface UsePedidoRecepcionParams {
  activeTab: "productos" | "remitos" | "recepcion"
  selectedPedido: { id: string; estado?: string; remitoEnvioId?: string | null; enlacePublicoId?: string | null } | null
  ownerId: string | null
  user: { uid: string } | null
  obtenerRemito: (id: string) => Promise<Remito | null>
  obtenerRemitosPorPedido: (pedidoId: string) => Promise<Remito[]>
  obtenerEnlacePublico: (id: string) => Promise<any>
  crearRecepcion: (data: Omit<Recepcion, "id" | "createdAt">) => Promise<Recepcion | null>
  crearRemito: (data: Omit<Remito, "id" | "numero" | "createdAt" | "ownerId" | "userId">, nombrePedido?: string) => Promise<Remito | null>
  descargarPDFRemito: (remito: Remito) => Promise<void>
  updatePedidoEstado: (
    pedidoId: string,
    estado: "creado" | "enviado" | "recibido" | "completado",
    fechaEnvio?: Date,
    fechaRecepcion?: Date
  ) => Promise<boolean | void>
  desactivarEnlacesPorPedido: (pedidoId: string) => Promise<boolean | void>
  setStockActual: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setRemitos: (remitos: Remito[]) => void
  setRecepciones: (recepciones: Recepcion[]) => void
  setEnlaceActivo: (enlace: { id: string } | null) => void
  setSelectedPedido: (pedido: any) => void
  obtenerRecepcionesPorPedido: (pedidoId: string) => Promise<Recepcion[]>
  setActiveTab: (tab: "productos" | "remitos" | "recepcion") => void
}

export function usePedidoRecepcion(params: UsePedidoRecepcionParams) {
  const {
    activeTab,
    selectedPedido,
    ownerId,
    user,
    obtenerRemito,
    obtenerRemitosPorPedido,
    obtenerEnlacePublico,
    crearRecepcion,
    crearRemito,
    descargarPDFRemito,
    updatePedidoEstado,
    desactivarEnlacesPorPedido,
    setStockActual,
    setRemitos,
    setRecepciones,
    setEnlaceActivo,
    setSelectedPedido,
    obtenerRecepcionesPorPedido,
    setActiveTab
  } = params

  const { toast } = useToast()
  const [productosEnviados, setProductosEnviados] = useState<ProductoEnviado[]>([])
  const [observacionesRemito, setObservacionesRemito] = useState<string | null>(null)
  const [loadingRecepcion, setLoadingRecepcion] = useState(false)

  useEffect(() => {
    const cargarDatosRecepcion = async () => {
      if (activeTab !== "recepcion" || !selectedPedido?.id) {
        setProductosEnviados([])
        setObservacionesRemito(null)
        return
      }

      if (!db) return

      setLoadingRecepcion(true)
      try {
        if (selectedPedido.estado === "enviado" || selectedPedido.estado === "recibido") {
          let remitoEnvio = null
          if (selectedPedido.remitoEnvioId) {
            remitoEnvio = await obtenerRemito(selectedPedido.remitoEnvioId)
          }

          if (!remitoEnvio || !remitoEnvio.productos || remitoEnvio.productos.length === 0) {
            const remitos = await obtenerRemitosPorPedido(selectedPedido.id)

            if (selectedPedido.remitoEnvioId) {
              remitoEnvio = remitos.find((r) => r.id === selectedPedido.remitoEnvioId && r.tipo === "envio")
            }

            if (!remitoEnvio) {
              remitoEnvio = remitos.find((r) => r.tipo === "envio")
            }
          }

          const { collection: col, query: q, where: w, getDocs: getDocsProducts } = await import("firebase/firestore")
          if (!ownerId) return

          const productosQuery = q(
            col(db, COLLECTIONS.PRODUCTS),
            w("pedidoId", "==", selectedPedido.id),
            w("ownerId", "==", ownerId)
          )
          const productosSnapshot = await getDocsProducts(productosQuery)
          const todosLosProductos = productosSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          })) as any[]

          if (remitoEnvio?.observaciones) {
            setObservacionesRemito(remitoEnvio.observaciones)
          }

          const observacionesPorProducto = new Map<string, string>()
          if (remitoEnvio?.observaciones) {
            const lineas = remitoEnvio.observaciones.split("\n")
            lineas.forEach((linea) => {
              if (linea.includes(":")) {
                const [nombreProducto, ...resto] = linea.split(":")
                const observacion = resto.join(":").trim()
                if (observacion) {
                  observacionesPorProducto.set(nombreProducto.trim(), observacion)
                }
              }
            })
          }

          const productosEnviadosMap = new Map<
            string,
            { cantidadEnviada: number; cantidadPedida: number; observaciones?: string }
          >()
          if (remitoEnvio?.productos) {
            remitoEnvio.productos.forEach((p: any) => {
              productosEnviadosMap.set(p.productoId, {
                cantidadEnviada: p.cantidadEnviada || 0,
                cantidadPedida: p.cantidadPedida || 0,
                observaciones: p.observaciones || undefined
              })
            })
          }

          const productos = todosLosProductos.map((producto) => {
            const infoEnvio = productosEnviadosMap.get(producto.id)
            const cantidadEnviada = infoEnvio?.cantidadEnviada ?? 0
            const cantidadPedida = infoEnvio?.cantidadPedida ?? (producto.stockMinimo || 0)
            const observacion =
              infoEnvio?.observaciones || observacionesPorProducto.get(producto.nombre) || undefined

            return {
              productoId: producto.id,
              productoNombre: producto.nombre,
              cantidadPedida,
              cantidadEnviada,
              observacionesEnvio: observacion,
              modoCompra: producto.modoCompra,
              cantidadPorPack: producto.cantidadPorPack
            }
          })

          setProductosEnviados(productos)
        } else {
          if (selectedPedido.enlacePublicoId) {
            const enlace = await obtenerEnlacePublico(selectedPedido.enlacePublicoId)

            const { collection: col, query: q, where: w, getDocs: getDocsProducts } = await import("firebase/firestore")
            if (!ownerId) return

            const productosQuery = q(
              col(db, COLLECTIONS.PRODUCTS),
              w("pedidoId", "==", selectedPedido.id),
              w("ownerId", "==", ownerId)
            )
            const productosSnapshot = await getDocsProducts(productosQuery)
            const todosLosProductos = productosSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data()
            })) as any[]

            const productosEnviadosMap = new Map<string, { cantidadEnviada: number; observaciones?: string }>()
            if (enlace?.productosDisponibles) {
              Object.entries(enlace.productosDisponibles).forEach(([productoId, data]: [string, any]) => {
                if (data.disponible !== false) {
                  productosEnviadosMap.set(productoId, {
                    cantidadEnviada: data.cantidadEnviada || 0,
                    observaciones: data.observaciones || undefined
                  })
                }
              })
            }

            const productos = todosLosProductos.map((producto) => {
              const infoEnvio = productosEnviadosMap.get(producto.id)
              const cantidadEnviada = infoEnvio?.cantidadEnviada ?? 0
              const cantidadPedida = producto.stockMinimo || 0

              return {
                productoId: producto.id,
                productoNombre: producto.nombre,
                cantidadPedida,
                cantidadEnviada,
                observacionesEnvio: infoEnvio?.observaciones || undefined,
                modoCompra: producto.modoCompra,
                cantidadPorPack: producto.cantidadPorPack
              }
            })

            setProductosEnviados(productos)
          }
        }
      } catch (error) {
        console.error("Error al cargar datos de recepción:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos de recepción",
          variant: "destructive"
        })
      } finally {
        setLoadingRecepcion(false)
      }
    }

    cargarDatosRecepcion()
  }, [
    activeTab,
    selectedPedido?.id,
    selectedPedido?.estado,
    selectedPedido?.remitoEnvioId,
    selectedPedido?.enlacePublicoId,
    ownerId,
    obtenerRemito,
    obtenerRemitosPorPedido,
    obtenerEnlacePublico,
    toast
  ])

  const handleConfirmarRecepcion = async (recepcionData: Omit<Recepcion, "id" | "createdAt">) => {
    if (!selectedPedido || !ownerId) return

    setLoadingRecepcion(true)
    try {
      const recepcion = await crearRecepcion({
        ...recepcionData,
        pedidoId: selectedPedido.id,
        ownerId,
        userId: user!.uid
      })

      if (!recepcion) return

      if (db && recepcion.productos) {
        for (const productoRecepcion of recepcion.productos) {
          if (productoRecepcion.cantidadRecibida > 0) {
            try {
              const productRef = doc(db, COLLECTIONS.PRODUCTS, productoRecepcion.productoId)
              const productDoc = await getDoc(productRef)
              const stockActualVal = productDoc.exists() ? (productDoc.data().stockActual ?? 0) : 0
              const nuevoStock = stockActualVal + productoRecepcion.cantidadRecibida
              await updateDoc(productRef, {
                stockActual: nuevoStock,
                updatedAt: serverTimestamp(),
                ownerId,
                userId: user!.uid
              })
              setStockActual((prev) => ({ ...prev, [productoRecepcion.productoId]: nuevoStock }))
            } catch (stockError) {
              console.error("Error al actualizar stock para producto:", productoRecepcion.productoId, stockError)
            }
          }
        }
      }

      const remitosAnteriores = await obtenerRemitosPorPedido(selectedPedido.id)
      const remitoPedido = remitosAnteriores.find((r) => r.tipo === "pedido") || null
      const remitoEnvio = remitosAnteriores.find((r) => r.tipo === "envio") || null

      const remitoData = crearRemitoRecepcion(selectedPedido as any, recepcion, remitoPedido, remitoEnvio)
      const remito = await crearRemito(remitoData, (selectedPedido as any).nombre)

      if (remito && db) {
        await updateDoc(doc(db, COLLECTIONS.RECEPCIONES, recepcion.id), {
          remitoId: remito.id
        })

        const nuevoEstado = recepcionData.esParcial ? "recibido" : "completado"
        await updatePedidoEstado(selectedPedido.id, nuevoEstado, undefined, new Date())

        if (nuevoEstado === "completado") {
          await desactivarEnlacesPorPedido(selectedPedido.id)
          setEnlaceActivo(null)
        }

        await descargarPDFRemito(remito)

        const remitosData = await obtenerRemitosPorPedido(selectedPedido.id)
        setRemitos(remitosData)

        const recepcionesData = await obtenerRecepcionesPorPedido(selectedPedido.id)
        setRecepciones(recepcionesData)

        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id))
        if (pedidoDoc.exists()) {
          setSelectedPedido({ id: pedidoDoc.id, ...pedidoDoc.data() } as any)
        }

        toast({
          title: "Recepción registrada",
          description:
            "La recepción se ha registrado, el stock se ha actualizado y el remito se ha generado"
        })

        setActiveTab("remitos")
      }
    } catch (error: any) {
      console.error("Error al confirmar recepción:", error)
      toast({
        title: "Error",
        description: error?.message || "No se pudo registrar la recepción",
        variant: "destructive"
      })
    } finally {
      setLoadingRecepcion(false)
    }
  }

  return {
    productosEnviados,
    observacionesRemito,
    loadingRecepcion,
    handleConfirmarRecepcion
  }
}
