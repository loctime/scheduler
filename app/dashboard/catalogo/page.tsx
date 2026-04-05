"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore"
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
import type { CatalogoProducto, GrupoCatalogo } from "@/lib/catalogo-types"
import {
  crearProductoCatalogo,
  actualizarProductoCatalogo,
  toggleProductoActivo,
} from "@/lib/catalogo-service"
import { useToast } from "@/hooks/use-toast"
import { FolderTree, Loader2, Package, Plus, Trash2 } from "lucide-react"

type DestinoUsuario = {
  locationId: string
  locationName: string
}

export default function CatalogoAdminPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])

  const puede = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "ver_admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [gruposCatalogo, setGruposCatalogo] = useState<GrupoCatalogo[]>([])
  const [destinosUsuarios, setDestinosUsuarios] = useState<DestinoUsuario[]>([])
  const [items, setItems] = useState<CatalogoProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState("")
  const [nuevoGrupoDestinoLocationId, setNuevoGrupoDestinoLocationId] = useState("")
  const [creandoGrupo, setCreandoGrupo] = useState(false)
  const [eliminandoGrupoId, setEliminandoGrupoId] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [nombre, setNombre] = useState("")
  const [unidad, setUnidad] = useState("U")
  const [grupoCatalogoId, setGrupoCatalogoId] = useState("")
  const [stockMinimo, setStockMinimo] = useState("0")
  const [categoria, setCategoria] = useState("")

  useEffect(() => {
    if (!db || !ownerId) return
    const pq = query(collection(db, COLLECTIONS.PEDIDOS), where("ownerId", "==", ownerId))
    const unsub = onSnapshot(pq, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Pedido[]
      list.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setPedidos(list)
    })
    return () => unsub()
  }, [ownerId])

  useEffect(() => {
    if (!db || !ownerId) return
    const gq = query(collection(db, COLLECTIONS.GRUPOS_CATALOGO), where("ownerId", "==", ownerId))
    const unsub = onSnapshot(gq, (snap) => {
      const list: GrupoCatalogo[] = snap.docs.map((d) => {
        const x = d.data() as Record<string, unknown>
        return {
          id: d.id,
          nombre: String(x.nombre ?? ""),
          destinoLocationId: String(x.destinoLocationId ?? ""),
          destinoNombre: String(x.destinoNombre ?? ""),
          ownerId: String(x.ownerId ?? ""),
          createdBy: String(x.createdBy ?? ""),
          createdAt: x.createdAt,
        }
      })
      list.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setGruposCatalogo(list)
    })
    return () => unsub()
  }, [ownerId])

  useEffect(() => {
    if (!db || !ownerId || !user?.uid) {
      setDestinosUsuarios([])
      return
    }
    const firestore = db
    const uid = user.uid
    const uq = query(collection(firestore, COLLECTIONS.USERS), where("ownerId", "==", ownerId))
    const unsub = onSnapshot(
      uq,
      async (snap) => {
        try {
          const byLocation = new Map<string, DestinoUsuario>()
          snap.docs.forEach((d) => {
            const x = d.data() as Record<string, unknown>
            const locName = typeof x.locationName === "string" ? x.locationName.trim() : ""
            if (!locName) return
            const locationId = String(x.locationId ?? x.location ?? x.ownerId ?? d.id)
            if (!byLocation.has(locationId)) {
              byLocation.set(locationId, { locationId, locationName: locName })
            }
          })
          const adminSnap = await getDoc(doc(firestore, COLLECTIONS.USERS, uid))
          if (adminSnap.exists()) {
            const x = adminSnap.data() as Record<string, unknown>
            const locName = typeof x.locationName === "string" ? x.locationName.trim() : ""
            if (locName) {
              const locationId = String(x.locationId ?? x.location ?? x.ownerId ?? uid)
              if (!byLocation.has(locationId)) {
                byLocation.set(locationId, { locationId, locationName: locName })
              }
            }
          }
          const rows = [...byLocation.values()].sort((a, b) =>
            a.locationName.localeCompare(b.locationName)
          )
          setDestinosUsuarios(rows)
        } catch {
          setDestinosUsuarios([])
        }
      },
      () => setDestinosUsuarios([])
    )
    return () => unsub()
  }, [ownerId, user?.uid])

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
            grupoCatalogoId: x.grupoCatalogoId ? String(x.grupoCatalogoId) : undefined,
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

  const grupoNombre = useCallback(
    (id: string | undefined) => {
      if (!id) return ""
      return gruposCatalogo.find((g) => g.id === id)?.nombre ?? id
    },
    [gruposCatalogo]
  )

  const etiquetaGrupoProducto = useCallback(
    (row: CatalogoProducto) => {
      if (row.grupoCatalogoId) return grupoNombre(row.grupoCatalogoId)
      return pedidoNombre(row.pedidoId)
    },
    [grupoNombre, pedidoNombre]
  )

  useEffect(() => {
    if (editId !== "new") return
    setGrupoCatalogoId((prev) => (prev ? prev : gruposCatalogo[0]?.id ?? ""))
  }, [editId, gruposCatalogo])

  const resetForm = () => {
    setEditId(null)
    setNombre("")
    setUnidad("U")
    setGrupoCatalogoId(gruposCatalogo[0]?.id ?? "")
    setStockMinimo("0")
    setCategoria("")
  }

  const openEdit = (row: CatalogoProducto) => {
    setEditId(row.id)
    setNombre(row.nombre)
    setUnidad(row.unidad || "U")
    setGrupoCatalogoId(row.grupoCatalogoId ?? gruposCatalogo[0]?.id ?? "")
    setStockMinimo(String(row.stockMinimo ?? 0))
    setCategoria(row.categoria ?? "")
  }

  const crearGrupo = async () => {
    if (!db || !ownerId || !user?.uid) return
    const nombreTrim = nuevoGrupoNombre.trim()
    if (!nombreTrim) {
      toast({ title: "Indicá el nombre del grupo", variant: "destructive" })
      return
    }
    if (!nuevoGrupoDestinoLocationId) {
      toast({
        title: "Elegí un destino",
        description: "Necesitás al menos un usuario vinculado con nombre de ubicación.",
        variant: "destructive",
      })
      return
    }
    const dest = destinosUsuarios.find((d) => d.locationId === nuevoGrupoDestinoLocationId)
    if (!dest) {
      toast({ title: "Destino inválido", variant: "destructive" })
      return
    }
    setCreandoGrupo(true)
    try {
      await addDoc(collection(db, COLLECTIONS.GRUPOS_CATALOGO), {
        nombre: nombreTrim,
        destinoLocationId: dest.locationId,
        destinoNombre: dest.locationName,
        ownerId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })
      setNuevoGrupoNombre("")
      setNuevoGrupoDestinoLocationId("")
      toast({ title: "Grupo creado" })
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo crear el grupo",
        variant: "destructive",
      })
    } finally {
      setCreandoGrupo(false)
    }
  }

  const eliminarGrupo = async (grupoId: string) => {
    if (!db) return
    setEliminandoGrupoId(grupoId)
    try {
      await deleteDoc(doc(db, COLLECTIONS.GRUPOS_CATALOGO, grupoId))
      toast({ title: "Grupo eliminado" })
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo eliminar",
        variant: "destructive",
      })
    } finally {
      setEliminandoGrupoId(null)
    }
  }

  const guardar = async () => {
    if (!ownerId || !user?.uid) return
    if (!nombre.trim() || !grupoCatalogoId) {
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
          grupoCatalogoId: grupoCatalogoId.trim(),
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
        pedidoId: "",
        grupoCatalogoId: grupoCatalogoId.trim(),
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
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              <div>
                <CardTitle>Grupos</CardTitle>
                <CardDescription>
                  Agrupá productos por destino (ubicación con nombre). Los pedidos del sistema siguen usando su propia
                  colección; acá definís grupos solo para el catálogo.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {gruposCatalogo.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gruposCatalogo.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.nombre}</TableCell>
                      <TableCell>{g.destinoNombre || g.destinoLocationId}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          aria-label="Eliminar grupo"
                          disabled={eliminandoGrupoId === g.id}
                          onClick={() => void eliminarGrupo(g.id)}
                        >
                          {eliminandoGrupoId === g.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay grupos. Creá el primero abajo.</p>
            )}

            <div className="rounded-lg border p-4 space-y-4 max-w-lg">
              <p className="text-sm font-medium">Nuevo grupo</p>
              <div className="space-y-2">
                <Label>Nombre del grupo</Label>
                <Input
                  placeholder="Ej: Papelería, Limpieza"
                  value={nuevoGrupoNombre}
                  onChange={(e) => setNuevoGrupoNombre(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Destino</Label>
                <Select
                  value={nuevoGrupoDestinoLocationId || undefined}
                  onValueChange={setNuevoGrupoDestinoLocationId}
                  disabled={destinosUsuarios.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        destinosUsuarios.length === 0
                          ? "Sin ubicaciones con nombre (configuración → invitaciones)"
                          : "Elegí ubicación"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {destinosUsuarios.map((d) => (
                      <SelectItem key={d.locationId} value={d.locationId}>
                        {d.locationName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void crearGrupo()} disabled={creandoGrupo}>
                {creandoGrupo ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Crear grupo
              </Button>
            </div>
          </CardContent>
        </Card>

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
                      <TableCell>{etiquetaGrupoProducto(row)}</TableCell>
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
                <Label>Grupo</Label>
                <Select value={grupoCatalogoId} onValueChange={setGrupoCatalogoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí grupo del catálogo" />
                  </SelectTrigger>
                  <SelectContent>
                    {gruposCatalogo.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nombre}
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
