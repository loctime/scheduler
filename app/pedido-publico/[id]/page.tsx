"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { useEnlacePublico } from "@/hooks/use-enlace-publico"
import { EnlacePublicoForm } from "@/components/pedidos/enlace-publico-form"
import { Package, Loader2 } from "lucide-react"
import { logger } from "@/lib/logger"
import type { Pedido, Producto, EnlacePublico } from "@/lib/types"

export default function PedidoPublicoPage() {
  const params = useParams()
  const enlaceId = params.id as string
  const { obtenerEnlacePublico, actualizarProductosDisponibles, loading } = useEnlacePublico(null)
  
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

        setPedido({ id: pedidoDoc.id, ...pedidoDoc.data() } as Pedido)

        // Obtener productos del pedido
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
    if (!enlacePublico) return

    const success = await actualizarProductosDisponibles(
      enlacePublico.id,
      productosDisponibles
    )

    if (success) {
      alert("Pedido confirmado exitosamente. Gracias!")
      // Opcional: redirigir o mostrar mensaje de éxito
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
