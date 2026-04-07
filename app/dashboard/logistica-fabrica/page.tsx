"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
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
import { useToast } from "@/hooks/use-toast"
import { canUser } from "@/lib/permissions"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { PedidoFabrica, RemitoLogItem } from "@/lib/logistica-types"
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"
import { ChevronDown, ChevronRight, Factory, Loader2, Truck } from "lucide-react"

// ─── helpers ─────────────────────────────────────────────────────────────────

const HOY = new Date().getDay() // 0=domingo … 6=sábado

function buildAutoPedido(
  grupoId: string,
  grupoNombre: string,
  despachadorLocationId: string,
  despachadorNombre: string,
  stockFilas: StockUbicacion[]
): PedidoFabrica | null {
  const items = stockFilas
    .filter((f) => f.grupoCatalogoId === grupoId && f.stockMinimo > 0 && f.stockActual < f.stockMinimo)
    .map((f) => ({
      productoId: f.catalogoId,
      productoNombre: f.nombre,
      cantidadSugerida: f.stockMinimo - f.stockActual,
      cantidadPedida: f.stockMinimo - f.stockActual,
    }))
  if (items.length === 0) return null
  return {
    id: `auto_${grupoId}`,
    ownerId: "",
    origenLocationId: "",
    origenNombre: "Automático",
    destinoLocationId: despachadorLocationId,
    destinoNombre: despachadorNombre,
    grupoPedidoId: grupoId,
    grupoPedidoNombre: grupoNombre,
    estado: "enviado",
    esPendiente: false,
    controlado: false,
    items,
    creadoEn: null,
    creadoPor: "",
    creadoPorEmail: "",
    actualizadoEn: null,
  }
}

// ─── pedido row ───────────────────────────────────────────────────────────────

function PedidoRow({
  pedido,
  abierto,
  cantSend,
  comentSend,
  obsRemito,
  procesando,
  onToggle,
  onCantChange,
  onComentChange,
  onObsChange,
  onDespachar,
}: {
  pedido: PedidoFabrica
  abierto: boolean
  cantSend: Record<string, number>
  comentSend: Record<string, string>
  obsRemito: string
  procesando: boolean
  onToggle: () => void
  onCantChange: (productoId: string, val: number) => void
  onComentChange: (productoId: string, val: string) => void
  onObsChange: (val: string) => void
  onDespachar: () => void
}) {
  const esControlado = pedido.controlado === true
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
        onClick={onToggle}
      >
        {abierto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="font-medium flex-1">{pedido.origenNombre || pedido.grupoPedidoNombre}</span>
        {esControlado ? (
          <Badge variant="default" className="text-xs">✅ Controlado</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">⚠️ Automático</Badge>
        )}
        {pedido.esPendiente && <Badge variant="outline" className="text-xs">PENDIENTE</Badge>}
      </button>
      {abierto && (
        <div className="border-t border-border px-3 py-3 space-y-4">
          {pedido.items.map((it) => (
            <div key={it.productoId} className="grid gap-2 sm:grid-cols-2">
              <div>
                <div className="font-medium text-sm">{it.productoNombre}</div>
                <div className="text-xs text-muted-foreground">Pedido: {it.cantidadPedida}</div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Cantidad a enviar</Label>
                <Input
                  type="number"
                  min={0}
                  value={cantSend[it.productoId] ?? it.cantidadPedida}
                  onChange={(e) =>
                    onCantChange(it.productoId, Math.max(0, Math.floor(Number(e.target.value) || 0)))
                  }
                />
                <Input
                  placeholder="Comentario (opcional)"
                  value={comentSend[it.productoId] ?? ""}
                  onChange={(e) => onComentChange(it.productoId, e.target.value)}
                />
              </div>
            </div>
          ))}
          <div>
            <Label className="text-xs">Observación del remito</Label>
            <Textarea rows={2} value={obsRemito} onChange={(e) => onObsChange(e.target.value)} />
          </div>
          <Button onClick={onDespachar} disabled={procesando}>
            {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear remito y despachar
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function LogisticaFabricaPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const { pedidosRaw, remitosRaw, crearRemito, marcarEnCamino, loading, ownerId } = useLogistica(user)
  const { gruposCatalogo } = useGruposCatalogo(ownerId)

  const puede = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "ver_admin"),
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
        (p) => p.grupoPedidoId === grupo.id && p.estado === "enviado"
      )
      const hayControlado = pedidosGrupo.some((p) => p.controlado === true)
      const autoPedido = hayControlado
        ? null
        : buildAutoPedido(
            grupo.id,
            grupo.nombre,
            despachadorLocationId,
            userData?.locationId ?? "",
            stockFilas
          )
      return { grupo, pedidos: pedidosGrupo, autoPedido }
    })
  }, [gruposVisibles, pedidosRaw, stockFilas, despachadorLocationId, userData?.locationId])

  // ── despachar state ────────────────────────────────────────────────────────
  const [abierto, setAbierto] = useState<string | null>(null)
  const [cantSend, setCantSend] = useState<Record<string, Record<string, number>>>({})
  const [comentSend, setComentSend] = useState<Record<string, Record<string, string>>>({})
  const [obsRemito, setObsRemito] = useState<Record<string, string>>({})
  const [procesando, setProcesando] = useState<string | null>(null)

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
      origenNombre: pedido.destinoNombre,
      destinoLocationId: pedido.origenLocationId,
      destinoNombre: pedido.origenNombre,
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
            <TabsTrigger value="pedidos">Pedidos de hoy</TabsTrigger>
            <TabsTrigger value="activos">Remitos activos</TabsTrigger>
          </TabsList>

          {/* ── tab pedidos de hoy ── */}
          <TabsContent value="pedidos" className="space-y-4 mt-4">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando…
              </div>
            )}
            {!loading && gruposVisibles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay grupos asignados a tu despacho para hoy.
              </p>
            )}
            {pedidosDeHoy.map(({ grupo, pedidos, autoPedido }) => {
              const todosLosPedidos: PedidoFabrica[] = [
                ...pedidos,
                ...(autoPedido ? [autoPedido] : []),
              ]
              return (
                <Card key={grupo.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{grupo.nombre}</CardTitle>
                    <CardDescription>
                      {pedidos.length === 0
                        ? "Sin pedidos confirmados — mostrando pedido automático"
                        : `${pedidos.length} pedido(s)`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {todosLosPedidos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sin pedidos ni diferencias de stock para este grupo.
                      </p>
                    ) : (
                      todosLosPedidos.map((p) => (
                        <PedidoRow
                          key={p.id}
                          pedido={p}
                          abierto={abierto === p.id}
                          cantSend={cantSend[p.id] ?? {}}
                          comentSend={comentSend[p.id] ?? {}}
                          obsRemito={obsRemito[p.id] ?? ""}
                          procesando={procesando === p.id}
                          onToggle={() => togglePedido(p)}
                          onCantChange={(pid, val) =>
                            setCantSend((s) => ({ ...s, [p.id]: { ...(s[p.id] ?? {}), [pid]: val } }))
                          }
                          onComentChange={(pid, val) =>
                            setComentSend((s) => ({ ...s, [p.id]: { ...(s[p.id] ?? {}), [pid]: val } }))
                          }
                          onObsChange={(val) => setObsRemito((s) => ({ ...s, [p.id]: val }))}
                          onDespachar={() => void despachar(p)}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          {/* ── tab remitos activos (sin cambios) ── */}
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
