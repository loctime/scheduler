"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Upload, Package, Minus, Plus, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { Producto } from "@/lib/types"

type TableMode = "config" | "pedido"

interface ProductosTableProps {
  products: Producto[]
  stockActual: Record<string, number>
  onStockChange: (productId: string, value: number) => void
  onUpdateProduct: (productId: string, field: string, value: string) => Promise<boolean>
  onDeleteProduct: (productId: string) => void
  onImport: () => void
  onProductsOrderUpdate?: (newOrder: string[]) => Promise<boolean>
  calcularPedido: (stockMinimo: number, stockActualValue: number | undefined) => number
  configMode?: boolean
}

export function ProductosTable({
  products,
  stockActual,
  onStockChange,
  onUpdateProduct,
  onDeleteProduct,
  onImport,
  onProductsOrderUpdate,
  calcularPedido,
  configMode = false,
}: ProductosTableProps) {
  // Sincronizar el modo con configMode del padre
  const mode: TableMode = configMode ? "config" : "pedido"
  const [editingField, setEditingField] = useState<{id: string, field: string} | null>(null)
  const [inlineValue, setInlineValue] = useState("")
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null)
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null)
  const isNavigatingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Seleccionar texto cuando cambia el campo editado o al navegar
  useEffect(() => {
    if (editingField && inputRef.current) {
      // Pequeño delay para asegurar que el input esté montado
      const timer = setTimeout(() => {
        inputRef.current?.select()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [editingField])

  const handleInlineSave = async (productId: string, field: string, value: string, keepEditing = false) => {
    const success = await onUpdateProduct(productId, field, value)
    if (success) {
      if (!keepEditing) {
        setEditingField(null)
        setInlineValue("")
      }
    }
    return success
  }

  const startEditing = (productId: string, field: string, currentValue: string) => {
    setEditingField({ id: productId, field })
    setInlineValue(currentValue)
  }

  const cancelEditing = () => {
    setEditingField(null)
    setInlineValue("")
  }

  const navigateToNextRow = (currentProductId: string, field: string, currentValue: string, direction: "up" | "down") => {
    const currentIndex = products.findIndex(p => p.id === currentProductId)
    if (currentIndex === -1) return

    // Marcar que estamos navegando para prevenir el onBlur
    isNavigatingRef.current = true

    // Guardar el valor actual (sin esperar, de forma asíncrona en segundo plano)
    if (field === "stockActual") {
      // Para stock actual, usar onStockChange directamente (sincrónico)
      const numValue = parseInt(currentValue, 10) || 0
      onStockChange(currentProductId, numValue)
    } else {
      // Para otros campos, guardar en segundo plano sin esperar
      handleInlineSave(currentProductId, field, currentValue, true).catch(() => {
        // Ignorar errores silenciosamente, el usuario ya navegó
      })
    }

    // Calcular el siguiente índice
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    
    if (nextIndex < 0 || nextIndex >= products.length) {
      // Si estamos en el límite, solo guardar y cerrar
      setEditingField(null)
      setInlineValue("")
      isNavigatingRef.current = false
      return
    }

    // Navegar al siguiente producto inmediatamente
    const nextProduct = products[nextIndex]
    let nextValue: string
    if (field === "stockMinimo") {
      nextValue = nextProduct.stockMinimo.toString()
    } else if (field === "stockActual") {
      nextValue = (stockActual[nextProduct.id] ?? 0).toString()
    } else {
      nextValue = nextProduct.unidad || "U"
    }
    
    // Cambiar inmediatamente para navegación instantánea
    setEditingField({ id: nextProduct.id, field })
    setInlineValue(nextValue)
    
    // Resetear la flag inmediatamente (sin setTimeout)
    requestAnimationFrame(() => {
      isNavigatingRef.current = false
    })
  }

  // Drag and drop handlers
  const orderedProductIds = products.map(p => p.id)

  const handleDragStart = useCallback((e: React.DragEvent, productId: string) => {
    if (!onProductsOrderUpdate) return
    setDraggedProductId(productId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", productId)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5"
    }
  }, [onProductsOrderUpdate])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedProductId(null)
    setDragOverProductId(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1"
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, productId: string) => {
    if (!onProductsOrderUpdate || !draggedProductId || draggedProductId === productId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverProductId(productId)
  }, [onProductsOrderUpdate, draggedProductId])

  const handleDragLeave = useCallback(() => {
    setDragOverProductId(null)
  }, [])

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
      </div>

      {/* Lista de productos - mobile first */}
      <div className="divide-y divide-border">
          {products.map((product) => {
            const isEditing = editingField?.id === product.id
            const editingThisField = isEditing ? editingField?.field : null
            const stockActualValue = stockActual[product.id] ?? 0
            const pedidoCalculado = calcularPedido(product.stockMinimo, stockActualValue)
            
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
                            onStockChange(product.id, stockActualValue + 1)
                          }}
                          disabled={pedidoCalculado <= 0}
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
                            if (stockActualValue > 0) {
                              onStockChange(product.id, stockActualValue - 1)
                            }
                          }}
                          disabled={stockActualValue <= 0}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
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
      </div>
    </div>
  )
}
