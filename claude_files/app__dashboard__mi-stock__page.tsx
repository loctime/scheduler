"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"
import type { CatalogoProducto } from "@/lib/catalogo-types"
import { inicializarStockUbicacion, setStockUbicacion } from "@/lib/stock-ubicaciones-service"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Warehouse } from "lucide-react"

function estadoStock(actual: number, minimo: number): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (actual <= 0 && minimo > 0) return { label: "CRÍTICO", variant: "destructive" }
  if (minimo > 0 && actual < minimo) return { label: "BAJO", variant: "secondary" }
  return { label: "OK", variant: "default" }
}

export default function MiStockPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const isAdmin = userData?.role === "admin"
  const myLocationId = userData?.locationId ?? user?.uid ?? ""

  const puede = useMemo(
    () =>
      canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "editar_stock") &&
      (userData?.role === "operador" || userData?.role === "admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const [filas, setFilas] = useState<StockUbicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [editRow, setEditRow] = useState<StockUbicacion | null>(null)
  const [editVal, setEditVal] = useState("")
  const [saving, setSaving] = useState(false)

  const [modalActivo, setModalActivo] = useState(false)
  const [buscar, setBuscar] = useState("")
  const [catalogoFiltrado, setCatalogoFiltrado] = useState<CatalogoProducto[]>([])
  const [catalogoCargado, setCatalogoCargado] = useState<CatalogoProducto[]>([])
  const [selCatalogo, setSelCatalogo] = useState<CatalogoProducto | null>(null)
  const [minSucursal, setMinSucursal] = useState("0")

  const locationFilter = isAdmin ? null : myLocationId

  useEffect(() => {
    if (!db || !ownerId) {
      setFilas([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q =
      locationFilter != null && locationFilter !== ""
        ? query(
            collection(db, COLLECTIONS.STOCK_UBICACIONES),
            where("ownerId", "==", ownerId),
            where("locationId", "==", locationFilter)
          )
        : query(collection(db, COLLECTIONS.STOCK_UBICACIONES), where("ownerId", "==", ownerId))

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
            updatedBy: String(x.updatedBy ?? ""),
          }
        })
        rows.sort((a, b) => a.nombre.localeCompare(b.nombre))
        setFilas(rows)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return () => unsub()
  }, [ownerId, locationFilter])

  const cargarCatalogo = useCallback(async () => {
    if (!db || !ownerId) return
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.CATALOGO), where("ownerId", "==", ownerId))
    )
    const list: CatalogoProducto[] = snap.docs.map((d) => {
      const x = d.data() as Record<string, unknown>
      return {
        id: d.id,
        ownerId: String(x.ownerId ?? ""),
        nombre: String(x.nombre ?? ""),
        unidad: String(x.unidad ?? "U"),
        pedidoId: String(x.pedidoId ?? ""),
        stockMinimo: typeof x.stockMinimo === "number" ? x.stockMinimo : 0,
        orden: typeof x.orden === "number" ? x.orden : 0,
        activo: x.activo !== false,
        createdBy: String(x.createdBy ?? ""),
      }
    })
    list.sort((a, b) => a.nombre.localeCompare(b.nombre))
    setCatalogoCargado(list)
  }, [ownerId])

  useEffect(() => {
    if (!modalActivo) return
    void cargarCatalogo()
  }, [modalActivo, cargarCatalogo])

  useEffect(() => {
    const t = buscar.trim().toLowerCase()
    const activos = catalogoCargado.filter((c) => c.activo)
    const ya = new Set(filas.map((f) => f.catalogoId))
    const disp = activos.filter((c) => !ya.has(c.id))
    setCatalogoFiltrado(
      t ? disp.filter((c) => c.nombre.toLowerCase().includes(t)) : disp
    )
  }, [buscar, catalogoCargado, filas])

  const abrirActivar = (c: CatalogoProducto) => {
    setSelCatalogo(c)
    setMinSucursal(String(c.stockMinimo ?? 0))
  }

  const confirmarActivar = async () => {
    if (!selCatalogo || !ownerId || !user?.uid) return
    if (!myLocationId) {
      toast({ title: "Sin ubicación", description: "No se pudo determinar la sucursal.", variant: "destructive" })
      return
    }
    setSaving(true)
    const res = await inicializarStockUbicacion({
      ownerId,
      catalogoId: selCatalogo.id,
      locationId: myLocationId,
      stockMinimo: Math.max(0, Math.floor(Number(minSucursal) || 0)),
      userId: user.uid,
    })
    setSaving(false)
    if (!res.ok) {
      toast({ title: "No se pudo activar", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: "Producto activado", description: "Stock inicial en 0." })
    setSelCatalogo(null)
    setModalActivo(false)
  }

  const guardarStock = async () => {
    if (!editRow || !ownerId || !user?.uid) return
    const v = Math.max(0, Math.floor(Number(editVal) || 0))
    setSaving(true)
    const res = await setStockUbicacion({
      ownerId,
      catalogoId: editRow.catalogoId,
      locationId: editRow.locationId,
      cantidad: v,
      user: { uid: user.uid },
    })
    setSaving(false)
    if (!res.ok) {
      toast({ title: "Error", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: "Stock actualizado" })
    setEditRow(null)
  }

  const agrupado = useMemo(() => {
    if (!isAdmin || locationFilter) return null
    const m = new Map<string, StockUbicacion[]>()
    for (const f of filas) {
      if (!m.has(f.locationId)) m.set(f.locationId, [])
      m.get(f.locationId)!.push(f)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filas, isAdmin, locationFilter])

  if (!puede) {
    return (
      <DashboardLayout user={user}>
        <Card>
          <CardHeader>
            <CardTitle>Mi stock</CardTitle>
            <CardDescription>No tenés permiso para ver esta pantalla.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  const renderFila = (f: StockUbicacion) => {
    const st = estadoStock(f.stockActual, f.stockMinimo)
    return (
      <div
        key={f.id}
        className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="font-medium">{f.nombre}</div>
          <div className="text-xs text-muted-foreground">
            {f.unidad} · mín. {f.stockMinimo}
            {isAdmin && !locationFilter ? ` · ubicación ${f.locationId.slice(0, 8)}…` : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">{f.stockActual}</span>
          <Badge variant={st.variant}>{st.label}</Badge>
          <Button size="sm" variant="secondary" onClick={() => {
            setEditRow(f)
            setEditVal(String(f.stockActual))
          }}>
            Editar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-semibold">Mi stock</h1>
              <p className="text-sm text-muted-foreground">
                {isAdmin && !locationFilter
                  ? "Vista de todas las ubicaciones."
                  : "Stock de tu sucursal únicamente."}
              </p>
            </div>
          </div>
          <Button onClick={() => setModalActivo(true)}>Activar nuevo producto</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Productos en esta vista</CardTitle>
            <CardDescription>Cantidades por ubicación según tu rol</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </div>
            ) : filas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay productos activos en stock. Usá «Activar nuevo producto».
              </p>
            ) : agrupado ? (
              agrupado.map(([locId, rows]) => (
                <div key={locId} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Ubicación: {locId}</h3>
                  {rows.map(renderFila)}
                </div>
              ))
            ) : (
              filas.map(renderFila)
            )}
          </CardContent>
        </Card>

        <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stock real — {editRow?.nombre}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label>Cantidad actual</Label>
              <Input
                type="number"
                min={0}
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRow(null)}>
                Cancelar
              </Button>
              <Button onClick={() => void guardarStock()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={modalActivo} onOpenChange={setModalActivo}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Activar producto del catálogo</DialogTitle>
            </DialogHeader>
            {!selCatalogo ? (
              <>
                <Input
                  placeholder="Buscar por nombre…"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                />
                <ul className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-2">
                  {catalogoFiltrado.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-muted"
                        onClick={() => abrirActivar(c)}
                      >
                        {c.nombre} <span className="text-muted-foreground">({c.unidad})</span>
                      </button>
                    </li>
                  ))}
                  {catalogoFiltrado.length === 0 && (
                    <li className="text-sm text-muted-foreground px-2">Sin resultados</li>
                  )}
                </ul>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">{selCatalogo.nombre}</p>
                <div className="space-y-2">
                  <Label>Stock mínimo en tu sucursal</Label>
                  <Input
                    type="number"
                    min={0}
                    value={minSucursal}
                    onChange={(e) => setMinSucursal(e.target.value)}
                  />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setSelCatalogo(null)}>
                    Volver
                  </Button>
                  <Button onClick={() => void confirmarActivar()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Crear con stock 0
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
