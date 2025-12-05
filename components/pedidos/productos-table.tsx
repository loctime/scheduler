"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Upload, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { Producto } from "@/lib/types"

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

  if (products.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          <CardDescription>Importa productos para comenzar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No hay productos en este pedido</p>
            <Button onClick={onImport}>
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
      <CardHeader>
        <CardTitle>Productos</CardTitle>
        <CardDescription>{products.length} productos en este pedido</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center w-24">Stock Mín.</TableHead>
                <TableHead className="text-center w-24">Stock Actual</TableHead>
                <TableHead className="text-center w-24">Pedido</TableHead>
                <TableHead className="text-center w-20">Unidad</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isEditing = editingField?.id === product.id
                const editingThisField = isEditing ? editingField?.field : null
                const pedidoCalculado = calcularPedido(product.stockMinimo, stockActual[product.id])
                
                return (
                  <TableRow 
                    key={product.id} 
                    className={pedidoCalculado > 0 ? "bg-amber-500/10" : ""}
                  >
                    {/* Nombre */}
                    <TableCell className="font-medium">
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
                          className="h-8"
                        />
                      ) : (
                        <div
                          onClick={() => startEditing(product.id, "nombre", product.nombre)}
                          className="cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2"
                        >
                          {product.nombre}
                        </div>
                      )}
                    </TableCell>
                    
                    {/* Stock Mínimo */}
                    <TableCell className="text-center">
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
                          className="h-8 w-16 mx-auto text-center"
                        />
                      ) : (
                        <div
                          onClick={() => startEditing(product.id, "stockMinimo", product.stockMinimo.toString())}
                          className="cursor-pointer hover:bg-muted rounded px-2 py-1 inline-block"
                        >
                          {product.stockMinimo}
                        </div>
                      )}
                    </TableCell>
                    
                    {/* Stock Actual */}
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="0"
                        value={stockActual[product.id] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value
                          onStockChange(product.id, val === "" ? 0 : parseInt(val, 10) || 0)
                        }}
                        placeholder="0"
                        className="h-8 w-16 mx-auto text-center"
                      />
                    </TableCell>
                    
                    {/* Pedido Calculado */}
                    <TableCell className="text-center">
                      <span className={cn(
                        "font-bold",
                        pedidoCalculado > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                      )}>
                        {pedidoCalculado}
                      </span>
                    </TableCell>
                    
                    {/* Unidad */}
                    <TableCell className="text-center text-muted-foreground">
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
                          placeholder="kg..."
                          className="h-8 w-14 mx-auto text-center"
                        />
                      ) : (
                        <div
                          onClick={() => startEditing(product.id, "unidad", product.unidad || "")}
                          className="cursor-pointer hover:bg-muted rounded px-2 py-1 inline-block min-w-[2rem]"
                        >
                          {product.unidad || "-"}
                        </div>
                      )}
                    </TableCell>
                    
                    {/* Acciones */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteProduct(product.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

