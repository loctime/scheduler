"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/contexts/data-context"
import { db, COLLECTIONS } from "@/lib/firebase"
import { canUser } from "@/lib/permissions"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { useGruposCatalogo } from "@/hooks/use-grupos-catalogo"
import { useCatalogoProductos } from "@/hooks/use-catalogo-productos"
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"
import type { GrupoCatalogoUI } from "@/lib/catalogo-types"
import {
  desactivarGrupo,
  inicializarGrupoCompleto,
  setStockMinimoUbicacion,
  setStockUbicacion,
} from "@/lib/stock-ubicaciones-service"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Warehouse } from "lucide-react"

// ─── helpers ─────────────────────────────────────────────────────────────────

function estadoBadge(actual: number, minimo: number) {
  if (minimo === 0) return { label: "OK", variant: "default" as const }
  if (actual <= 0) return { label: "CRÍTICO", variant: "destructive" as const }
  if (actual < minimo) return { label: "BAJO", variant: "secondary" as const }
  return { label: "OK", variant: "default" as const }
}

// ─── inline editable cell ────────────────────────────────────────────────────

function EditableCell({
  value,
  onCommit,
  disabled,
}: {
  value: number
  onCommit: (v: number) => Promise<void>
  disabled?: boolean
}) {
  const [local, setLocal] = useState(String(value))
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  // keep in sync when value changes externally
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
    <div className="flex items-center gap-1">
      <Input
        ref={ref}
        type="number"
        min={0}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => e.key === "Enter" && ref.current?.blur()}
        disabled={disabled || saving}
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
      canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "editar_stock") &&
      (userData?.role === "operador" || userData?.role === "admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const { gruposCatalogo } = useGruposCatalogo(ownerId)
  const { items: catalogoProductos } = useCatalogoProductos(ownerId)

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

  // ── activar grupo modal ─────────────────────────────────────────────────────
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
      toast({ title: "Grupo sin productos activos", description: "Este grupo no tiene productos activos en el catálogo.", variant: "destructive" })
      return
    }

    setActivando(true)
    const res = await inicializarGrupoCompleto({
      ownerId,
      grupoCatalogoId: grupo.id,
      productos,
      locationId,
      userId: user.uid,
    })
    setActivando(false)

    if (!res.ok) {
      toast({ title: "Error al activar grupo", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: `Grupo "${grupo.nombre}" activado` })
    setModalActivar(false)
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

  // ── edición inline de stock ─────────────────────────────────────────────────
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

  // ── pedido ──────────────────────────────────────────────────────────────────
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

  const [modalPedido, setModalPedido] = useState(false)
  const [enviandoPedido, setEnviandoPedido] = useState(false)

  const enviarPedido = async () => {
    if (!db || !ownerId || !user) return
    setEnviandoPedido(true)
    try {
      for (const { grupo, filas: rows } of itemsPedido) {
        const items = rows.map((f) => ({
          productoId: f.catalogoId,
          productoNombre: f.nombre,
          cantidadSugerida: f.stockMinimo - f.stockActual,
          cantidadPedida: f.stockMinimo - f.stockActual,
        }))
        await addDoc(collection(db, COLLECTIONS.PEDIDOS_FABRICA), {
          ownerId,
          origenLocationId: locationId,
          origenNombre: locationId,
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
      }
      toast({ title: "Pedido enviado", description: `Se enviaron ${itemsPedido.length} pedido(s).` })
      setModalPedido(false)
    } catch (e) {
      toast({ title: "Error al enviar pedido", description: e instanceof Error ? e.message : "Error desconocido", variant: "destructive" })
    } finally {
      setEnviandoPedido(false)
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────
  if (!puede) {
    return (
      <DashboardLayout user={user}>
        <Card>
          <CardHeader>
            <CardTitle>Mi stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No tenés permiso para ver esta pantalla.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

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

        {/* loading */}
        {loadingStock && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        )}

        {/* empty */}
        {!loadingStock && gruposActivados.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No tenés grupos activados. Usá «Activar grupo» para empezar.
            </CardContent>
          </Card>
        )}

        {/* grupos activados */}
        {gruposActivados.map((grupo) => {
          const rows = (filasPorGrupo.get(grupo.id) ?? []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
          const porPedir = rows.filter((f) => f.stockMinimo > 0 && f.stockActual < f.stockMinimo)

          return (
            <Card key={grupo.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{grupo.nombre}</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmarDesactivar(grupo)}
                    disabled={desactivandoId === grupo.id}
                  >
                    {desactivandoId === grupo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desactivar"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* tabla */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 text-left font-medium">Producto</th>
                        <th className="py-2 text-right font-medium">Stock actual</th>
                        <th className="py-2 text-right font-medium">Stock mínimo</th>
                        <th className="py-2 text-right font-medium">Estado</th>
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
                            <td className="py-2 pr-4 text-right">
                              <EditableCell
                                value={f.stockActual}
                                onCommit={(v) => handleStockActual(f, v)}
                              />
                            </td>
                            <td className="py-2 pr-4 text-right">
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

                {/* pedido sugerido */}
                {porPedir.length > 0 && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                    <p className="font-medium text-muted-foreground">Pedido sugerido</p>
                    {porPedir.map((f) => (
                      <div key={f.id} className="flex justify-between">
                        <span>{f.nombre}</span>
                        <span className="tabular-nums font-medium">× {f.stockMinimo - f.stockActual}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* botón enviar pedido */}
        {itemsPedido.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={() => setModalPedido(true)}>
              Confirmar y enviar pedido
            </Button>
          </div>
        )}

        {/* ── modal activar grupo ── */}
        <Dialog open={modalActivar} onOpenChange={setModalActivar}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Activar grupo</DialogTitle>
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
            </DialogHeader>
            <p className="text-sm">
              ¿Desactivar el grupo <strong>{confirmarDesactivar?.nombre}</strong>? Se eliminarán todos los registros de stock de este grupo para tu sucursal.
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

        {/* ── modal confirmar pedido ── */}
        <Dialog open={modalPedido} onOpenChange={setModalPedido}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirmar pedido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              {itemsPedido.map(({ grupo, filas: rows }) => (
                <div key={grupo.id}>
                  <p className="font-semibold mb-1">{grupo.nombre}</p>
                  <ul className="space-y-0.5 pl-2">
                    {rows.map((f) => (
                      <li key={f.id} className="flex justify-between">
                        <span>{f.nombre}</span>
                        <span className="tabular-nums">× {f.stockMinimo - f.stockActual}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalPedido(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void enviarPedido()} disabled={enviandoPedido}>
                {enviandoPedido ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar pedido"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  )
}
