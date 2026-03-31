"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { VENCAPP_CATEGORIES, VENCAPP_STATUS_COLORS } from "@/lib/vencapp-constants"
import { getNearestExpiry, getProductStatus } from "@/lib/vencapp-status"
import type { Lot, Producto, WarehouseZone } from "@/lib/types"

interface ProductsScreenProps {
  productos: Producto[]
  lots: Lot[]
  zones: WarehouseZone[]
  loading: boolean
  addProduct: (nombre: string, category?: Producto["category"]) => Promise<any>
  onOpenWorkPanel: (productId: string | null) => void
}

export function ProductsScreen({
  productos,
  lots,
  loading,
  addProduct,
  onOpenWorkPanel,
}: ProductsScreenProps) {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState<Producto["category"]>("Otro")
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return productos.filter((product) => {
      const matchesSearch = query.length === 0 || product.nombre.toLowerCase().includes(query)
      const category = product.category ?? "Otro"
      const matchesCategory = categoryFilter === "all" || category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [productos, search, categoryFilter])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await addProduct(newName.trim(), newCategory)
      setNewName("")
      setNewCategory("Otro")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <h1 className="text-xl font-semibold">Inventario</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto"
          className="h-11 max-w-xs border-gray-200"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-11 rounded-md border border-gray-200 px-3 text-sm"
        >
          <option value="all">Todas</option>
          {VENCAPP_CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((product) => {
          const status = getProductStatus(product.id, lots)
          const lotCount = lots.filter((lot) => lot.productId === product.id).length
          const nearestExpiry = getNearestExpiry(product.id, lots)
          const statusColor = VENCAPP_STATUS_COLORS[status]

          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onOpenWorkPanel(product.id)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{product.nombre}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                    <Badge variant="outline" className="border-gray-300 text-gray-700">
                      {product.category ?? "Otro"}
                    </Badge>
                    <span>{lotCount} lotes</span>
                    <span>
                      {nearestExpiry ? `Próx: ${nearestExpiry}` : "Sin vencimientos"}
                    </span>
                  </div>
                </div>
                <span
                  className="rounded-full px-2 py-1 text-xs font-semibold"
                  style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                >
                  {status === "danger" ? "Urgente" : status === "warn" ? "Próximo" : status === "ok" ? "OK" : "Sin lotes"}
                </span>
              </div>
            </button>
          )
        })}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            No hay productos para mostrar.
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold">Agregar producto</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del producto"
            className="h-11 border-gray-200"
          />
          <select
            value={newCategory ?? "Otro"}
            onChange={(e) => setNewCategory(e.target.value as Producto["category"])}
            className="h-11 rounded-md border border-gray-200 px-3 text-sm"
          >
            {VENCAPP_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="h-11"
          >
            {saving ? "Guardando..." : "Agregar"}
          </Button>
        </div>
      </div>
    </div>
  )
}

