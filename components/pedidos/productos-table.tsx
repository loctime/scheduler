"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Upload, Package, ShoppingCart, Settings2, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Producto } from "@/lib/types"

type TableMode = "pedido" | "config"

interface ProductosTableProps {
  products: Producto[]
  stockActual: Record<string, number>
  onStockChange: (productId: string, value: number) => void
  onUpdateProduct: (productId: string, field: string, value: string) => Promise<boolean>
  onDeleteProduct: (productId: string) => void
  onImport: () => void
  calcularPedido: (stockMinimo: number, stockActualValue: number | undefined) => number
}

export function ProductosTable({
  products,
  stockActual,
  onStockChange,
  onUpdateProduct,
  onDeleteProduct,
  onImport,
  calcularPedido,
}: ProductosTableProps) {
  const [mode, setMode] = useState<TableMode>("pedido")
  const [editingField, setEditingField] = useState<{id: string, field: string} | null>(null)
  const [inlineValue, setInlineValue] = useState("")

  const handleInlineSave = async (productId: string, field: string, value: string) => {
    const success = await onUpdateProduct(productId, field, value)
    if (success) {
      setEditingField(null)
      setInlineValue("")
    }
  }

  const startEditing = (productId: string, field: string, currentValue: string) => {
    setEditingField({ id: productId, field })
    setInlineValue(currentValue)
  }

  const cancelEditing = () => {
    setEditingField(null)
    setInlineValue("")
  }

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
      {/* Header con tabs de modo */}
      <div className="flex items-center justify-between gap-1 p-1.5 pb-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Productos</h3>
          <p className="text-[10px] text-muted-foreground">{products.length} productos</p>
        </div>
          <div className="flex rounded-md border border-border p-0.5 bg-muted/50 shrink-0">
            <button
              onClick={() => setMode("pedido")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                mode === "pedido"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShoppingCart className="h-3 w-3" />
              <span className="hidden xs:inline">Pedido</span>
            </button>
            <button
              onClick={() => setMode("config")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                mode === "config"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Settings2 className="h-3 w-3" />
              <span className="hidden xs:inline">Config</span>
            </button>
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
                className={cn(
                  "px-2 py-2",
                  mode === "pedido" && pedidoCalculado > 0 && "bg-amber-500/10"
                )}
              >
                {mode === "pedido" ? (
                  // MODO PEDIDO - Layout compacto
                  <div className="flex items-center gap-2">
                    {/* Nombre del producto */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{product.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">
                        mín: {product.stockMinimo}
                      </p>
                    </div>
                    
                    {/* Stock actual input */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase">Actual</span>
                      <Input
                        type="number"
                        min="0"
                        value={stockActual[product.id] !== undefined ? stockActual[product.id] : ""}
                        onChange={(e) => {
                          const val = e.target.value
                          onStockChange(product.id, val === "" ? 0 : parseInt(val, 10) || 0)
                        }}
                        placeholder="0"
                        className="h-7 w-16 text-center text-xs px-1"
                      />
                    </div>
                    
                    {/* Pedido con botones +/- */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase">Pedir</span>
                      <div className="flex items-center">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            onStockChange(product.id, stockActualValue + 1)
                          }}
                          disabled={pedidoCalculado <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className={cn(
                          "font-bold text-base w-6 text-center tabular-nums",
                          pedidoCalculado > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                        )}>
                          {pedidoCalculado}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            if (stockActualValue > 0) {
                              onStockChange(product.id, stockActualValue - 1)
                            }
                          }}
                          disabled={stockActualValue <= 0}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // MODO CONFIG - Layout compacto
                  <div className="flex items-center gap-2">
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
                      <span className="text-[9px] text-muted-foreground uppercase">Mín</span>
                      {editingThisField === "stockMinimo" ? (
                        <Input
                          type="number"
                          min="0"
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onBlur={() => handleInlineSave(product.id, "stockMinimo", inlineValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInlineSave(product.id, "stockMinimo", inlineValue)
                            if (e.key === "Escape") cancelEditing()
                          }}
                          autoFocus
                          className="h-7 w-10 text-center text-xs"
                        />
                      ) : (
                        <button
                          onClick={() => startEditing(product.id, "stockMinimo", product.stockMinimo.toString())}
                          className="h-7 w-10 text-center text-xs font-medium hover:bg-muted rounded"
                        >
                          {product.stockMinimo}
                        </button>
                      )}
                    </div>
                    
                    {/* Unidad */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase">Unid</span>
                      {editingThisField === "unidad" ? (
                        <Input
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onBlur={() => handleInlineSave(product.id, "unidad", inlineValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInlineSave(product.id, "unidad", inlineValue)
                            if (e.key === "Escape") cancelEditing()
                          }}
                          autoFocus
                          placeholder="-"
                          className="h-7 w-10 text-center text-xs"
                        />
                      ) : (
                        <button
                          onClick={() => startEditing(product.id, "unidad", product.unidad || "")}
                          className="h-7 w-10 text-center text-xs text-muted-foreground hover:bg-muted rounded"
                        >
                          {product.unidad || "-"}
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
