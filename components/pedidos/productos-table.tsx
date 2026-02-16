"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Upload, Package, Minus, Plus, GripVertical, PlusCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Producto } from "@/lib/types"

type TableMode = "config" | "pedido"

interface ProductosTableProps {
  products: Producto[]
  stockActual: Record<string, number>
  onStockChange: (productId: string, value: number) => void
  onUpdateProduct: (productId: string, field: string, value: string) => Promise<boolean>
  onDeleteProduct: (productId: string) => void
  onCreateProduct?: (nombre: string, stockMinimo?: number, unidad?: string) => Promise<string | null>
  onImport: () => void
  onProductsOrderUpdate?: (newOrder: string[]) => Promise<boolean>
  calcularPedido: (stockMinimo: number, stockActualValue: number | undefined) => number
  ajustesPedido?: Record<string, number>
  onAjustePedidoChange?: (productId: string, ajuste: number) => void
  configMode?: boolean
  stockMinimoDefault?: number
  viewMode?: "pedir" | "stock"
}

const btnIcon = "h-7 w-7 rounded-full transition-transform active:scale-95 shrink-0"

function StockInput({ value, onChange, onFocus, className }: { value: number | undefined; onChange: (v: number) => void; onFocus?: () => void; className?: string }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min="0"
      value={value !== undefined ? String(value) : ""}
      onChange={(e) => onChange(e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0)}
      onFocus={(e) => {
        onFocus?.()
        setTimeout(() => (e.target as HTMLInputElement).select(), 0)
      }}
      placeholder="0"
      className={cn("h-7 w-14 text-center text-sm font-medium px-1", className)}
    />
  )
}

