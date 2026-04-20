"use client"

import { useRouter } from "next/navigation"
import { useState, useRef, useEffect, useMemo } from "react"
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { useGruposCatalogo } from "@/hooks/use-grupos-catalogo"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, Sparkles, Truck } from "lucide-react"
import type { PedidoFabrica } from "@/lib/logistica-types"
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"

const HOY = new Date().getDay() // 0=domingo … 6=sábado
const ESTADOS_ACTIVOS = new Set(["enviado", "en_preparacion", "despachado"])

// Same algorithm as buildAutoPedidosPorOperador in logistica-fabrica/page.tsx
function buildAutoPedidos(
  grupoPedidoId: string,
  grupoPedidoNombre: string,
  despachadorLocationId: string,
  despachadorNombre: string,
  stockFilas: StockUbicacion[],
  pedidosExistentes: PedidoFabrica[],
  nombrePorLocationId: Map<string, string>
): PedidoFabrica[] {
  const yaPedidoPorOrigenProducto = new Map<string, number>()
  for (const p of pedidosExistentes) {
    for (const it of p.items) {
      const k = `${p.origenLocationId}::${it.productoId}`
      yaPedidoPorOrigenProducto.set(k, (yaPedidoPorOrigenProducto.get(k) ?? 0) + (it.cantidadPedida ?? 0))
    }
  }

  const itemsByOrigen = new Map<string, PedidoFabrica["items"]>()
  for (const fila of stockFilas) {
    if (fila.grupoCatalogoId !== grupoPedidoId) continue
    const faltante = Math.max(0, Math.floor((fila.stockMinimo ?? 0) - (fila.stockActual ?? 0)))
    if (faltante <= 0) continue
    const k = `${fila.locationId}::${fila.catalogoId}`
    const cantidad = Math.max(0, faltante - (yaPedidoPorOrigenProducto.get(k) ?? 0))
    if (cantidad <= 0) continue
    const list = itemsByOrigen.get(fila.locationId) ?? []
    list.push({ productoId: fila.catalogoId, productoNombre: fila.nombre, cantidadSugerida: cantidad, cantidadPedida: cantidad })
    itemsByOrigen.set(fila.locationId, list)
  }

  const out: PedidoFabrica[] = []
  itemsByOrigen.forEach((items, origenLocationId) => {
    if (!items.length) return
    out.push({
      id: `auto_${grupoPedidoId}_${origenLocationId}`,
      ownerId: "",
      origenLocationId,
      origenNombre: nombrePorLocationId.get(origenLocationId) ?? origenLocationId,
      destinoLocationId: despachadorLocationId,
      destinoNombre: despachadorNombre,
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

export default function DespacharPage() {
  const router = useRouter()
  const { user, userData } = useData()
  const { toast } = useToast()

  const { pedidosRaw, pedidosParaMi, loading, locationId, ownerId, crearRemito, marcarEnCamino } = useLogistica(user)
  const { gruposCatalogo } = useGruposCatalogo(ownerId)

  const [despachando, setDespachando] = useState<string | null>(null)
  const [observaciones, setObservaciones] = useState<Record<string, string>>({})
  const [stockFilas, setStockFilas] = useState<StockUbicacion[]>([])
  const [nombrePorLocationId, setNombrePorLocationId] = useState<Map<string, string>>(new Map())

  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Groups where this factory user is a despachador AND today is a send day
  const gruposVisibles = useMemo(() => {
    if (!locationId) return []
    return gruposCatalogo.filter(
      (g) =>
        g.despachadores.some((d) => d.locationId === locationId) &&
        (g.diasEnvio?.includes(HOY) ?? false)
    )
  }, [gruposCatalogo, locationId])

  const idsKey = useMemo(() => gruposVisibles.map((g) => g.id).join(","), [gruposVisibles])

  // Real-time stock for visible groups (to calculate auto-pedidos)
  useEffect(() => {
    const gruposIds = gruposVisibles.map((g) => g.id)
    if (!db || !ownerId || gruposIds.length === 0) {
      setStockFilas([])
      return
    }
    const q = query(
      collection(db, COLLECTIONS.STOCK_UBICACIONES),
      where("ownerId", "==", ownerId),
      where("grupoCatalogoId", "in", gruposIds)
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
    // idsKey drives the effect, not the array reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, idsKey])

  // Location names (for auto-pedido origenNombre)
  useEffect(() => {
    if (!db || !ownerId) return
    const q = query(collection(db, COLLECTIONS.USERS), where("ownerId", "==", ownerId))
    const unsub = onSnapshot(q, (snap) => {
      const m = new Map<string, string>()
      for (const d of snap.docs) {
        const x = d.data() as Record<string, unknown>
        if (x.disabled === true) continue
        const name = typeof x.locationName === "string" ? x.locationName.trim() : ""
        if (!name) continue
        m.set(String(x.locationId ?? x.location ?? d.id), name)
      }
      setNombrePorLocationId(m)
    })
    return () => unsub()
  }, [ownerId])

  // Calculate auto-pedidos from stock minimums
  const autoPedidos = useMemo(() => {
    if (!locationId || gruposVisibles.length === 0 || stockFilas.length === 0) return []
    const despachadorNombre = userData?.locationName ?? locationId
    const result: PedidoFabrica[] = []
    for (const grupo of gruposVisibles) {
      const pedidosGrupo = pedidosRaw.filter(
        (p) => p.grupoPedidoId === grupo.id && p.estado !== "cancelado"
      )
      result.push(...buildAutoPedidos(
        grupo.id, grupo.nombre,
        locationId, despachadorNombre,
        stockFilas, pedidosGrupo, nombrePorLocationId
      ))
    }
    return result
  }, [gruposVisibles, stockFilas, pedidosRaw, locationId, userData?.locationName, nombrePorLocationId])

  // Real active pedidos for this despachador
  const pedidosActivos = useMemo(
    () => pedidosParaMi.filter((p) => ESTADOS_ACTIVOS.has(p.estado)),
    [pedidosParaMi]
  )
  const listos = pedidosActivos.filter((p) => p.estado === "enviado" || p.estado === "en_preparacion")
  const enCamino = pedidosActivos.filter((p) => p.estado === "despachado")

  const totalActivos = pedidosActivos.length + autoPedidos.length
  const totalDespachados = enCamino.length

  // Save a virtual auto-pedido to Firestore, return its new ID
  const materializarAutoPedido = async (pedido: PedidoFabrica): Promise<string | null> => {
    if (!db || !ownerId || !user) return null
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.PEDIDOS_FABRICA), {
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
        creadoPor: user.uid ?? "",
        creadoPorEmail: user.email ?? "",
        actualizadoEn: serverTimestamp(),
      })
      return ref.id
    } catch (e) {
      toast({
        title: "Error al registrar pedido automático",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      })
      return null
    }
  }

  const handleDespachar = async (pedido: PedidoFabrica) => {
    if (!locationId) {
      toast({ title: "Error", description: "Sin ubicación configurada", variant: "destructive" })
      return
    }

    const pedidoKey = pedido.id
    setDespachando(pedidoKey)

    // Virtual auto-pedidos must be saved to Firestore first
    let realPedidoId = pedidoKey
    if (pedidoKey.startsWith("auto_")) {
      const nuevoId = await materializarAutoPedido(pedido)
      if (!mountedRef.current) return
      if (!nuevoId) { setDespachando(null); return }
      realPedidoId = nuevoId
    }

    const items = pedido.items.map((item) => ({
      productoId: item.productoId,
      productoNombre: item.productoNombre,
      cantidadEnviada: item.cantidadPedida,
      cantidadPedida: item.cantidadPedida,
    }))

    const remitoResult = await crearRemito({
      pedidoFabricaId: realPedidoId,
      origenLocationId: locationId,
      origenNombre: userData?.locationName ?? locationId,
      destinoLocationId: pedido.origenLocationId,
      destinoNombre: pedido.origenNombre,
      items,
      observacion: observaciones[pedidoKey]?.trim() || undefined,
    })

    if (!mountedRef.current) return
    if (!remitoResult.ok) {
      setDespachando(null)
      toast({ title: "Error al despachar", description: remitoResult.error ?? "Error desconocido", variant: "destructive" })
      return
    }
    if (!remitoResult.remitoId) {
      setDespachando(null)
      toast({ title: "Error", description: "Remito creado sin ID", variant: "destructive" })
      return
    }

    const enCaminoResult = await marcarEnCamino(remitoResult.remitoId)
    if (!mountedRef.current) return
    setDespachando(null)
    if (!enCaminoResult.ok) {
      toast({ title: "Error", description: enCaminoResult.error ?? "No se pudo marcar en camino", variant: "destructive" })
      return
    }
    toast({ title: "Remito despachado", description: `Pedido de ${pedido.origenNombre} marcado como en camino` })
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderCard = (pedido: PedidoFabrica, isAuto: boolean) => {
    const isListo = isAuto || pedido.estado === "enviado" || pedido.estado === "en_preparacion"
    const isEnCamino = !isAuto && pedido.estado === "despachado"
    const resumen = pedido.items.map((i) => `${i.productoNombre} ×${i.cantidadPedida}`).join(" · ")
    return (
      <div
        key={pedido.id}
        className={`rounded-xl border mb-3 px-4 py-3 ${isAuto ? "bg-amber-50/40 border-amber-200" : "bg-white border-[#ebebeb]"}`}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-900">{pedido.origenNombre}</p>
          {isAuto ? (
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              <Sparkles className="w-3 h-3" />
              Auto
            </span>
          ) : isEnCamino ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">En camino</span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E1F5EE] text-[#0F6E56]">Listo</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-2">{resumen}</p>
        {isListo && (
          <>
            <textarea
              value={observaciones[pedido.id] ?? ""}
              onChange={(e) => setObservaciones((prev) => ({ ...prev, [pedido.id]: e.target.value }))}
              placeholder="Observaciones del envío (opcional)..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1D9E75] resize-none mb-2 bg-white"
            />
            {!locationId ? (
              <p className="text-xs text-red-500 text-center py-1">Sin ubicación configurada</p>
            ) : (
              <button
                onClick={() => handleDespachar(pedido)}
                disabled={despachando === pedido.id}
                className="w-full py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40 active:bg-[#18886B]"
              >
                {despachando === pedido.id ? "Despachando…" : "Marcar como despachado"}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-medium text-gray-900 flex-1">Despachar pedidos</h1>
        {totalActivos > 0 && (
          <span className="text-xs font-medium bg-[#E1F5EE] text-[#0F6E56] px-2.5 py-1 rounded-full">
            {totalActivos} pedido{totalActivos !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Cargando pedidos…</p>
        )}

        {!loading && totalActivos === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <Truck className="w-12 h-12" />
            <p className="text-sm text-center">No hay pedidos para despachar hoy.</p>
          </div>
        )}

        {!loading && (listos.length > 0 || autoPedidos.length > 0) && (
          <>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Listos para despachar
            </p>
            {listos.map((p) => renderCard(p, false))}
            {autoPedidos.map((p) => renderCard(p, true))}
          </>
        )}

        {!loading && enCamino.length > 0 && (
          <>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-4">
              En camino
            </p>
            {enCamino.map((p) => renderCard(p, false))}
          </>
        )}
      </div>

      {totalActivos > 0 && (
        <div className="bg-white border-t border-gray-100 px-4 py-3 text-center shrink-0">
          <p className="text-sm text-gray-400">
            {totalDespachados} de {totalActivos} remitos despachados
          </p>
        </div>
      )}
    </div>
  )
}
