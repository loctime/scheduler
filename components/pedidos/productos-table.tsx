/**
 * TAREA CRÍTICA – LIMPIEZA ESTRUCTURAL
 *
 * Este archivo está corrupto por una refactorización fallida.
 *
 * INSTRUCCIONES OBLIGATORIAS:
 * 1. Elegir UNA sola implementación funcional del componente ProductosTable.
 * 2. Eliminar COMPLETAMENTE todo el código duplicado, restos y versiones antiguas.
 * 3. Debe quedar:
 *    - un solo "use client"
 *    - un solo bloque de imports
 *    - componentes auxiliares definidos una sola vez
 *    - UN export function ProductosTable(...)
 * 4. NO agregar nuevas features.
 * 5. NO refactorizar lógica.
 * 6. SOLO limpiar, ordenar y dejar el archivo compilable.
 *
 * Si hay dudas, priorizar la versión MÁS COMPLETA y eliminar el resto.
 */
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

function StockInput({ value, onChange, onFocus }: { value: number | undefined; onChange: (v: number) => void; onFocus?: () => void }) {
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
      className="h-10 w-16 text-center text-sm font-medium px-1"
    />
  )
}

function PedidoControls({ pedidoCalculado, onDecrement, onIncrement, disabledDecrement }: { pedidoCalculado: number; onDecrement: () => void; onIncrement: () => void; disabledDecrement?: boolean }) {
  return (
    <div className="flex flex-col items-center shrink-0">
      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Pedir</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={onDecrement} disabled={disabledDecrement}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className={cn("font-bold text-lg w-8 text-center tabular-nums", pedidoCalculado > 0 ? "text-amber-600" : "text-green-600")}>
          {pedidoCalculado}
        </span>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={onIncrement}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function CreateProductForm({ nombre, onNombreChange, stockMinimo, onStockMinimoChange, unidad, onUnidadChange, onCreate, onCancel }: { nombre: string; onNombreChange: (v: string) => void; stockMinimo: string; onStockMinimoChange: (v: string) => void; unidad: string; onUnidadChange: (v: string) => void; onCreate: () => void; onCancel: () => void }) {
  return (
    <div className="px-2 py-2 flex items-center gap-2 border-t border-border bg-muted/30">
      <div className="flex-1 min-w-0">
        <Input value={nombre} onChange={(e) => onNombreChange(e.target.value)} placeholder="Nombre del producto" className="h-7 text-xs" />
      </div>

      <div className="flex flex-col items-center shrink-0">
        <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Mín</span>
        <Input type="number" inputMode="numeric" min="0" value={stockMinimo} onChange={(e) => onStockMinimoChange(e.target.value)} className="h-10 w-16 text-center text-sm font-medium" />
      </div>

      <div className="flex flex-col items-center shrink-0">
        <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Unid</span>
        <Input value={unidad} onChange={(e) => onUnidadChange(e.target.value)} placeholder="U" className="h-10 w-16 text-center text-sm font-medium" />
      </div>

      <Button variant="ghost" size="icon" onClick={onCreate} disabled={!nombre.trim()} className="h-7 w-7 shrink-0">
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <Button variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7 shrink-0">
        <X className="h-3.5 w-3.5" />
      </Button>
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
      <div className="flex items-center justify-between gap-1 p-1.5 pb-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Productos</h3>
          <p className="text-[10px] text-muted-foreground">{products.length} productos</p>
        </div>
        {onCreateProduct && configMode && (
          <Button variant="ghost" size="sm" onClick={() => setIsCreatingProduct(true)} className="h-7 text-xs px-2">
            <PlusCircle className="h-3.5 w-3.5 mr-1" />
            Agregar
          </Button>
        )}
      </div>

      <div className="divide-y divide-border">
        {products.map((product) => {
          const isEditing = editingField?.id === product.id
          const editingThisField = isEditing ? editingField?.field : null
          const stockActualValue = stockActual[product.id] ?? 0
          // Usar valor local para stockMinimo (actualización inmediata en UI)
          const stockMinimoValue = stockMinimoLocal[product.id] ?? product.stockMinimo
          const pedidoBase = calcularPedido(stockMinimoValue, stockActualValue)
          const ajuste = ajustesPedido[product.id] ?? 0
          const pedidoCalculado = Math.max(0, pedidoBase + ajuste)
          // Mostrar el valor lógico calculado en el input. No cambiar cálculos,
          // solo la representación visual para permitir mostrar 0 aunque
          // el mínimo (product.stockMinimo) se muestre por separado.
          const displayPedido = pedidoCalculado

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
                "px-2 py-2 flex items-center gap-2",
                mode === "pedido" && pedidoCalculado > 0 && "bg-amber-500/10",
                dragOverProductId === product.id && "bg-primary/5",
                draggedProductId === product.id && "opacity-50"
              )}
            >
              {onProductsOrderUpdate && (
                <div className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors">
                  <GripVertical className="h-4 w-4" />
                </div>
              )}

              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate">{product.nombre}</p>
                  {configMode ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">mín:</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            const nuevoValor = Math.max(0, stockMinimoValue - 1)
                            // Actualizar estado local primero (actualización inmediata en UI)
                            setStockMinimoLocal(prev => ({ ...prev, [product.id]: nuevoValor }))
                            // Llamar a onUpdateProduct en segundo plano
                            onUpdateProduct(product.id, "stockMinimo", nuevoValor.toString())
                          }}
                          disabled={stockMinimoValue <= 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <StockInput
                          value={stockMinimoValue}
                          onChange={(v) => {
                            // Actualizar estado local primero (actualización inmediata en UI)
                            setStockMinimoLocal(prev => ({ ...prev, [product.id]: v }))
                            // Llamar a onUpdateProduct en segundo plano
                            onUpdateProduct(product.id, "stockMinimo", v.toString())
                          }}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            const nuevoValor = stockMinimoValue + 1
                            // Actualizar estado local primero (actualización inmediata en UI)
                            setStockMinimoLocal(prev => ({ ...prev, [product.id]: nuevoValor }))
                            // Llamar a onUpdateProduct en segundo plano
                            onUpdateProduct(product.id, "stockMinimo", nuevoValor.toString())
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">mín: {stockMinimoValue}</p>
                  )}
                </div>

                {viewMode === "pedir" ? (
                  <>
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Actual</span>
                      <span className={cn("font-bold text-lg w-8 text-center tabular-nums", stockActualValue > 0 ? "text-amber-600" : "text-green-600")}>{stockActualValue}</span>
                    </div>

                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Pedir</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            if (onAjustePedidoChange) onAjustePedidoChange(product.id, (ajuste ?? 0) - 1)
                          }}
                          disabled={pedidoCalculado <= 0 && (!onAjustePedidoChange || (ajuste ?? 0) <= 0)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>

                        <StockInput
                          value={displayPedido}
                          onChange={(v) => {
                            if (!onAjustePedidoChange) return
                            const newAjuste = v - pedidoBase
                            onAjustePedidoChange(product.id, newAjuste)
                          }}
                        />

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            if (onAjustePedidoChange) onAjustePedidoChange(product.id, (ajuste ?? 0) + 1)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Pedir</span>
                      <span className={cn("font-bold text-lg w-8 text-center tabular-nums", pedidoCalculado > 0 ? "text-amber-600" : "text-green-600")}>{pedidoCalculado}</span>
                    </div>

                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Actual</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => onStockChange(product.id, Math.max(0, (stockActualValue ?? 0) - 1))}
                          disabled={(stockActualValue ?? 0) <= 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>

                        <StockInput
                          value={stockActual[product.id]}
                          onChange={(v) => onStockChange(product.id, v)}
                          onFocus={() => startEditing(product.id, "stockActual", (stockActual[product.id] ?? 0).toString())}
                        />

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => onStockChange(product.id, (stockActualValue ?? 0) + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {configMode && (
                  <Button variant="ghost" size="icon" onClick={() => onDeleteProduct(product.id)} className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
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
            