function CreateProductForm({ nombre, onNombreChange, stockMinimo, onStockMinimoChange, unidad, onUnidadChange, onCreate, onCancel }: { nombre: string; onNombreChange: (v: string) => void; stockMinimo: string; onStockMinimoChange: (v: string) => void; unidad: string; onUnidadChange: (v: string) => void; onCreate: () => void; onCancel: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Input value={nombre} onChange={(e) => onNombreChange(e.target.value)} placeholder="Nombre del producto" className="h-8 text-sm flex-1" />
        <span className="text-xs text-muted-foreground">Mín</span>
        <Input type="number" inputMode="numeric" min="0" value={stockMinimo} onChange={(e) => onStockMinimoChange(e.target.value)} className="h-8 w-12 text-center text-sm" />
        <Input value={unidad} onChange={(e) => onUnidadChange(e.target.value)} placeholder="U" className="h-8 w-10 text-center text-xs" />
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onCreate} disabled={!nombre.trim()} className="h-7 w-7 shrink-0 rounded-full">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7 shrink-0 rounded-full">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ProductosTable({ products, stockActual, onStockChange, onUpdateProduct, onDeleteProduct, onCreateProduct, onImport, onProductsOrderUpdate, calcularPedido, ajustesPedido = {}, onAjustePedidoChange, configMode = false, stockMinimoDefault = 0, viewMode = "pedir", }: ProductosTableProps) {
  const mode: TableMode = configMode ? "config" : "pedido"

  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null)
  const [inlineValue, setInlineValue] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [newProductNombre, setNewProductNombre] = useState("")
  const [newProductStockMinimo, setNewProductStockMinimo] = useState((stockMinimoDefault ?? 0).toString())
  const [newProductUnidad, setNewProductUnidad] = useState("U")
  const newProductInputRef = useRef<HTMLInputElement | null>(null)

  // Estado local para stockMinimo (actualización inmediata en UI)
  const [stockMinimoLocal, setStockMinimoLocal] = useState<Record<string, number>>({})

  useEffect(() => {
    if (isCreatingProduct && newProductInputRef.current) newProductInputRef.current.focus()
  }, [isCreatingProduct])

  // Sincronizar stockMinimoLocal cuando cambia products (solo limpiar productos eliminados)
  useEffect(() => {
    setStockMinimoLocal(prev => {
      const productIds = new Set(products.map(p => p.id))
      const nuevo: Record<string, number> = {}
      // Solo mantener valores locales para productos que aún existen
      Object.keys(prev).forEach(productId => {
        if (productIds.has(productId)) {
          nuevo[productId] = prev[productId]
        }
      })
      return nuevo
    })
  }, [products])

  const startEditing = (id: string, field: string, value = "") => {
    setEditingField({ id, field })
    setInlineValue(value)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const cancelEditing = () => {
    setEditingField(null)
    setInlineValue("")
  }

  const handleInlineSave = useCallback(async (productId: string, field: string, value: string) => {
    const success = await onUpdateProduct(productId, field, value)
    if (success) cancelEditing()
  }, [onUpdateProduct])

  const orderedProductIds = products.map((p) => p.id)
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null)
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, productId: string) => {
    if (!onProductsOrderUpdate) return
    setDraggedProductId(productId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", productId)
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.5"
  }, [onProductsOrderUpdate])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedProductId(null)
    setDragOverProductId(null)
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1"
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, productId: string) => {
    if (!onProductsOrderUpdate || !draggedProductId || draggedProductId === productId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverProductId(productId)
  }, [onProductsOrderUpdate, draggedProductId])

  const handleDragLeave = useCallback(() => setDragOverProductId(null), [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    if (!onProductsOrderUpdate || !draggedProductId || draggedProductId === targetId) return
    e.preventDefault()
    const draggedIndex = orderedProductIds.indexOf(draggedProductId)
    const targetIndex = orderedProductIds.indexOf(targetId)
    if (draggedIndex === -1 || targetIndex === -1) return
    const newOrder = [...orderedProductIds]
    const [removed] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, removed)
    setDraggedProductId(null)
    setDragOverProductId(null)
    await onProductsOrderUpdate(newOrder)
  }, [onProductsOrderUpdate, draggedProductId, orderedProductIds])

  const handleCreateProduct = useCallback(async () => {
    if (!onCreateProduct || !newProductNombre.trim()) return
    const stockMinimo = parseInt(newProductStockMinimo, 10) || stockMinimoDefault
    const unidad = newProductUnidad.trim() || "U"
    const productId = await onCreateProduct(newProductNombre.trim(), stockMinimo, unidad)
    if (productId) {
      setNewProductNombre("")
      setNewProductStockMinimo((stockMinimoDefault ?? 0).toString())
      setNewProductUnidad("U")
      setIsCreatingProduct(false)
    }
  }, [onCreateProduct, newProductNombre, newProductStockMinimo, newProductUnidad, stockMinimoDefault])

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-1.5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold">Productos</h3>
            <p className="text-[10px] text-muted-foreground">Importa productos</p>
          </div>
        </div>
        <div className="py-4 text-center">
          <Package className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
          <p className="text-muted-foreground text-[11px] mb-2">No hay productos</p>
          <Button onClick={onImport} size="sm" className="h-6 text-[11px] px-2">
            <Upload className="mr-1 h-3 w-3" />
            Importar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Productos</h3>
          <p className="text-xs text-muted-foreground">{products.length} productos</p>
        </div>
        {onCreateProduct && configMode && (
          <Button variant="ghost" size="sm" onClick={() => setIsCreatingProduct(true)} className="h-7 text-xs px-2 rounded-full">
            <PlusCircle className="h-3.5 w-3.5 mr-1" />
            Agregar
          </Button>
        )}
      </div>

      <div className="space-y-1 p-2">
        {products.map((product) => {
          const stockActualValue = stockActual[product.id] ?? 0
          const stockMinimoValue = stockMinimoLocal[product.id] ?? product.stockMinimo
          const pedidoBase = calcularPedido(stockMinimoValue, stockActualValue)
          const ajuste = ajustesPedido[product.id] ?? 0
          const pedidoCalculado = Math.max(0, pedidoBase + ajuste)
          const displayPedido = pedidoCalculado
          const isBajoMinimo = stockActualValue < stockMinimoValue
          const pedidoMayorCero = viewMode === "pedir" && pedidoCalculado > 0

          return (
            <div
              key={product.id}
              draggable={!!onProductsOrderUpdate}
              onDragStart={(e) => handleDragStart(e, product.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, product.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, product.id)}
              className={cn(
                "rounded-lg border bg-card px-3 py-1.5 flex items-center gap-3 shadow-sm hover:shadow-md transition-all",
                isBajoMinimo && !pedidoMayorCero && "border-amber-300/60",
                dragOverProductId === product.id && "ring-2 ring-primary/20",
                draggedProductId === product.id && "opacity-50"
              )}
            >
              {onProductsOrderUpdate && (
                <div className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors">
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
              )}
              <p className="text-sm font-medium truncate flex-1 min-w-0">{product.nombre}</p>
              <div className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground tabular-nums">
                {stockActualValue} / {configMode ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Button variant="outline" size="icon" className="h-6 w-6 rounded-full shrink-0" onClick={() => {
                      const nuevoValor = Math.max(0, stockMinimoValue - 1)
                      setStockMinimoLocal(prev => ({ ...prev, [product.id]: nuevoValor }))
                      onUpdateProduct(product.id, "stockMinimo", nuevoValor.toString())
                    }} disabled={stockMinimoValue <= 0}>
                      <Minus className="h-2.5 w-2.5" />
                    </Button>
                    <StockInput value={stockMinimoValue} onChange={(v) => {
                      setStockMinimoLocal(prev => ({ ...prev, [product.id]: v }))
                      onUpdateProduct(product.id, "stockMinimo", v.toString())
                    }} className="h-6 w-10 text-xs" />
                    <Button variant="outline" size="icon" className="h-6 w-6 rounded-full shrink-0" onClick={() => {
                      const nuevoValor = stockMinimoValue + 1
                      setStockMinimoLocal(prev => ({ ...prev, [product.id]: nuevoValor }))
                      onUpdateProduct(product.id, "stockMinimo", nuevoValor.toString())
                    }}>
                      <Plus className="h-2.5 w-2.5" />
                    </Button>
                  </span>
                ) : (
                  <span>{stockMinimoValue}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {viewMode === "pedir" ? (
                  <>
                    <Button variant="outline" size="icon" className={btnIcon} onClick={() => onAjustePedidoChange?.(product.id, (ajuste ?? 0) - 1)} disabled={pedidoCalculado <= 0 && (ajuste ?? 0) <= 0}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <StockInput value={displayPedido} onChange={(v) => { if (onAjustePedidoChange) { const newAjuste = v - pedidoBase; onAjustePedidoChange(product.id, newAjuste) } }} className="h-7 w-14 text-sm" />
                    <Button variant="outline" size="icon" className={btnIcon} onClick={() => onAjustePedidoChange?.(product.id, (ajuste ?? 0) + 1)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="icon" className={btnIcon} onClick={() => onStockChange(product.id, Math.max(0, (stockActualValue ?? 0) - 1))} disabled={(stockActualValue ?? 0) <= 0}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <StockInput value={stockActual[product.id]} onChange={(v) => onStockChange(product.id, v)} onFocus={() => startEditing(product.id, "stockActual", (stockActual[product.id] ?? 0).toString())} className="h-7 w-14 text-sm" />
                    <Button variant="outline" size="icon" className={btnIcon} onClick={() => onStockChange(product.id, (stockActualValue ?? 0) + 1)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
              {configMode && (
                <Button variant="ghost" size="icon" onClick={() => onDeleteProduct(product.id)} className="h-7 w-7 shrink-0 rounded-full opacity-60 hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          )
        })}

        {isCreatingProduct && onCreateProduct && configMode && (
          <CreateProductForm
            nombre={newProductNombre}
            onNombreChange={setNewProductNombre}
            stockMinimo={newProductStockMinimo}
            onStockMinimoChange={setNewProductStockMinimo}
            unidad={newProductUnidad}
            onUnidadChange={setNewProductUnidad}
            onCreate={handleCreateProduct}
            onCancel={() => {
              setIsCreatingProduct(false)
              setNewProductNombre("")
              setNewProductStockMinimo((stockMinimoDefault ?? 0).toString())
              setNewProductUnidad("U")
            }}
          />
        )}
      </div>
    </div>
  )
}
            