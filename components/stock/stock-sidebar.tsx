"use client"

import { useState } from "react"
import { 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Clock,
  ChevronDown,
  ChevronUp,
  Search
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Producto, StockMovimiento } from "@/lib/types"

interface StockSidebarProps {
  productos: Producto[]
  stockActual: Record<string, number>
  movimientos: StockMovimiento[]
  productosStockBajo: Producto[]
  loading?: boolean
}

export function StockSidebar({
  productos,
  stockActual,
  movimientos,
  productosStockBajo,
  loading,
}: StockSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [showMovimientos, setShowMovimientos] = useState(false)

  // Filtrar productos
  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Agrupar por pedido
  const productosPorPedido = productosFiltrados.reduce((acc, producto) => {
    const pedidoId = producto.pedidoId || "sin_pedido"
    if (!acc[pedidoId]) {
      acc[pedidoId] = []
    }
    acc[pedidoId].push(producto)
    return acc
  }, {} as Record<string, Producto[]>)

  if (loading) {
    return (
      <div className="flex flex-col h-full rounded-lg border border-border bg-card p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Inventario</h2>
          <Badge variant="secondary" className="ml-auto">
            {productos.length} productos
          </Badge>
        </div>

        {/* Alertas de stock bajo */}
        {productosStockBajo.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {productosStockBajo.length} producto{productosStockBajo.length > 1 ? "s" : ""} con stock bajo
            </span>
          </div>
        )}

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Lista de productos */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {productos.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No hay productos registrados
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Agregá productos desde la sección de Pedidos
              </p>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sin resultados para "{searchTerm}"
            </p>
          ) : (
            productosFiltrados.map((producto) => (
              <ProductoItem
                key={producto.id}
                producto={producto}
                cantidad={stockActual[producto.id] || 0}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Movimientos recientes */}
      <div className="border-t border-border">
        <button
          onClick={() => setShowMovimientos(!showMovimientos)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Últimos movimientos</span>
          </div>
          {showMovimientos ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showMovimientos && (
          <ScrollArea className="max-h-48 border-t border-border">
            <div className="p-2 space-y-1">
              {movimientos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Sin movimientos registrados
                </p>
              ) : (
                movimientos.slice(0, 10).map((mov) => (
                  <MovimientoItem key={mov.id} movimiento={mov} />
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}

function ProductoItem({ 
  producto, 
  cantidad 
}: { 
  producto: Producto
  cantidad: number 
}) {
  const esBajo = cantidad < producto.stockMinimo
  const esCritico = cantidad === 0

  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-lg",
      esCritico && "bg-destructive/10 border border-destructive/20",
      esBajo && !esCritico && "bg-amber-500/10 border border-amber-500/20",
      !esBajo && "bg-muted/50"
    )}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{producto.nombre}</p>
        <p className="text-xs text-muted-foreground">
          Mín: {producto.stockMinimo} {producto.unidad || "u"}
        </p>
      </div>
      <div className="text-right ml-2">
        <p className={cn(
          "text-lg font-bold",
          esCritico && "text-destructive",
          esBajo && !esCritico && "text-amber-600 dark:text-amber-400",
          !esBajo && "text-foreground"
        )}>
          {cantidad}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {producto.unidad || "u"}
        </p>
      </div>
    </div>
  )
}

function MovimientoItem({ movimiento }: { movimiento: StockMovimiento }) {
  const esEntrada = movimiento.tipo === "entrada"
  const fecha = movimiento.createdAt?.toDate?.() || new Date()

  return (
    <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
      {esEntrada ? (
        <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
      ) : (
        <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate">
          <span className={esEntrada ? "text-green-600" : "text-red-600"}>
            {esEntrada ? "+" : "-"}{movimiento.cantidad}
          </span>
          {" "}
          {movimiento.productoNombre || "Producto"}
        </p>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  )
}

