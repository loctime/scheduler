"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Productos</CardTitle>
          <CardDescription>Importa productos para comenzar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm mb-4">No hay productos en este pedido</p>
            <Button onClick={onImport} size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Importar Productos
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card">
      {/* Header con tabs de modo */}
      <CardHeader className="pb-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg">Productos</CardTitle>
            <CardDescription className="text-xs">{products.length} productos</CardDescription>
          </div>
          <div className="flex rounded-lg border border-border p-0.5 bg-muted/50 shrink-0">
            <button
              onClick={() => setMode("pedido")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                mode === "pedido"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Pedido</span>
            </button>
            <button
              onClick={() => setMode("config")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                mode === "config"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Config</span>
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-2">
        {/* Lista de productos - mobile first */}
        <div className="divide-y divide-border">
          {products.map((product) => {
            const isEditing = editingField?.id === product.id
            const editingThisField = isEditing ? editingField?.field : null
            const pedidoCalculado = calcularPedido(product.stockMinimo, stockActual[product.id])
            
            return (
              <div 
                key={product.id} 
                className={cn(
                  "px-4 py-3",
                  mode === "pedido" && pedidoCalculado > 0 && "bg-amber-500/10"
                )}
              >
                {mode === "pedido" ? (
                  // MODO PEDIDO - Layout móvil optimizado
                  <div className="flex items-center gap-3">
                    {/* Nombre del producto */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        Stock mín: {product.stockMinimo}
                      </p>
                    </div>
                    
                    {/* Stock actual input */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Actual</span>
                      <Input
                        type="number"
                        min="0"
                        value={stockActual[product.id] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value
                          onStockChange(product.id, val === "" ? 0 : parseInt(val, 10) || 0)
                        }}
                        placeholder="0"
                        className="h-9 w-14 text-center text-sm"
                      />
                    </div>
                    
                    {/* Pedido con botones +/- */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pedir</span>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            const currentStock = stockActual[product.id] ?? 0
                            onStockChange(product.id, currentStock + 1)
                          }}
                          disabled={pedidoCalculado <= 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className={cn(
                          "font-bold text-xl w-8 text-center tabular-nums",
                          pedidoCalculado > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                        )}>
                          {pedidoCalculado}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            const currentStock = stockActual[product.id] ?? 0
                            if (currentStock > 0) {
                              onStockChange(product.id, currentStock - 1)
                            }
                          }}
                          disabled={(stockActual[product.id] ?? 0) <= 0}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // MODO CONFIG - Layout móvil optimizado
                  <div className="flex items-center gap-3">
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
                          className="h-8 text-sm"
                        />
                      ) : (
                        <p 
                          onClick={() => startEditing(product.id, "nombre", product.nombre)}
                          className="font-medium text-sm truncate cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2"
                        >
                          {product.nombre}
                        </p>
                      )}
                    </div>
                    
                    {/* Stock mínimo */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Mín</span>
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
                          className="h-9 w-14 text-center text-sm"
                        />
                      ) : (
                        <button
                          onClick={() => startEditing(product.id, "stockMinimo", product.stockMinimo.toString())}
                          className="h-9 w-14 text-center text-sm font-medium hover:bg-muted rounded border border-transparent hover:border-border"
                        >
                          {product.stockMinimo}
                        </button>
                      )}
                    </div>
                    
                    {/* Unidad */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Unid</span>
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
                          className="h-9 w-14 text-center text-sm"
                        />
                      ) : (
                        <button
                          onClick={() => startEditing(product.id, "unidad", product.unidad || "")}
                          className="h-9 w-14 text-center text-sm text-muted-foreground hover:bg-muted rounded border border-transparent hover:border-border"
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
                      className="h-9 w-9 shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
