import type { Producto } from "./types"

export type ProductoLike = Partial<
  Pick<Producto, "modoCompra" | "cantidadPorPack" | "unidadBase" | "unidad" | "stockMinimo" | "stockMinimoUnits">
> & {
  stockActual?: number
  stockActualUnits?: number
}

export interface StockDisplay {
  units: number
  packs: number
  remainderUnits: number
  primaryLabel: string
  equivalenceLabel: string
  fullLabel: string
}

function sanitizeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function getCantidadPorPack(producto?: ProductoLike | null): number {
  if (!producto || producto.modoCompra !== "pack") {
    return 1
  }

  const cantidad = Number(producto.cantidadPorPack)
  if (!Number.isFinite(cantidad) || cantidad < 2) {
    return 1
  }

  return Math.floor(cantidad)
}

export function esModoPack(producto?: ProductoLike | null): boolean {
  return !!producto && producto.modoCompra === "pack" && getCantidadPorPack(producto) > 1
}

export function packsToUnits(packs: number, cantidadPorPack: number): number {
  return sanitizeInteger(packs) * Math.max(1, sanitizeInteger(cantidadPorPack))
}

export function unitsToPacks(units: number, cantidadPorPack: number): number {
  const normalizedUnits = sanitizeInteger(units)
  const normalizedPackSize = Math.max(1, sanitizeInteger(cantidadPorPack))

  if (normalizedUnits === 0) {
    return 0
  }

  return Math.ceil(normalizedUnits / normalizedPackSize)
}

export function getStockMinimoUnits(producto?: ProductoLike | null): number {
  if (!producto) return 0
  const value = producto.stockMinimoUnits ?? producto.stockMinimo ?? 0
  return sanitizeInteger(Number(value))
}

export function getStockActualUnits(producto?: ProductoLike | null): number {
  if (!producto) return 0
  const value = producto.stockActualUnits ?? producto.stockActual ?? 0
  return sanitizeInteger(Number(value))
}

export function normalizeStockMinimoInput(producto: ProductoLike, valorUI: number): number {
  if (esModoPack(producto)) {
    return packsToUnits(valorUI, getCantidadPorPack(producto))
  }

  return sanitizeInteger(valorUI)
}

export function normalizeStockActualInput(producto: ProductoLike, valorUI: number): number {
  if (esModoPack(producto)) {
    return packsToUnits(valorUI, getCantidadPorPack(producto))
  }

  return sanitizeInteger(valorUI)
}

export function formatStockForDisplay(producto: ProductoLike, units: number): StockDisplay {
  const normalizedUnits = sanitizeInteger(units)

  if (!esModoPack(producto)) {
    const primaryLabel = `${normalizedUnits} ${producto.unidadBase || producto.unidad || "unidades"}`
    return {
      units: normalizedUnits,
      packs: normalizedUnits,
      remainderUnits: 0,
      primaryLabel,
      equivalenceLabel: primaryLabel,
      fullLabel: primaryLabel,
    }
  }

  const cantidadPorPack = getCantidadPorPack(producto)
  const packs = Math.floor(normalizedUnits / cantidadPorPack)
  const remainderUnits = normalizedUnits % cantidadPorPack
  const unidadesLabel = producto.unidadBase || producto.unidad || "unidades"
  const packLabel = `${packs} pack${packs === 1 ? "" : "s"}`
  const remainderLabel =
    remainderUnits > 0
      ? `${remainderUnits} ${unidadesLabel}${remainderUnits === 1 ? "" : ""}`
      : ""
  const primaryLabel = remainderLabel ? `${packLabel} + ${remainderLabel}` : packLabel
  const equivalenceLabel = `${normalizedUnits} ${unidadesLabel}`

  return {
    units: normalizedUnits,
    packs,
    remainderUnits,
    primaryLabel,
    equivalenceLabel,
    fullLabel: `${primaryLabel} (${equivalenceLabel})`,
  }
}

export function unidadesToPacks(producto: ProductoLike, unidades: number): number {
  return unitsToPacks(unidades, getCantidadPorPack(producto))
}

export function packsToUnidades(producto: ProductoLike, packs: number): number {
  return packsToUnits(packs, getCantidadPorPack(producto))
}

export function calcularPedidoBaseEnPacks(producto: ProductoLike, pedidoEnUnidades: number): number {
  return unidadesToPacks(producto, pedidoEnUnidades)
}

export function unidadesToPacksFloor(producto: ProductoLike, unidades: number): number {
  const normalizedUnits = sanitizeInteger(unidades)
  const cantidadPorPack = getCantidadPorPack(producto)
  if (normalizedUnits === 0) return 0
  return Math.floor(normalizedUnits / cantidadPorPack)
}

export function unidadesSignedToPacksFloor(producto: ProductoLike, unidades: number): number {
  if (!Number.isFinite(unidades) || unidades === 0) return 0
  const sign = unidades >= 0 ? 1 : -1
  return unidadesToPacksFloor(producto, Math.abs(unidades)) * sign
}

export function packsSignedToUnidades(producto: ProductoLike, packs: number): number {
  if (!Number.isFinite(packs) || packs === 0) return 0
  const sign = packs >= 0 ? 1 : -1
  return packsToUnidades(producto, Math.abs(packs)) * sign
}
