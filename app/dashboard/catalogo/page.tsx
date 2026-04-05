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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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

type UbicacionCatalogo = {
  locationId: string
  locationName: string
}

function normalizeDespachadoresGrupo(
  x: Record<string, unknown>
): Array<{ locationId: string; locationName: string }> {
  const raw = x.despachadores
  if (Array.isArray(raw)) {
    const out: Array<{ locationId: string; locationName: string }> = []
    for (const item of raw) {
      if (!item || typeof item !== "object") continue
      const o = item as Record<string, unknown>
      const locationId = String(o.locationId ?? "").trim()
      const locationName = typeof o.locationName === "string" ? o.locationName.trim() : ""
      if (locationId && locationName) out.push({ locationId, locationName })
    }
    return out
  }
  const legacyId = String(x.destinoLocationId ?? "").trim()
  const legacyName = typeof x.destinoNombre === "string" ? x.destinoNombre.trim() : ""
  if (legacyId && legacyName) {
    return [{ locationId: legacyId, locationName: legacyName }]
  }
  return []
}

const FILTRO_TODOS_LOS_GRUPOS = "__all__"

export default function CatalogoAdminPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])

  /** Dueño del espacio + uid actual: los links de invitación guardan `ownerId` = quien creó el link, no siempre el tenant raíz. */
  const ownerIdsParaUsuarios = useMemo(() => {
    if (!ownerId || !user?.uid) return null
    return [...new Set([ownerId, user.uid])]
  }, [ownerId, user?.uid])

  const puede = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "ver_admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [gruposCatalogo, setGruposCatalogo] = useState<GrupoCatalogo[]>([])
  const [ubicaciones, setUbicaciones] = useState<UbicacionCatalogo[]>([])
  const [items, setItems] = useState<CatalogoProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState("")
  const [nuevoGrupoDespachadoresIds, setNuevoGrupoDespachadoresIds] = useState<string[]>([])
  const [creandoGrupo, setCreandoGrupo] = useState(false)
  const [eliminandoGrupoId, setEliminandoGrupoId] = useState<string | null>(null)

  const [filtroGrupoCatalogoId, setFiltroGrupoCatalogoId] = useState("")

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
          ownerId: String(x.ownerId ?? ""),
          createdBy: String(x.createdBy ?? ""),
          createdAt: x.createdAt,
          despachadores: normalizeDespachadoresGrupo(x),
        }
      })
      list.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setGruposCatalogo(list)
    })
    return () => unsub()
  }, [ownerId])

  useEffect(() => {
    if (!db || !ownerIdsParaUsuarios?.length) {
      setUbicaciones([])
      return
    }
    const firestore = db
    const ids = ownerIdsParaUsuarios
    const uq =
      ids.length === 1
        ? query(collection(firestore, COLLECTIONS.USERS), where("ownerId", "==", ids[0]!))
        : query(collection(firestore, COLLECTIONS.USERS), where("ownerId", "in", ids))

    const mergeUsuarioDoc = (
      byLocation: Map<string, UbicacionCatalogo>,
      d: { id: string; data: () => Record<string, unknown> }
    ) => {
      const x = d.data()
      const locName = typeof x.locationName === "string" ? x.locationName.trim() : ""
      if (!locName) return
      const locationId = String(x.locationId ?? x.location ?? x.ownerId ?? d.id)
      if (!byLocation.has(locationId)) {
        byLocation.set(locationId, { locationId, locationName: locName })
      }
    }

    let cancelled = false
    let loadGen = 0

    const unsub = onSnapshot(
      uq,
      (snap) => {
        const myGen = ++loadGen
        void (async () => {
          const byLocation = new Map<string, UbicacionCatalogo>()
          snap.docs.forEach((d) => mergeUsuarioDoc(byLocation, d))

          if (user?.uid && !cancelled && myGen === loadGen) {
            try {
              const selfSnap = await getDoc(doc(firestore, COLLECTIONS.USERS, user.uid))
              if (cancelled || myGen !== loadGen) return
              if (selfSnap.exists()) {
                mergeUsuarioDoc(byLocation, {
                  id: selfSnap.id,
                  data: () => selfSnap.data() as Record<string, unknown>,
                })
              }
            } catch {
              /* merge del propio usuario es opcional; no invalidar el resto */
            }
          }

          if (cancelled || myGen !== loadGen) return
          const rows = [...byLocation.values()].sort((a, b) =>
            a.locationName.localeCompare(b.locationName)
          )
          setUbicaciones(rows)
        })()
      },
      (err) => {
        console.warn("[catalogo] ubicaciones listener:", err)
      }
    )
    return () => {
      cancelled = true
      loadGen += 1
      unsub()
    }
  }, [ownerIdsParaUsuarios, user?.uid])

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

  const itemsFiltrados = useMemo(() => {
    if (!filtroGrupoCatalogoId) return items
    return items.filter((row) => row.grupoCatalogoId === filtroGrupoCatalogoId)
  }, [items, filtroGrupoCatalogoId])

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

  const toggleDespachadorNuevoGrupo = (locationId: string, checked: boolean) => {
    setNuevoGrupoDespachadoresIds((prev) => {
      if (checked) return prev.includes(locationId) ? prev : [...prev, locationId]
      return prev.filter((id) => id !== locationId)
    })
  }

  const crearGrupo = async () => {
    if (!db || !ownerId || !user?.uid) return
    const nombreTrim = nuevoGrupoNombre.trim()
    if (!nombreTrim) {
      toast({ title: "Indicá el nombre del grupo", variant: "destructive" })
      return
    }
    if (nuevoGrupoDespachadoresIds.length === 0) {
      toast({
        title: "Elegí al menos un despachador",
        description: "Marcá una o más ubicaciones como despachadores del grupo.",
        variant: "destructive",
      })
      return
    }
    const despachadores: Array<{ locationId: string; locationName: string }> = []
    for (const id of nuevoGrupoDespachadoresIds) {
      const u = ubicaciones.find((x) => x.locationId === id)
      if (u) despachadores.push({ locationId: u.locationId, locationName: u.locationName })
    }
    if (despachadores.length === 0) {
      toast({ title: "Ubicaciones inválidas", variant: "destructive" })
      return
    }
    setCreandoGrupo(true)
    try {
      await addDoc(collection(db, COLLECTIONS.GRUPOS_CATALOGO), {
        nombre: nombreTrim,
        ownerId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        despachadores,
      })
      setNuevoGrupoNombre("")
      setNuevoGrupoDespachadoresIds([])
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
                  Cada grupo une varios despachadores (ubicaciones con nombre). Los pedidos del sistema siguen en su
                  colección; estos grupos son solo para organizar el catálogo.
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
                    <TableHead>Despachadores</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gruposCatalogo.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.nombre}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {g.despachadores.length > 0 ? (
                            g.despachadores.map((d) => (
                              <Badge key={d.locationId} variant="secondary">
                                {d.locationName}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
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
                <Label>Despachadores</Label>
                {ubicaciones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay usuarios con nombre de ubicación. Configuralos en invitaciones o perfiles.
                  </p>
                ) : (
                  <div className="rounded-md border p-3 space-y-3 max-h-48 overflow-y-auto">
                    {ubicaciones.map((u) => (
                      <label
                        key={u.locationId}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={nuevoGrupoDespachadoresIds.includes(u.locationId)}
                          onCheckedChange={(v) =>
                            toggleDespachadorNuevoGrupo(u.locationId, v === true)
                          }
                        />
                        <span>{u.locationName}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={() => void crearGrupo()}
                disabled={creandoGrupo || ubicaciones.length === 0}
              >
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
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 max-w-xs">
              <Label className="shrink-0">Filtrar por grupo</Label>
              <Select
                value={filtroGrupoCatalogoId ? filtroGrupoCatalogoId : FILTRO_TODOS_LOS_GRUPOS}
                onValueChange={(v) =>
                  setFiltroGrupoCatalogoId(v === FILTRO_TODOS_LOS_GRUPOS ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los grupos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTRO_TODOS_LOS_GRUPOS}>Todos los grupos</SelectItem>
                  {gruposCatalogo.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                  {itemsFiltrados.map((row) => (
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
                <Label>Grupo del catálogo</Label>
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
