// REFACTOR PASO 1:
// Hay mucha UI duplicada (inputs de stock, botones + / -).
// Extraer componentes reutilizables.
// No cambiar comportamiento.
// REFACTOR PASO 2:
// Separar lógica de cálculo (pedido, ajuste, stock)
// de la lógica de render.
// Extraer helpers o hooks simples.
// No cambiar comportamiento.
// REFACTOR PASO 3:
// Simplificar handlers largos.
// Eliminar código repetido.
// Mantener exactamente el mismo flujo.


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

export function ProductosTable({
  products,
  stockActual,
  onStockChange,
  onUpdateProduct,
  onDeleteProduct,
  onCreateProduct,
  onImport,
  onProductsOrderUpdate,
  calcularPedido,
  ajustesPedido = {},
  onAjustePedidoChange,
  configMode = false,
  stockMinimoDefault = 0,
  viewMode = "pedir",
}: ProductosTableProps) {
  const mode: TableMode = configMode ? "config" : "pedido"

  // Simple editing helpers
  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null)
  const [inlineValue, setInlineValue] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  // New product form
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [newProductNombre, setNewProductNombre] = useState("")
  const [newProductStockMinimo, setNewProductStockMinimo] = useState(stockMinimoDefault.toString())
  const [newProductUnidad, setNewProductUnidad] = useState("U")
  const newProductInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isCreatingProduct && newProductInputRef.current) newProductInputRef.current.focus()
  }, [isCreatingProduct])

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

  // Drag & drop (optional): basic implementation to support onProductsOrderUpdate if provided
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null)
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null)
  const orderedProductIds = products.map((p) => p.id)

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
      setNewProductStockMinimo(stockMinimoDefault.toString())
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
          const pedidoBase = calcularPedido(product.stockMinimo, stockActualValue)
          const ajuste = ajustesPedido[product.id] ?? 0
          const pedidoCalculado = Math.max(0, pedidoBase + ajuste)

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
                  <p className="text-[10px] text-muted-foreground">mín: {product.stockMinimo}</p>
                </div>

                {/* Order depends on viewMode */}
                {viewMode === "pedir" ? (
                  <>
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Actual</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={stockActual[product.id] !== undefined ? stockActual[product.id] : ""}
                        onChange={(e) => onStockChange(product.id, e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0)}
                        onFocus={(e) => startEditing(product.id, "stockActual", (stockActual[product.id] ?? 0).toString())}
                        placeholder="0"
                        className="h-10 w-16 text-center text-sm font-medium px-1"
                      />
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
                            else onStockChange(product.id, (stockActualValue || 0) + 1)
                          }}
                          disabled={pedidoCalculado <= 0 && (!onAjustePedidoChange || (ajuste ?? 0) <= 0)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className={cn("font-bold text-lg w-8 text-center tabular-nums", pedidoCalculado > 0 ? "text-amber-600" : "text-green-600")}>
                          {pedidoCalculado}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            if (onAjustePedidoChange) onAjustePedidoChange(product.id, (ajuste ?? 0) + 1)
                            else if (stockActualValue > 0) onStockChange(product.id, stockActualValue - 1)
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => onStockChange(product.id, Math.max(0, (stockActualValue || 0) - 1))}
                          disabled={stockActualValue <= 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className={cn("font-bold text-lg w-8 text-center tabular-nums", pedidoCalculado > 0 ? "text-amber-600" : "text-green-600")}>
                          {pedidoCalculado}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => onStockChange(product.id, (stockActualValue || 0) + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Actual</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={stockActual[product.id] !== undefined ? stockActual[product.id] : ""}
                        onChange={(e) => onStockChange(product.id, e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0)}
                        onFocus={(e) => startEditing(product.id, "stockActual", (stockActual[product.id] ?? 0).toString())}
                        placeholder="0"
                        className="h-10 w-16 text-center text-sm font-medium px-1"
                      />
                    </div>
                  </>
                )}

                <Button variant="ghost" size="icon" onClick={() => onDeleteProduct(product.id)} className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          )
        })}

        {isCreatingProduct && onCreateProduct && configMode && (
          <div className="px-2 py-2 flex items-center gap-2 border-t border-border bg-muted/30">
            <div className="flex-1 min-w-0">
              <Input
                ref={newProductInputRef}
                value={newProductNombre}
                onChange={(e) => setNewProductNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateProduct()
                  if (e.key === "Escape") {
                    setIsCreatingProduct(false)
                    setNewProductNombre("")
                    setNewProductStockMinimo(stockMinimoDefault.toString())
                    setNewProductUnidad("U")
                  }
                }}
                placeholder="Nombre del producto"
                className="h-7 text-xs"
              />
            </div>

            <div className="flex flex-col items-center shrink-0">
              <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Mín</span>
              <Input type="number" inputMode="numeric" min="0" value={newProductStockMinimo} onChange={(e) => setNewProductStockMinimo(e.target.value)} className="h-10 w-16 text-center text-sm font-medium" />
            </div>

            <div className="flex flex-col items-center shrink-0">
              <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Unid</span>
              <Input value={newProductUnidad} onChange={(e) => setNewProductUnidad(e.target.value)} placeholder="U" className="h-10 w-16 text-center text-sm font-medium" />
            </div>

            <Button variant="ghost" size="icon" onClick={handleCreateProduct} disabled={!newProductNombre.trim()} className="h-7 w-7 shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </Button>

            <Button variant="ghost" size="icon" onClick={() => { setIsCreatingProduct(false); setNewProductNombre(""); setNewProductStockMinimo(stockMinimoDefault.toString()); setNewProductUnidad("U") }} className="h-7 w-7 shrink-0">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
  products,
  stockActual,
  onStockChange,
  onUpdateProduct,
  onDeleteProduct,
  onCreateProduct,
  onImport,
  onProductsOrderUpdate,
  calcularPedido,
  ajustesPedido = {},
  onAjustePedidoChange,
  configMode = false,
  stockMinimoDefault = 0,
  viewMode = "pedir",
}: ProductosTableProps) {
  // Sincronizar el modo con configMode del padre
  const mode: TableMode = configMode ? "config" : "pedido"
  const [editingField, setEditingField] = useState<{id: string, field: string} | null>(null)
                {mode === "pedido" ? (
                  // MODO PEDIDO - Layout compacto
                  <div className="flex items-center gap-2 flex-1">
                    {/* Nombre del producto */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{product.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">
                        mín: {product.stockMinimo}
                      </p>
                    </div>

                    {/* Order depends on viewMode: pedir -> Actual then Pedir; stock -> Pedir then Actual */}
                    {viewMode === "pedir" ? (
                      <>
                        {/* Stock actual input */}
                        <div className="flex flex-col items-center shrink-0">
                          <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Actual</span>
                          {editingThisField === "stockActual" ? (
                            <Input
                              ref={inputRef}
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={inlineValue}
                              onChange={(e) => setInlineValue(e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => {
                                if (!isNavigatingRef.current) {
                                  const numValue = parseInt(inlineValue, 10) || 0
                                  onStockChange(product.id, numValue)
                                  setEditingField(null)
                                  setInlineValue("")
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const numValue = parseInt(inlineValue, 10) || 0
                                  onStockChange(product.id, numValue)
                                  setEditingField(null)
                                  setInlineValue("")
                                } else if (e.key === "Escape") {
                                  setEditingField(null)
                                  setInlineValue("")
                                } else if (e.key === "ArrowDown") {
                                  e.preventDefault()
                                  navigateToNextRow(product.id, "stockActual", inlineValue, "down")
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault()
                                  navigateToNextRow(product.id, "stockActual", inlineValue, "up")
                                }
                              }}
                              autoFocus
                              placeholder="0"
                              className="h-10 w-16 text-center text-sm font-medium px-1"
                            />
                          ) : (
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={stockActual[product.id] !== undefined ? stockActual[product.id] : ""}
                              onChange={(e) => {
                                const val = e.target.value
                                onStockChange(product.id, val === "" ? 0 : parseInt(val, 10) || 0)
                              }}
                              onFocus={(e) => {
                                startEditing(product.id, "stockActual", (stockActual[product.id] ?? 0).toString())
                                // Seleccionar texto cuando se hace focus
                                setTimeout(() => e.target.select(), 0)
                              }}
                              placeholder="0"
                              className="h-10 w-16 text-center text-sm font-medium px-1"
                            />
                          )}
                        </div>

                        {/* Pedido con botones +/- */}
                        <div className="flex flex-col items-center shrink-0">
                          <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Pedir</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => {
                                if (onAjustePedidoChange) {
                                  const nuevoAjuste = (ajuste ?? 0) - 1
                                  onAjustePedidoChange(product.id, nuevoAjuste)
                                } else {
                                  // Fallback: si no hay función de ajuste, aumentar stock (comportamiento antiguo)
                                  onStockChange(product.id, stockActualValue + 1)
                                }
                              }}
                              disabled={pedidoCalculado <= 0 && (!onAjustePedidoChange || (ajuste ?? 0) <= 0)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className={cn(
                              "font-bold text-lg w-8 text-center tabular-nums",
                              pedidoCalculado > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                            )}>
                              {pedidoCalculado}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => {
                                if (onAjustePedidoChange) {
                                  const nuevoAjuste = (ajuste ?? 0) + 1
                                  onAjustePedidoChange(product.id, nuevoAjuste)
                                } else {
                                  // Fallback: si no hay función de ajuste, disminuir stock (comportamiento antiguo)
                                  if (stockActualValue > 0) {
                                    onStockChange(product.id, stockActualValue - 1)
                                  }
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Pedido con botones +/- (shown first in stock view) */}
                        <div className="flex flex-col items-center shrink-0">
                          <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Pedir</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => {
                                if (onAjustePedidoChange) {
                                  const nuevoAjuste = (ajuste ?? 0) - 1
                                  onAjustePedidoChange(product.id, nuevoAjuste)
                                } else {
                                  onStockChange(product.id, stockActualValue + 1)
                                }
                              }}
                              disabled={pedidoCalculado <= 0 && (!onAjustePedidoChange || (ajuste ?? 0) <= 0)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className={cn(
                              "font-bold text-lg w-8 text-center tabular-nums",
                              pedidoCalculado > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                            )}>
                              {pedidoCalculado}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => {
                                if (onAjustePedidoChange) {
                                  const nuevoAjuste = (ajuste ?? 0) + 1
                                  onAjustePedidoChange(product.id, nuevoAjuste)
                                } else {
                                  if (stockActualValue > 0) {
                                    onStockChange(product.id, stockActualValue - 1)
                                  }
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Stock actual input (shown after pedir in stock view) */}
                        <div className="flex flex-col items-center shrink-0">
                          <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Actual</span>
                          {editingThisField === "stockActual" ? (
                            <Input
                              ref={inputRef}
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={inlineValue}
                              onChange={(e) => setInlineValue(e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => {
                                if (!isNavigatingRef.current) {
                                  const numValue = parseInt(inlineValue, 10) || 0
                                  onStockChange(product.id, numValue)
                                  setEditingField(null)
                                  setInlineValue("")
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const numValue = parseInt(inlineValue, 10) || 0
                                  onStockChange(product.id, numValue)
                                  setEditingField(null)
                                  setInlineValue("")
                                } else if (e.key === "Escape") {
                                  setEditingField(null)
                                  setInlineValue("")
                                } else if (e.key === "ArrowDown") {
                                  e.preventDefault()
                                  navigateToNextRow(product.id, "stockActual", inlineValue, "down")
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault()
                                  navigateToNextRow(product.id, "stockActual", inlineValue, "up")
                                }
                              }}
                              autoFocus
                              placeholder="0"
                              className="h-10 w-16 text-center text-sm font-medium px-1"
                            />
                          ) : (
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={stockActual[product.id] !== undefined ? stockActual[product.id] : ""}
                              onChange={(e) => {
                                const val = e.target.value
                                onStockChange(product.id, val === "" ? 0 : parseInt(val, 10) || 0)
                              }}
                              onFocus={(e) => {
                                startEditing(product.id, "stockActual", (stockActual[product.id] ?? 0).toString())
                                // Seleccionar texto cuando se hace focus
                                setTimeout(() => e.target.select(), 0)
                              }}
                              placeholder="0"
                              className="h-10 w-16 text-center text-sm font-medium px-1"
                            />
                          )}
                        </div>
                      </>
                    )}

                    {/* Eliminar en modo pedido */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteProduct(product.id)}
                      className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ) : (

    if (draggedIndex === -1 || targetIndex === -1) return

    const newOrder = [...orderedProductIds]
    const [removed] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, removed)

    setDraggedProductId(null)
    setDragOverProductId(null)

    await onProductsOrderUpdate(newOrder)
  }, [onProductsOrderUpdate, draggedProductId, orderedProductIds])

  // Manejar creación de nuevo producto
  const handleCreateProduct = useCallback(async () => {
    if (!onCreateProduct || !newProductNombre.trim()) return

    const stockMinimo = parseInt(newProductStockMinimo, 10) || stockMinimoDefault
    const unidad = newProductUnidad.trim() || "U"

    const productId = await onCreateProduct(newProductNombre.trim(), stockMinimo, unidad)
    
    if (productId) {
      // Limpiar formulario
      setNewProductNombre("")
      setNewProductStockMinimo(stockMinimoDefault.toString())
      setNewProductUnidad("U")
      setIsCreatingProduct(false)
    }
  }, [onCreateProduct, newProductNombre, newProductStockMinimo, newProductUnidad, stockMinimoDefault])

  // Focus en el input cuando se activa la creación
  useEffect(() => {
    if (isCreatingProduct && newProductInputRef.current) {
      newProductInputRef.current.focus()
    }
  }, [isCreatingProduct])

  // Empty state
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
      {/* Header */}
      <div className="flex items-center justify-between gap-1 p-1.5 pb-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Productos</h3>
          <p className="text-[10px] text-muted-foreground">{products.length} productos</p>
        </div>
        {onCreateProduct && configMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreatingProduct(true)}
            className="h-7 text-xs px-2"
          >
            <PlusCircle className="h-3.5 w-3.5 mr-1" />
            Agregar
          </Button>
        )}
      </div>

      {/* Lista de productos - mobile first */}
      <div className="divide-y divide-border">
          {products.map((product) => {
            const isEditing = editingField?.id === product.id
            const editingThisField = isEditing ? editingField?.field : null
            const stockActualValue = stockActual[product.id] ?? 0
            const pedidoBase = calcularPedido(product.stockMinimo, stockActualValue)
            const ajuste = ajustesPedido[product.id] ?? 0
            const pedidoCalculado = Math.max(0, pedidoBase + ajuste)
            
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
                {/* Icono de reordenar */}
                {onProductsOrderUpdate && (
                  <div className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors">
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
                
                {mode === "pedido" ? (
                  // MODO PEDIDO - Layout compacto
                  <div className="flex items-center gap-2 flex-1">
                    {/* Nombre del producto */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{product.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">
                        mín: {product.stockMinimo}
                      </p>
                    </div>
                    
                    {/* Stock actual input */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Actual</span>
                      {editingThisField === "stockActual" ? (
                        <Input
                          ref={inputRef}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            if (!isNavigatingRef.current) {
                              const numValue = parseInt(inlineValue, 10) || 0
                              onStockChange(product.id, numValue)
                              setEditingField(null)
                              setInlineValue("")
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const numValue = parseInt(inlineValue, 10) || 0
                              onStockChange(product.id, numValue)
                              setEditingField(null)
                              setInlineValue("")
                            } else if (e.key === "Escape") {
                              setEditingField(null)
                              setInlineValue("")
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault()
                              navigateToNextRow(product.id, "stockActual", inlineValue, "down")
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault()
                              navigateToNextRow(product.id, "stockActual", inlineValue, "up")
                            }
                          }}
                          autoFocus
                          placeholder="0"
                          className="h-10 w-16 text-center text-sm font-medium px-1"
                        />
                      ) : (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={stockActual[product.id] !== undefined ? stockActual[product.id] : ""}
                          onChange={(e) => {
                            const val = e.target.value
                            onStockChange(product.id, val === "" ? 0 : parseInt(val, 10) || 0)
                          }}
                          onFocus={(e) => {
                            startEditing(product.id, "stockActual", (stockActual[product.id] ?? 0).toString())
                            // Seleccionar texto cuando se hace focus
                            setTimeout(() => e.target.select(), 0)
                          }}
                          placeholder="0"
                          className="h-10 w-16 text-center text-sm font-medium px-1"
                        />
                      )}
                    </div>
                    
                    {/* Pedido / Stock con botones +/- (según viewMode) */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">{viewMode === "pedir" ? "Pedir" : "Stock"}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            if (viewMode === "pedir") {
                              if (onAjustePedidoChange) {
                                const nuevoAjuste = (ajuste ?? 0) - 1
                                onAjustePedidoChange(product.id, nuevoAjuste)
                              } else {
                                // Fallback: si no hay función de ajuste, aumentar stock (comportamiento antiguo)
                                onStockChange(product.id, stockActualValue + 1)
                              }
                            } else {
                              // Stock mode: decrementar stock
                              const nuevoStock = Math.max(0, (stockActualValue || 0) - 1)
                              onStockChange(product.id, nuevoStock)
                            }
                          }}
                          disabled={viewMode === "pedir" ? (pedidoCalculado <= 0 && (!onAjustePedidoChange || (ajuste ?? 0) <= 0)) : (stockActualValue <= 0)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className={cn(
                          "font-bold text-lg w-8 text-center tabular-nums",
                          pedidoCalculado > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                        )}>
                          {pedidoCalculado}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            if (viewMode === "pedir") {
                              if (onAjustePedidoChange) {
                                const nuevoAjuste = (ajuste ?? 0) + 1
                                onAjustePedidoChange(product.id, nuevoAjuste)
                              } else {
                                // Fallback: si no hay función de ajuste, disminuir stock (comportamiento antiguo)
                                if (stockActualValue > 0) {
                                  onStockChange(product.id, stockActualValue - 1)
                                }
                              }
                            } else {
                              // Stock mode: incrementar stock
                              onStockChange(product.id, (stockActualValue || 0) + 1)
                            }
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Eliminar en modo pedido */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteProduct(product.id)}
                      className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  // MODO CONFIG - Layout compacto
                  <div className="flex items-center gap-2 flex-1">
                    {/* Nombre editable */}
                    <div className="flex-1 min-w-0">
                      {editingThisField === "nombre" ? (
                        <Input
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onBlur={() => handleInlineSave(product.id, "nombre", inlineValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInlineSave(product.id, "nombre", inlineValue)
                            if (e.key === "Escape") cancelEditing()
                          }}
                          autoFocus
                          className="h-7 text-xs"
                        />
                      ) : (
                        <p 
                          onClick={() => startEditing(product.id, "nombre", product.nombre)}
                          className="font-medium text-xs truncate cursor-pointer hover:bg-muted rounded px-1.5 py-0.5 -mx-1.5"
                        >
                          {product.nombre}
                        </p>
                      )}
                    </div>
                    
                    {/* Stock mínimo */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Mín</span>
                      {editingThisField === "stockMinimo" ? (
                        <Input
                          ref={inputRef}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            if (!isNavigatingRef.current) {
                              handleInlineSave(product.id, "stockMinimo", inlineValue)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleInlineSave(product.id, "stockMinimo", inlineValue)
                            } else if (e.key === "Escape") {
                              cancelEditing()
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault()
                              navigateToNextRow(product.id, "stockMinimo", inlineValue, "down")
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault()
                              navigateToNextRow(product.id, "stockMinimo", inlineValue, "up")
                            }
                          }}
                          autoFocus
                          className="h-10 w-16 text-center text-sm font-medium"
                        />
                      ) : (
                        <button
                          onClick={() => startEditing(product.id, "stockMinimo", product.stockMinimo.toString())}
                          className="h-10 w-16 text-center text-sm font-medium hover:bg-muted active:bg-muted/80 rounded-md transition-colors px-2 py-1.5"
                        >
                          {product.stockMinimo}
                        </button>
                      )}
                    </div>
                    
                    {/* Unidad */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Unid</span>
                      {editingThisField === "unidad" ? (
                        <Input
                          ref={inputRef}
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            if (!isNavigatingRef.current) {
                              handleInlineSave(product.id, "unidad", inlineValue)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleInlineSave(product.id, "unidad", inlineValue)
                            } else if (e.key === "Escape") {
                              cancelEditing()
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault()
                              navigateToNextRow(product.id, "unidad", inlineValue, "down")
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault()
                              navigateToNextRow(product.id, "unidad", inlineValue, "up")
                            }
                          }}
                          autoFocus
                          placeholder="U"
                          className="h-10 w-16 text-center text-sm font-medium"
                        />
                      ) : (
                        <button
                          onClick={() => startEditing(product.id, "unidad", product.unidad || "U")}
                          className="h-10 w-16 text-center text-sm font-medium text-muted-foreground hover:bg-muted active:bg-muted/80 rounded-md transition-colors px-2 py-1.5"
                        >
                          {product.unidad || "U"}
                        </button>
                      )}
                    </div>
                    
                    {/* Eliminar */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteProduct(product.id)}
                      className="h-7 w-7 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
          
          {/* Formulario para agregar nuevo producto */}
          {isCreatingProduct && onCreateProduct && configMode && (
            <div className="px-2 py-2 flex items-center gap-2 border-t border-border bg-muted/30">
              <div className="flex-1 min-w-0">
                <Input
                  ref={newProductInputRef}
                  value={newProductNombre}
                  onChange={(e) => setNewProductNombre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateProduct()
                    } else if (e.key === "Escape") {
                      setIsCreatingProduct(false)
                      setNewProductNombre("")
                      setNewProductStockMinimo(stockMinimoDefault.toString())
                      setNewProductUnidad("U")
                    }
                  }}
                  placeholder="Nombre del producto"
                  className="h-7 text-xs"
                />
              </div>
              
              <div className="flex flex-col items-center shrink-0">
                <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Mín</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={newProductStockMinimo}
                  onChange={(e) => setNewProductStockMinimo(e.target.value)}
                  className="h-10 w-16 text-center text-sm font-medium"
                />
              </div>
              
              <div className="flex flex-col items-center shrink-0">
                <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Unid</span>
                <Input
                  value={newProductUnidad}
                  onChange={(e) => setNewProductUnidad(e.target.value)}
                  placeholder="U"
                  className="h-10 w-16 text-center text-sm font-medium"
                />
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCreateProduct}
                disabled={!newProductNombre.trim()}
                className="h-7 w-7 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsCreatingProduct(false)
                  setNewProductNombre("")
                  setNewProductStockMinimo(stockMinimoDefault.toString())
                  setNewProductUnidad("U")
                }}
                className="h-7 w-7 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
      </div>
    </div>
  )
}
