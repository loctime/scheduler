"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/contexts/data-context"
import { usePedidos } from "@/hooks/use-pedidos"
import { useLogistica } from "@/hooks/use-logistica"
import { useToast } from "@/hooks/use-toast"
import { db, COLLECTIONS } from "@/lib/firebase"
import { canUser } from "@/lib/permissions"
import { getPedidoSugeridoUnits, type PedidoEngineProduct } from "@/lib/pedido-engine"
import type { PedidoFabricaItem } from "@/lib/logistica-types"
import type { Producto } from "@/lib/types"
import { Loader2, Package } from "lucide-react"

type PuntoDestino = { locationId: string; nombre: string }

function productToEngine(p: Producto): PedidoEngineProduct {
  return {
    id: p.id,
    nombre: p.nombre,
    unidad: p.unidad,
    unidadBase: p.unidadBase,
    modoCompra: p.modoCompra,
    cantidadPorPack: p.cantidadPorPack,
    stockMinimo: p.stockMinimo,
    stockMinimoUnits: p.stockMinimoUnits,
  }
}

export default function PedirLogisticaPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const {
    pedidos,
    products,
    selectedPedido,
    setSelectedPedido,
    loading: pedidosLoading,
    stockActual,
  } = usePedidos(user)

  const { pedidosPropios, crearPedidoFabrica, loading: logLoading, ownerId } = useLogistica(user)

  const [puntos, setPuntos] = useState<PuntoDestino[]>([])
  const [destinoId, setDestinoId] = useState<string>("")
  const [observacion, setObservacion] = useState("")
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [enviando, setEnviando] = useState(false)
  const [cargandoPuntos, setCargandoPuntos] = useState(true)

  const puede = useMemo(
    () =>
      canUser(
        { uid: user?.uid, role: userData?.role, locationId: userData?.locationId },
        "crear_pedido"
      ) && (userData?.role === "operador" || userData?.role === "admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const origenLocationId = userData?.locationId ?? user?.uid ?? ""
  const origenNombre =
    userData?.displayName?.trim() || user?.displayName?.trim() || user?.email?.trim() || "Mi sucursal"

  const pendientes = useMemo(
    () =>
      pedidosPropios.filter((p) => p.esPendiente && p.estado === "enviado"),
    [pedidosPropios]
  )

  const lineasSugeridas = useMemo(() => {
    if (!selectedPedido) return []
    const out: Array<{ producto: Producto; sugerido: number }> = []
    for (const p of products) {
      const stock = Math.max(0, Math.floor(stockActual[p.id] ?? p.stockActualUnits ?? 0))
      const sugerido = getPedidoSugeridoUnits(productToEngine(p), stock)
      if (sugerido > 0) out.push({ producto: p, sugerido })
    }
    return out
  }, [products, stockActual, selectedPedido])

  useEffect(() => {
    const next: Record<string, number> = {}
    for (const { producto, sugerido } of lineasSugeridas) {
      next[producto.id] = sugerido
    }
    setCantidades(next)
  }, [lineasSugeridas])

  const cargarPuntos = useCallback(async () => {
    if (!db || !ownerId) {
      setPuntos([])
      setCargandoPuntos(false)
      return
    }
    setCargandoPuntos(true)
    try {
      let docs = (await getDocs(query(collection(db, COLLECTIONS.USERS), where("ownerId", "==", ownerId)))).docs
      if (docs.length === 0) {
        const all = await getDocs(collection(db, COLLECTIONS.USERS))
        docs = all.docs.filter((d) => {
          const u = d.data() as Record<string, unknown>
          const oid = u.ownerId as string | undefined
          return oid === ownerId || d.id === ownerId
        })
      }
      const map = new Map<string, string>()
      docs.forEach((d) => {
        const u = d.data() as Record<string, unknown>
        const lid = String(u.locationId ?? u.location ?? d.id)
        const nombre = String(u.displayName ?? u.email ?? lid)
        if (!map.has(lid)) map.set(lid, nombre)
      })
      const list: PuntoDestino[] = [...map.entries()].map(([locationId, nombre]) => ({
        locationId,
        nombre,
      }))
      const fabrica: PuntoDestino = {
        locationId: ownerId,
        nombre: "Depósito central (fábrica)",
      }
      const merged = [fabrica, ...list.filter((p) => p.locationId !== fabrica.locationId)]
      merged.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setPuntos(merged)
      setDestinoId((prev) => prev || merged.find((p) => p.locationId !== origenLocationId)?.locationId || merged[0]?.locationId || "")
    } catch {
      setPuntos([
        { locationId: ownerId, nombre: "Depósito central (fábrica)" },
      ])
      setDestinoId(ownerId)
    } finally {
      setCargandoPuntos(false)
    }
  }, [ownerId, origenLocationId])

  useEffect(() => {
    void cargarPuntos()
  }, [cargarPuntos])

  const destino = puntos.find((p) => p.locationId === destinoId)

  const enviar = async () => {
    if (!selectedPedido || !destino) {
      toast({ title: "Faltan datos", description: "Elegí grupo y destino.", variant: "destructive" })
      return
    }
    if (destino.locationId === origenLocationId) {
      toast({
        title: "Destino inválido",
        description: "El destino debe ser distinto de tu sucursal.",
        variant: "destructive",
      })
      return
    }
    const items: PedidoFabricaItem[] = []
    for (const { producto, sugerido } of lineasSugeridas) {
      const pedida = Math.max(0, Math.floor(cantidades[producto.id] ?? sugerido))
      if (pedida <= 0) continue
      items.push({
        productoId: producto.id,
        productoNombre: producto.nombre,
        cantidadSugerida: sugerido,
        cantidadPedida: pedida,
      })
    }
    if (!items.length) {
      toast({
        title: "Sin ítems",
        description: "No hay cantidades a pedir o todas están en cero.",
        variant: "destructive",
      })
      return
    }
    setEnviando(true)
    const res = await crearPedidoFabrica({
      origenLocationId,
      origenNombre,
      destinoLocationId: destino.locationId,
      destinoNombre: destino.nombre,
      grupoPedidoId: selectedPedido.id,
      grupoPedidoNombre: selectedPedido.nombre,
      items,
      observacion: observacion.trim() || undefined,
    })
    setEnviando(false)
    if (!res.ok) {
      toast({ title: "No se pudo enviar", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: "Pedido enviado", description: "El destino verá el pedido en su panel." })
    setObservacion("")
  }

  if (!puede) {
    return (
      <DashboardLayout user={user}>
        <Card>
          <CardHeader>
            <CardTitle>Pedir insumos</CardTitle>
            <CardDescription>No tenés permiso para usar esta pantalla.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  const loading = pedidosLoading || logLoading || cargandoPuntos

  return (
    <DashboardLayout user={user}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7" />
            Pedir insumos
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Armá pedidos internos a la fábrica u otras sucursales según faltantes de stock.
          </p>
        </div>

        {pendientes.length > 0 && (
          <Card className="border-amber-500/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Pendientes por faltantes
                <Badge variant="secondary">PENDIENTE</Badge>
              </CardTitle>
              <CardDescription>
                Generados automáticamente cuando una recepción no coincidió con lo enviado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendientes.map((p) => (
                <div
                  key={p.id}
                  className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="font-medium">{p.grupoPedidoNombre}</div>
                  <div className="text-muted-foreground">
                    Hacia {p.destinoNombre} · {p.items.length} ítem(s)
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Nuevo pedido</CardTitle>
            <CardDescription>Grupo de productos y destino</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </div>
            )}
            <div className="grid gap-2">
              <Label>Grupo</Label>
              <Select
                value={selectedPedido?.id ?? ""}
                onValueChange={(id) => {
                  const p = pedidos.find((x) => x.id === id)
                  if (p) setSelectedPedido(p)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí un grupo" />
                </SelectTrigger>
                <SelectContent>
                  {pedidos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Destino</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="¿A quién le pedís?" />
                </SelectTrigger>
                <SelectContent>
                  {puntos
                    .filter((p) => p.locationId !== origenLocationId)
                    .map((p) => (
                      <SelectItem key={p.locationId} value={p.locationId}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Observación (opcional)</Label>
              <Textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos con faltante</CardTitle>
            <CardDescription>
              Solo aparecen líneas con sugerencia &gt; 0. Podés ajustar las cantidades.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedPedido && (
              <p className="text-sm text-muted-foreground">Elegí un grupo para ver productos.</p>
            )}
            {selectedPedido && lineasSugeridas.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay faltantes sugeridos en este grupo.</p>
            )}
            {lineasSugeridas.map(({ producto, sugerido }) => (
              <div
                key={producto.id}
                className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{producto.nombre}</div>
                  <div className="text-xs text-muted-foreground">Sugerido: {sugerido}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="whitespace-nowrap text-xs">Cantidad</Label>
                  <Input
                    type="number"
                    min={0}
                    className="w-28"
                    value={cantidades[producto.id] ?? sugerido}
                    onChange={(e) =>
                      setCantidades((prev) => ({
                        ...prev,
                        [producto.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      }))
                    }
                  />
                </div>
              </div>
            ))}
            <Button onClick={() => void enviar()} disabled={enviando || !selectedPedido || !destinoId}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enviar pedido
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
