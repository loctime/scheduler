"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { useGruposCatalogo } from "@/hooks/use-grupos-catalogo"
import { useUbicacionesCatalogo } from "@/hooks/use-ubicaciones-catalogo"
import { useToast } from "@/hooks/use-toast"
import { canUser } from "@/lib/permissions"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { PedidoFabrica, RemitoLogItem } from "@/lib/logistica-types"
import { PedidosHoyView } from "@/components/logistica/pedidos-hoy-view"
import { PedidosHistorialView } from "@/components/logistica/pedidos-historial-view"
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"
import { ChevronDown, ChevronRight, Factory, Loader2, Truck } from "lucide-react"

// Cambio 1 - Estado de vista
type VistaType = "tarjetas" | "tabla"

// Cambio 2 - Componente OperarioCardView (vista tarjetas)
function OperarioCardView({
  pedido,
  cantSend,
  comentSend,
  obsRemito,
  procesando,
  onAceptar,
  aceptando,
  onCantChange,
  onComentChange,
  onObsChange,
  onDespachar,
  onTomarPedido,
}: {
  pedido: PedidoFabrica
  cantSend: Record<string, number>
  comentSend: Record<string, string>
  obsRemito: string
  procesando: boolean
  onAceptar?: () => void
  aceptando?: boolean
  onCantChange: (productoId: string, val: number) => void
  onComentChange: (productoId: string, val: string) => void
  onObsChange: (val: string) => void
  onDespachar: () => void
  onTomarPedido: () => void
}) {
  const [expandido, setExpandido] = useState(false)
  const esControlado = pedido.controlado === true
  const esAuto = pedido.id.startsWith("auto_")
  const sinConfirmar = esAuto && typeof onAceptar === "function"

  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{pedido.origenNombre}</h4>
        <div className="flex items-center gap-2">
          {pedido.estado === "en_preparacion" && (
            <Badge className="bg-blue-50 text-blue-800 border border-blue-200">En preparación</Badge>
          )}
          {sinConfirmar ? (
            <Badge className="bg-yellow-50 text-yellow-800 border border-yellow-200">Sin confirmar</Badge>
          ) : esControlado ? (
            <Badge className="bg-green-50 text-green-800 border border-green-200">Controlado</Badge>
          ) : (
            <Badge className="bg-amber-50 text-amber-800 border border-amber-200">Automático</Badge>
          )}
        </div>
      </div>

      {/* Lista de items como pills */}
      <div className="flex flex-wrap gap-1">
        {pedido.items.map((item) => (
          <span
            key={item.productoId}
            className="inline-block px-2 py-1 text-xs bg-background border rounded-md"
          >
            {item.productoNombre} × {item.cantidadPedida}
          </span>
        ))}
      </div>

      {/* Botón Tomar pedido */}
      {!esAuto && pedido.estado === "enviado" && (
        <Button
          onClick={onTomarPedido}
          variant="outline"
          size="sm"
          className="w-full"
        >
          Tomar pedido
        </Button>
      )}

      {sinConfirmar && onAceptar && (
        <Button onClick={onAceptar} disabled={aceptando === true} variant="outline" size="sm" className="w-full">
          {aceptando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Aceptar como está
        </Button>
      )}

      {/* Botón de despachar */}
      {!sinConfirmar && (
        <Button onClick={() => setExpandido(!expandido)} variant="outline" size="sm" className="w-full">
          {expandido ? "Cancelar" : "Despachar"}
        </Button>
      )}

      {/* Contenido expandido */}
      {!sinConfirmar && expandido && (
        <div className="space-y-3 pt-3 border-t">
          {pedido.items.map((item) => (
            <div key={item.productoId} className="space-y-2">
              <div className="text-sm font-medium">{item.productoNombre}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Cantidad a enviar</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cantSend[item.productoId] ?? item.cantidadPedida}
                    onChange={(e) =>
                      onCantChange(item.productoId, Math.max(0, Math.floor(Number(e.target.value) || 0)))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Comentario</Label>
                  <Input
                    placeholder="Opcional"
                    value={comentSend[item.productoId] ?? ""}
                    onChange={(e) => onComentChange(item.productoId, e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <div>
            <Label className="text-xs">Observación del remito</Label>
            <Textarea
              rows={2}
              value={obsRemito}
              onChange={(e) => onObsChange(e.target.value)}
              placeholder="Observaciones del remito..."
            />
          </div>

          <Button onClick={onDespachar} disabled={procesando} className="w-full">
            {procesando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Crear remito y despachar
          </Button>
        </div>
      )}
    </div>
  )
}

// Cambio 2 - Componente GrupoTablaView (vista tabla)
function GrupoTablaView({ pedidos }: { pedidos: PedidoFabrica[] }) {
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

  if (pedidos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin pedidos para mostrar</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left p-2 border bg-muted">Producto</th>
            {pedidos.map((pedido) => (
              <th key={pedido.id} className="text-left p-2 border bg-muted min-w-[120px]">
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
            <th className="text-left p-2 border bg-muted font-semibold text-blue-600">Total</th>
          </tr>
        </thead>
        <tbody>
          {todosProductos.map(({ id, nombre }) => (
            <tr key={id}>
              <td className="p-2 border font-medium">{nombre}</td>
              {pedidos.map((pedido) => {
                const item = pedido.items.find((i) => i.productoId === id)
                return (
                  <td key={pedido.id} className="p-2 border text-center">
                    {item ? item.cantidadPedida : " - "}
                  </td>
                )
              })}
              <td className="p-2 border text-center font-semibold text-blue-600">
                {totalesPorProducto[id]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  // Cambio 1 - Estado de vista
  const [vista, setVista] = useState<VistaType>("tarjetas")
  
  const { user, userData } = useData()
  const { toast } = useToast()
  const { pedidosRaw, remitosRaw, crearRemito, marcarEnCamino, tomarPedido, loading, ownerId } = useLogistica(user)
  const { gruposCatalogo } = useGruposCatalogo(ownerId)
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
      const despachadorNombre = nombrePorLocationId.get(despachadorLocationId) ?? despachadorLocationId
      const autoPedidos = buildAutoPedidosPorOperador(
        grupo.id,
        grupo.nombre,
        despachadorLocationId,
        despachadorNombre,
        stockFilas,
        [...pedidosGrupo, ...pedidosGestionados],
        nombrePorLocationId
      )
      return { grupo, pedidos: pedidosGrupo, autoPedidos }
    })
  }, [gruposVisibles, pedidosRaw, stockFilas, despachadorLocationId, nombrePorLocationId])

  // ── despachar state ────────────────────────────────────────────────────────
  const [abierto, setAbierto] = useState<string | null>(null)
  const [cantSend, setCantSend] = useState<Record<string, Record<string, number>>>({})
  const [comentSend, setComentSend] = useState<Record<string, Record<string, string>>>({})
  const [obsRemito, setObsRemito] = useState<Record<string, string>>({})
  const [procesando, setProcesando] = useState<string | null>(null)
  const [aceptando, setAceptando] = useState<string | null>(null)

  const togglePedido = (pedido: PedidoFabrica) => {
    const id = pedido.id
    setAbierto((prev) => (prev === id ? null : id))
    if (!cantSend[id]) {
      const c: Record<string, number> = {}
      const cm: Record<string, string> = {}
      for (const it of pedido.items) {
        c[it.productoId] = it.cantidadPedida
        cm[it.productoId] = ""
      }
      setCantSend((s) => ({ ...s, [id]: c }))
      setComentSend((s) => ({ ...s, [id]: cm }))
    }
  }

  const despachar = async (pedido: PedidoFabrica) => {
    const id = pedido.id
    const cants = cantSend[id]
    const coments = comentSend[id] ?? {}
    if (!cants) {
      toast({ title: "Abrí el pedido primero", variant: "destructive" })
      return
    }
    const items: RemitoLogItem[] = []
    for (const it of pedido.items) {
      const env = Math.max(0, Math.floor(cants[it.productoId] ?? it.cantidadPedida))
      if (env <= 0) continue
      const com = coments[it.productoId]?.trim()
      items.push({
        productoId: it.productoId,
        productoNombre: it.productoNombre,
        cantidadPedida: it.cantidadPedida,
        cantidadEnviada: env,
        ...(com ? { comentario: com } : {}),
      })
    }
    if (!items.length) {
      toast({
        title: "Sin cantidades",
        description: "Indicá al menos una cantidad a enviar mayor a cero.",
        variant: "destructive",
      })
      return
    }
    const esAuto = id.startsWith("auto_")
    setProcesando(id)
    const res = await crearRemito({
      origenLocationId: pedido.destinoLocationId,
      origenNombre: nombrePorLocationId.get(pedido.destinoLocationId) ?? pedido.destinoNombre,
      destinoLocationId: pedido.origenLocationId,
      destinoNombre: nombrePorLocationId.get(pedido.origenLocationId) ?? pedido.origenNombre,
      ...(esAuto ? {} : { pedidoFabricaId: id }),
      items,
      observacion: obsRemito[id]?.trim() || undefined,
    })
    setProcesando(null)
    if (!res.ok) {
      toast({ title: "No se pudo crear el remito", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: "Remito creado", description: "Stock descontado en origen y pedido marcado como despachado." })
    setObsRemito((s) => ({ ...s, [id]: "" }))
  }

  const aceptarAutoPedido = async (pedido: PedidoFabrica) => {
    if (!db || !ownerId || !user) return
    setAceptando(pedido.id)
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
    } finally {
      setAceptando(null)
    }
  }

  // ── remitos ────────────────────────────────────────────────────────────────
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
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Factory className="h-7 w-7" />
            Fábrica — pedidos internos
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Despachá pedidos del día y seguí remitos activos.
          </p>
        </div>

        <Tabs defaultValue="pedidos">
          <TabsList>
            <TabsTrigger value="hoy">Hoy</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos de hoy</TabsTrigger>
            <TabsTrigger value="activos">Remitos activos</TabsTrigger>
          </TabsList>

          <TabsContent value="hoy" className="mt-4">
            <PedidosHoyView pedidos={pedidosRaw} />
          </TabsContent>

          <TabsContent value="historial" className="mt-4">
            <PedidosHistorialView pedidos={pedidosRaw} />
          </TabsContent>

          {/* Tab pedidos de hoy - NUEVA ESTRUCTURA */}
          <TabsContent value="pedidos" className="space-y-4 mt-4">
            {/* Header con toggle de vista */}
            <div className="flex items-center justify-between">
              <div>
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
              </div>
              
              {/* Toggle de vista */}
              <div className="flex gap-1">
                <Button
                  variant={vista === "tarjetas" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVista("tarjetas")}
                >
                  Tarjetas
                </Button>
                <Button
                  variant={vista === "tabla" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVista("tabla")}
                >
                  Tabla
                </Button>
              </div>
            </div>

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
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{grupo.nombre}</CardTitle>
                          <CardDescription>
                            {pedidos.length === 0 && autoPedidos.length === 0
                              ? "Sin pedidos ni diferencias de stock"
                              : pedidos.length === 0
                              ? `${autoPedidos.length} sin confirmar`
                              : `${pedidos.length} confirmado(s)${autoPedidos.length > 0 ? ` · ${autoPedidos.length} sin confirmar` : ""}`}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Días: {formatDiasEnvio(grupo.diasEnvio)}
                          </span>
                          {estaAbierto ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {/* Cuerpo del grupo */}
                  {estaAbierto && (
                    <CardContent className="space-y-4">
                      {todosLosPedidos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Sin pedidos ni diferencias de stock
                        </p>
                      ) : vista === "tarjetas" ? (
                        // Vista tarjetas
                        <div className="grid gap-3">
                          {todosLosPedidos.map((pedido) => (
                            <OperarioCardView
                              key={pedido.id}
                              pedido={pedido}
                              cantSend={cantSend[pedido.id] ?? {}}
                              comentSend={comentSend[pedido.id] ?? {}}
                              obsRemito={obsRemito[pedido.id] ?? ""}
                              procesando={procesando === pedido.id}
                              onCantChange={(productoId: string, val: number) =>
                                setCantSend((s) => ({ ...s, [pedido.id]: { ...(s[pedido.id] ?? {}), [productoId]: val } }))
                              }
                              onComentChange={(productoId: string, val: string) =>
                                setComentSend((s) => ({ ...s, [pedido.id]: { ...(s[pedido.id] ?? {}), [productoId]: val } }))
                              }
                              onObsChange={(val: string) => setObsRemito((s) => ({ ...s, [pedido.id]: val }))}
                              onDespachar={() => void despachar(pedido)}
                              onTomarPedido={() => void tomarPedido(pedido.id).then(res => {
                                if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" })
                                else toast({ title: "Pedido tomado", description: "El pedido está en preparación." })
                              })}
                              onAceptar={pedido.id.startsWith("auto_") ? () => void aceptarAutoPedido(pedido) : undefined}
                              aceptando={aceptando === pedido.id}
                            />
                          ))}
                        </div>
                      ) : (
                        // Vista tabla
                        <GrupoTablaView pedidos={todosLosPedidos} />
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
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
