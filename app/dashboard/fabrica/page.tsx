"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/contexts/data-context"
import { useFabricaPedidos } from "@/hooks/use-fabrica-pedidos"
import { Package, Loader2, Clock, CheckCircle2, FileText, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, addDoc } from "firebase/firestore"
import type { Pedido, Producto, EnlacePublico, Configuracion, Remito } from "@/lib/types"
import { FabricaPedidoForm } from "@/components/fabrica/pedido-form"
import { FirmaRemitoDialog } from "@/components/fabrica/firma-remito-dialog"
import { generarNumeroRemito, crearRemitoEnvioDesdeDisponibles } from "@/lib/remito-utils"
import { useRemitos } from "@/hooks/use-remitos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { logger } from "@/lib/logger"
type FiltroEstado = "todos" | "pendientes" | "en-proceso"

interface PedidoExpandido {
  pedidoId: string
  productos: Producto[]
  enlacePublico?: EnlacePublico
  nombreEmpresa: string
  loading: boolean
}

export default function FabricaPage() {
  const { user } = useData()
  const router = useRouter()
  const { pedidos, loading, obtenerUsuarioAsignado, usuariosMap, tieneGrupos, userIdsDelGrupo, sucursalesDelGrupo, aceptarPedido } = useFabricaPedidos(user)
  const { crearRemito } = useRemitos(user)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos")
  const [pedidoExpandido, setPedidoExpandido] = useState<string | null>(null)
  const pedidoExpandidoRef = useRef<string | null>(null) // Ref para mantener el pedido expandido durante actualizaciones
  const [pedidosExpandidos, setPedidosExpandidos] = useState<Record<string, PedidoExpandido>>({})
  const [mostrarFirmaDialog, setMostrarFirmaDialog] = useState(false)
  const [productosDisponiblesPendientes, setProductosDisponiblesPendientes] = useState<EnlacePublico["productosDisponibles"] | null>(null)
  const [aceptandoPedido, setAceptandoPedido] = useState<string | null>(null)

  // Sincronizar el ref con el estado
  useEffect(() => {
    pedidoExpandidoRef.current = pedidoExpandido
  }, [pedidoExpandido])

  // Mantener el desplegable abierto cuando los pedidos se actualizan desde el listener
  useEffect(() => {
    const pedidoIdExpandido = pedidoExpandidoRef.current
    if (pedidoIdExpandido) {
      // Verificar que el pedido expandido aún existe en la lista
      const pedidoExiste = pedidos.some(p => p.id === pedidoIdExpandido)
      if (!pedidoExiste && pedidos.length > 0) {
        // Si el pedido ya no existe, cerrar el desplegable
        setPedidoExpandido(null)
        pedidoExpandidoRef.current = null
      } else if (pedidoExiste) {
        // SIEMPRE forzar la actualización del estado para mantener el desplegable abierto
        // Esto es crítico cuando los pedidos se actualizan desde el listener
        setPedidoExpandido(prev => {
          // Si el estado actual no coincide con el ref, actualizarlo
          if (prev !== pedidoIdExpandido) {
            return pedidoIdExpandido
          }
          return prev
        })
        
        // Si el pedido existe pero no tiene datos expandidos, cargarlos
        const datosExpandidos = pedidosExpandidos[pedidoIdExpandido]
        if (!datosExpandidos) {
          const pedido = pedidos.find(p => p.id === pedidoIdExpandido)
          if (pedido) {
            cargarDatosPedido(pedido)
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos])

  // Filtrar pedidos según el filtro seleccionado
  const pedidosFiltrados = useMemo(() => {
    if (filtroEstado === "todos") return pedidos
    if (filtroEstado === "pendientes") {
      return pedidos.filter(p => p.estado === "creado" || !p.estado)
    }
    if (filtroEstado === "en-proceso") {
      return pedidos.filter(p => p.estado === "processing")
    }
    return pedidos
  }, [pedidos, filtroEstado])

  // Obtener nombre de la sucursal
  const obtenerNombreSucursal = (pedido: any) => {
    const usuario = usuariosMap[pedido.ownerId]
    return usuario?.displayName || usuario?.email?.split("@")[0] || "Sucursal desconocida"
  }

  // Formatear fecha
  const formatearFecha = (timestamp: any) => {
    if (!timestamp) return "Sin fecha"
    try {
      const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return format(fecha, "dd/MM/yyyy HH:mm", { locale: es })
    } catch {
      return "Fecha inválida"
    }
  }

  // Cargar datos del pedido cuando se expande
  const cargarDatosPedido = async (pedido: Pedido) => {
    if (!db || pedidosExpandidos[pedido.id]) return

    setPedidosExpandidos(prev => ({
      ...prev,
      [pedido.id]: {
        pedidoId: pedido.id,
        productos: [],
        nombreEmpresa: "",
        loading: true,
      }
    }))

    try {
      // Obtener configuración para nombre de empresa
      let nombreEmpresa = "Empresa"
      if (pedido.ownerId) {
        try {
          const configDoc = await getDoc(doc(db, COLLECTIONS.CONFIG, pedido.ownerId))
          if (configDoc.exists()) {
            const config = configDoc.data() as Configuracion
            nombreEmpresa = config.nombreEmpresa || "Empresa"
          }
        } catch (err) {
          logger.error("Error al cargar configuración:", err)
        }
      }

      // Buscar enlace público (activo o inactivo si el pedido está en proceso)
      // Solo para mostrar información del enlace, no para productos
      const enlacesQuery = pedido.estado === "processing"
        ? query(
            collection(db, COLLECTIONS.ENLACES_PUBLICOS),
            where("pedidoId", "==", pedido.id)
          )
        : query(
            collection(db, COLLECTIONS.ENLACES_PUBLICOS),
            where("pedidoId", "==", pedido.id),
            where("activo", "==", true)
          )
      const enlacesSnapshot = await getDocs(enlacesQuery)
      
      let enlacePublico: EnlacePublico | undefined
      if (!enlacesSnapshot.empty) {
        enlacePublico = { id: enlacesSnapshot.docs[0].id, ...enlacesSnapshot.docs[0].data() } as EnlacePublico
      }

      // SIEMPRE leer productos dinámicamente para tener la versión más actualizada
      // El snapshot puede estar desactualizado si se agregaron productos después de crear el enlace
      const productosQuery = query(
        collection(db, COLLECTIONS.PRODUCTS),
        where("pedidoId", "==", pedido.id),
        where("ownerId", "==", pedido.ownerId)
      )
      const productosSnapshot = await getDocs(productosQuery)
      const productos = productosSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Producto[]
      productos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

      setPedidosExpandidos(prev => ({
        ...prev,
        [pedido.id]: {
          pedidoId: pedido.id,
          productos,
          enlacePublico,
          nombreEmpresa,
          loading: false,
        }
      }))
    } catch (err: any) {
      logger.error("Error al cargar datos del pedido:", err)
      setPedidosExpandidos(prev => ({
        ...prev,
        [pedido.id]: {
          pedidoId: pedido.id,
          productos: [],
          nombreEmpresa: "Empresa",
          loading: false,
        }
      }))
    }
  }

  // Toggle expandir/colapsar pedido
  const togglePedido = (pedido: Pedido) => {
    if (pedidoExpandido === pedido.id) {
      setPedidoExpandido(null)
      pedidoExpandidoRef.current = null
    } else {
      setPedidoExpandido(pedido.id)
      pedidoExpandidoRef.current = pedido.id
      cargarDatosPedido(pedido)
    }
  }

  // Manejar aceptar pedido
  const handleAceptarPedido = async (pedido: Pedido, e?: React.MouseEvent) => {
    // Prevenir que el evento se propague y cierre el desplegable
    e?.stopPropagation()
    e?.preventDefault()
    
    const pedidoId = pedido.id
    setAceptandoPedido(pedidoId)
    
    // Asegurarse de que el desplegable permanezca abierto ANTES de aceptar
    setPedidoExpandido(pedidoId)
    pedidoExpandidoRef.current = pedidoId
    
    const exito = await aceptarPedido(pedidoId)
    setAceptandoPedido(null)
    
    if (exito) {
      // Mantener el desplegable abierto explícitamente después de aceptar
      setPedidoExpandido(pedidoId)
      pedidoExpandidoRef.current = pedidoId
      
      // Limpiar datos expandidos para forzar recarga con nuevo estado
      setPedidosExpandidos(prev => {
        const nuevo = { ...prev }
        delete nuevo[pedidoId]
        return nuevo
      })
      
      // El useEffect se encargará de recargar los datos cuando los pedidos se actualicen
      // Solo necesitamos asegurarnos de que el desplegable permanezca abierto
    }
  }

  // Manejar generar remito
  const handleGenerarRemito = async (
    pedido: Pedido,
    productosDisponibles: EnlacePublico["productosDisponibles"]
  ) => {
    setProductosDisponiblesPendientes(productosDisponibles)
    setMostrarFirmaDialog(true)
  }

  // Confirmar firma y generar remito
  const handleConfirmarFirma = async (firma: { nombre: string; firma?: string }) => {
    if (!pedidoExpandido || !productosDisponiblesPendientes || !db) return

    const pedido = pedidos.find(p => p.id === pedidoExpandido)
    if (!pedido) return

    const datosExpandidos = pedidosExpandidos[pedidoExpandido]
    if (!datosExpandidos) return

    try {
      // Convertir array a Record (incluir observaciones)
      const productosDisponiblesRecord = productosDisponiblesPendientes.reduce((acc, item) => {
        acc[item.productoId] = {
          disponible: item.disponible,
          cantidadEnviada: item.cantidadEnviar,
          observaciones: item.observaciones,
        }
        return acc
      }, {} as Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string }>)

      // Crear datos del remito
      const remitoData = crearRemitoEnvioDesdeDisponibles(
        pedido,
        datosExpandidos.productos,
        productosDisponiblesRecord
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
      if (datosExpandidos.enlacePublico) {
        await updateDoc(doc(db, COLLECTIONS.ENLACES_PUBLICOS, datosExpandidos.enlacePublico.id), {
          activo: false,
        })
      }

      setMostrarFirmaDialog(false)
      setPedidoExpandido(null)
    } catch (error: any) {
      logger.error("Error al generar remito:", error)
      alert(`Error al generar el remito: ${error?.message || "Error desconocido"}`)
    }
  }

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-2 sm:space-y-3 px-1 sm:px-0">
        {/* Header - Mobile-first */}
        <div className="flex flex-col gap-2 sm:gap-0">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold">Panel de Fábrica</h1>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => router.push("/dashboard/fabrica/historial")}
            >
              <FileText className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Historial de Remitos</span>
              <span className="sm:hidden">Historial</span>
            </Button>
          </div>
          <div className="text-sm sm:text-base text-muted-foreground">
            <span>Gestiona los pedidos de: </span>
            {sucursalesDelGrupo.length > 0 ? (
              <span className="inline-flex flex-wrap gap-1.5 sm:gap-2 items-center">
                {sucursalesDelGrupo.map((sucursal) => (
                  <Badge key={sucursal.userId} variant="outline" className="text-xs">
                    {sucursal.nombreEmpresa}
                  </Badge>
                ))}
              </span>
            ) : (
              <span>las sucursales de tu grupo</span>
            )}
          </div>
        </div>

        {/* Tabs - Scrollable en móvil */}
        <Tabs value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as FiltroEstado)}>
          <div className="overflow-x-auto -mx-1 sm:mx-0 scrollbar-none">
            <div className="inline-block min-w-full sm:min-w-0 px-1 sm:px-0">
              <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
                <TabsTrigger value="todos" className="text-xs sm:text-sm">
                  Todos ({pedidos.length})
                </TabsTrigger>
                <TabsTrigger value="pendientes" className="text-xs sm:text-sm">
                  Pendientes ({pedidos.filter(p => p.estado === "creado" || !p.estado).length})
                </TabsTrigger>
                <TabsTrigger value="en-proceso" className="text-xs sm:text-sm">
                  En proceso ({pedidos.filter(p => p.estado === "processing").length})
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value={filtroEstado} className="mt-1 sm:mt-2">
            {pedidosFiltrados.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
                  <Package className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  {!tieneGrupos ? (
                    <>
                      <p className="text-sm sm:text-base text-muted-foreground text-center font-medium mb-2">
                        No tienes grupos asignados
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground text-center">
                        Contacta al administrador para que te asigne a un grupo con sucursales.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm sm:text-base text-muted-foreground text-center">
                        No hay pedidos {filtroEstado === "pendientes" ? "pendientes" : filtroEstado === "en-proceso" ? "en proceso" : ""}
                      </p>
                      {userIdsDelGrupo.length === 0 && (
                        <p className="text-xs sm:text-sm text-muted-foreground text-center mt-2">
                          No hay sucursales en tus grupos asignados.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {pedidosFiltrados.map((pedido) => {
                  const usuarioAsignado = obtenerUsuarioAsignado(pedido)
                  const nombreSucursal = obtenerNombreSucursal(pedido)
                  const estaAsignado = !!(pedido.estado === "processing" && pedido.assignedTo)
                  const esMiPedido = pedido.assignedTo === user?.uid
                  const puedeGenerarRemito = pedido.estado === "processing" && esMiPedido
                  const estaExpandido = pedidoExpandido === pedido.id
                  const datosExpandidos = pedidosExpandidos[pedido.id]
                  const estaAceptando = aceptandoPedido === pedido.id

                  const cantidadProductos = datosExpandidos?.productos?.length || null
                  const nombreEmpresaExpandida = datosExpandidos?.nombreEmpresa || nombreSucursal

                  return (
                    <Card key={pedido.id} className="hover:shadow-md transition-shadow p-0 gap-0">
                      <CardHeader 
                        className="pb-2 cursor-pointer px-0 pt-0 gap-0"
                        onClick={() => togglePedido(pedido)}
                      >
                        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 pt-3 sm:pt-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-sm sm:text-base font-semibold truncate">{pedido.nombre}</CardTitle>
                              {estaExpandido ? (
                                <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="truncate">{nombreEmpresaExpandida}</span>
                              {cantidadProductos !== null && (
                                <>
                                  <span>•</span>
                                  <span>{cantidadProductos} {cantidadProductos === 1 ? 'artículo' : 'artículos'}</span>
                                </>
                              )}
                              {estaAsignado && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary font-medium">
                                    {pedido.assignedToNombre || usuarioAsignado?.displayName || "Usuario"}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge
                              variant={
                                pedido.estado === "processing"
                                  ? "default"
                                  : pedido.estado === "creado" || !pedido.estado
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {pedido.estado === "processing"
                                ? "En proceso"
                                : pedido.estado === "creado" || !pedido.estado
                                ? "Pendiente"
                                : pedido.estado || "Sin estado"}
                            </Badge>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>{formatearFecha(pedido.createdAt).split(' ')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 pb-0 px-0">

                        {/* Contenido expandido */}
                        {estaExpandido && (
                          <div className="pt-2 border-t space-y-3 px-3 sm:px-4 pb-3 sm:pb-4">
                            {datosExpandidos?.loading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              </div>
                            ) : datosExpandidos ? (
                              <>
                                {estaAsignado && !esMiPedido && (
                                  <Alert variant="destructive" className="text-sm">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <AlertTitle className="text-sm">Pedido ya asignado</AlertTitle>
                                    <AlertDescription className="text-xs sm:text-sm">
                                      Este pedido ya fue tomado por: <strong>{pedido.assignedToNombre || "otro usuario"}</strong> - Fábrica
                                    </AlertDescription>
                                  </Alert>
                                )}

                                {estaAsignado && esMiPedido && (
                                  <Alert className="text-sm">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    <AlertTitle className="text-sm">Pedido en proceso</AlertTitle>
                                    <AlertDescription className="text-xs sm:text-sm">
                                      Este pedido está siendo procesado por ti. Puedes generar el remito cuando esté listo.
                                    </AlertDescription>
                                  </Alert>
                                )}

                                <div>
                                  <h4 className="text-sm font-semibold mb-2">Productos solicitados</h4>
                                  <FabricaPedidoForm
                                    productos={datosExpandidos.productos}
                                    enlacePublico={datosExpandidos.enlacePublico}
                                    onGenerarRemito={(productosDisponibles) => handleGenerarRemito(pedido, productosDisponibles)}
                                    pedido={pedido}
                                    puedeGenerarRemito={puedeGenerarRemito}
                                  />
                                </div>

                                {pedido.estado === "creado" || !pedido.estado ? (
                                  <Button
                                    onClick={(e) => handleAceptarPedido(pedido, e)}
                                    disabled={!!estaAceptando || estaAsignado}
                                    className="w-full"
                                    size="lg"
                                  >
                                    {estaAceptando ? (
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
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de firma de remito */}
      {mostrarFirmaDialog && productosDisponiblesPendientes && pedidoExpandido && (
        <FirmaRemitoDialog
          open={!!mostrarFirmaDialog}
          onOpenChange={(open) => setMostrarFirmaDialog(open)}
          onConfirm={handleConfirmarFirma}
          nombrePedido={pedidos.find(p => p.id === pedidoExpandido)?.nombre || "Pedido"}
          productos={pedidosExpandidos[pedidoExpandido]?.productos || []}
          productosDisponibles={productosDisponiblesPendientes}
        />
      )}
    </DashboardLayout>
  )
}
