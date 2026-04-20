"use client"

import { useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { deleteDoc, doc, updateDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { CatalogoProducto, GrupoCatalogoUI } from "@/lib/catalogo-types"
import { actualizarProductoCatalogo, crearProductoCatalogo, toggleProductoActivo } from "@/lib/catalogo-service"
import { parseFactor, calcularEquivalencia } from "@/lib/catalogo-normalize"
import { useToast } from "@/hooks/use-toast"
import { Download, Loader2, Pencil, Plus, Sparkles, Upload } from "lucide-react"

const PRODUCTOS_DEMO: Array<{
  nombre: string
  unidad: string
  unidadAlternativa?: string
  factorConversion?: number
  proveedor?: string
}> = [
  { nombre: "Leche entera", unidad: "L", proveedor: "La Serenísima" },
  { nombre: "Pan lactal", unidad: "u", proveedor: "Bimbo" },
  { nombre: "Queso cremoso", unidad: "kg", proveedor: "Sancor" },
  { nombre: "Yogur natural", unidad: "u", proveedor: "La Serenísima" },
  { nombre: "Manteca", unidad: "u", unidadAlternativa: "g", factorConversion: 200, proveedor: "Sancor" },
  { nombre: "Huevos", unidad: "docena", proveedor: "Granja San Miguel" },
  { nombre: "Azúcar", unidad: "kg", proveedor: "Ledesma" },
  { nombre: "Harina 0000", unidad: "kg", proveedor: "Molinos" },
  { nombre: "Aceite girasol", unidad: "L", proveedor: "Natura" },
  { nombre: "Arroz largo fino", unidad: "kg", proveedor: "Gallo" },
  { nombre: "Fideos spaghetti", unidad: "u", unidadAlternativa: "g", factorConversion: 500, proveedor: "Matarazzo" },
  { nombre: "Tomate perita", unidad: "kg", proveedor: "Verdulería Central" },
  { nombre: "Cebolla", unidad: "kg", proveedor: "Verdulería Central" },
  { nombre: "Papa", unidad: "kg", proveedor: "Verdulería Central" },
  { nombre: "Zanahoria", unidad: "kg", proveedor: "Verdulería Central" },
  { nombre: "Pollo entero", unidad: "kg", proveedor: "Granja San Miguel" },
  { nombre: "Carne picada", unidad: "kg", proveedor: "Carnicería Don José" },
  { nombre: "Atún en lata", unidad: "u", unidadAlternativa: "g", factorConversion: 170, proveedor: "La Campagnola" },
  { nombre: "Café molido", unidad: "u", unidadAlternativa: "g", factorConversion: 250, proveedor: "La Virginia" },
]

type TableMode = "editar" | "excel"
type SortKey = "nombre" | "unidad" | "unidadAlternativa" | "factorConversion" | "resultado" | "proveedor" | "activo"

const columnasExcel = ["nombre", "unidad", "unidadAlternativa", "factorConversion", "proveedor"] as const

interface ProductosTableProps {
  items: CatalogoProducto[]
  ownerId: string
  userId: string
  loadingItems: boolean
  groupById: Map<string, GrupoCatalogoUI>
}

export function ProductosTable({ items, ownerId, userId, loadingItems, groupById }: ProductosTableProps) {
  const { toast } = useToast()

  const [tableMode, setTableMode] = useState<TableMode>("editar")
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<Record<string, string>>({})
  const [excelDraft, setExcelDraft] = useState<Record<string, Record<string, string>>>({})
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null)

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

  const guardarCampoProducto = async (
    row: CatalogoProducto,
    changes: Parameters<typeof actualizarProductoCatalogo>[1]
  ) => {
    const res = await actualizarProductoCatalogo(row.id, { ...changes, pedidoId: "" }, ownerId)
    if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" })
  }

  const crearProducto = async () => {
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
        user: { uid: userId },
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
          user: { uid: userId },
        })
        if (res.ok) creados += 1
      }
      toast({ title: `Importación completada: ${creados} producto(s)` })
    } finally {
      setImportandoMasivo(false)
    }
  }

  const parsearTsv = (text: string) =>
    text
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

  const focusCell = (row: number, col: string) => {
    const el = document.querySelector<HTMLInputElement>(`[data-row="${row}"][data-col="${col}"]`)
    el?.focus()
    el?.select()
  }

  const handleExcelKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    col: (typeof columnasExcel)[number]
  ) => {
    const colIndex = columnasExcel.indexOf(col)
    if (e.key === "ArrowUp") { e.preventDefault(); if (rowIndex > 0) focusCell(rowIndex - 1, col); return }
    if (e.key === "ArrowDown") { e.preventDefault(); if (rowIndex < items.length - 1) focusCell(rowIndex + 1, col); return }
    if (e.key === "ArrowLeft") { e.preventDefault(); if (colIndex > 0) focusCell(rowIndex, columnasExcel[colIndex - 1]); return }
    if (e.key === "ArrowRight") { e.preventDefault(); if (colIndex < columnasExcel.length - 1) focusCell(rowIndex, columnasExcel[colIndex + 1]); return }
    if (e.key === "Enter") {
      e.preventDefault()
      e.currentTarget.blur()
      if (rowIndex < items.length - 1) focusCell(rowIndex + 1, col)
    }
  }

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items
    const rows = [...items]
    const dir = sortConfig.direction === "asc" ? 1 : -1
    const getValue = (row: CatalogoProducto) => {
      switch (sortConfig.key) {
        case "nombre":
          return row.nombre ?? ""
        case "unidad":
          return row.unidad ?? ""
        case "unidadAlternativa":
          return row.unidadAlternativa ?? ""
        case "factorConversion":
          return row.factorConversion ?? -1
        case "resultado":
          return calcularEquivalencia(row.nombre, row.unidad || "u", row.unidadAlternativa, row.factorConversion)
        case "proveedor":
          return row.proveedor ?? ""
        case "activo":
          return row.activo ? 1 : 0
      }
    }
    rows.sort((a, b) => {
      const av = getValue(a)
      const bv = getValue(b)
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
      return String(av).localeCompare(String(bv), "es", { sensitivity: "base" }) * dir
    })
    return rows
  }, [items, sortConfig])

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key, direction: "asc" }
    })
  }

  const sortIndicator = (key: SortKey) => {
    if (sortConfig?.key !== key) return "↕"
    return sortConfig.direction === "asc" ? "↑" : "↓"
  }

  return (
    <>
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
              <button
                type="button"
                aria-label="Cambiar modo de tabla"
                onClick={() => {
                  if (tableMode === "editar") {
                    setTableMode("excel")
                    setEditingRowId(null)
                  } else {
                    setTableMode("editar")
                  }
                }}
                className="group inline-flex min-w-[170px] items-center rounded-md border bg-muted/40 p-1"
              >
                <span
                  className={
                    tableMode === "editar"
                      ? "w-1/2 rounded-sm bg-blue-600 px-3 py-1.5 text-center text-sm font-medium text-white shadow-sm transition-all"
                      : "w-1/2 px-3 py-1.5 text-center text-sm text-muted-foreground transition-all group-hover:text-foreground"
                  }
                >
                  Editar
                </span>
                <span
                  className={
                    tableMode === "excel"
                      ? "w-1/2 rounded-sm bg-blue-600 px-3 py-1.5 text-center text-sm font-medium text-white shadow-sm transition-all"
                      : "w-1/2 px-3 py-1.5 text-center text-sm text-muted-foreground transition-all group-hover:text-foreground"
                  }
                >
                  Excel
                </span>
              </button>
              <Button variant="outline" onClick={() => nuevaFilaNombreRef.current?.focus()}>
                <Plus className="mr-1 h-4 w-4" />
                Nuevo producto
              </Button>
              <Button
                variant="outline"
                onClick={() => void crearDesdeFilas(PRODUCTOS_DEMO)}
                disabled={importandoMasivo}
              >
                {importandoMasivo ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                Cargar 19 de prueba
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
                  <th className="px-2 py-2 text-left font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("nombre")}>
                      Nombre <span className="text-xs text-muted-foreground">{sortIndicator("nombre")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("unidad")}>
                      Unidad base <span className="text-xs text-muted-foreground">{sortIndicator("unidad")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleSort("unidadAlternativa")}
                    >
                      Bulto. <span className="text-xs text-muted-foreground">{sortIndicator("unidadAlternativa")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleSort("factorConversion")}
                    >
                      Cantidad <span className="text-xs text-muted-foreground">{sortIndicator("factorConversion")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleSort("resultado")}
                    >
                      Resultado <span className="text-xs text-muted-foreground">{sortIndicator("resultado")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleSort("proveedor")}
                    >
                      Proveedor <span className="text-xs text-muted-foreground">{sortIndicator("proveedor")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("activo")}>
                      Activo <span className="text-xs text-muted-foreground">{sortIndicator("activo")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((row, index) => {
                  const isEditingRow = tableMode === "editar" && editingRowId === row.id
                  const draft = excelDraft[row.id]
                  const equivalencia = isEditingRow
                    ? calcularEquivalencia(
                        (editingValues.nombre ?? row.nombre).trim() || row.nombre,
                        (editingValues.unidad ?? row.unidad).trim() || "u",
                        (editingValues.unidadAlternativa ?? "").trim() || undefined,
                        parseFactor(editingValues.factorConversion ?? "") ?? undefined
                      )
                    : tableMode === "excel"
                      ? calcularEquivalencia(
                          draft?.nombre ?? row.nombre,
                          draft?.unidad ?? row.unidad ?? "u",
                          draft?.unidadAlternativa ?? row.unidadAlternativa,
                          parseFactor(draft?.factorConversion ?? "") ?? row.factorConversion
                        )
                      : calcularEquivalencia(
                          row.nombre,
                          row.unidad || "u",
                          row.unidadAlternativa,
                          row.factorConversion
                        )
                  return (
                    <tr key={row.id} className="border-b hover:bg-muted/20">
                      <td className="px-2 py-1">
                        {tableMode === "excel" ? (
                          <input
                            data-row={index}
                            data-col="nombre"
                            value={excelDraft[row.id]?.nombre ?? row.nombre}
                            className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                            onChange={(e) =>
                              setExcelDraft((prev) => ({
                                ...prev,
                                [row.id]: { ...prev[row.id], nombre: e.target.value },
                              }))
                            }
                            onKeyDown={(e) => handleExcelKeyDown(e, index, "nombre")}
                            onBlur={(e) => {
                              const value = e.target.value.trim()
                              if (value && value !== row.nombre) {
                                void guardarCampoProducto(row, { nombre: value })
                              }
                              setExcelDraft((prev) => {
                                const next = { ...prev }
                                delete next[row.id]
                                return next
                              })
                            }}
                          />
                        ) : null}
                        {tableMode === "editar" ? (
                          isEditingRow ? (
                            <input
                              value={editingValues.nombre ?? ""}
                              className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                              onChange={(e) =>
                                setEditingValues((prev) => ({ ...prev, nombre: e.target.value }))
                              }
                            />
                          ) : (
                            <span>{row.nombre}</span>
                          )
                        ) : null}
                      </td>
                      <td className="px-2 py-1">
                        {tableMode === "excel" ? (
                          <input
                            data-row={index}
                            data-col="unidad"
                            value={excelDraft[row.id]?.unidad ?? row.unidad}
                            className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                            onChange={(e) =>
                              setExcelDraft((prev) => ({
                                ...prev,
                                [row.id]: { ...prev[row.id], unidad: e.target.value },
                              }))
                            }
                            onKeyDown={(e) => handleExcelKeyDown(e, index, "unidad")}
                            onBlur={(e) => {
                              const value = e.target.value.trim() || "u"
                              if (value !== (row.unidad || "u")) {
                                void guardarCampoProducto(row, { unidad: value })
                              }
                              setExcelDraft((prev) => {
                                const next = { ...prev }
                                delete next[row.id]
                                return next
                              })
                            }}
                          />
                        ) : null}
                        {tableMode === "editar" ? (
                          isEditingRow ? (
                            <input
                              value={editingValues.unidad ?? ""}
                              className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                              onChange={(e) =>
                                setEditingValues((prev) => ({ ...prev, unidad: e.target.value }))
                              }
                            />
                          ) : (
                            <span>{row.unidad}</span>
                          )
                        ) : null}
                      </td>
                      <td className="px-2 py-1">
                        {tableMode === "excel" ? (
                          <input
                            data-row={index}
                            data-col="unidadAlternativa"
                            value={excelDraft[row.id]?.unidadAlternativa ?? (row.unidadAlternativa ?? "")}
                            placeholder="opcional"
                            className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                            onChange={(e) =>
                              setExcelDraft((prev) => ({
                                ...prev,
                                [row.id]: { ...prev[row.id], unidadAlternativa: e.target.value },
                              }))
                            }
                            onKeyDown={(e) => handleExcelKeyDown(e, index, "unidadAlternativa")}
                            onBlur={(e) => {
                              const value = e.target.value.trim()
                              const current = row.unidadAlternativa?.trim() ?? ""
                              if (value !== current) {
                                void guardarCampoProducto(row, { unidadAlternativa: value || null })
                              }
                              setExcelDraft((prev) => {
                                const next = { ...prev }
                                delete next[row.id]
                                return next
                              })
                            }}
                          />
                        ) : null}
                        {tableMode === "editar" ? (
                          isEditingRow ? (
                            <input
                              value={editingValues.unidadAlternativa ?? ""}
                              className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                              onChange={(e) =>
                                setEditingValues((prev) => ({
                                  ...prev,
                                  unidadAlternativa: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <span>{row.unidadAlternativa ?? "-"}</span>
                          )
                        ) : null}
                      </td>
                      <td className="px-2 py-1">
                        {tableMode === "excel" ? (
                          <div className="flex items-center gap-2">
                            <input
                              data-row={index}
                              data-col="factorConversion"
                              value={
                                excelDraft[row.id]?.factorConversion ??
                                (row.factorConversion ? String(row.factorConversion) : "")
                              }
                              placeholder="opcional"
                              className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                              onChange={(e) =>
                                setExcelDraft((prev) => ({
                                  ...prev,
                                  [row.id]: { ...prev[row.id], factorConversion: e.target.value },
                                }))
                              }
                              onKeyDown={(e) => handleExcelKeyDown(e, index, "factorConversion")}
                              onBlur={(e) => {
                                const next = parseFactor(e.target.value)
                                const current = row.factorConversion ?? null
                                if (next !== current) {
                                  void guardarCampoProducto(row, { factorConversion: next })
                                }
                                setExcelDraft((prev) => {
                                  const nextDraft = { ...prev }
                                  delete nextDraft[row.id]
                                  return nextDraft
                                })
                              }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {excelDraft[row.id]?.unidad ?? row.unidad ?? "u"}
                            </span>
                          </div>
                        ) : null}
                        {tableMode === "editar" ? (
                          isEditingRow ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={editingValues.factorConversion ?? ""}
                                className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                                onChange={(e) =>
                                  setEditingValues((prev) => ({
                                    ...prev,
                                    factorConversion: e.target.value,
                                  }))
                                }
                              />
                              <span className="text-xs text-muted-foreground">
                                {(editingValues.unidad ?? row.unidad).trim() || "u"}
                              </span>
                            </div>
                          ) : (
                            <span>{row.factorConversion ?? "—"}</span>
                          )
                        ) : null}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">{equivalencia}</td>
                      <td className="px-2 py-1">
                        {tableMode === "excel" ? (
                          <input
                            data-row={index}
                            data-col="proveedor"
                            defaultValue={row.proveedor ?? ""}
                            placeholder="opcional"
                            className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                            onKeyDown={(e) => handleExcelKeyDown(e, index, "proveedor")}
                            onBlur={(e) => {
                              const value = e.target.value.trim()
                              const current = row.proveedor?.trim() ?? ""
                              if (value === current) return
                              void guardarCampoProducto(row, { proveedor: value || null })
                            }}
                          />
                        ) : null}
                        {tableMode === "editar" ? (
                          isEditingRow ? (
                            <input
                              value={editingValues.proveedor ?? ""}
                              className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                              onChange={(e) =>
                                setEditingValues((prev) => ({ ...prev, proveedor: e.target.value }))
                              }
                            />
                          ) : (
                            <span>{row.proveedor ?? "-"}</span>
                          )
                        ) : null}
                      </td>
                      <td className="px-2 py-1">
                        <Switch
                          checked={row.activo}
                          onCheckedChange={(v) => void onToggleActivo(row.id, v)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          {tableMode === "editar" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingRowId(row.id)
                                  setEditingValues({
                                    nombre: row.nombre,
                                    unidad: row.unidad,
                                    unidadAlternativa: row.unidadAlternativa ?? "",
                                    factorConversion: row.factorConversion
                                      ? String(row.factorConversion)
                                      : "",
                                    proveedor: row.proveedor ?? "",
                                  })
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {isEditingRow ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      void guardarCampoProducto(row, {
                                        nombre: (editingValues.nombre ?? "").trim() || row.nombre,
                                        unidad: (editingValues.unidad ?? "").trim() || "u",
                                        unidadAlternativa:
                                          (editingValues.unidadAlternativa ?? "").trim() || null,
                                        factorConversion: parseFactor(
                                          editingValues.factorConversion ?? ""
                                        ),
                                        proveedor:
                                          (editingValues.proveedor ?? "").trim() || null,
                                      }).then(() => {
                                        setEditingRowId(null)
                                      })
                                    }}
                                  >
                                    <span aria-hidden>✓</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingRowId(null)}
                                  >
                                    <span aria-hidden>✗</span>
                                  </Button>
                                </>
                              ) : null}
                            </>
                          ) : null}
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
                        </div>
                      </td>
                    </tr>
                  )
                })}

                <tr className="border-b bg-muted/30">
                  <td className="px-2 py-1">
                    <input
                      ref={nuevaFilaNombreRef}
                      value={nuevoProductoNombre}
                      placeholder="Nombre"
                      className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                      onChange={(e) => setNuevoProductoNombre(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void crearProducto() }}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={nuevoProductoUnidad}
                      placeholder="kg, L, u"
                      className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                      onChange={(e) => setNuevoProductoUnidad(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void crearProducto() }}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={nuevoProductoUnidadAlt}
                      placeholder="horma, caja..."
                      className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                      onChange={(e) => setNuevoProductoUnidadAlt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void crearProducto() }}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={nuevoProductoFactor}
                      placeholder="1.5"
                      className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                      onChange={(e) => setNuevoProductoFactor(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void crearProducto() }}
                    />
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {calcularEquivalencia(
                      nuevoProductoNombre.trim() || "producto",
                      nuevoProductoUnidad.trim() || "u",
                      nuevoProductoUnidadAlt.trim() || undefined,
                      parseFactor(nuevoProductoFactor) ?? undefined
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={nuevoProductoProveedor}
                      placeholder="Proveedor"
                      className="w-full rounded border-none bg-transparent px-1 py-1 text-sm outline-none focus:bg-blue-50"
                      onChange={(e) => setNuevoProductoProveedor(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void crearProducto() }}
                    />
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">-</td>
                  <td className="px-2 py-1">
                    <Button size="icon" disabled={creandoProducto} onClick={() => void crearProducto()}>
                      {creandoProducto ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
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
            placeholder="Harina	kg	horma	1.5	Molinos SA"
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
    </>
  )
}
