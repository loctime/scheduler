"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useData } from "@/contexts/data-context"
import { db, COLLECTIONS } from "@/lib/firebase"
import { canUser } from "@/lib/permissions"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import type { Pedido } from "@/lib/types"
import type { CatalogoProducto } from "@/lib/catalogo-types"
import {
  crearProductoCatalogo,
  actualizarProductoCatalogo,
  toggleProductoActivo,
} from "@/lib/catalogo-service"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Package, Plus } from "lucide-react"

export default function CatalogoAdminPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])

  const puede = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "ver_admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [items, setItems] = useState<CatalogoProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [nombre, setNombre] = useState("")
  const [unidad, setUnidad] = useState("U")
  const [pedidoId, setPedidoId] = useState("")
  const [stockMinimo, setStockMinimo] = useState("0")
  const [categoria, setCategoria] = useState("")

  useEffect(() => {
    if (!db || !ownerId) return
    const pq = query(collection(db, COLLECTIONS.PEDIDOS), where("ownerId", "==", ownerId))
    const unsub = onSnapshot(pq, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Pedido[]
      list.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setPedidos(list)
      setPedidoId((prev) => prev || list[0]?.id || "")
    })
    return () => unsub()
  }, [ownerId])

  useEffect(() => {
    if (!db || !ownerId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const cq = query(collection(db, COLLECTIONS.CATALOGO), where("ownerId", "==", ownerId))
    const unsub = onSnapshot(
      cq,
      (snap) => {
        const rows: CatalogoProducto[] = snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>
          return {
            id: d.id,
            ownerId: String(x.ownerId ?? ""),
            nombre: String(x.nombre ?? ""),
            unidad: String(x.unidad ?? "U"),
            categoria: x.categoria ? String(x.categoria) : undefined,
            pedidoId: String(x.pedidoId ?? ""),
            stockMinimo: typeof x.stockMinimo === "number" ? x.stockMinimo : 0,
            orden: typeof x.orden === "number" ? x.orden : 0,
            activo: x.activo !== false,
            createdAt: x.createdAt,
            updatedAt: x.updatedAt,
            createdBy: String(x.createdBy ?? ""),
          }
        })
        rows.sort((a, b) => a.nombre.localeCompare(b.nombre))
        setItems(rows)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return () => unsub()
  }, [ownerId])

  const pedidoNombre = useCallback(
    (id: string) => pedidos.find((p) => p.id === id)?.nombre ?? id,
    [pedidos]
  )

  const resetForm = () => {
    setEditId(null)
    setNombre("")
    setUnidad("U")
    setPedidoId(pedidos[0]?.id ?? "")
    setStockMinimo("0")
    setCategoria("")
  }

  const openEdit = (row: CatalogoProducto) => {
    setEditId(row.id)
    setNombre(row.nombre)
    setUnidad(row.unidad || "U")
    setPedidoId(row.pedidoId)
    setStockMinimo(String(row.stockMinimo ?? 0))
    setCategoria(row.categoria ?? "")
  }

  const guardar = async () => {
    if (!ownerId || !user?.uid) return
    if (!nombre.trim() || !pedidoId) {
      toast({ title: "Completá nombre y grupo", variant: "destructive" })
      return
    }
    setSaving(true)
    if (editId && editId !== "new") {
      const res = await actualizarProductoCatalogo(
        editId,
        {
          nombre: nombre.trim(),
          unidad,
          pedidoId,
          stockMinimo: Math.max(0, Math.floor(Number(stockMinimo) || 0)),
          categoria: categoria.trim() || null,
        },
        ownerId
      )
      setSaving(false)
      if (!res.ok) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
        return
      }
      toast({ title: "Producto actualizado" })
    } else {
      const res = await crearProductoCatalogo({
        ownerId,
        nombre: nombre.trim(),
        unidad,
        pedidoId,
        stockMinimo: Math.max(0, Math.floor(Number(stockMinimo) || 0)),
        categoria: categoria.trim() || undefined,
        user: { uid: user.uid },
      })
      setSaving(false)
      if (!res.ok) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
        return
      }
      toast({ title: "Producto creado", description: "El stock por sucursal se activa desde «Mi stock»." })
    }
    resetForm()
  }

  const onToggleActivo = async (id: string, activo: boolean) => {
    if (!ownerId) return
    const res = await toggleProductoActivo(id, activo, ownerId)
    if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" })
  }

  if (!puede) {
    return (
      <DashboardLayout user={user}>
        <Card>
          <CardHeader>
            <CardTitle>Catálogo</CardTitle>
            <CardDescription>Solo administradores pueden gestionar el catálogo.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex items-center gap-2">
          <Package className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-semibold">Catálogo de productos</h1>
            <p className="text-sm text-muted-foreground">
              Definición global. El stock por sucursal se gestiona en «Mi stock».
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Productos</CardTitle>
              <CardDescription>Listado de ítems del catálogo</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm()
                setEditId("new")
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nuevo producto
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Mín. ref.</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.nombre}</TableCell>
                      <TableCell>{row.unidad}</TableCell>
                      <TableCell>{pedidoNombre(row.pedidoId)}</TableCell>
                      <TableCell>{row.stockMinimo}</TableCell>
                      <TableCell>
                        <Switch
                          checked={row.activo}
                          onCheckedChange={(v) => void onToggleActivo(row.id, v)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {editId !== null && (
          <Card>
            <CardHeader>
              <CardTitle>{editId === "new" ? "Nuevo producto" : "Editar producto"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Unidad (U, KG, L…)</Label>
                <Input value={unidad} onChange={(e) => setUnidad(e.target.value || "U")} />
              </div>
              <div className="space-y-2">
                <Label>Grupo (pedido)</Label>
                <Select value={pedidoId} onValueChange={setPedidoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí grupo" />
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
              <div className="space-y-2">
                <Label>Stock mínimo de referencia</Label>
                <Input
                  type="number"
                  min={0}
                  value={stockMinimo}
                  onChange={(e) => setStockMinimo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría (opcional)</Label>
                <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void guardar()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Guardar
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
