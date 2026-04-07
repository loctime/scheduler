"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useData } from "@/contexts/data-context"
import { db, COLLECTIONS } from "@/lib/firebase"
import { canUser } from "@/lib/permissions"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { useGruposCatalogo } from "@/hooks/use-grupos-catalogo"
import { useCatalogoProductos } from "@/hooks/use-catalogo-productos"
import { useLogistica } from "@/hooks/use-logistica"
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"
import type { GrupoCatalogoUI } from "@/lib/catalogo-types"
import type { PedidoFabrica } from "@/lib/logistica-types"
import {
  desactivarGrupo,
  inicializarGrupoCompleto,
  setStockMinimoUbicacion,
  setStockUbicacion,
} from "@/lib/stock-ubicaciones-service"
import { useToast } from "@/hooks/use-toast"
import { ChevronDown, Loader2, Warehouse } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── helpers ─────────────────────────────────────────────────────────────────

function estadoBadge(actual: number, minimo: number) {
  if (minimo === 0) return { label: "OK", variant: "default" as const }
  if (actual <= 0) return { label: "CRÍTICO", variant: "destructive" as const }
  if (actual < minimo) return { label: "BAJO", variant: "secondary" as const }
  return { label: "OK", variant: "default" as const }
}

// Retorna los 7 días de la semana actual (lunes a domingo) en fecha local
function getSemanaActual(): Date[] {
  const hoy = new Date()
  const diaSemana = hoy.getDay() // 0 = domingo
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((diaSemana + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return d
  })
}

const DIAS_CORTOS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

// ─── inline editable cell ────────────────────────────────────────────────────

