"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Package, ArrowLeft, FileText, Link as LinkIcon, Download, CheckCircle } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { usePedidos } from "@/hooks/use-pedidos"
import { useRemitos } from "@/hooks/use-remitos"
import { useEnlacePublico } from "@/hooks/use-enlace-publico"
import { useRecepciones } from "@/hooks/use-recepciones"
import { PedidoTimeline } from "@/components/pedidos/pedido-timeline"
import { crearRemitoPedido, crearRemitoRecepcion } from "@/lib/remito-utils"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import type { Remito, Recepcion } from "@/lib/types"

export default function PedidoDetallePage() {
  const params = useParams()
  const router = useRouter()
  const pedidoId = params.id as string
  const { user } = useData()
  const { toast } = useToast()

  const { pedidos, products, stockActual, calcularPedido, updatePedidoEstado, updateRemitoEnvio, updateEnlacePublico } = usePedidos(user)
  const { crearRemito, obtenerRemitosPorPedido, descargarPDFRemito } = useRemitos(user)
  const { crearEnlacePublico, obtenerEnlacePublico, desactivarEnlacesPorPedido } = useEnlacePublico(user)
  const { obtenerRecepcionesPorPedido } = useRecepciones(user)

  const [pedido, setPedido] = useState<any>(null)
  const [remitos, setRemitos] = useState<Remito[]>([])
  const [recepciones, setRecepciones] = useState<Recepcion[]>([])
  const [enlacePublico, setEnlacePublico] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarDatos = async () => {
      if (!pedidoId || !db) return

      try {
        // Cargar pedido
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId))
        if (pedidoDoc.exists()) {
          setPedido({ id: pedidoDoc.id, ...pedidoDoc.data() })
        }

        // Cargar remitos
        const remitosData = await obtenerRemitosPorPedido(pedidoId)
        setRemitos(remitosData)

        // Cargar recepciones
        const recepcionesData = await obtenerRecepcionesPorPedido(pedidoId)
        setRecepciones(recepcionesData)

        // Cargar enlace público si existe
        if (pedidoDoc.exists() && pedidoDoc.data().enlacePublicoId) {
          const enlace = await obtenerEnlacePublico(pedidoDoc.data().enlacePublicoId)
          setEnlacePublico(enlace)
        }
      } catch (error) {
        console.error("Error al cargar datos:", error)
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [pedidoId, obtenerRemitosPorPedido, obtenerRecepcionesPorPedido, obtenerEnlacePublico])

  const handleGenerarRemitoEnvio = async () => {
    if (!pedido || !products.length) return

    const remitoData = crearRemitoPedido(pedido, products, stockActual, calcularPedido)
    const remito = await crearRemito(remitoData, pedido.nombre)
    
    if (remito) {
      await updateRemitoEnvio(pedido.id, remito.id)
      await updatePedidoEstado(pedido.id, "enviado", new Date())
      await descargarPDFRemito(remito)
      
      // Recargar remitos
      const remitosData = await obtenerRemitosPorPedido(pedidoId)
      setRemitos(remitosData)
      
      // Recargar pedido
      if (db) {
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId))
        if (pedidoDoc.exists()) {
          setPedido({ id: pedidoDoc.id, ...pedidoDoc.data() })
        }
      }
    }
  }

  const handleGenerarEnlacePublico = async () => {
    if (!pedido) return

    const enlace = await crearEnlacePublico(pedido.id)
    if (enlace) {
      await updateEnlacePublico(pedido.id, enlace.id)
      setEnlacePublico(enlace)
      
      const url = `${window.location.origin}/pedido-publico/${enlace.id}`
      navigator.clipboard.writeText(url)
      toast({
        title: "Enlace copiado",
        description: "El enlace público se ha copiado al portapapeles",
      })
    }
  }

  const handleMarcarCompletado = async () => {
    if (!pedido || !db) return
    await updatePedidoEstado(pedido.id, "completado")
    
    // Desactivar enlaces públicos del pedido cuando se completa
    await desactivarEnlacesPorPedido(pedido.id)
    
    // Actualizar estado local del pedido
    const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId))
    if (pedidoDoc.exists()) {
      const pedidoActualizado = { id: pedidoDoc.id, ...pedidoDoc.data() } as Pedido
      setPedido(pedidoActualizado)
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
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Pedido no encontrado</h2>
          <Button onClick={() => router.push("/dashboard/pedidos")}>
            Volver a Pedidos
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const estado = pedido.estado || "creado"
  const productosAPedir = products.filter(p => calcularPedido(p.stockMinimo, stockActual[p.id]) > 0)

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/pedidos")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{pedido.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              Estado: {estado.charAt(0).toUpperCase() + estado.slice(1)}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-lg border bg-card p-6">
          <PedidoTimeline pedido={pedido} />
        </div>

        {/* Acciones según estado */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Acciones</h2>
          <div className="flex flex-wrap gap-2">
            {estado === "creado" && productosAPedir.length > 0 && (
              <Button onClick={handleGenerarRemitoEnvio}>
                <FileText className="h-4 w-4 mr-2" />
                Generar Remito de Envío
              </Button>
            )}
            
            {estado === "enviado" && !enlacePublico && (
              <Button onClick={handleGenerarEnlacePublico}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Generar Enlace Público
              </Button>
            )}

            {enlacePublico && (
              <Button
                variant="outline"
                onClick={() => {
                  const url = `${window.location.origin}/pedido-publico/${enlacePublico.id}`
                  navigator.clipboard.writeText(url)
                  toast({ title: "Enlace copiado" })
                }}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Copiar Enlace Público
              </Button>
            )}

            {(estado === "enviado" || estado === "recibido") && (
              <Link href={`/dashboard/pedidos/${pedidoId}/recepcion`}>
                <Button>
                  <Package className="h-4 w-4 mr-2" />
                  Registrar Recepción
                </Button>
              </Link>
            )}

            {estado === "recibido" && (
              <Button onClick={handleMarcarCompletado}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Marcar como Completado
              </Button>
            )}
          </div>
        </div>

        {/* Remitos */}
        {remitos.length > 0 && (
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Remitos</h2>
            <div className="space-y-2">
              {remitos.map((remito) => (
                <div
                  key={remito.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">
                      {remito.tipo === "envio" ? "Remito de Envío" : "Remito de Recepción"} - {remito.numero}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {remito.fecha?.toDate ? remito.fecha.toDate().toLocaleDateString() : "Sin fecha"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => descargarPDFRemito(remito)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar PDF
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recepciones */}
        {recepciones.length > 0 && (
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Recepciones</h2>
            <div className="space-y-2">
              {recepciones.map((recepcion) => (
                <div
                  key={recepcion.id}
                  className="p-3 rounded-lg border"
                >
                  <p className="font-medium">
                    Recepción {recepcion.esParcial ? "(Parcial)" : "(Completa)"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {recepcion.fecha?.toDate ? recepcion.fecha.toDate().toLocaleDateString() : "Sin fecha"}
                  </p>
                  <p className="text-sm mt-1">
                    Productos: {recepcion.productos.length}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
