"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useEnlacePublico } from "@/hooks/use-enlace-publico"
import { EnlacePublicoForm } from "@/components/pedidos/enlace-publico-form"
import { Package, Loader2 } from "lucide-react"
import { logger } from "@/lib/logger"
import type { Pedido, Producto, EnlacePublico } from "@/lib/types"
import { generarNumeroRemito, crearRemitoEnvioDesdeDisponibles } from "@/lib/remito-utils"

export default function PedidoPublicoPage() {
  const params = useParams()
  const enlaceId = params.id as string
  const { obtenerEnlacePublico, actualizarProductosDisponibles, desactivarEnlace, loading } = useEnlacePublico(null)
  
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [enlacePublico, setEnlacePublico] = useState<EnlacePublico | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Obtener enlace público
        const enlace = await obtenerEnlacePublico(enlaceId)
        if (!enlace || !enlace.activo) {
          setError("El enlace no es válido o ha sido desactivado")
          setLoadingData(false)
          return
        }

        setEnlacePublico(enlace)

        // Obtener pedido
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, enlace.pedidoId))
        if (!pedidoDoc.exists()) {
          setError("El pedido no existe")
          setLoadingData(false)
          return
        }

        const pedidoData = { id: pedidoDoc.id, ...pedidoDoc.data() } as Pedido
        setPedido(pedidoData)

        // Verificar si el pedido ya está enviado
        if (pedidoData.estado === "enviado" || pedidoData.estado === "recibido" || pedidoData.estado === "completado") {
          setError("Este pedido ya fue enviado y no puede ser modificado")
          setLoadingData(false)
          return
        }

        // Usar snapshot de productos si existe, sino leer dinámicamente (para enlaces antiguos)
        if (enlace.productosSnapshot && enlace.productosSnapshot.length > 0) {
          // Convertir snapshot a formato Producto
          const productosFromSnapshot = enlace.productosSnapshot.map(p => ({
            id: p.id,
            pedidoId: enlace.pedidoId,
            nombre: p.nombre,
            stockMinimo: p.stockMinimo,
            unidad: p.unidad,
            orden: p.orden,
            userId: enlace.userId,
          })) as Producto[]
          setProductos(productosFromSnapshot)
        } else {
          // Fallback: leer productos dinámicamente (para enlaces antiguos sin snapshot)
          const productosQuery = query(
            collection(db, COLLECTIONS.PRODUCTS),
            where("pedidoId", "==", enlace.pedidoId)
          )
          const productosSnapshot = await getDocs(productosQuery)
          const productosData = productosSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Producto[]

          productosData.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
          setProductos(productosData)
        }
      } catch (err: any) {
        logger.error("Error al cargar datos:", err)
        setError("Error al cargar el pedido")
      } finally {
        setLoadingData(false)
      }
    }

    if (enlaceId) {
      cargarDatos()
    }
  }, [enlaceId, obtenerEnlacePublico])

  const handleConfirmar = async (
    productosDisponibles: EnlacePublico["productosDisponibles"]
  ) => {
    if (!enlacePublico || !pedido || !db) return

    try {
      console.log("Iniciando confirmación de envío...")
      
      // 1. Actualizar el enlace con productosDisponibles
      console.log("Paso 1: Actualizando productos disponibles...")
      const success = await actualizarProductosDisponibles(
        enlacePublico.id,
        productosDisponibles
      )

      if (!success) {
        alert("Error al actualizar el enlace")
        return
      }
      console.log("✓ Productos disponibles actualizados")

      // 2. Generar el remito automáticamente
      console.log("Paso 2: Generando datos del remito...")
      const remitoData = crearRemitoEnvioDesdeDisponibles(
        pedido,
        productos,
        productosDisponibles || {}
      )
      console.log("Datos del remito:", remitoData)

      // Generar número de remito
      console.log("Paso 3: Generando número de remito...")
      const numeroRemito = await generarNumeroRemito(db, COLLECTIONS)
      console.log("Número de remito:", numeroRemito)

      // Crear remito en Firestore
      console.log("Paso 4: Creando remito en Firestore...")
      console.log("Datos del remito a crear:", {
        pedidoId: remitoData.pedidoId,
        userId: remitoData.userId,
        tipo: remitoData.tipo,
        numero: numeroRemito,
      })
      console.log("Estado del pedido:", pedido.estado)
      console.log("UserId del pedido:", pedido.userId)
      
      const remitoRef = await addDoc(collection(db, COLLECTIONS.REMITOS), {
        ...remitoData,
        numero: numeroRemito,
        createdAt: serverTimestamp(),
      })
      console.log("✓ Remito creado:", remitoRef.id)

      // 3. Actualizar el pedido: estado "enviado", fechaEnvio, y vincular remito
      console.log("Paso 5: Actualizando pedido...")
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedido.id), {
        estado: "enviado",
        remitoEnvioId: remitoRef.id,
        fechaEnvio: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      console.log("✓ Pedido actualizado")

      // 4. Desactivar el enlace para que no pueda ser editado nuevamente
      // Si falla, no es crítico - el pedido ya está marcado como enviado
      console.log("Paso 6: Desactivando enlace...")
      try {
        await desactivarEnlace(enlacePublico.id)
        console.log("✓ Enlace desactivado")
      } catch (desactivarError: any) {
        logger.error("Error al desactivar enlace (no crítico):", desactivarError)
        console.error("Error al desactivar enlace (no crítico):", desactivarError)
        // No bloqueamos el flujo si falla la desactivación
      }

      console.log("✓ Confirmación completada exitosamente")
      alert("Pedido confirmado y remito generado exitosamente. Gracias!")
    } catch (error: any) {
      logger.error("Error al confirmar envío:", error)
      console.error("Detalles del error:", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      })
      alert(`Error al procesar la confirmación: ${error?.message || "Error desconocido"}. Por favor, intente nuevamente.`)
    }
  }

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando pedido...</p>
        </div>
      </div>
    )
  }

  if (error || !pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <Package className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">Error</h1>
          <p className="text-muted-foreground">{error || "El pedido no existe"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{pedido.nombre}</h1>
              <p className="text-sm text-muted-foreground">
                Complete la información de disponibilidad y cantidades a enviar
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <EnlacePublicoForm
            productos={productos}
            enlacePublico={enlacePublico}
            onConfirmar={handleConfirmar}
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}