function EditableCell({
  value,
  onCommit,
}: {
  value: number
  onCommit: (v: number) => Promise<void>
}) {
  const [local, setLocal] = useState(String(value))
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (document.activeElement !== ref.current) {
      setLocal(String(value))
    }
  }, [value])

  const commit = async () => {
    const parsed = Math.max(0, Math.floor(Number(local) || 0))
    if (parsed === value) return
    setSaving(true)
    await onCommit(parsed)
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <Input
        ref={ref}
        type="number"
        min={0}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => e.key === "Enter" && ref.current?.blur()}
        disabled={saving}
        className="h-8 w-20 text-right"
      />
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function MiStockPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const locationId = userData?.locationId ?? user?.uid ?? ""

  const puede = useMemo(
    () =>
      canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "editar_stock"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const { gruposCatalogo } = useGruposCatalogo(ownerId)
  const { items: catalogoProductos } = useCatalogoProductos(ownerId)
  const { actualizarItemsPedido } = useLogistica(user)

  // ── stock rows ──────────────────────────────────────────────────────────────
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

  // ── derived ─────────────────────────────────────────────────────────────────
  const gruposActivadosIds = useMemo(
    () => new Set(filas.map((f) => f.grupoCatalogoId).filter(Boolean) as string[]),
    [filas]
  )

  const gruposActivados = useMemo(
    () => gruposCatalogo.filter((g) => gruposActivadosIds.has(g.id)),
    [gruposCatalogo, gruposActivadosIds]
  )

  const gruposDisponibles = useMemo(
    () => gruposCatalogo.filter((g) => !gruposActivadosIds.has(g.id)),
    [gruposCatalogo, gruposActivadosIds]
  )

  const filasPorGrupo = useMemo(() => {
    const m = new Map<string, StockUbicacion[]>()
    for (const f of filas) {
      if (!f.grupoCatalogoId) continue
      if (!m.has(f.grupoCatalogoId)) m.set(f.grupoCatalogoId, [])
      m.get(f.grupoCatalogoId)!.push(f)
    }
    return m
  }, [filas])

  const pedidoActivoPorGrupo = useMemo(() => {
    const m = new Map<string, PedidoFabrica>()
    for (const p of pedidosActivos) {
      if (!m.has(p.grupoPedidoId)) m.set(p.grupoPedidoId, p)
    }
    return m
  }, [pedidosActivos])

  // ── grupos abiertos (colapsables) ───────────────────────────────────────────
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set())

  // Cuando llegan grupos activados, abrir el primero por defecto
  useEffect(() => {
    if (gruposActivados.length > 0) {
      setGruposAbiertos((prev) => {
        if (prev.size === 0) return new Set([gruposActivados[0].id])
        return prev
      })
    }
  }, [gruposActivados])

  const toggleGrupo = (id: string) => {
    setGruposAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── activar grupo ───────────────────────────────────────────────────────────
  const [modalActivar, setModalActivar] = useState(false)
  const [activando, setActivando] = useState(false)

  const activarGrupo = async (grupo: GrupoCatalogoUI) => {
    if (!ownerId || !user?.uid) return
    const productos = catalogoProductos
      .filter((p) => grupo.productosIds.includes(p.id) && p.activo)
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        unidad: p.unidad,
        pedidoId: p.pedidoId,
        stockMinimo: p.stockMinimo,
        orden: p.orden,
      }))

    if (productos.length === 0) {
      toast({ title: "Grupo sin productos activos", variant: "destructive" })
      return
    }

    setActivando(true)
    try {
      const res = await inicializarGrupoCompleto({
        ownerId,
        grupoCatalogoId: grupo.id,
        productos,
        locationId,
        userId: user.uid,
      })
      if (!res.ok) {
        toast({ title: "Error al activar grupo", description: res.error, variant: "destructive" })
        return
      }
      toast({ title: `Grupo "${grupo.nombre}" activado` })
      setModalActivar(false)
      setGruposAbiertos((prev) => new Set([...prev, grupo.id]))
    } catch (error) {
      toast({ title: "Error inesperado", description: error instanceof Error ? error.message : "Error desconocido", variant: "destructive" })
    } finally {
      setActivando(false)
    }
  }

  // ── desactivar grupo ────────────────────────────────────────────────────────
  const [desactivandoId, setDesactivandoId] = useState<string | null>(null)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState<GrupoCatalogoUI | null>(null)

  const handleDesactivar = async (grupo: GrupoCatalogoUI) => {
    if (!ownerId) return
    setDesactivandoId(grupo.id)
    const res = await desactivarGrupo({ ownerId, grupoCatalogoId: grupo.id, locationId })
    setDesactivandoId(null)
    setConfirmarDesactivar(null)
    if (!res.ok) {
      toast({ title: "Error al desactivar", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: `Grupo "${grupo.nombre}" desactivado` })
  }

  // ── edición inline ──────────────────────────────────────────────────────────
  const handleStockActual = async (fila: StockUbicacion, val: number) => {
    if (!ownerId || !user) return
    const res = await setStockUbicacion({ ownerId, catalogoId: fila.catalogoId, locationId: fila.locationId, cantidad: val, user: { uid: user.uid } })
    if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" })
  }

  const handleStockMinimo = async (fila: StockUbicacion, val: number) => {
    if (!ownerId || !user) return
    const res = await setStockMinimoUbicacion({ ownerId, catalogoId: fila.catalogoId, locationId: fila.locationId, minimo: val, user: { uid: user.uid } })
    if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" })
  }

  // ── pedidos calculados ──────────────────────────────────────────────────────
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

  // ── semana y días con pedido ────────────────────────────────────────────────
  const semana = useMemo(() => getSemanaActual(), [])
  const hoy = new Date()
  const hoyIdx = semana.findIndex(
    (d) => d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth()
  )

  // Días con pedidos asignados: si hay itemsPedido, marcamos hoy
  // (en el futuro esto podría venir de los días de envío del grupo)
  const diasConPedido = useMemo(() => {
    const s = new Set<number>()
    if (itemsPedido.length > 0 && hoyIdx >= 0) s.add(hoyIdx)
    return s
  }, [itemsPedido, hoyIdx])

  // ── enviar pedido ───────────────────────────────────────────────────────────
  const [enviandoPedido, setEnviandoPedido] = useState(false)

  const enviarPedidoGrupo = async (grupo: GrupoCatalogoUI, rows: StockUbicacion[]) => {
    if (!db || !ownerId || !user) return
    setEnviandoPedido(true)
    try {
      const items = rows.map((f) => ({
        productoId: f.catalogoId,
        productoNombre: f.nombre,
        cantidadSugerida: f.stockMinimo - f.stockActual,
        cantidadPedida: f.stockMinimo - f.stockActual,
      }))

      const pedidoExistente = pedidoActivoPorGrupo.get(grupo.id)

      if (pedidoExistente?.estado === "en_preparacion" || pedidoExistente?.estado === "despachado") {
        toast({ title: `"${grupo.nombre}" ya está en preparación o fue despachado.`, variant: "destructive" })
        return
      }

      if (pedidoExistente?.estado === "enviado") {
        await actualizarItemsPedido(pedidoExistente.id, items)
        toast({ title: `Pedido de "${grupo.nombre}" actualizado.` })
      } else {
        await addDoc(collection(db, COLLECTIONS.PEDIDOS_FABRICA), {
          ownerId,
          origenLocationId: locationId,
          origenNombre: (userData as any)?.locationName || userData?.displayName || locationId,
          destinoLocationId: grupo.despachadores[0]?.locationId ?? "",
          destinoNombre: grupo.despachadores[0]?.locationName ?? "",
          grupoPedidoId: grupo.id,
          grupoPedidoNombre: grupo.nombre,
          estado: "enviado",
          esPendiente: false,
          controlado: true,
          items,
          creadoEn: serverTimestamp(),
          creadoPor: user.uid,
          creadoPorEmail: user.email ?? "",
          actualizadoEn: serverTimestamp(),
        })
        toast({ title: `Pedido de "${grupo.nombre}" enviado.` })
      }
    } catch (e) {
      toast({ title: "Error al enviar pedido", description: e instanceof Error ? e.message : "Error desconocido", variant: "destructive" })
    } finally {
      setEnviandoPedido(false)
    }
  }

  // ── sin permiso ─────────────────────────────────────────────────────────────
  if (!puede) {
    return (
      <DashboardLayout user={user}>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">No tenés permiso para ver esta pantalla.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout user={user}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">

        {/* header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-semibold">Mi stock</h1>
              <p className="text-sm text-muted-foreground">Stock de tu sucursal, agrupado por grupo.</p>
            </div>
          </div>
          <Button onClick={() => setModalActivar(true)} disabled={gruposDisponibles.length === 0}>
            Activar grupo
          </Button>
        </div>

        {/* tabs */}
        <Tabs defaultValue="stock">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="stock" className="flex-1 sm:flex-none">Stock</TabsTrigger>
            <TabsTrigger value="pedidos" className="flex-1 sm:flex-none">
              Pedidos
              {itemsPedido.length > 0 && (
                <span className="ml-2 rounded-full bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 leading-none">
                  {itemsPedido.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── TAB STOCK ── */}
          <TabsContent value="stock" className="mt-4 space-y-3">
            {loadingStock && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </div>
            )}

            {!loadingStock && gruposActivados.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No tenés grupos activados. Usá «Activar grupo» para empezar.
                </CardContent>
              </Card>
            )}

            {gruposActivados.map((grupo) => {
              const rows = (filasPorGrupo.get(grupo.id) ?? []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
              const bajosCount = rows.filter((f) => f.stockMinimo > 0 && f.stockActual < f.stockMinimo).length
              const isOpen = gruposAbiertos.has(grupo.id)

              return (
                <Collapsible key={grupo.id} open={isOpen} onOpenChange={() => toggleGrupo(grupo.id)}>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 text-left">
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                              isOpen && "rotate-180"
                            )}
                          />
                          <div>
                            <p className="font-medium text-sm">{grupo.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {rows.length} producto{rows.length !== 1 ? "s" : ""}
                              {bajosCount > 0 && (
                                <span className="ml-1 text-destructive">· {bajosCount} bajo stock</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          className="text-xs text-destructive hover:underline ml-4 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmarDesactivar(grupo)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              setConfirmarDesactivar(grupo)
                            }
                          }}
                          aria-disabled={desactivandoId === grupo.id}
                        >
                          {desactivandoId === grupo.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : "Desactivar"}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t border-border px-4 pb-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm mt-3">
                            <thead>
                              <tr className="border-b text-muted-foreground">
                                <th className="pb-2 text-left font-medium">Producto</th>
                                <th className="pb-2 text-right font-medium">Stock actual</th>
                                <th className="pb-2 text-right font-medium">Stock mínimo</th>
                                <th className="pb-2 text-right font-medium">Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((f) => {
                                const st = estadoBadge(f.stockActual, f.stockMinimo)
                                return (
                                  <tr key={f.id} className="border-b last:border-0">
                                    <td className="py-2 pr-4">
                                      <div className="font-medium">{f.nombre}</div>
                                      <div className="text-xs text-muted-foreground">{f.unidad}</div>
                                    </td>
                                    <td className="py-2 pr-2">
                                      <EditableCell
                                        value={f.stockActual}
                                        onCommit={(v) => handleStockActual(f, v)}
                                      />
                                    </td>
                                    <td className="py-2 pr-2">
                                      <EditableCell
                                        value={f.stockMinimo}
                                        onCommit={(v) => handleStockMinimo(f, v)}
                                      />
                                    </td>
                                    <td className="py-2 text-right">
                                      <Badge variant={st.variant}>{st.label}</Badge>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </TabsContent>

          {/* ── TAB PEDIDOS ── */}
          <TabsContent value="pedidos" className="mt-4 space-y-4">

            {/* calendario semanal */}
            <div className="grid grid-cols-7 gap-1.5">
              {semana.map((dia, idx) => {
                const esHoy = idx === hoyIdx
                const tienePedido = diasConPedido.has(idx)
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex flex-col items-center rounded-lg border py-2 px-1 text-center",
                      esHoy
                        ? "border-foreground bg-muted/50"
                        : "border-border"
                    )}
                  >
                    <span className="text-[10px] font-medium text-muted-foreground">{DIAS_CORTOS[idx]}</span>
                    <span className={cn(
                      "mt-0.5 text-base font-semibold leading-none",
                      esHoy ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {dia.getDate()}
                    </span>
                    <div className={cn(
                      "mt-1.5 h-1.5 w-1.5 rounded-full",
                      tienePedido ? "bg-foreground" : "bg-transparent"
                    )} />
                  </div>
                )
              })}
            </div>

            {/* pedidos del día */}
            {hoyIdx >= 0 && (
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Hoy · {DIAS_LARGOS[hoyIdx]} {semana[hoyIdx].getDate()}
              </p>
            )}

            {itemsPedido.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No hay productos bajo stock mínimo. Todo en orden.
                </CardContent>
              </Card>
            ) : (
              <>
                {itemsPedido.map(({ grupo, filas: rows }) => {
                  const pedidoActivo = pedidoActivoPorGrupo.get(grupo.id)
                  const bloqueado = pedidoActivo?.estado === "en_preparacion" || pedidoActivo?.estado === "despachado"
                  return (
                    <Card key={grupo.id}>
                      <CardContent className="pt-4 pb-3 px-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{grupo.nombre}</p>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            automático
                          </span>
                        </div>
                        <div className="space-y-1">
                          {rows.map((f) => (
                            <div key={f.id} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{f.nombre}</span>
                              <span className="font-medium tabular-nums">× {f.stockMinimo - f.stockActual}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-1">
                          {!pedidoActivo && (
                            <Badge className="bg-yellow-50 text-yellow-800 border border-yellow-200">Sin confirmar</Badge>
                          )}
                          {pedidoActivo?.estado === "enviado" && (
                            <Badge className="bg-green-50 text-green-800 border border-green-200">Enviado · pendiente de tomar</Badge>
                          )}
                          {pedidoActivo?.estado === "en_preparacion" && (
                            <Badge className="bg-blue-50 text-blue-800 border border-blue-200">En preparación · no editable</Badge>
                          )}
                          {pedidoActivo?.estado === "despachado" && (
                            <Badge className="bg-gray-100 text-gray-600 border border-gray-200">Despachado</Badge>
                          )}
                        </div>
                        <Button
                          className="w-full mt-2"
                          disabled={bloqueado || enviandoPedido}
                          onClick={() => void enviarPedidoGrupo(grupo, rows)}
                        >
                          {enviandoPedido ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          {bloqueado ? "En preparación" : "Confirmar y enviar"}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* ── modal activar grupo ── */}
        <Dialog open={modalActivar} onOpenChange={setModalActivar}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Activar grupo</DialogTitle>
              <DialogDescription>
                Seleccioná un grupo para activarlo en tu sucursal.
              </DialogDescription>
            </DialogHeader>
            {gruposDisponibles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Ya tenés todos los grupos activados.</p>
            ) : (
              <ul className="space-y-1 border rounded-md p-2 max-h-80 overflow-y-auto">
                {gruposDisponibles.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="w-full text-left rounded px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                      onClick={() => void activarGrupo(g)}
                      disabled={activando}
                    >
                      <span className="font-medium">{g.nombre}</span>
                      <span className="text-xs text-muted-foreground">{g.productosIds.length} productos</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {activando && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Activando…
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── modal confirmar desactivar ── */}
        <Dialog open={!!confirmarDesactivar} onOpenChange={(o) => !o && setConfirmarDesactivar(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Desactivar grupo</DialogTitle>
              <DialogDescription>
                Se eliminarán todos los registros de stock de este grupo para tu sucursal.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm">
              ¿Desactivar <strong>{confirmarDesactivar?.nombre}</strong>?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmarDesactivar(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => confirmarDesactivar && void handleDesactivar(confirmarDesactivar)}
                disabled={!!desactivandoId}
              >
                {desactivandoId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desactivar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  )
}
