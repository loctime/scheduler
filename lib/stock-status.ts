import { getStockMinimoUnits, type ProductoLike } from "./unidades-utils"

export type StockStatus = "OK" | "LOW" | "CRITICAL"

export interface StockStatusInput extends ProductoLike {
  id?: string
}

export function getStockStatus(producto: StockStatusInput, stockActualUnits: number): StockStatus {
  const stockMinimoUnits = getStockMinimoUnits(producto)
  const actual = Math.max(0, Math.floor(stockActualUnits))

  if (stockMinimoUnits <= 0) {
    return "OK"
  }

  if (actual <= 0) {
    return "CRITICAL"
  }

  if (actual < stockMinimoUnits) {
    return "LOW"
  }

  return "OK"
}
