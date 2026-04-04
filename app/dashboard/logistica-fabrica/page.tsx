"use client"

import { useMemo, useState } from "react"
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
import { useToast } from "@/hooks/use-toast"
import { canUser } from "@/lib/permissions"
import type { PedidoFabrica, RemitoLogItem } from "@/lib/logistica-types"
import { ChevronDown, ChevronRight, Factory, Loader2, Truck } from "lucide-react"

export default function LogisticaFabricaPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const { pedidosRaw, remitosRaw, crearRemito, marcarEnCamino, loading, ownerId } = useLogistica(user)

  const puede = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "ver_admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const pedidosEnviados = useMemo(() => {
    const ts = (v: unknown) => {
      if (v && typeof v === "object" && "toMillis" in v && typeof (v as { toMillis: () => number }).toMillis === "function") {
        return (v as { toMillis: () => number }).toMillis()
      }
      return 0
    }
    return pedidosRaw
      .filter((p) => p.estado === "enviado")
      .sort((a, b) => ts(a.creadoEn) - ts(b.creadoEn))
  }, [pedidosRaw])

  const agrupados = useMemo(() => {
    const m = new Map<string, PedidoFabrica[]>()
    for (const p of pedidosEnviados) {
      const k = p.origenLocationId
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [pedidosEnviados])

  const [abierto, setAbierto] = useState<string | null>(null)
  const [cantSend, setCantSend] = useState<Record<string, Record<string, number>>>({})
  const [comentSend, setComentSend] = useState<Record<string, Record<string, string>>>({})
  const [obsRemito, setObsRemito] = useState<Record<string, string>>({})
  const [procesando, setProcesando] = useState<string | null>(null)

  const remitosEnCamino = useMemo(() => remitosRaw.filter((r) => r.estado === "en_camino"), [remitosRaw])
  const remitosPreparados = useMemo(() => remitosRaw.filter((r) => r.estado === "preparado"), [remitosRaw])

  const togglePedido = (id: string) => {
    setAbierto((prev) => (prev === id ? null : id))
    const pedido = pedidosRaw.find((p) => p.id === id)
    if (pedido && !cantSend[id]) {
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
    const cants = cantSend[pedido.id]
    const coments = comentSend[pedido.id] ?? {}
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
    setProcesando(pedido.id)
    const res = await crearRemito({
      origenLocationId: pedido.destinoLocationId,
      origenNombre: pedido.destinoNombre,
      destinoLocationId: pedido.origenLocationId,
      destinoNombre: pedido.origenNombre,
      pedidoFabricaId: pedido.id,
      items,
      observacion: obsRemito[pedido.id]?.trim() || undefined,
    })
    setProcesando(null)
    if (!res.ok) {
      toast({
        title: "No se pudo crear el remito",
        description: res.error,
        variant: "destructive",
      })
      return
    }
    toast({ title: "Remito creado", description: "Stock descontado en origen y pedido marcado como despachado." })
    setObsRemito((s) => ({ ...s, [pedido.id]: "" }))
  }

  const enCamino = async (remitoId: string) => {
    const res = await marcarEnCamino(remitoId)
    if (!res.ok) {
      toast({ title: "No se pudo actualizar", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: "Remito en camino" })
  }

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
            Despachá pedidos en estado enviado y seguí remitos activos. El remito sale del destino del pedido
            (proveedor) hacia quien pidió.
          </p>
        </div>

        <Tabs defaultValue="pedidos">
          <TabsList>
            <TabsTrigger value="pedidos">Pedidos enviados</TabsTrigger>
            <TabsTrigger value="activos">Remitos activos</TabsTrigger>
          </TabsList>

          <TabsContent value="pedidos" className="space-y-4 mt-4">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando…
              </div>
            )}
            {pedidosEnviados.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No hay pedidos en estado enviado.</p>
            )}
            {agrupados.map(([locId, lista]) => (
              <Card key={locId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{lista[0]?.origenNombre ?? locId}</CardTitle>
                  <CardDescription>{lista.length} pedido(s)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lista.map((p) => {
                    const open = abierto === p.id
                    return (
                      <div key={p.id} className="rounded-md border border-border">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                          onClick={() => togglePedido(p.id)}
                        >
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="font-medium">{p.grupoPedidoNombre}</span>
                          {p.esPendiente ? <Badge variant="secondary">PENDIENTE</Badge> : null}
                          <span className="text-muted-foreground ml-auto text-xs">
                            → {p.destinoNombre}
                          </span>
                        </button>
                        {open && (
                          <div className="border-t border-border px-3 py-3 space-y-4">
                            {p.items.map((it) => (
                              <div key={it.productoId} className="grid gap-2 sm:grid-cols-2">
                                <div>
                                  <div className="font-medium text-sm">{it.productoNombre}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Pedido: {it.cantidadPedida}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Label className="text-xs">Cantidad a enviar</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={cantSend[p.id]?.[it.productoId] ?? it.cantidadPedida}
                                    onChange={(e) =>
                                      setCantSend((s) => ({
                                        ...s,
                                        [p.id]: {
                                          ...(s[p.id] ?? {}),
                                          [it.productoId]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                                        },
                                      }))
                                    }
                                  />
                                  <Input
                                    placeholder="Comentario (opcional)"
                                    value={comentSend[p.id]?.[it.productoId] ?? ""}
                                    onChange={(e) =>
                                      setComentSend((s) => ({
                                        ...s,
                                        [p.id]: {
                                          ...(s[p.id] ?? {}),
                                          [it.productoId]: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                              </div>
                            ))}
                            <div>
                              <Label className="text-xs">Observación del remito</Label>
                              <Textarea
                                rows={2}
                                value={obsRemito[p.id] ?? ""}
                                onChange={(e) =>
                                  setObsRemito((s) => ({ ...s, [p.id]: e.target.value }))
                                }
                              />
                            </div>
                            <Button
                              onClick={() => void despachar(p)}
                              disabled={procesando === p.id}
                            >
                              {procesando === p.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Crear remito y despachar
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

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
                      <span className="font-mono">{r.numero}</span> · {r.destinoNombre} · {r.items.length}{" "}
                      ítem(s)
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
