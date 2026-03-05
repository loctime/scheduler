"use client"

import { ProductosTable } from "./productos-table"
import type { Producto } from "@/lib/types"

export interface ProductosTabProps {
  products: Producto[]
  stockActual: Record<string, number>
  onStockChange: (productId: string, value: number) => void
  onUpdateProduct: (productId: string, field: string, value: string) => Promise<boolean>
  onDeleteProduct: (productId: string) => void
  onCreateProduct?: (
    nombre: string,
    stockMinimo?: number,
    unidad?: string,
    modoCompra?: "unidad" | "pack",
    cantidadPorPack?: number
  ) => Promise<string | null>
  onImport: () => void
  onProductsOrderUpdate?: (newOrder: string[]) => Promise<boolean>
  stockMinimoDefault?: number
}

export function ProductosTab({
  products,
  stockActual,
  onStockChange,
  onUpdateProduct,
  onDeleteProduct,
  onCreateProduct,
  onImport,
  onProductsOrderUpdate,
  stockMinimoDefault
}: ProductosTabProps) {
  return (
    <ProductosTable
      products={products}
      stockActual={stockActual}
      onStockChange={onStockChange}
      onUpdateProduct={onUpdateProduct}
      onDeleteProduct={onDeleteProduct}
      onCreateProduct={onCreateProduct}
      onImport={onImport}
      onProductsOrderUpdate={onProductsOrderUpdate}
      stockMinimoDefault={stockMinimoDefault}
    />
  )
}
