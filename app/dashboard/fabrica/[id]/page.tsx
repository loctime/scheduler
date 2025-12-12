"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from "firebase/firestore"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Package, Loader2, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react"
import { logger } from "@/lib/logger"
import type { Pedido, Producto, EnlacePublico, Configuracion } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { useFabricaPedidos } from "@/hooks/use-fabrica-pedidos"
import { FabricaPedidoForm } from "@/components/fabrica/pedido-form"
import { FirmaRemitoDialog } from "@/components/fabrica/firma-remito-dialog"
import { generarNumeroRemito, crearRemitoEnvioDesdeDisponibles } from "@/lib/remito-utils"
import { useRemitos } from "@/hooks/use-remitos"
import { addDoc, collection } from "firebase/firestore"

export default function FabricaPedidoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const pedidoId = params.id as string
  const { user } = useData()
  const { aceptarPedido } = useFabricaPedidos(user)
  const { crearRemito } = useRemitos(user)
  
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [enlacePublico, setEnlacePublico] = useState<EnlacePublico | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nombreEmpresa, setNombreEmpresa] = useState<string>("")
  const [mostrarFirmaDialog, setMostrarFirmaDialog] = useState(false)
  const [productosDisponiblesPendientes, setProductosDisponiblesPendientes] = useState<EnlacePublico["productosDisponibles"] | null>(null)
  const [aceptandoPedido, setAceptandoPedido] = useState(false)

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        if (!db) {
          setError("Firebase no está configurado correctamente")
          setLoadingData(false)
          return
        }

        // Obtener pedido
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId))
        if (!pedidoDoc.exists()) {
          setError("El pedido no existe")
          setLoadingData(false)
          return
        }

        const pedidoData = { id: pedidoDoc.id, ...pedidoDoc.data() } as Pedido
        setPedido(pedidoData)

        // Obtener configuración para nombre de empresa
        if (pedidoData.userId) {
          try {
            const configDoc = await getDoc(doc(db, COLLECTIONS.CONFIG, pedidoData.userId))
            if (configDoc.exists()) {
              const config = configDoc.data() as Configuracion
              setNombreEmpresa(config.nombreEmpresa || "Empresa")
            } else {
              setNombreEmpresa("Empresa")
            }
          } catch (err) {
            logger.error("Error al cargar configuración:", err)
            setNombreEmpresa("Empresa")
          }
        }

        // Buscar enlace público activo para obtener snapshot de productos
        const enlacesQuery = query(
          collection(db, COLLECTIONS.ENLACES_PUBLICOS),
          where("pedidoId", "==", pedidoId),
          where("activo", "==", true)
        )
        const enlacesSnapshot = await getDocs(enlacesQuery)
        
        if (!enlacesSnapshot.empty) {
          const enlaceData = { id: enlacesSnapshot.docs[0].id, ...enlacesSnapshot.docs[0].data() } as EnlacePublico
          setEnlacePublico(enlaceData)

          // Usar snapshot de productos si existe
          if (enlaceData.productosSnapshot && enlaceData.productosSnapshot.length > 0) {
            const productosFromSnapshot = enlaceData.productosSnapshot
              .filter(p => (p.cantidadPedida ?? 0) > 0)
              .map(p => ({
                id: p.id,
                pedidoId: pedidoId,
                nombre: p.nombre,
                stockMinimo: p.stockMinimo,
                cantidadPedida: p.cantidadPedida ?? 0,
                unidad: p.unidad,
                orden: p.orden,
                userId: pedidoData.userId,
              })) as Producto[]
            setProductos(productosFromSnapshot)
          } else {
            // Fallback: leer productos dinámicamente
            const productosQuery = query(
              collection(db, COLLECTIONS.PRODUCTS),
              where("pedidoId", "==", pedidoId),
              where("userId", "==", pedidoData.userId)
            )
            const productosSnapshot = await getDocs(productosQuery)
            const productosData = productosSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Producto[]
            productosData.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
            setProductos(productosData)
          }
        } else {
          // No hay enlace público, leer productos directamente
          const productosQuery = query(
            collection(db, COLLECTIONS.PRODUCTS),
            where("pedidoId", "==", pedidoId),
            where("userId", "==", pedidoData.userId)
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

    if (pedidoId) {
      cargarDatos()
    }
  }, [pedidoId])

  const handleAceptarPedido = async () => {
    if (!pedido) return
    
    setAceptandoPedido(true)
    const exito = await aceptarPedido(pedido.id)
    setAceptandoPedido(false)
    
    if (exito) {
      // Recargar pedido
      const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedido.id))
      if (pedidoDoc.exists()) {
        setPedido({ id: pedidoDoc.id, ...pedidoDoc.data() } as Pedido)
      }
    }
  }

  const handleGenerarRemito = async (
    productosDisponibles: EnlacePublico["productosDisponibles"]
  ) => {
    if (!pedido) return
    
    setProductosDisponiblesPendientes(productosDisponibles)
    setMostrarFirmaDialog(true)
  }

  const handleConfirmarFirma = async (firma: { nombre: string; firma?: string }) => {
    if (!pedido || !productosDisponiblesPendientes || !db) return

    try {
      // Crear datos del remito
      const remitoData = crearRemitoEnvioDesdeDisponibles(
        pedido,
        productos,
        productosDisponiblesPendientes
      )

      if (!remitoData.productos || remitoData.productos.length === 0) {
        throw new Error("No hay productos para enviar")
      }

      // Generar número de remito
      const numeroRemito = await generarNumeroRemito(db, COLLECTIONS, pedido.nombre)

      // Crear remito con firma
      const remitoParaGuardar = {
        ...remitoData,
        numero: numeroRemito,
        firmaEnvio: firma,
        createdAt: serverTimestamp(),
      }

      const remitoRef = await addDoc(collection(db, COLLECTIONS.REMITOS), remitoParaGuardar)

      // Actualizar pedido: estado "enviado", fechaEnvio, y vincular remito
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedido.id), {
        estado: "enviado",
        remitoEnvioId: remitoRef.id,
        fechaEnvio: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Desactivar enlace público si existe
      if (enlacePublico) {
        await updateDoc(doc(db, COLLECTIONS.ENLACES_PUBLICOS, enlacePublico.id), {
          activo: false,
        })
      }

      setMostrarFirmaDialog(false)
      
      // Redirigir a la lista de pedidos
      router.push("/dashboard/fabrica")
    } catch (error: any) {
      logger.error("Error al generar remito:", error)
      alert(`Error al generar el remito: ${error?.message || "Error desconocido"}`)
    }
  }

  if (loadingData) {
    return (
      <DashboardLayout user={user}>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !pedido) {
    return (
      <DashboardLayout user={user}>
        <div className="flex min-h-[400px] items-center justify-center">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">{error || "El pedido no existe"}</p>
              <Button onClick={() => router.push("/dashboard/fabrica")} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  const estaAsignado = pedido.estado === "processing" && pedido.assignedTo
  const esMiPedido = pedido.assignedTo === user?.uid
  const puedeGenerarRemito = pedido.estado === "processing" && esMiPedido

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/fabrica")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{pedido.nombre}</h1>
            <p className="text-muted-foreground mt-1">
              {nombreEmpresa || "Empresa"}
            </p>
          </div>
        </div>

        {estaAsignado && !esMiPedido && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Pedido ya asignado</AlertTitle>
            <AlertDescription>
              Este pedido ya fue tomado por: <strong>{pedido.assignedToNombre || "otro usuario"}</strong> - Fábrica
            </AlertDescription>
          </Alert>
        )}

        {estaAsignado && esMiPedido && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Pedido en proceso</AlertTitle>
            <AlertDescription>
              Este pedido está siendo procesado por ti. Puedes generar el remito cuando esté listo.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Productos solicitados</CardTitle>
            <CardDescription>
              Marca los productos disponibles y especifica las cantidades a enviar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FabricaPedidoForm
              productos={productos}
              enlacePublico={enlacePublico ?? undefined}
              onGenerarRemito={handleGenerarRemito}
              pedido={pedido}
              puedeGenerarRemito={puedeGenerarRemito}
            />
          </CardContent>
        </Card>

        {pedido.estado === "creado" || !pedido.estado ? (
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={handleAceptarPedido}
                disabled={aceptandoPedido || estaAsignado}
                className="w-full"
                size="lg"
              >
                {aceptandoPedido ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aceptando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aceptar pedido
                  </>
                )}
              </Button>
              {estaAsignado && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Este pedido ya fue tomado por otro usuario
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {mostrarFirmaDialog && productosDisponiblesPendientes && (
          <FirmaRemitoDialog
            open={mostrarFirmaDialog}
            onOpenChange={setMostrarFirmaDialog}
            onConfirm={handleConfirmarFirma}
            nombrePedido={pedido.nombre}
            productos={productos}
            productosDisponibles={productosDisponiblesPendientes}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

