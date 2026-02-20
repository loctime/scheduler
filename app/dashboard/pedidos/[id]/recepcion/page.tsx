"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { usePedidos } from "@/hooks/use-pedidos"
import { useRecepciones } from "@/hooks/use-recepciones"
import { useRemitos } from "@/hooks/use-remitos"
import { useEnlacePublico } from "@/hooks/use-enlace-publico"
import { RecepcionForm } from "@/components/pedidos/recepcion-form"
import { crearRemitoRecepcion, eliminarRemitosAnteriores } from "@/lib/remito-utils"
import type { Remito, Pedido, Producto } from "@/lib/types"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import type { Recepcion } from "@/lib/types"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { logStockAction } from "@/lib/services/stockLogService"

export default function RecepcionPage() {
  const params = useParams()
  const router = useRouter()
  const pedidoId = params.id as string
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])

  const { pedidos, stockActual, calcularPedido, updatePedidoEstado } = usePedidos(user)
  const { crearRecepcion } = useRecepciones(user)
  const { crearRemito, descargarPDFRemito, obtenerRemitosPorPedido, obtenerRemito } = useRemitos(user)
  const { obtenerEnlacePublico, desactivarEnlacesPorPedido } = useEnlacePublico(user)

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [enlacePublico, setEnlacePublico] = useState<any>(null)
  const [productosEnviados, setProductosEnviados] = useState<Array<{
    productoId: string
    productoNombre: string
    cantidadPedida: number
    cantidadEnviada: number
  }>>([])
  const [observacionesRemito, setObservacionesRemito] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarDatos = async () => {
      if (!pedidoId || !db) return

      try {
        // Cargar pedido
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId))
        if (pedidoDoc.exists()) {
          const pedidoData = { id: pedidoDoc.id, ...pedidoDoc.data() } as Pedido
          setPedido(pedidoData)

          // Obtener productos enviados desde el remito de envío (si el pedido está en estado "enviado")
          if (pedidoData.estado === "enviado") {
            console.log("Pedido en estado enviado, buscando remito de envío...")
            console.log("remitoEnvioId:", pedidoData.remitoEnvioId)
            
            // Intentar obtener el remito directamente por ID primero
            let remitoEnvio = null
            if (pedidoData.remitoEnvioId) {
              console.log("Obteniendo remito directamente por ID:", pedidoData.remitoEnvioId)
              remitoEnvio = await obtenerRemito(pedidoData.remitoEnvioId)
              console.log("Remito obtenido por ID:", remitoEnvio)
              if (remitoEnvio) {
                console.log("Productos en remito (obtenido por ID):", remitoEnvio.productos)
                console.log("Tipo de productos:", typeof remitoEnvio.productos)
                console.log("Es array?", Array.isArray(remitoEnvio.productos))
              }
            }
            
            // Si no se encontró por ID, buscar en todos los remitos del pedido
            if (!remitoEnvio || !remitoEnvio.productos || remitoEnvio.productos.length === 0) {
              console.log("Buscando en todos los remitos del pedido...")
              const remitos = await obtenerRemitosPorPedido(pedidoId)
              console.log("Remitos encontrados:", remitos)
              
              // Buscar el remito de envío (por ID si existe, o por tipo)
              if (pedidoData.remitoEnvioId) {
                remitoEnvio = remitos.find(r => r.id === pedidoData.remitoEnvioId && r.tipo === "envio")
              }
              
              // Si no se encontró por ID, buscar por tipo
              if (!remitoEnvio) {
                remitoEnvio = remitos.find(r => r.tipo === "envio")
              }
              
              // Debug: verificar estructura completa del remito
              if (remitoEnvio) {
                console.log("Remito encontrado - estructura completa:", JSON.stringify(remitoEnvio, null, 2))
                console.log("Remito.productos existe?", "productos" in remitoEnvio)
                console.log("Remito.productos es array?", Array.isArray(remitoEnvio.productos))
                console.log("Remito.productos length:", remitoEnvio.productos?.length)
                console.log("Tipo de remito.productos:", typeof remitoEnvio.productos)
              }
            }
            
            // Cargar TODOS los productos del pedido primero
            const { collection: col, query: q, where: w, getDocs: getDocsProducts } = await import("firebase/firestore")
            if (!ownerId) return

            const productosQuery = q(
              col(db, COLLECTIONS.PRODUCTS),
              w("pedidoId", "==", pedidoId),
              w("ownerId", "==", ownerId)
            )
            const productosSnapshot = await getDocsProducts(productosQuery)
            const todosLosProductos = productosSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Producto[]
            
            // Guardar observaciones del remito si existen
            if (remitoEnvio?.observaciones) {
              setObservacionesRemito(remitoEnvio.observaciones)
            }
            
            // Extraer observaciones del remito que tienen formato "Producto: observación"
            const observacionesPorProducto = new Map<string, string>()
            if (remitoEnvio?.observaciones) {
              const lineas = remitoEnvio.observaciones.split('\n')
              lineas.forEach(linea => {
                if (linea.includes(':')) {
                  const [nombreProducto, ...resto] = linea.split(':')
                  const observacion = resto.join(':').trim()
                  if (observacion) {
                    observacionesPorProducto.set(nombreProducto.trim(), observacion)
                  }
                }
              })
            }
            
            // Crear mapa de productos enviados desde el remito (por productoId)
            const productosEnviadosMap = new Map<string, { cantidadEnviada: number; cantidadPedida: number; observaciones?: string }>()
            if (remitoEnvio?.productos) {
              remitoEnvio.productos.forEach((p: any) => {
                productosEnviadosMap.set(p.productoId, {
                  cantidadEnviada: p.cantidadEnviada || 0,
                  cantidadPedida: p.cantidadPedida || 0,
                  observaciones: p.observaciones || undefined, // Observaciones del producto individual
                })
              })
            }
            
            // Combinar todos los productos del pedido con la información del remito
            const productos: typeof productosEnviados = todosLosProductos.map((producto) => {
              const infoEnvio = productosEnviadosMap.get(producto.id)
              const cantidadEnviada = infoEnvio?.cantidadEnviada ?? 0
              const cantidadPedida = infoEnvio?.cantidadPedida ?? (producto.stockMinimo || 0)
              // Priorizar observaciones del producto individual, luego las del campo general
              const observacion = infoEnvio?.observaciones || observacionesPorProducto.get(producto.nombre) || undefined
              
              return {
                productoId: producto.id,
                productoNombre: producto.nombre,
                cantidadPedida: cantidadPedida,
                cantidadEnviada: cantidadEnviada,
                observacionesEnvio: observacion,
                modoCompra: producto.modoCompra,
                cantidadPorPack: producto.cantidadPorPack,
              }
            })
            
            console.log("Productos cargados (todos):", productos.length)
            setProductosEnviados(productos)
          } else {
            // Fallback: buscar en enlace público si existe (para pedidos antiguos)
            if (pedidoData.enlacePublicoId) {
              const enlace = await obtenerEnlacePublico(pedidoData.enlacePublicoId)
              setEnlacePublico(enlace)

              // Cargar TODOS los productos del pedido
              if (db) {
                const { collection: col, query: q, where: w, getDocs: getDocsProducts } = await import("firebase/firestore")
                if (!ownerId) return

                const productosQuery = q(
                  col(db, COLLECTIONS.PRODUCTS),
                  w("pedidoId", "==", pedidoId),
                  w("ownerId", "==", ownerId)
                )
                const productosSnapshot = await getDocsProducts(productosQuery)
                const todosLosProductos = productosSnapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                })) as Producto[]
                
                // Crear mapa de productos disponibles desde el enlace
                const productosEnviadosMap = new Map<string, { cantidadEnviada: number; observaciones?: string }>()
                if (enlace?.productosDisponibles) {
                  Object.entries(enlace.productosDisponibles).forEach(([productoId, data]: [string, any]) => {
                    if (data.disponible !== false) {
                      productosEnviadosMap.set(productoId, {
                        cantidadEnviada: data.cantidadEnviada || 0,
                        observaciones: data.observaciones || undefined,
                      })
                    }
                  })
                }
                
                // Combinar todos los productos del pedido con la información del enlace
                const productos: typeof productosEnviados = todosLosProductos.map((producto) => {
                  const infoEnvio = productosEnviadosMap.get(producto.id)
                  const cantidadEnviada = infoEnvio?.cantidadEnviada ?? 0
                  const cantidadPedida = producto.stockMinimo || 0
                  
                  return {
                    productoId: producto.id,
                    productoNombre: producto.nombre,
                    cantidadPedida: cantidadPedida,
                    cantidadEnviada: cantidadEnviada,
                    observacionesEnvio: infoEnvio?.observaciones || undefined,
                    modoCompra: producto.modoCompra,
                    cantidadPorPack: producto.cantidadPorPack,
                  }
                })

                setProductosEnviados(productos)
              }
            }
          }
        }
      } catch (error) {
        console.error("Error al cargar datos:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos del pedido",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [pedidoId, obtenerEnlacePublico, obtenerRemitosPorPedido, obtenerRemito, toast])

  const handleConfirmarRecepcion = async (
    recepcionData: Omit<Recepcion, "id" | "createdAt">
  ) => {
    if (!pedido || !ownerId) return

    try {
      // Crear recepción
      const recepcion = await crearRecepcion({
        ...recepcionData,
        pedidoId: pedido.id,
        ownerId,
        userId: user.uid,
      })

      if (!recepcion) return

      // Actualizar stock: sumar cantidad recibida
      if (db && recepcion.productos) {
        for (const productoRecepcion of recepcion.productos) {
          if (productoRecepcion.cantidadRecibida > 0) {
            const productRef = doc(db, COLLECTIONS.PRODUCTS, productoRecepcion.productoId)
            const productDoc = await getDoc(productRef)
            const stockActual = productDoc.exists() ? (productDoc.data().stockActual ?? 0) : 0
            const nuevoStock = stockActual + productoRecepcion.cantidadRecibida
            
            await updateDoc(productRef, {
              stockActual: nuevoStock,
              updatedAt: serverTimestamp(),
              ownerId,
              userId: user.uid,
            })

            // Log de auditoría para cada actualización de stock
            await logStockAction({
              ownerId,
              productId: productoRecepcion.productoId,
              productName: productoRecepcion.productoNombre || 'Producto desconocido',
              action: "recepcion_confirm",
              previousValue: stockActual,
              newValue: nuevoStock,
              recepcionId: recepcion.id,
              user: {
                uid: user.uid,
                email: user.email || 'desconocido@example.com'
              },
              source: "pwa"
            })
          }
        }
      }

      // Log de auditoría para confirmación de recepción
      await logStockAction({
        ownerId,
        action: "recepcion_confirm",
        recepcionId: recepcion.id,
        user: {
          uid: user.uid,
          email: user.email || 'desconocido@example.com'
        },
        source: "pwa"
      })

      // Log de auditoría para confirmación de pedido (cambio de estado)
      await logStockAction({
        ownerId,
        action: "pedido_confirm",
        pedidoId: pedido.id,
        user: {
          uid: user.uid,
          email: user.email || 'desconocido@example.com'
        },
        source: "pwa"
      })

      // Buscar remitos anteriores (pedido y envío) para consolidar
      const remitosAnteriores = await obtenerRemitosPorPedido(pedido.id)
      const remitoPedido = remitosAnteriores.find(r => r.tipo === "pedido") || null
      const remitoEnvio = remitosAnteriores.find(r => r.tipo === "envio") || null

      // Generar remito de recepción consolidado
      const remitoData = crearRemitoRecepcion(pedido, recepcion, remitoPedido, remitoEnvio)
      const remito = await crearRemito(remitoData, pedido.nombre)

      if (remito && db) {
        // Actualizar recepción con remito ID
        const { updateDoc } = await import("firebase/firestore")
        await updateDoc(doc(db, COLLECTIONS.RECEPCIONES, recepcion.id), {
          remitoId: remito.id,
        })

        // Actualizar estado del pedido
        // Si la recepción no es parcial, marcar como completado automáticamente
        const nuevoEstado = recepcionData.esParcial ? "recibido" : "completado"
        await updatePedidoEstado(pedido.id, nuevoEstado, undefined, new Date())

        // Desactivar enlaces públicos del pedido cuando se completa
        if (nuevoEstado === "completado") {
          await desactivarEnlacesPorPedido(pedido.id)
        }

        // Descargar PDF del remito
        await descargarPDFRemito(remito)

        toast({
          title: "Recepción registrada",
          description: "La recepción se ha registrado, el stock se ha actualizado y el remito se ha generado",
        })

        // Redirigir a la vista del pedido
        router.push(`/dashboard/pedidos/${pedidoId}`)
      }
    } catch (error) {
      console.error("Error al confirmar recepción:", error)
      toast({
        title: "Error",
        description: "No se pudo registrar la recepción",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!pedido) {
    return (
      <DashboardLayout user={user}>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Pedido no encontrado</h2>
          <Button onClick={() => router.push("/dashboard/pedidos")}>
            Volver a Pedidos
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  if (productosEnviados.length === 0) {
    return (
      <DashboardLayout user={user}>
        <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.push(`/dashboard/pedidos/${pedidoId}`)}
              className="h-9 w-9 sm:h-10 sm:w-10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">Registrar Recepción</h1>
          </div>
          <div className="rounded-lg border bg-card p-4 sm:p-6 text-center">
            <p className="text-sm sm:text-base text-muted-foreground">
              No hay productos enviados registrados. Primero debe generarse un enlace público y la fábrica debe confirmar el envío.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push(`/dashboard/pedidos/${pedidoId}`)}
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Registrar Recepción</h1>
        </div>

        <div className="rounded-lg border bg-card p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {observacionesRemito && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-3 sm:p-4">
              <h4 className="font-semibold text-xs sm:text-sm mb-2 text-blue-900 dark:text-blue-100">
                Observaciones del envío:
              </h4>
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                {observacionesRemito}
              </p>
            </div>
          )}
          <RecepcionForm
            productosEnviados={productosEnviados}
            onConfirmar={handleConfirmarRecepcion}
            esParcial={false}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
