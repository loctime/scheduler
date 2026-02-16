/**
 * Helpers centralizados para conversión unidad ↔ pack.
 * Toda la lógica de conversión del sistema debe pasar por estas funciones.
 */
import type { Producto } from "./types"

/** Tipo mínimo requerido para conversiones (Producto o items de productosEnviados) */
export type ProductoLike = Partial<Pick<Producto, "modoCompra" | "cantidadPorPack" | "unidadBase" | "unidad">>

/**
 * Obtiene la cantidad de unidades por pack.
 * Si modoCompra !== "pack" → retorna 1 (tratado como unidad).
 */
export function getCantidadPorPack(product: ProductoLike): number {
  if (product.modoCompra !== "pack" || !product.cantidadPorPack || product.cantidadPorPack < 1) {
    return 1
  }
  return product.cantidadPorPack
}

/**
 * Convierte unidades a packs.
 * Usa Math.ceil (1.1 unidades = 2 packs si cantidadPorPack es 1).
 * Nunca retorna valores negativos.
 */
export function unidadesToPacks(product: ProductoLike, unidades: number): number {
  if (unidades <= 0) return 0
  const qty = getCantidadPorPack(product)
  return Math.max(0, Math.ceil(unidades / qty))
}

/**
 * Convierte packs a unidades.
 * packs * cantidadPorPack
 * Nunca retorna valores negativos.
 */
export function packsToUnidades(product: ProductoLike, packs: number): number {
  if (packs <= 0) return 0
  const qty = getCantidadPorPack(product)
  return Math.max(0, packs * qty)
}

/**
 * Calcula cuántos packs equivalen a un pedido dado en unidades.
 * Útil para obtener el pedido base en packs cuando se trabaja con ajustes en packs.
 */
export function calcularPedidoBaseEnPacks(product: ProductoLike, pedidoEnUnidades: number): number {
  return unidadesToPacks(product, pedidoEnUnidades)
}

/**
 * Convierte unidades a packs usando Math.floor (packs completos).
 * Útil para mostrar "X packs" cuando se tiene cantidad en unidades.
 */
export function unidadesToPacksFloor(product: ProductoLike, unidades: number): number {
  if (unidades <= 0) return 0
  const qty = getCantidadPorPack(product)
  return Math.max(0, Math.floor(unidades / qty))
}

/** Indica si el producto se compra por pack */
export function esModoPack(product: ProductoLike): boolean {
  return product.modoCompra === "pack" && getCantidadPorPack(product) > 1
}
