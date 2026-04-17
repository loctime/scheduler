"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { useGruposCatalogo } from "@/hooks/use-grupos-catalogo"
import { useUbicacionesCatalogo } from "@/hooks/use-ubicaciones-catalogo"
import { useToast } from "@/hooks/use-toast"
import { canUser } from "@/lib/permissions"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { PedidoFabrica, RemitoLogItem } from "@/lib/logistica-types"
import { PedidosHistorialView } from "@/components/logistica/pedidos-historial-view"
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"
import { ChevronDown, ChevronRight, Factory, Loader2, Truck } from "lucide-react"

// Componente GrupoTablaView con nueva funcionalidad
function GrupoTablaView({ 
  pedidos, 
  onTomarPedido,
  modoDespacho,
  cantidadesDespacho,
  onCantidadDespachoChange,
  onDespachar,
  grupoId,
  dialogAbierto,
  setDialogAbierto,
  opcionSeleccionada,
  setOpcionSeleccionada,
  sucursalesSeleccionadas,
  setSucursalesSeleccionadas
}: {
  pedidos: PedidoFabrica[]
  onTomarPedido: (grupoId: string, pedidos: PedidoFabrica[]) => void
  modoDespacho: boolean
  cantidadesDespacho: Record<string, number>
  onCantidadDespachoChange: (productoId: string, sucursalId: string, cantidad: number) => void
  onDespachar: (grupoId: string, pedidos: PedidoFabrica[], sucursalesAFiltrar?: string[]) => void
  grupoId: string
  dialogAbierto: boolean
  setDialogAbierto: (open: boolean) => void
  opcionSeleccionada: string
  setOpcionSeleccionada: (value: string) => void
  sucursalesSeleccionadas: string[]
  setSucursalesSeleccionadas: (sucursales: string[]) => void
}) {
  // Estados locales para el diálogo de despachar
  const [dialogDespacharAbierto, setDialogDespacharAbierto] = useState(false)
  const [opcionDespacharSeleccionada, setOpcionDespacharSeleccionada] = useState("todos")
  const [sucursalesDespacharSeleccionadas, setSucursalesDespacharSeleccionadas] = useState<string[]>([])

  // Recolectar todos los productos únicos
  const todosProductos = useMemo(() => {
    const productosMap = new Map<string, string>()
    pedidos.forEach((pedido) => {
      pedido.items.forEach((item) => {
        if (!productosMap.has(item.productoId)) {
          productosMap.set(item.productoId, item.productoNombre)
        }
      })
    })
    return Array.from(productosMap.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [pedidos])

  // Calcular totales por fila
  const totalesPorProducto = useMemo(() => {
    const totales: Record<string, number> = {}
    todosProductos.forEach(({ id }) => {
      totales[id] = 0
      pedidos.forEach((pedido) => {
        const item = pedido.items.find((i) => i.productoId === id)
        if (item) {
          totales[id] += item.cantidadPedida
        }
      })
    })
    return totales
  }, [todosProductos, pedidos])

  // Calcular totales de despacho
  const totalesDespachoPorProducto = useMemo(() => {
    const totales: Record<string, number> = {}
    todosProductos.forEach(({ id }) => {
      totales[id] = 0
      pedidos.forEach((pedido) => {
        const item = pedido.items.find((i) => i.productoId === id)
        if (item) {
          const cantidad = cantidadesDespacho[`${id}_${pedido.id}`] || 0
          totales[id] += cantidad
        }
      })
    })
    return totales
  }, [todosProductos, pedidos, cantidadesDespacho])

  // Función para completar cantidades de un producto
  const completarCantidadesProducto = (productoId: string) => {
    pedidos.forEach((pedido) => {
      const item = pedido.items.find((i) => i.productoId === productoId)
      if (item) {
        onCantidadDespachoChange(productoId, pedido.id, item.cantidadPedida)
      }
    })
  }

  if (pedidos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin pedidos para mostrar</p>
  }

  return (
    <div className="space-y-4">
      {/* Diálogo para tomar pedidos */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tomar pedido del grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={opcionSeleccionada} onValueChange={setOpcionSeleccionada}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="todos" id="todos" />
                <label htmlFor="todos">Todos</label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="confirmados" id="confirmados" />
                <label htmlFor="confirmados">Solo confirmados</label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <label htmlFor="manual">Manual</label>
              </div>
            </RadioGroup>
            
            {opcionSeleccionada === "manual" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Seleccionar sucursales:</p>
                {pedidos.map((pedido) => {
                  const esAuto = pedido.id.startsWith("auto_")
                  return (
                    <div 
                      key={pedido.id} 
                      className={`flex items-center space-x-2 p-2 rounded ${esAuto ? "bg-amber-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        id={pedido.id}
                        checked={sucursalesSeleccionadas.includes(pedido.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSucursalesSeleccionadas([...sucursalesSeleccionadas, pedido.id])
                          } else {
                            setSucursalesSeleccionadas(sucursalesSeleccionadas.filter(id => id !== pedido.id))
                          }
                        }}
                      />
                      <label htmlFor={pedido.id} className="text-sm">
                        {pedido.origenNombre} {esAuto && "(automático)"}
                      </label>
                    </div>
                  )
                })}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogAbierto(false)}>
                Cancelar
              </Button>
              <Button onClick={() => onTomarPedido(grupoId, pedidos)}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para despachar */}
      <Dialog open={dialogDespacharAbierto} onOpenChange={setDialogDespacharAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Despachar pedidos del grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={opcionDespacharSeleccionada} onValueChange={setOpcionDespacharSeleccionada}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="todos" id="despachar-todos" />
                <label htmlFor="despachar-todos">Todos</label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="despachar-manual" />
                <label htmlFor="despachar-manual">Manual</label>
              </div>
            </RadioGroup>
            
            {opcionDespacharSeleccionada === "manual" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Seleccionar sucursales:</p>
                {pedidos.map((pedido) => {
                  const esAuto = pedido.id.startsWith("auto_")
                  return (
                    <div 
                      key={pedido.id} 
                      className={`flex items-center space-x-2 p-2 rounded ${esAuto ? "bg-amber-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        id={`despachar-${pedido.id}`}
                        checked={sucursalesDespacharSeleccionadas.includes(pedido.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSucursalesDespacharSeleccionadas([...sucursalesDespacharSeleccionadas, pedido.id])
                          } else {
                            setSucursalesDespacharSeleccionadas(sucursalesDespacharSeleccionadas.filter(id => id !== pedido.id))
                          }
                        }}
                      />
                      <label htmlFor={`despachar-${pedido.id}`} className="text-sm">
                        {pedido.origenNombre} {esAuto && "(automático)"}
                      </label>
                    </div>
                  )
                })}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogDespacharAbierto(false)}>
                Cancelar
              </Button>
              <Button onClick={() => {
                // Determinar sucursales a despachar según la opción seleccionada
                let sucursalesParaDespacho: string[] = []
                if (opcionDespacharSeleccionada === "todos") {
                  sucursalesParaDespacho = pedidos.map(p => p.id)
                } else if (opcionDespacharSeleccionada === "manual") {
                  sucursalesParaDespacho = sucursalesDespacharSeleccionadas
                }
                
                // Llamar a handleDespacharGrupo con las sucursales seleccionadas
                onDespachar(grupoId, pedidos, sucursalesParaDespacho)
                setDialogDespacharAbierto(false)
              }}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-2 py-1.5 border bg-muted">Producto</th>
              {pedidos.map((pedido) => (
                <th key={pedido.id} className="text-left px-2 py-1.5 border bg-muted min-w-[120px]">
                  <div className="flex flex-col gap-1">
                    <span>{pedido.origenNombre}</span>
                    {pedido.controlado ? (
                      <Badge className="bg-green-50 text-green-800 border border-green-200 text-xs">
                        Controlado
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-xs">
                        Automático
                      </Badge>
                    )}
                  </div>
                </th>
              ))}
              <th className="text-left px-2 py-1.5 border bg-muted font-semibold text-blue-600">
                <div className="flex items-center gap-2">
                  <span>Total</span>
                  {!modoDespacho ? (
                    <Button
                      size="sm"
                      onClick={() => setDialogAbierto(true)}
                      className="h-6 px-2 text-xs"
                    >
                      Tomar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setDialogDespacharAbierto(true)}
                      className="h-6 px-2 text-xs"
                    >
                      Despachar
                    </Button>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {todosProductos.map(({ id, nombre }) => (
              <tr key={id} className={modoDespacho ? "bg-muted/50" : ""}>
                <td className="px-2 py-1.5 border font-medium">
                  <div className="flex items-center gap-2">
                    <span>{nombre}</span>
                    {modoDespacho && (
                      <Button
                        size="sm"
                        onClick={() => completarCantidadesProducto(id)}
                        className="h-5 px-1 text-xs"
                        variant="outline"
                      >
                        OK
                      </Button>
                    )}
                  </div>
                </td>
                {pedidos.map((pedido) => {
                  const item = pedido.items.find((i) => i.productoId === id)
                  if (!item) {
                    return (
                      <td key={pedido.id} className="px-2 py-1.5 border text-center">
                        -
                      </td>
                    )
                  }

                  if (modoDespacho) {
                    // Modo despacho: mostrar pedido + input
                    const cantidad = cantidadesDespacho[`${id}_${pedido.id}`] || 0
                    const esMenor = cantidad < item.cantidadPedida
                    const esMayorOIgual = cantidad >= item.cantidadPedida
                    
                    return (
                      <td key={pedido.id} className="px-2 py-1.5 border">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{item.cantidadPedida}</span>
                          <Input
                            type="number"
                            min={0}
                            value={cantidad}
                            onChange={(e) => onCantidadDespachoChange(id, pedido.id, Math.max(0, Number(e.target.value) || 0))}
                            className={`w-20 h-6 text-xs ${
                              esMenor ? "border-red-500 focus:border-red-500" : 
                              esMayorOIgual ? "border-green-500 focus:border-green-500" : 
                              ""
                            }`}
                          />
                        </div>
                      </td>
                    )
                  } else {
                    // Modo normal: solo mostrar cantidad
                    return (
                      <td key={pedido.id} className="px-2 py-1.5 border text-center">
                        {item.cantidadPedida}
                      </td>
                    )
                  }
                })}
                <td className="px-2 py-1.5 border text-center font-semibold">
                  <span className={modoDespacho ? "text-green-600" : "text-blue-600"}>
                    {modoDespacho ? totalesDespachoPorProducto[id] : totalesPorProducto[id]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const HOY = new Date().getDay() // 0=domingo ... 6=sábado

// ─── main page ────────────────────────────────────────────────────────────────

// Helper para formatear días de envío
const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

function formatDiasEnvio(dias?: number[]): string {
  if (!dias || dias.length === 0) return "No definidos"
  return dias.map(d => DIAS_SEMANA[d]).join(", ")
}

function buildAutoPedidosPorOperador(
  grupoPedidoId: string,
  grupoPedidoNombre: string,
  destinoLocationId: string,
  destinoNombre: string,
  stockFilas: StockUbicacion[],
  pedidosGrupo: PedidoFabrica[],
  nombrePorLocationId: Map<string, string>
): PedidoFabrica[] {
  const pedidoCantidadByOrigenProducto = new Map<string, number>()
  for (const p of pedidosGrupo) {
    const origenId = p.origenLocationId
    for (const it of p.items) {
      const k = `${origenId}::${it.productoId}`
      pedidoCantidadByOrigenProducto.set(k, (pedidoCantidadByOrigenProducto.get(k) ?? 0) + (it.cantidadPedida ?? 0))
    }
  }

  const itemsByOrigen = new Map<string, PedidoFabrica["items"]>()
  for (const fila of stockFilas) {
    if (fila.grupoCatalogoId !== grupoPedidoId) continue
    const faltante = Math.max(0, Math.floor((fila.stockMinimo ?? 0) - (fila.stockActual ?? 0)))
    if (faltante <= 0) continue

    const origenLocationId = fila.locationId
    const k = `${origenLocationId}::${fila.catalogoId}`
    const yaPedido = pedidoCantidadByOrigenProducto.get(k) ?? 0
    const cantidad = Math.max(0, faltante - yaPedido)
    if (cantidad <= 0) continue

    const list = itemsByOrigen.get(origenLocationId) ?? []
    list.push({
      productoId: fila.catalogoId,
      productoNombre: fila.nombre,
      cantidadSugerida: cantidad,
      cantidadPedida: cantidad,
    })
    itemsByOrigen.set(origenLocationId, list)
  }

  const out: PedidoFabrica[] = []
  itemsByOrigen.forEach((items, origenLocationId) => {
    if (!items.length) return
    out.push({
      id: `auto_${grupoPedidoId}_${origenLocationId}`,
      ownerId: "",
      origenLocationId,
      origenNombre: nombrePorLocationId.get(origenLocationId) ?? origenLocationId,
      destinoLocationId,
      destinoNombre,
      grupoPedidoId,
      grupoPedidoNombre,
      estado: "enviado",
      esPendiente: false,
      controlado: false,
      items,
      creadoEn: null,
      creadoPor: "",
      creadoPorEmail: "",
      actualizadoEn: null,
    })
  })

  out.sort((a, b) => a.origenNombre.localeCompare(b.origenNombre))
  return out
}

export default function LogisticaFabricaPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const { pedidosRaw, remitosRaw, crearRemito, marcarEnCamino, tomarPedido, loading, ownerId } = useLogistica(user)
  const { gruposCatalogo } = useGruposCatalogo(ownerId)
  
  // Estados para el modo despacho
  const [gruposEnModoDespacho, setGruposEnModoDespacho] = useState<Record<string, boolean>>({})
  const [cantidadesDespacho, setCantidadesDespacho] = useState<Record<string, Record<string, number>>>({})
  const [dialogTomarAbierto, setDialogTomarAbierto] = useState<string | null>(null)
  const [opcionTomarSeleccionada, setOpcionTomarSeleccionada] = useState<string>("todos")
  const [sucursalesSeleccionadas, setSucursalesSeleccionadas] = useState<string[]>([])
  const ownerIdsParaUsuarios = useMemo(() => {
    if (!ownerId) return null
    return [ownerId]
  }, [ownerId])

  const { ubicaciones } = useUbicacionesCatalogo(ownerIdsParaUsuarios)

  const nombrePorLocationId = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of ubicaciones) {
      m.set(u.locationId, u.locationName)
    }
    return m
  }, [ubicaciones])

  const puede = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "ver_logistica"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  // ── grupos visibles para este despachador hoy ──────────────────────────────
  const despachadorLocationId = userData?.locationId ?? ""

  const gruposVisibles = useMemo(() => {
    if (!despachadorLocationId) return []
    return gruposCatalogo.filter(
      (g) =>
        g.despachadores.some((d) => d.locationId === despachadorLocationId) &&
        (g.diasEnvio?.includes(HOY) ?? false)
    )
  }, [gruposCatalogo, despachadorLocationId])

  // DEBUG: Temporary console logs to identify which filter is failing
  console.log("despachadorLocationId:", despachadorLocationId)
  console.log("HOY:", HOY)
  console.log("detalle grupos:", gruposCatalogo.map(g => ({
    nombre: g.nombre,
    despachadores: g.despachadores,
    diasEnvio: g.diasEnvio,
    incluyeHoy: g.diasEnvio?.includes(HOY),
    matchDespachador: g.despachadores.some(d => d.locationId === despachadorLocationId)
  })))
  console.log("gruposVisibles:", gruposVisibles.length)

  const gruposVisiblesIds = useMemo(() => gruposVisibles.map((g) => g.id), [gruposVisibles])

  // ── stock de ubicaciones para grupos visibles ──────────────────────────────
  const [stockFilas, setStockFilas] = useState<StockUbicacion[]>([])
  // stable ref to avoid re-running effect on every render
  const gruposVisiblesIdsRef = useRef<string[]>([])
  const idsKey = gruposVisiblesIds.join(",")

  useEffect(() => {
    if (!db || !ownerId || gruposVisiblesIds.length === 0) {
      setStockFilas([])
      return
    }
    gruposVisiblesIdsRef.current = gruposVisiblesIds
    const q = query(
      collection(db, COLLECTIONS.STOCK_UBICACIONES),
      where("ownerId", "==", ownerId),
      where("grupoCatalogoId", "in", gruposVisiblesIds)
    )
    const unsub = onSnapshot(q, (snap) => {
      setStockFilas(
        snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>
          return {
            id: d.id,
            ownerId: String(x.ownerId ?? ""),
            catalogoId: String(x.catalogoId ?? ""),
            locationId: String(x.locationId ?? ""),
            nombre: String(x.nombre ?? ""),
            unidad: String(x.unidad ?? "U"),
            pedidoId: String(x.pedidoId ?? ""),
            stockActual: Math.max(0, Math.floor(Number(x.stockActual) || 0)),
            stockMinimo: typeof x.stockMinimo === "number" ? x.stockMinimo : 0,
            orden: typeof x.orden === "number" ? x.orden : 0,
            grupoCatalogoId: typeof x.grupoCatalogoId === "string" ? x.grupoCatalogoId : undefined,
            updatedBy: String(x.updatedBy ?? ""),
          }
        })
      )
    })
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, idsKey])

  // ── pedidos de hoy (por grupo) ─────────────────────────────────────────────
  const pedidosDeHoy = useMemo(() => {
    return gruposVisibles.map((grupo) => {
      const pedidosGrupo = pedidosRaw.filter(
        (p) => p.grupoPedidoId === grupo.id && 
             (p.estado === "enviado" || p.estado === "en_preparacion")
      )
      const pedidosGestionados = pedidosRaw.filter(
        (p) => p.grupoPedidoId === grupo.id &&
             (p.estado === "despachado" || p.estado === "recibido")
      )
      // Borradores: la sucursal está editando. No se muestran, pero sí cuentan
      // en el cálculo de stock para evitar auto-pedidos fantasma durante la edición.
      const pedidosBorrador = pedidosRaw.filter(
        (p) => p.grupoPedidoId === grupo.id && p.estado === "borrador"
      )
      const despachadorNombre = nombrePorLocationId.get(despachadorLocationId) ?? despachadorLocationId
      const autoPedidos = buildAutoPedidosPorOperador(
        grupo.id,
        grupo.nombre,
        despachadorLocationId,
        despachadorNombre,
        stockFilas,
        [...pedidosGrupo, ...pedidosGestionados, ...pedidosBorrador],
        nombrePorLocationId
      )
      return { grupo, pedidos: pedidosGrupo, autoPedidos }
    })
  }, [gruposVisibles, pedidosRaw, stockFilas, despachadorLocationId, nombrePorLocationId])

  // Función para tomar pedidos
  const handleTomarPedidos = async (grupoId: string, pedidos: PedidoFabrica[]) => {
    let pedidosATomar: PedidoFabrica[] = []
    
    if (opcionTomarSeleccionada === "todos") {
      pedidosATomar = pedidos
    } else if (opcionTomarSeleccionada === "confirmados") {
      pedidosATomar = pedidos.filter(p => !p.id.startsWith("auto_"))
    } else if (opcionTomarSeleccionada === "manual") {
      pedidosATomar = pedidos.filter(p => sucursalesSeleccionadas.includes(p.id))
    }
    
    for (const pedido of pedidosATomar) {
      if (pedido.id.startsWith("auto_")) {
        // Registrar pedido automático primero
        await aceptarAutoPedido(pedido)
      }
      // Tomar el pedido
      const res = await tomarPedido(pedido.id)
      if (!res.ok) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
        return
      }
    }
    
    // Activar modo despacho para este grupo
    setGruposEnModoDespacho(prev => ({ ...prev, [grupoId]: true }))
    
    // Inicializar cantidades de despacho
    const cantidadesIniciales: Record<string, number> = {}
    pedidos.forEach(pedido => {
      pedido.items.forEach(item => {
        cantidadesIniciales[`${item.productoId}_${pedido.id}`] = 0
      })
    })
    setCantidadesDespacho(prev => ({ ...prev, [grupoId]: cantidadesIniciales }))
    
    setDialogTomarAbierto(null)
    toast({ title: "Pedidos tomados", description: "Los pedidos están en preparación." })
  }
  
  // Función para despachar grupo
  const handleDespacharGrupo = async (grupoId: string, pedidos: PedidoFabrica[], sucursalesAFiltrar?: string[]) => {
    const cantidadesGrupo = cantidadesDespacho[grupoId] || {}
    
    // Filtrar pedidos según selección
    const pedidosADespachar = sucursalesAFiltrar 
      ? pedidos.filter(p => sucursalesAFiltrar.includes(p.id))
      : pedidos
    
    // Agrupar por sucursal para crear remitos
    const remitosPorSucursal = new Map<string, any[]>()
    
    pedidosADespachar.forEach(pedido => {
      const itemsRemito: any[] = []
      pedido.items.forEach(item => {
        const cantidad = cantidadesGrupo[`${item.productoId}_${pedido.id}`] || 0
        if (cantidad > 0) {
          itemsRemito.push({
            productoId: item.productoId,
            productoNombre: item.productoNombre,
            cantidadPedida: item.cantidadPedida,
            cantidadEnviada: cantidad
          })
        }
      })
      
      if (itemsRemito.length > 0) {
        remitosPorSucursal.set(pedido.id, itemsRemito)
      }
    })
    
    // Crear remitos
    for (const [pedidoId, items] of remitosPorSucursal) {
      const pedido = pedidosADespachar.find(p => p.id === pedidoId)
      if (!pedido) continue
      
      const res = await crearRemito({
        origenLocationId: pedido.destinoLocationId,
        origenNombre: nombrePorLocationId.get(pedido.destinoLocationId) ?? pedido.destinoNombre,
        destinoLocationId: pedido.origenLocationId,
        destinoNombre: nombrePorLocationId.get(pedido.origenLocationId) ?? pedido.origenNombre,
        pedidoFabricaId: pedido.id.startsWith("auto_") ? undefined : pedidoId,
        items,
        observacion: undefined
      })
      
      if (!res.ok) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
        return
      }
    }
    
    // Salir del modo despacho
    setGruposEnModoDespacho(prev => ({ ...prev, [grupoId]: false }))
    toast({ title: "Remitos creados", description: "Stock descontado y pedidos despachados." })
  }


  // Función para aceptar pedidos automáticos
  const aceptarAutoPedido = async (pedido: PedidoFabrica) => {
    if (!db || !ownerId || !user) return
    try {
      await addDoc(collection(db, COLLECTIONS.PEDIDOS_FABRICA), {
        ownerId,
        origenLocationId: pedido.origenLocationId,
        origenNombre: pedido.origenNombre,
        destinoLocationId: pedido.destinoLocationId,
        destinoNombre: pedido.destinoNombre,
        grupoPedidoId: pedido.grupoPedidoId,
        grupoPedidoNombre: pedido.grupoPedidoNombre,
        estado: "enviado",
        esPendiente: false,
        controlado: false,
        items: pedido.items,
        creadoEn: serverTimestamp(),
        creadoPor: user.uid,
        creadoPorEmail: user.email ?? "",
        actualizadoEn: serverTimestamp(),
      })
      toast({ title: "Pedido aceptado", description: "El pedido automático fue registrado." })
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      })
    }
  }
  const remitosEnCamino = useMemo(() => remitosRaw.filter((r) => r.estado === "en_camino"), [remitosRaw])
  const remitosPreparados = useMemo(() => remitosRaw.filter((r) => r.estado === "preparado"), [remitosRaw])

  const enCamino = async (remitoId: string) => {
    const res = await marcarEnCamino(remitoId)
    if (!res.ok) {
      toast({ title: "No se pudo actualizar", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: "Remito en camino" })
  }

  // Estado para grupos colapsables
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({})

  const toggleGrupo = (grupoId: string) => {
    setGruposAbiertos((prev) => ({ ...prev, [grupoId]: !prev[grupoId] }))
  }

  // Inicializar grupos abiertos por defecto
  useEffect(() => {
    const inicial: Record<string, boolean> = {}
    gruposVisibles.forEach((grupo) => {
      if (!(grupo.id in gruposAbiertos)) {
        inicial[grupo.id] = true
      }
    })
    if (Object.keys(inicial).length > 0) {
      setGruposAbiertos(prev => ({ ...prev, ...inicial }))
    }
  }, [gruposVisibles])

  // ── render ─────────────────────────────────────────────────────────────────
  if (!puede) {
    return (
      <DashboardLayout user={user}>
        <Card>
          <CardHeader>
            <CardTitle>Fábrica — logística interna</CardTitle>
            <CardDescription>Solo administradores pueden ver esta pantalla.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  console.log(
    "stockFilas:",
    stockFilas.length,
    stockFilas.map((f) => ({
      grupoCatalogoId: f.grupoCatalogoId,
      locationId: f.locationId,
      stockActual: f.stockActual,
      stockMinimo: f.stockMinimo,
    }))
  )
  console.log(
    "autoPedidos calculados:",
    pedidosDeHoy.map((p) => ({ grupo: p.grupo.nombre, auto: p.autoPedidos.length }))
  )

  return (
    <DashboardLayout user={user}>
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Fábrica — pedidos internos
          </h2>
          <span className="text-border select-none text-lg hidden sm:inline">|</span>
          <p className="text-muted-foreground text-sm">
            Despachá pedidos del día y seguí remitos activos.
          </p>
        </div>

        <Tabs defaultValue="hoy">
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="hoy">Hoy</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
              <TabsTrigger value="activos">Remitos activos</TabsTrigger>
            </TabsList>

          </div>

          <TabsContent value="hoy" className="space-y-3 mt-3">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando...
              </div>
            )}
            {!loading && gruposVisibles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay grupos asignados a tu despacho para hoy.
              </p>
            )}

            {/* Grupos colapsables */}
            {pedidosDeHoy.map(({ grupo, pedidos, autoPedidos }) => {
              const todosLosPedidos: PedidoFabrica[] = [
                ...pedidos,
                ...autoPedidos,
              ]
              const estaAbierto = gruposAbiertos[grupo.id] ?? true

              return (
                <Card key={grupo.id}>
                  {/* Header clickeable del grupo */}
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => toggleGrupo(grupo.id)}
                  >
                    <CardHeader className="py-2 px-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <CardTitle className="text-sm font-semibold shrink-0">{grupo.nombre}</CardTitle>
                        <CardDescription className="text-xs shrink-0">
                          {pedidos.length === 0 && autoPedidos.length === 0
                            ? "Sin pedidos"
                            : pedidos.length === 0
                            ? `${autoPedidos.length} sin confirmar`
                            : `${pedidos.length} confirmado(s)${autoPedidos.length > 0 ? ` · ${autoPedidos.length} sin confirmar` : ""}`}
                        </CardDescription>
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                          Días: {formatDiasEnvio(grupo.diasEnvio)}
                        </span>
                        {estaAbierto ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                  </button>

                  {/* Cuerpo del grupo */}
                  {estaAbierto && (
                    <CardContent className="space-y-3 px-4 pb-3 pt-0">
                      {todosLosPedidos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Sin pedidos ni diferencias de stock
                        </p>
                      ) : (
                        // Solo vista tabla
                        <GrupoTablaView 
                          pedidos={todosLosPedidos} 
                          onTomarPedido={handleTomarPedidos}
                          modoDespacho={gruposEnModoDespacho[grupo.id] || false}
                          cantidadesDespacho={cantidadesDespacho[grupo.id] || {}}
                          onCantidadDespachoChange={(productoId: string, sucursalId: string, cantidad: number) => {
                            setCantidadesDespacho(prev => ({
                              ...prev,
                              [grupo.id]: {
                                ...(prev[grupo.id] || {}),
                                [`${productoId}_${sucursalId}`]: cantidad
                              }
                            }))
                          }}
                          onDespachar={(grupoId: string, pedidos: PedidoFabrica[], sucursalesAFiltrar?: string[]) => handleDespacharGrupo(grupoId, pedidos, sucursalesAFiltrar)}
                          grupoId={grupo.id}
                          dialogAbierto={dialogTomarAbierto === grupo.id}
                          setDialogAbierto={(open) => setDialogTomarAbierto(open ? grupo.id : null)}
                          opcionSeleccionada={opcionTomarSeleccionada}
                          setOpcionSeleccionada={setOpcionTomarSeleccionada}
                          sucursalesSeleccionadas={sucursalesSeleccionadas}
                          setSucursalesSeleccionadas={setSucursalesSeleccionadas}
                        />
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="historial" className="mt-4">
            <PedidosHistorialView pedidos={pedidosRaw} />
          </TabsContent>

          {/* Tab remitos activos (sin cambios) */}
          <TabsContent value="activos" className="space-y-6 mt-4">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4" />
                En camino (repartidor)
              </h3>
              {remitosEnCamino.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay remitos en camino.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {remitosEnCamino.map((r) => (
                    <li key={r.id} className="rounded-md border border-border px-3 py-2">
                      <span className="font-mono">{r.numero}</span> · {r.destinoNombre} · {r.items.length} ítem(s)
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Preparados (marcar salida)</h3>
              {remitosPreparados.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay remitos preparados.</p>
              ) : (
                <ul className="space-y-2">
                  {remitosPreparados.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-sm">
                        <span className="font-mono font-medium">{r.numero}</span> → {r.destinoNombre}
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => void enCamino(r.id)}>
                        Marcar en camino
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
