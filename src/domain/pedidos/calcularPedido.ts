import type { AjustesPedido, ProductoPedido } from "./types"

export function calcularCantidadPedida(stockMinimo: number, stockActual?: number): number {
  const actual = stockActual ?? 0
  return Math.max(0, stockMinimo - actual)
}

export function aplicarAjusteCantidad(cantidadBase: number, ajuste?: number): number {
  const ajusteFinal = ajuste ?? 0
  return Math.max(0, cantidadBase + ajusteFinal)
}

export function calcularPedidoPorProducto(
  producto: ProductoPedido,
  stockActual: Record<string, number>,
  ajustes?: AjustesPedido
): number {
  const cantidadBase = calcularCantidadPedida(producto.stockMinimo, stockActual[producto.productoId])
  const ajuste = ajustes?.[producto.productoId]
  return aplicarAjusteCantidad(cantidadBase, ajuste)
}
