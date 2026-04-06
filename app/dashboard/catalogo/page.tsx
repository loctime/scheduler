"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useData } from "@/contexts/data-context"
import { db, COLLECTIONS } from "@/lib/firebase"
import { canUser } from "@/lib/permissions"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import type { CatalogoProducto, GrupoCatalogo } from "@/lib/catalogo-types"
import { actualizarProductoCatalogo, crearProductoCatalogo, toggleProductoActivo } from "@/lib/catalogo-service"
import { useToast } from "@/hooks/use-toast"
import { ChevronDown, ChevronRight, Download, Loader2, Package, Pencil, Plus, Trash2, Upload } from "lucide-react"

type UbicacionCatalogo = {
  locationId: string
  locationName: string
}

type GrupoCatalogoUI = GrupoCatalogo & {
  productosIds: string[]
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
  return []
}

function normalizeProductosIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  for (const item of raw) {
    const id = String(item ?? "").trim()
    if (id) seen.add(id)
  }
  return [...seen]
}

export default function CatalogoAdminPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const ownerIdsParaUsuarios = useMemo(() => {
    if (!ownerId || !user?.uid) return null
    return [...new Set([ownerId, user.uid])]
  }, [ownerId, user?.uid])

  const puede = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "ver_admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const [items, setItems] = useState<CatalogoProducto[]>([])
  const [gruposCatalogo, setGruposCatalogo] = useState<GrupoCatalogoUI[]>([])
  const [ubicaciones, setUbicaciones] = useState<UbicacionCatalogo[]>([])
  const [loadingItems, setLoadingItems] = useState(true)

  const [openGroupIds, setOpenGroupIds] = useState<Record<string, boolean>>({})
  const [showNuevoGrupoForm, setShowNuevoGrupoForm] = useState(false)
  const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState("")
  const [nuevoGrupoDespachadoresIds, setNuevoGrupoDespachadoresIds] = useState<string[]>([])
  const [nuevoGrupoProductosIds, setNuevoGrupoProductosIds] = useState<string[]>([])
  const [creandoGrupo, setCreandoGrupo] = useState(false)

  const [editandoGrupoId, setEditandoGrupoId] = useState<string | null>(null)
  const [grupoEditNombre, setGrupoEditNombre] = useState("")
  const [grupoEditDespachadoresIds, setGrupoEditDespachadoresIds] = useState<string[]>([])
  const [grupoEditProductosIds, setGrupoEditProductosIds] = useState<string[]>([])
  const [guardandoGrupoId, setGuardandoGrupoId] = useState<string | null>(null)
  const [eliminandoGrupoId, setEliminandoGrupoId] = useState<string | null>(null)

  const [selectorProductosGrupoId, setSelectorProductosGrupoId] = useState<string | null>(null)
  const [selectorProductosIds, setSelectorProductosIds] = useState<string[]>([])
  const [guardandoSelectorGrupoId, setGuardandoSelectorGrupoId] = useState<string | null>(null)

  const [nuevoProductoNombre, setNuevoProductoNombre] = useState("")
  const [nuevoProductoUnidad, setNuevoProductoUnidad] = useState("u")
  const [nuevoProductoUnidadAlt, setNuevoProductoUnidadAlt] = useState("")
  const [nuevoProductoFactor, setNuevoProductoFactor] = useState("")
  const [nuevoProductoProveedor, setNuevoProductoProveedor] = useState("")
  const [creandoProducto, setCreandoProducto] = useState(false)
  const [eliminandoProductoId, setEliminandoProductoId] = useState<string | null>(null)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkTsv, setBulkTsv] = useState("")
  const [importandoMasivo, setImportandoMasivo] = useState(false)

  const nuevaFilaNombreRef = useRef<HTMLInputElement | null>(null)
  const xlsxInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!db || !ownerId) {
      setItems([])
      setLoadingItems(false)
      return
    }
    setLoadingItems(true)
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
            unidadAlternativa:
              typeof x.unidadAlternativa === "string" && x.unidadAlternativa.trim()
                ? x.unidadAlternativa.trim()
                : undefined,
            factorConversion:
              typeof x.factorConversion === "number" && Number.isFinite(x.factorConversion) && x.factorConversion > 0
                ? x.factorConversion
                : undefined,
            proveedor: typeof x.proveedor === "string" && x.proveedor.trim() ? x.proveedor.trim() : undefined,
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
        setLoadingItems(false)
      },
      (err) => {
        console.warn("[catalogo] productos listener:", err)
        setLoadingItems(false)
      }
    )
    return () => unsub()
  }, [ownerId])

  useEffect(() => {
    if (!db || !ownerId) {
      setGruposCatalogo([])
      return
    }
    const gq = query(collection(db, COLLECTIONS.GRUPOS_CATALOGO), where("ownerId", "==", ownerId))
    const unsub = onSnapshot(
      gq,
      (snap) => {
        const list: GrupoCatalogoUI[] = snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>
          return {
            id: d.id,
            nombre: String(x.nombre ?? ""),
            ownerId: String(x.ownerId ?? ""),
            createdBy: String(x.createdBy ?? ""),
            createdAt: x.createdAt,
            despachadores: normalizeDespachadoresGrupo(x),
            productosIds: normalizeProductosIds(x.productosIds),
          }
        })
        list.sort((a, b) => a.nombre.localeCompare(b.nombre))
        setGruposCatalogo(list)
      },
      (err) => {
        console.warn("[catalogo] grupos listener:", err)
      }
    )
    return () => unsub()
  }, [ownerId])

  useEffect(() => {
    if (!db || !ownerIdsParaUsuarios?.length) {
      setUbicaciones([])
      return
    }
    const ids = ownerIdsParaUsuarios
    const uq =
      ids.length === 1
        ? query(collection(db, COLLECTIONS.USERS), where("ownerId", "==", ids[0]!))
        : query(collection(db, COLLECTIONS.USERS), where("ownerId", "in", ids))
    const unsub = onSnapshot(
      uq,
      (snap) => {
        const byLocation = new Map<string, UbicacionCatalogo>()
        for (const d of snap.docs) {
          const x = d.data() as Record<string, unknown>
          if (x.disabled === true) continue
          const locationName = typeof x.locationName === "string" ? x.locationName.trim() : ""
          if (!locationName) continue
          const locationId = String(x.locationId ?? x.location ?? d.id)
          if (!byLocation.has(locationId)) byLocation.set(locationId, { locationId, locationName })
        }
        const rows = [...byLocation.values()].sort((a, b) => a.locationName.localeCompare(b.locationName))
        setUbicaciones(rows)
      },
      (err) => {
        console.warn("[catalogo] ubicaciones listener:", err)
        setUbicaciones([])
      }
    )
    return () => unsub()
  }, [ownerIdsParaUsuarios])

  const groupById = useMemo(() => {
    const map = new Map<string, GrupoCatalogoUI>()
    for (const g of gruposCatalogo) map.set(g.id, g)
    return map
  }, [gruposCatalogo])

  const productById = useMemo(() => {
    const map = new Map<string, CatalogoProducto>()
    for (const p of items) map.set(p.id, p)
    return map
  }, [items])

  const getDespachadoresFromIds = (ids: string[]) => {
    const out: Array<{ locationId: string; locationName: string }> = []
    for (const id of ids) {
      const u = ubicaciones.find((x) => x.locationId === id)
      if (u) out.push({ locationId: u.locationId, locationName: u.locationName })
    }
    return out
  }

  const toggleIdInList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    id: string,
    checked: boolean
  ) => {
    setter((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((x) => x !== id)
    })
  }

  const updateGroupProductsMembership = async (
    grupoId: string,
    selectedIds: string[],
    currentIds: string[]
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!db || !ownerId) return { ok: false, error: "Firestore no está disponible" }
    const selectedSet = new Set(selectedIds)
    const currentSet = new Set(currentIds)
    const added = selectedIds.filter((id) => !currentSet.has(id))
    const removed = currentIds.filter((id) => !selectedSet.has(id))

    for (const productId of added) {
      const res = await actualizarProductoCatalogo(
        productId,
        { grupoCatalogoId: grupoId, pedidoId: "", stockMinimo: productById.get(productId)?.stockMinimo ?? 0 },
        ownerId
      )
      if (!res.ok) return { ok: false, error: res.error ?? "No se pudo asignar producto" }
    }

    for (const productId of removed) {
      const res = await actualizarProductoCatalogo(productId, { grupoCatalogoId: null, pedidoId: "" }, ownerId)
      if (!res.ok) return { ok: false, error: res.error ?? "No se pudo desasignar producto" }
    }

    await updateDoc(doc(db, COLLECTIONS.GRUPOS_CATALOGO, grupoId), { productosIds: [...selectedSet] })
    return { ok: true }
  }

  const crearGrupo = async () => {
    if (!db || !ownerId || !user?.uid) return
    const nombreTrim = nuevoGrupoNombre.trim()
    if (!nombreTrim) {
      toast({ title: "Indicá el nombre del grupo", variant: "destructive" })
      return
    }
    if (nuevoGrupoDespachadoresIds.length === 0) {
      toast({ title: "Elegí al menos un despachador", variant: "destructive" })
      return
    }
    const despachadores = getDespachadoresFromIds(nuevoGrupoDespachadoresIds)
    if (despachadores.length === 0) {
      toast({ title: "Ubicaciones inválidas", variant: "destructive" })
      return
    }

    setCreandoGrupo(true)
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.GRUPOS_CATALOGO), {
        nombre: nombreTrim,
        ownerId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        despachadores,
        productosIds: nuevoGrupoProductosIds,
      })
      const syncRes = await updateGroupProductsMembership(ref.id, nuevoGrupoProductosIds, [])
      if (!syncRes.ok) {
        toast({
          title: "Grupo creado con advertencia",
          description: syncRes.error ?? "No se pudo sincronizar la asignación de productos",
          variant: "destructive",
        })
      } else {
        toast({ title: "Grupo creado" })
      }
      setNuevoGrupoNombre("")
      setNuevoGrupoDespachadoresIds([])
      setNuevoGrupoProductosIds([])
      setShowNuevoGrupoForm(false)
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

  const iniciarEdicionGrupo = (g: GrupoCatalogoUI) => {
    setEditandoGrupoId(g.id)
    setGrupoEditNombre(g.nombre)
    setGrupoEditDespachadoresIds(g.despachadores.map((d) => d.locationId))
    setGrupoEditProductosIds(g.productosIds)
  }

  const guardarEdicionGrupo = async () => {
    if (!db || !editandoGrupoId || !ownerId) return
    const nombreTrim = grupoEditNombre.trim()
    if (!nombreTrim) {
      toast({ title: "Indicá el nombre del grupo", variant: "destructive" })
      return
    }
    const despachadores = getDespachadoresFromIds(grupoEditDespachadoresIds)
    if (despachadores.length === 0) {
      toast({ title: "Elegí al menos un despachador", variant: "destructive" })
      return
    }
    const group = groupById.get(editandoGrupoId)
    if (!group) return

    setGuardandoGrupoId(editandoGrupoId)
    try {
      await updateDoc(doc(db, COLLECTIONS.GRUPOS_CATALOGO, editandoGrupoId), {
        nombre: nombreTrim,
        despachadores,
        productosIds: grupoEditProductosIds,
      })
      const syncRes = await updateGroupProductsMembership(editandoGrupoId, grupoEditProductosIds, group.productosIds)
      if (!syncRes.ok) {
        toast({
          title: "Grupo actualizado con advertencia",
          description: syncRes.error ?? "No se pudo sincronizar la asignación de productos",
          variant: "destructive",
        })
      } else {
        toast({ title: "Grupo actualizado" })
      }
      setEditandoGrupoId(null)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo actualizar el grupo",
        variant: "destructive",
      })
    } finally {
      setGuardandoGrupoId(null)
    }
  }

  const eliminarGrupo = async (grupoId: string) => {
    if (!db || !ownerId) return
    const group = groupById.get(grupoId)
    if (!group) return
    setEliminandoGrupoId(grupoId)
    try {
      for (const productId of group.productosIds) {
        const res = await actualizarProductoCatalogo(productId, { grupoCatalogoId: null, pedidoId: "" }, ownerId)
        if (!res.ok) throw new Error(res.error ?? "No se pudo desasignar productos del grupo")
      }
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

  const abrirSelectorGrupo = (group: GrupoCatalogoUI) => {
    setSelectorProductosGrupoId(group.id)
    setSelectorProductosIds(group.productosIds)
  }

  const guardarSelectorGrupo = async () => {
    if (!selectorProductosGrupoId) return
    const group = groupById.get(selectorProductosGrupoId)
    if (!group) return
    setGuardandoSelectorGrupoId(group.id)
    try {
      const res = await updateGroupProductsMembership(group.id, selectorProductosIds, group.productosIds)
      if (!res.ok) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
        return
      }
      toast({ title: "Productos del grupo actualizados" })
      setSelectorProductosGrupoId(null)
      setSelectorProductosIds([])
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo guardar",
        variant: "destructive",
      })
    } finally {
      setGuardandoSelectorGrupoId(null)
    }
  }

  const parseFactor = (raw: string): number | null => {
    const value = Number(raw.replace(",", ".").trim())
    if (!Number.isFinite(value) || value <= 0) return null
    return value
  }

  const equivalenciaTexto = (row: CatalogoProducto) => {
    const unidadAlt = row.unidadAlternativa?.trim()
    const factor = row.factorConversion
    if (!unidadAlt || typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) return "sin conversión"
    return `1 ${unidadAlt} = ${factor} ${row.unidad || "u"}`
  }

  const guardarCampoProducto = async (
    row: CatalogoProducto,
    changes: Parameters<typeof actualizarProductoCatalogo>[1]
  ) => {
    if (!ownerId) return
    const res = await actualizarProductoCatalogo(row.id, { ...changes, pedidoId: "" }, ownerId)
    if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" })
  }

  const crearProducto = async () => {
    if (!ownerId || !user?.uid) return
    const nombreTrim = nuevoProductoNombre.trim()
    if (!nombreTrim) {
      toast({ title: "Indicá el nombre", variant: "destructive" })
      return
    }
    setCreandoProducto(true)
    try {
      const res = await crearProductoCatalogo({
        ownerId,
        nombre: nombreTrim,
        unidad: nuevoProductoUnidad.trim() || "u",
        unidadAlternativa: nuevoProductoUnidadAlt.trim() || undefined,
        factorConversion: parseFactor(nuevoProductoFactor) ?? undefined,
        proveedor: nuevoProductoProveedor.trim() || undefined,
        pedidoId: "",
        stockMinimo: 0,
        user: { uid: user.uid },
      })
      if (!res.ok || !res.catalogoId) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
        return
      }
      toast({ title: "Producto creado" })
      setNuevoProductoNombre("")
      setNuevoProductoUnidad("u")
      setNuevoProductoUnidadAlt("")
      setNuevoProductoFactor("")
      setNuevoProductoProveedor("")
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo crear",
        variant: "destructive",
      })
    } finally {
      setCreandoProducto(false)
    }
  }

  const eliminarProducto = async (row: CatalogoProducto) => {
    if (!db) return
    setEliminandoProductoId(row.id)
    try {
      await deleteDoc(doc(db, COLLECTIONS.CATALOGO, row.id))
      if (row.grupoCatalogoId) {
        const group = groupById.get(row.grupoCatalogoId)
        if (group) {
          await updateDoc(doc(db, COLLECTIONS.GRUPOS_CATALOGO, group.id), {
            productosIds: group.productosIds.filter((id) => id !== row.id),
          })
        }
      }
      toast({ title: "Producto eliminado" })
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo eliminar",
        variant: "destructive",
      })
    } finally {
      setEliminandoProductoId(null)
    }
  }

  const onToggleActivo = async (id: string, activo: boolean) => {
    if (!ownerId) return
    const res = await toggleProductoActivo(id, activo, ownerId)
    if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" })
  }

  const crearDesdeFilas = async (
    rows: Array<{
      nombre: string
      unidad: string
      unidadAlternativa?: string
      factorConversion?: number
      proveedor?: string
    }>
  ) => {
    if (!ownerId || !user?.uid) return
    if (!rows.length) {
      toast({ title: "No hay filas válidas para importar", variant: "destructive" })
      return
    }
    setImportandoMasivo(true)
    try {
      let creados = 0
      for (const row of rows) {
        const res = await crearProductoCatalogo({
          ownerId,
          nombre: row.nombre,
          unidad: row.unidad || "u",
          unidadAlternativa: row.unidadAlternativa,
          factorConversion: row.factorConversion,
          proveedor: row.proveedor,
          pedidoId: "",
          stockMinimo: 0,
          user: { uid: user.uid },
        })
        if (res.ok) creados += 1
      }
      toast({ title: `Importación completada: ${creados} producto(s)` })
    } finally {
      setImportandoMasivo(false)
    }
  }

  const parsearTsv = (text: string) => {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split("\t"))
      .map((cols) => {
        const nombre = (cols[0] ?? "").trim()
        const unidad = (cols[1] ?? "").trim() || "u"
        const unidadAlternativa = (cols[2] ?? "").trim()
        const factorConversion = parseFactor(cols[3] ?? "")
        const proveedor = (cols[4] ?? "").trim()
        if (!nombre) return null
        return {
          nombre,
          unidad,
          unidadAlternativa: unidadAlternativa || undefined,
          factorConversion: factorConversion ?? undefined,
          proveedor: proveedor || undefined,
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
    return rows
  }

  const importarDesdeXlsx = async (file: File) => {
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data, { type: "array" })
    const firstSheet = wb.Sheets[wb.SheetNames[0] ?? ""]
    if (!firstSheet) {
      toast({ title: "Archivo sin hojas válidas", variant: "destructive" })
      return
    }
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(firstSheet, { header: 1 })
    const rows = matrix
      .filter((cols) => Array.isArray(cols) && cols.some((v) => String(v ?? "").trim() !== ""))
      .map((cols) => {
        const nombre = String(cols[0] ?? "").trim()
        const unidad = String(cols[1] ?? "").trim() || "u"
        const unidadAlternativa = String(cols[2] ?? "").trim()
        const factorConversion = parseFactor(String(cols[3] ?? ""))
        const proveedor = String(cols[4] ?? "").trim()
        if (!nombre) return null
        return {
          nombre,
          unidad,
          unidadAlternativa: unidadAlternativa || undefined,
          factorConversion: factorConversion ?? undefined,
          proveedor: proveedor || undefined,
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
    await crearDesdeFilas(rows)
  }

  const exportarXlsx = () => {
    const rows = items.map((row) => ({
      nombre: row.nombre,
      unidadBase: row.unidad ?? "",
      unidadAlt: row.unidadAlternativa ?? "",
      factor: row.factorConversion ?? "",
      proveedor: row.proveedor ?? "",
      activo: row.activo ? "sí" : "no",
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Catalogo")
    XLSX.writeFile(wb, "catalogo-productos.xlsx")
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-semibold">Catálogo</h1>
            <p className="text-sm text-muted-foreground">
              Gestioná grupos de pedido y productos del catálogo en tiempo real.
            </p>
          </div>
        </div>

        <Tabs defaultValue="grupos" className="gap-4">
          <TabsList>
            <TabsTrigger value="grupos">Grupos de pedido</TabsTrigger>
            <TabsTrigger value="productos">Catálogo de productos</TabsTrigger>
          </TabsList>

          <TabsContent value="grupos" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowNuevoGrupoForm((prev) => !prev)}>
                <Plus className="mr-1 h-4 w-4" />
                Nuevo grupo
              </Button>
            </div>

            {gruposCatalogo.map((g) => {
              const open = openGroupIds[g.id] === true
              const productosAsignados = g.productosIds
                .map((id) => productById.get(id))
                .filter((x): x is CatalogoProducto => Boolean(x))

              return (
                <Collapsible
                  key={g.id}
                  open={open}
                  onOpenChange={(next) => setOpenGroupIds((prev) => ({ ...prev, [g.id]: next }))}
                >
                  <Card>
                    <CardHeader className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex min-w-[260px] flex-1 items-center gap-2 text-left"
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="font-medium">{g.nombre}</span>
                          </button>
                        </CollapsibleTrigger>

                        <div className="flex flex-wrap items-center gap-2">
                          {g.despachadores.map((d) => (
                            <Badge key={d.locationId} className="bg-green-100 text-green-800 hover:bg-green-100">
                              {d.locationName}
                            </Badge>
                          ))}
                          <Badge variant="secondary">{g.productosIds.length} productos</Badge>
                          <Button variant="ghost" size="icon" onClick={() => iniciarEdicionGrupo(g)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            disabled={eliminandoGrupoId === g.id}
                            onClick={() => void eliminarGrupo(g.id)}
                          >
                            {eliminandoGrupoId === g.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
                        {editandoGrupoId === g.id ? (
                          <div className="rounded-md border p-4 space-y-4">
                            <div className="space-y-2">
                              <Label>Nombre del grupo</Label>
                              <Input
                                value={grupoEditNombre}
                                onChange={(e) => setGrupoEditNombre(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Despachadores</Label>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {ubicaciones.map((u) => (
                                  <label key={u.locationId} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={grupoEditDespachadoresIds.includes(u.locationId)}
                                      onCheckedChange={(v) =>
                                        toggleIdInList(setGrupoEditDespachadoresIds, u.locationId, v === true)
                                      }
                                    />
                                    <span>{u.locationName}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Productos del catálogo</Label>
                              <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-3">
                                {items.map((p) => (
                                  <label key={p.id} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={grupoEditProductosIds.includes(p.id)}
                                      onCheckedChange={(v) =>
                                        toggleIdInList(setGrupoEditProductosIds, p.id, v === true)
                                      }
                                    />
                                    <span>
                                      {p.nombre} ({p.unidad})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                disabled={guardandoGrupoId === g.id}
                                onClick={() => void guardarEdicionGrupo()}
                              >
                                {guardandoGrupoId === g.id ? (
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : null}
                                Guardar
                              </Button>
                              <Button variant="outline" onClick={() => setEditandoGrupoId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              {productosAsignados.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Este grupo no tiene productos asignados.</p>
                              ) : (
                                productosAsignados.map((p) => (
                                  <div
                                    key={p.id}
                                    className="rounded-md border px-3 py-2 text-sm flex items-center justify-between"
                                  >
                                    <span>{p.nombre}</span>
                                    <span className="text-muted-foreground">{p.unidad}</span>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="space-y-3">
                              <Button variant="outline" onClick={() => abrirSelectorGrupo(g)}>
                                <Plus className="mr-1 h-4 w-4" />
                                Agregar producto
                              </Button>
                              {selectorProductosGrupoId === g.id ? (
                                <div className="rounded-md border p-3 space-y-3">
                                  <div className="max-h-56 space-y-2 overflow-y-auto">
                                    {items.map((p) => (
                                      <label key={p.id} className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                          checked={selectorProductosIds.includes(p.id)}
                                          onCheckedChange={(v) =>
                                            toggleIdInList(setSelectorProductosIds, p.id, v === true)
                                          }
                                        />
                                        <span>
                                          {p.nombre} ({p.unidad})
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      disabled={guardandoSelectorGrupoId === g.id}
                                      onClick={() => void guardarSelectorGrupo()}
                                    >
                                      {guardandoSelectorGrupoId === g.id ? (
                                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                      ) : null}
                                      Guardar selección
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setSelectorProductosGrupoId(null)
                                        setSelectorProductosIds([])
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )
            })}

            {showNuevoGrupoForm ? (
              <Card>
                <CardHeader>
                  <CardTitle>Nuevo grupo</CardTitle>
                  <CardDescription>Definí nombre, despachadores y productos iniciales.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre del grupo</Label>
                    <Input value={nuevoGrupoNombre} onChange={(e) => setNuevoGrupoNombre(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Despachadores</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ubicaciones.map((u) => (
                        <label key={u.locationId} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={nuevoGrupoDespachadoresIds.includes(u.locationId)}
                            onCheckedChange={(v) =>
                              toggleIdInList(setNuevoGrupoDespachadoresIds, u.locationId, v === true)
                            }
                          />
                          <span>{u.locationName}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Productos del catálogo</Label>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                      {items.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={nuevoGrupoProductosIds.includes(p.id)}
                            onCheckedChange={(v) =>
                              toggleIdInList(setNuevoGrupoProductosIds, p.id, v === true)
                            }
                          />
                          <span>
                            {p.nombre} ({p.unidad})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button disabled={creandoGrupo} onClick={() => void crearGrupo()}>
                      {creandoGrupo ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                      Guardar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowNuevoGrupoForm(false)
                        setNuevoGrupoNombre("")
                        setNuevoGrupoDespachadoresIds([])
                        setNuevoGrupoProductosIds([])
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="productos" className="space-y-4">
            {loadingItems ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando productos...
              </div>
            ) : null}

            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Catálogo de productos</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        nuevaFilaNombreRef.current?.focus()
                      }}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Nuevo producto
                    </Button>
                    <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
                      Pegar desde Excel
                    </Button>
                    <Button variant="outline" onClick={() => xlsxInputRef.current?.click()}>
                      <Upload className="mr-1 h-4 w-4" />
                      Importar .xlsx
                    </Button>
                    <Button variant="outline" onClick={exportarXlsx}>
                      <Download className="mr-1 h-4 w-4" />
                      Exportar .xlsx
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void importarDesdeXlsx(file)
                    e.currentTarget.value = ""
                  }}
                />

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-2 py-2 text-left font-medium">Nombre</th>
                        <th className="px-2 py-2 text-left font-medium">Unidad base</th>
                        <th className="px-2 py-2 text-left font-medium">Unidad alt.</th>
                        <th className="px-2 py-2 text-left font-medium">Factor</th>
                        <th className="px-2 py-2 text-left font-medium">Equivalencia</th>
                        <th className="px-2 py-2 text-left font-medium">Proveedor</th>
                        <th className="px-2 py-2 text-left font-medium">Activo</th>
                        <th className="px-2 py-2 text-left font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-muted/20">
                          <td className="px-2 py-1">
                            <input
                              defaultValue={row.nombre}
                              className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                              onBlur={(e) => {
                                const value = e.target.value.trim()
                                if (!value || value === row.nombre) return
                                void guardarCampoProducto(row, { nombre: value })
                              }}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              defaultValue={row.unidad}
                              className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                              onBlur={(e) => {
                                const value = e.target.value.trim() || "u"
                                if (value === (row.unidad || "u")) return
                                void guardarCampoProducto(row, { unidad: value })
                              }}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              defaultValue={row.unidadAlternativa ?? ""}
                              placeholder="opcional"
                              className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                              onBlur={(e) => {
                                const value = e.target.value.trim()
                                const current = row.unidadAlternativa?.trim() ?? ""
                                if (value === current) return
                                void guardarCampoProducto(row, { unidadAlternativa: value || null })
                              }}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              defaultValue={row.factorConversion ?? ""}
                              placeholder="opcional"
                              className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                              onBlur={(e) => {
                                const next = parseFactor(e.target.value)
                                const current = row.factorConversion ?? null
                                if (next === current) return
                                void guardarCampoProducto(row, { factorConversion: next })
                              }}
                            />
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">{equivalenciaTexto(row)}</td>
                          <td className="px-2 py-1">
                            <input
                              defaultValue={row.proveedor ?? ""}
                              placeholder="opcional"
                              className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                              onBlur={(e) => {
                                const value = e.target.value.trim()
                                const current = row.proveedor?.trim() ?? ""
                                if (value === current) return
                                void guardarCampoProducto(row, { proveedor: value || null })
                              }}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Switch checked={row.activo} onCheckedChange={(v) => void onToggleActivo(row.id, v)} />
                          </td>
                          <td className="px-2 py-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              disabled={eliminandoProductoId === row.id}
                              onClick={() => void eliminarProducto(row)}
                            >
                              {eliminandoProductoId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <span aria-hidden>✕</span>
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}

                      <tr className="border-b bg-muted/30">
                        <td className="px-2 py-1">
                          <input
                            ref={nuevaFilaNombreRef}
                            value={nuevoProductoNombre}
                            placeholder="Nombre"
                            className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                            onChange={(e) => setNuevoProductoNombre(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void crearProducto()
                            }}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            value={nuevoProductoUnidad}
                            placeholder="kg, L, u"
                            className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                            onChange={(e) => setNuevoProductoUnidad(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void crearProducto()
                            }}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            value={nuevoProductoUnidadAlt}
                            placeholder="horma, caja..."
                            className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                            onChange={(e) => setNuevoProductoUnidadAlt(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void crearProducto()
                            }}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            value={nuevoProductoFactor}
                            placeholder="1.5"
                            className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                            onChange={(e) => setNuevoProductoFactor(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void crearProducto()
                            }}
                          />
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">sin conversión</td>
                        <td className="px-2 py-1">
                          <input
                            value={nuevoProductoProveedor}
                            placeholder="Proveedor"
                            className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                            onChange={(e) => setNuevoProductoProveedor(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void crearProducto()
                            }}
                          />
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">-</td>
                        <td className="px-2 py-1">
                          <Button size="icon" disabled={creandoProducto} onClick={() => void crearProducto()}>
                            {creandoProducto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Pegar desde Excel</DialogTitle>
                  <DialogDescription>
                    Pegá filas TSV (tabuladas) con columnas: nombre, unidad base, unidad alt., factor, proveedor.
                  </DialogDescription>
                </DialogHeader>
                <textarea
                  value={bulkTsv}
                  onChange={(e) => setBulkTsv(e.target.value)}
                  className="min-h-[220px] w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Harina\tkg\thorma\t1.5\tMolinos SA"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    disabled={importandoMasivo}
                    onClick={() => {
                      const rows = parsearTsv(bulkTsv)
                      void crearDesdeFilas(rows).then(() => {
                        setBulkDialogOpen(false)
                        setBulkTsv("")
                      })
                    }}
                  >
                    {importandoMasivo ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Importar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
