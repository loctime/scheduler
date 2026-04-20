"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { useGruposCatalogo } from "@/hooks/use-grupos-catalogo"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, ClipboardList } from "lucide-react"
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"
import type { PedidoFabrica } from "@/lib/logistica-types"
import type { GrupoCatalogoUI } from "@/lib/catalogo-types"
import { cn } from "@/lib/utils"

const DIAS_CORTOS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

function getSemanaActual(): Date[] {
  const hoy = new Date()
  const diaSemana = hoy.getDay()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((diaSemana + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return d
  })
}

export default function VerPedidoPage() {
  const router = useRouter()
  const { user, userData } = useData()
  const { toast } = useToast()

  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const locationId = userData?.locationId ?? user?.uid ?? ""

  const { gruposCatalogo } = useGruposCatalogo(ownerId)
  const { crearPedidoFabrica, actualizarItemsPedido } = useLogistica(user)

  // ── stock rows de esta ubicación ───────────────────────────────────────────
  const [filas, setFilas] = useState<StockUbicacion[]>([])
  const [loadingStock, setLoadingStock] = useState(true)

  useEffect(() => {
    if (!db || !ownerId || !locationId) {
      setFilas([])
      setLoadingStock(false)
      return
    }
    setLoadingStock(true)
    const q = query(
      collection(db, COLLECTIONS.STOCK_UBICACIONES),
      where("ownerId", "==", ownerId),
      where("locationId", "==", locationId)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: StockUbicacion[] = snap.docs.map((d) => {
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
        setFilas(rows)
        setLoadingStock(false)
      },
      () => setLoadingStock(false)
    )
    return () => unsub()
  }, [ownerId, locationId])

  // ── pedidos activos de esta ubicación ───────────────────────────────────────
  const [pedidosActivos, setPedidosActivos] = useState<PedidoFabrica[]>([])
  useEffect(() => {
    if (!db || !ownerId || !locationId) {
      setPedidosActivos([])
      return
    }
    const q = query(
      collection(db, COLLECTIONS.PEDIDOS_FABRICA),
      where("ownerId", "==", ownerId),
      where("origenLocationId", "==", locationId)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPedidosActivos(
          snap.docs.map((d) => {
            const x = d.data() as Record<string, unknown>
            return {
              id: d.id,
              ownerId: String(x.ownerId ?? ""),
              origenLocationId: String(x.origenLocationId ?? ""),
              origenNombre: String(x.origenNombre ?? ""),
              destinoLocationId: String(x.destinoLocationId ?? ""),
              destinoNombre: String(x.destinoNombre ?? ""),
              grupoPedidoId: String(x.grupoPedidoId ?? ""),
              grupoPedidoNombre: String(x.grupoPedidoNombre ?? ""),
              estado: x.estado as PedidoFabrica["estado"],
              esPendiente: Boolean(x.esPendiente),
              controlado: x.controlado === true,
              pedidoOrigenId: x.pedidoOrigenId ? String(x.pedidoOrigenId) : undefined,
              items: (x.items as PedidoFabrica["items"]) ?? [],
              observacion: x.observacion ? String(x.observacion) : undefined,
              creadoEn: x.creadoEn,
              creadoPor: String(x.creadoPor ?? ""),
              creadoPorEmail: String(x.creadoPorEmail ?? ""),
              actualizadoEn: x.actualizadoEn,
            }
          })
        )
      },
      () => setPedidosActivos([])
    )
    return () => unsub()
  }, [ownerId, locationId])

  // ── derived ────────────────────────────────────────────────────────────────
  const filasPorGrupo = useMemo(() => {
    const m = new Map<string, StockUbicacion[]>()
    for (const f of filas) {
      if (!f.grupoCatalogoId) continue
      if (!m.has(f.grupoCatalogoId)) m.set(f.grupoCatalogoId, [])
      m.get(f.grupoCatalogoId)!.push(f)
    }
    for (const [, rows] of m) {
      rows.sort((a, b) => {
        if ((a.orden ?? 0) !== (b.orden ?? 0)) return (a.orden ?? 0) - (b.orden ?? 0)
        return a.nombre.localeCompare(b.nombre)
      })
    }
    return m
  }, [filas])

  const gruposActivadosIds = useMemo(
    () => new Set(filas.map((f) => f.grupoCatalogoId).filter(Boolean) as string[]),
    [filas]
  )

  const gruposActivados = useMemo(
    () => gruposCatalogo.filter((g) => gruposActivadosIds.has(g.id)),
    [gruposCatalogo, gruposActivadosIds]
  )

  const itemsPedido = useMemo(() => {
    const result: Array<{ grupo: GrupoCatalogoUI; filas: StockUbicacion[] }> = []
    for (const grupo of gruposActivados) {
      const rows = (filasPorGrupo.get(grupo.id) ?? []).filter(
        (f) => f.stockMinimo > 0 && f.stockActual < f.stockMinimo
      )
      if (rows.length > 0) result.push({ grupo, filas: rows })
    }
    return result
  }, [gruposActivados, filasPorGrupo])

  const pedidoActivoPorGrupo = useMemo(() => {
    const m = new Map<string, PedidoFabrica>()
    for (const p of pedidosActivos) {
      if (p.estado === "recibido" || p.estado === "cancelado") continue
      if (!m.has(p.grupoPedidoId)) m.set(p.grupoPedidoId, p)
    }
    return m
  }, [pedidosActivos])

  // ── cantidades editables por usuario: grupoId → productoId → cantidad ──────
  const [cantidades, setCantidades] = useState<Record<string, Record<string, number>>>({})
  const [enviando, setEnviando] = useState<string | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const getCantidad = (grupoId: string, productoId: string, fallback: number) =>
    cantidades[grupoId]?.[productoId] ?? fallback

  const setCantidadItem = (grupoId: string, productoId: string, value: number) => {
    setCantidades((prev) => ({
      ...prev,
      [grupoId]: { ...(prev[grupoId] ?? {}), [productoId]: Math.max(0, value) },
    }))
  }

  const buildItems = (grupoId: string, rows: StockUbicacion[]) =>
    rows
      .map((f) => {
        const sugerida = Math.max(0, f.stockMinimo - f.stockActual)
        const pedida = getCantidad(grupoId, f.catalogoId, sugerida)
        return {
          productoId: f.catalogoId,
          productoNombre: f.nombre,
          cantidadSugerida: sugerida,
          cantidadPedida: pedida,
        }
      })
      .filter((i) => i.cantidadPedida > 0)

  function hayDiferencias(pedido: PedidoFabrica, grupoId: string, rows: StockUbicacion[]): boolean {
    const finales = buildItems(grupoId, rows)
    if (pedido.items.length !== finales.length) return true
    for (const it of finales) {
      const existente = pedido.items.find((i) => i.productoId === it.productoId)
      if (!existente || existente.cantidadPedida !== it.cantidadPedida) return true
    }
    return false
  }

  const handleConfirmar = async (grupo: GrupoCatalogoUI, rows: StockUbicacion[]) => {
    if (!ownerId || !user || !locationId) return
    const items = buildItems(grupo.id, rows)
    if (items.length === 0) {
      toast({ title: "Nada para enviar", description: "Todas las cantidades están en 0", variant: "destructive" })
      return
    }
    setEnviando(grupo.id)
    try {
      const pedidoExistente = pedidoActivoPorGrupo.get(grupo.id)
      if (pedidoExistente?.estado === "en_preparacion" || pedidoExistente?.estado === "despachado") {
        toast({ title: `"${grupo.nombre}" ya está en preparación o fue despachado`, variant: "destructive" })
        return
      }
      if (pedidoExistente?.estado === "enviado") {
        const res = await actualizarItemsPedido(pedidoExistente.id, items)
        if (!res.ok) {
          toast({ title: "Error", description: res.error, variant: "destructive" })
          return
        }
        toast({ title: `Pedido de "${grupo.nombre}" actualizado` })
      } else {
        const res = await crearPedidoFabrica({
          origenLocationId: locationId,
          origenNombre: (userData as any)?.locationName || userData?.displayName || locationId,
          destinoLocationId: grupo.despachadores[0]?.locationId ?? "",
          destinoNombre: grupo.despachadores[0]?.locationName ?? "",
          grupoPedidoId: grupo.id,
          grupoPedidoNombre: grupo.nombre,
          items,
        })
        if (!res.ok) {
          toast({ title: "Error", description: res.error, variant: "destructive" })
          return
        }
        toast({ title: `Pedido de "${grupo.nombre}" enviado` })
        setCantidades((prev) => ({ ...prev, [grupo.id]: {} }))
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo enviar",
        variant: "destructive",
      })
    } finally {
      if (mountedRef.current) setEnviando(null)
    }
  }

  // ── calendario semanal ─────────────────────────────────────────────────────
  const semana = useMemo(() => getSemanaActual(), [])
  const hoy = new Date()
  const hoyIdx = semana.findIndex(
    (d) => d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth()
  )

  const gruposPorDia = useMemo(() => {
    const m = new Map<number, string[]>()
    for (let i = 0; i < 7; i++) m.set(i, [])
    for (const grupo of gruposActivados) {
      const diasJS = grupo.diasEnvio ?? []
      for (const diaJS of diasJS) {
        const idx = diaJS === 0 ? 6 : diaJS - 1
        m.get(idx)?.push(grupo.nombre)
      }
    }
    return m
  }, [gruposActivados])

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

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-medium text-gray-900 flex-1">Pedido del día</h1>
        <span className="text-xs font-medium bg-[#E1F5EE] text-[#0F6E56] px-2.5 py-1 rounded-full">
          Hoy
        </span>
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {loadingStock && (
          <p className="text-sm text-gray-400 text-center py-8">Cargando…</p>
        )}

        {!loadingStock && gruposActivados.length > 0 && (
          <>
            {/* calendario semanal */}
            <div className="grid grid-cols-7 gap-1 mb-3">
              {semana.map((dia, idx) => {
                const esHoy = idx === hoyIdx
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex flex-col items-center rounded-lg border py-2 px-0.5 text-center min-h-[64px] bg-white",
                      esHoy ? "border-[#0F6E56] bg-[#F0FBF7]" : "border-gray-100"
                    )}
                  >
                    <span className="text-[9px] font-medium text-gray-400">{DIAS_CORTOS[idx]}</span>
                    <span
                      className={cn(
                        "mt-0.5 text-sm font-semibold leading-none",
                        esHoy ? "text-[#0F6E56]" : "text-gray-700"
                      )}
                    >
                      {dia.getDate()}
                    </span>
                    <div className="mt-1 flex flex-col gap-0.5 w-full">
                      {(gruposPorDia.get(idx) ?? []).slice(0, 2).map((nombre, i) => (
                        <span
                          key={i}
                          className="text-[8px] leading-tight text-gray-500 bg-gray-50 rounded px-0.5 truncate"
                        >
                          {nombre}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {hoyIdx >= 0 && (
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                Hoy · {DIAS_LARGOS[hoyIdx]} {semana[hoyIdx].getDate()}
              </p>
            )}
          </>
        )}

        {!loadingStock && itemsPedido.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <ClipboardList className="w-12 h-12" />
            <p className="text-sm text-center">
              {gruposActivados.length === 0
                ? "No tenés grupos activados. Activá un grupo desde «Mi stock»."
                : "No hay productos bajo stock mínimo. Todo en orden."}
            </p>
          </div>
        )}

        {!loadingStock && itemsPedido.map(({ grupo, filas: rows }) => {
          const pedidoActivo = pedidoActivoPorGrupo.get(grupo.id)
          const bloqueado = pedidoActivo?.estado === "en_preparacion" || pedidoActivo?.estado === "despachado"
          const enviado = pedidoActivo?.estado === "enviado"
          const tieneCambios = enviado && pedidoActivo ? hayDiferencias(pedidoActivo, grupo.id, rows) : false
          const estaEnviando = enviando === grupo.id
          return (
            <div key={grupo.id} className="bg-white rounded-xl border border-[#ebebeb] mb-3 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{grupo.nombre}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {grupo.despachadores[0]?.locationName ?? "Sin destino"}
                  </p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0 ml-2">
                  automático
                </span>
              </div>

              <div className="px-4 py-2">
                <div className="flex text-[11px] text-gray-400 uppercase tracking-wide py-1.5 gap-2">
                  <span className="flex-1">Producto</span>
                  <span className="w-14 text-center">Sugerido</span>
                  <span className="w-24 text-center">Enviar</span>
                </div>
                {rows.map((f) => {
                  const sugerida = Math.max(0, f.stockMinimo - f.stockActual)
                  const cant = getCantidad(grupo.id, f.catalogoId, sugerida)
                  return (
                    <div key={f.id} className="flex items-center gap-2 py-2 border-t border-gray-50">
                      <span className="flex-1 text-sm text-gray-800 truncate">{f.nombre}</span>
                      <span className="w-14 text-center text-sm text-gray-400 tabular-nums">{sugerida}</span>
                      <div className="w-24 flex items-center gap-1 justify-center">
                        <button
                          onClick={() => setCantidadItem(grupo.id, f.catalogoId, cant - 1)}
                          disabled={bloqueado || estaEnviando}
                          className="w-6 h-6 rounded-full border border-gray-200 bg-gray-50 text-gray-600 text-sm flex items-center justify-center disabled:opacity-40"
                        >
                          −
                        </button>
                        <span
                          className={cn(
                            "w-7 text-center text-sm font-semibold tabular-nums",
                            cant !== sugerida ? "text-[#1D9E75]" : "text-gray-800"
                          )}
                        >
                          {cant}
                        </span>
                        <button
                          onClick={() => setCantidadItem(grupo.id, f.catalogoId, cant + 1)}
                          disabled={bloqueado || estaEnviando}
                          className="w-6 h-6 rounded-full border border-gray-200 bg-gray-50 text-gray-600 text-sm flex items-center justify-center disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="px-4 pb-2">
                {!pedidoActivo && (
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Sin confirmar
                  </span>
                )}
                {pedidoActivo?.estado === "enviado" && (
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                    Enviado · pendiente de tomar
                  </span>
                )}
                {pedidoActivo?.estado === "en_preparacion" && (
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    En preparación
                  </span>
                )}
                {pedidoActivo?.estado === "despachado" && (
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                    Despachado
                  </span>
                )}
              </div>

              <div className="px-4 pb-4">
                {bloqueado ? (
                  <button disabled className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-400 text-sm font-medium">
                    {pedidoActivo?.estado === "en_preparacion" ? "En preparación" : "Despachado"}
                  </button>
                ) : enviado && !tieneCambios ? (
                  <button disabled className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-400 text-sm font-medium">
                    Pedido enviado
                  </button>
                ) : (
                  <button
                    onClick={() => void handleConfirmar(grupo, rows)}
                    disabled={estaEnviando}
                    className="w-full py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40 active:bg-[#18886B]"
                  >
                    {estaEnviando ? "Enviando…" : enviado ? "Actualizar pedido" : "Confirmar y enviar"}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
