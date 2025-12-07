"use client"

import { useEffect, useState } from "react"
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
import { crearRemitoRecepcion } from "@/lib/remito-utils"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import type { Recepcion } from "@/lib/types"

export default function RecepcionPage() {
  const params = useParams()
  const router = useRouter()
  const pedidoId = params.id as string
  const { user } = useData()
  const { toast } = useToast()

  const { pedidos, stockActual, calcularPedido, updatePedidoEstado } = usePedidos(user)
  const { crearRecepcion } = useRecepciones(user)
  const { crearRemito, descargarPDFRemito } = useRemitos(user)
  const { obtenerEnlacePublico } = useEnlacePublico(user)

  const [pedido, setPedido] = useState<any>(null)
  const [enlacePublico, setEnlacePublico] = useState<any>(null)
  const [productosEnviados, setProductosEnviados] = useState<Array<{
    productoId: string
    productoNombre: string
    cantidadEnviada: number
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarDatos = async () => {
      if (!pedidoId) return

      try {
        // Cargar pedido
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId))
        if (pedidoDoc.exists()) {
          const pedidoData = { id: pedidoDoc.id, ...pedidoDoc.data() }
          setPedido(pedidoData)

          // Cargar enlace público si existe
          if (pedidoData.enlacePublicoId) {
            const enlace = await obtenerEnlacePublico(pedidoData.enlacePublicoId)
            setEnlacePublico(enlace)

            // Obtener productos enviados desde el enlace público
            if (enlace?.productosDisponibles) {
              const productos: typeof productosEnviados = []
              
              // Necesitamos obtener los productos del pedido para tener los nombres
              const { collection, query, where, getDocs } = await import("firebase/firestore")
              const productosQuery = query(
                collection(db, COLLECTIONS.PRODUCTS),
                where("pedidoId", "==", pedidoId)
              )
              const productosSnapshot = await getDocs(productosQuery)
              const productosData = productosSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }))

              // Construir lista de productos enviados
              Object.entries(enlace.productosDisponibles).forEach(([productoId, data]) => {
                if (data.disponible && data.cantidadEnviada) {
                  const producto = productosData.find(p => p.id === productoId)
                  if (producto) {
                    productos.push({
                      productoId: producto.id,
                      productoNombre: producto.nombre,
                      cantidadEnviada: data.cantidadEnviada,
                    })
                  }
                }
              })

              setProductosEnviados(productos)
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
  }, [pedidoId, obtenerEnlacePublico, toast])

  const handleConfirmarRecepcion = async (
    recepcionData: Omit<Recepcion, "id" | "createdAt">
  ) => {
    if (!pedido) return

    try {
      // Crear recepción
      const recepcion = await crearRecepcion({
        ...recepcionData,
        pedidoId: pedido.id,
        userId: user.uid,
      })

      if (!recepcion) return

      // Generar remito de recepción
      const remitoData = crearRemitoRecepcion(pedido, recepcion)
      const remito = await crearRemito(remitoData)

      if (remito) {
        // Actualizar recepción con remito ID
        const { updateDoc } = await import("firebase/firestore")
        await updateDoc(doc(db, COLLECTIONS.RECEPCIONES, recepcion.id), {
          remitoId: remito.id,
        })

        // Actualizar estado del pedido
        const nuevoEstado = recepcionData.esParcial ? "recibido" : "recibido"
        await updatePedidoEstado(pedido.id, nuevoEstado, undefined, new Date())

        // Descargar PDF del remito
        await descargarPDFRemito(remito)

        toast({
          title: "Recepción registrada",
          description: "La recepción se ha registrado y el remito se ha generado",
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
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/pedidos/${pedidoId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Registrar Recepción</h1>
          </div>
          <div className="rounded-lg border bg-card p-6 text-center">
            <p className="text-muted-foreground">
              No hay productos enviados registrados. Primero debe generarse un enlace público y la fábrica debe confirmar el envío.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/pedidos/${pedidoId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Registrar Recepción</h1>
        </div>

        <div className="rounded-lg border bg-card p-6">
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
