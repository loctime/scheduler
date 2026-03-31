import type { Lot, Producto, WarehouseZone } from "@/lib/types"

export type VencAppStatus = "danger" | "warn" | "ok" | "empty"

export function daysBetween(dateA: Date, dateB: Date) {
  const msPerDay = 24 * 60 * 60 * 1000
  const start = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime()
  const end = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime()
  return Math.ceil((end - start) / msPerDay)
}

export function getLotDaysRemaining(expiryDate: string, today = new Date()) {
  const target = new Date(expiryDate)
  return daysBetween(today, target)
}

export function getLotStatus(expiryDate: string, today = new Date()): VencAppStatus {
  const remaining = getLotDaysRemaining(expiryDate, today)
  if (remaining <= 6) return "danger"
  if (remaining <= 30) return "warn"
  return "ok"
}

export function getWorstStatus(statuses: VencAppStatus[]): VencAppStatus {
  if (statuses.length === 0) return "empty"
  if (statuses.includes("danger")) return "danger"
  if (statuses.includes("warn")) return "warn"
  if (statuses.includes("ok")) return "ok"
  return "empty"
}

export function getProductStatus(productId: string, lots: Lot[], today = new Date()): VencAppStatus {
  const productLots = lots.filter((lot) => lot.productId === productId)
  if (productLots.length === 0) return "empty"
  return getWorstStatus(productLots.map((lot) => getLotStatus(lot.expiryDate, today)))
}

export function getNearestExpiry(productId: string, lots: Lot[]) {
  const productLots = lots.filter((lot) => lot.productId === productId)
  if (productLots.length === 0) return null
  return productLots
    .map((lot) => lot.expiryDate)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null
}

export function getZoneStatus(
  zoneId: string,
  zones: WarehouseZone[],
  lots: Lot[],
  today = new Date()
): VencAppStatus {
  const childZones = zones.filter((zone) => zone.parentId === zoneId)
  if (childZones.length > 0) {
    const childStatuses = childZones.map((child) => getZoneStatus(child.id, zones, lots, today))
    return getWorstStatus(childStatuses)
  }
  const zoneLots = lots.filter((lot) => lot.locationId === zoneId)
  if (zoneLots.length === 0) return "empty"
  return getWorstStatus(zoneLots.map((lot) => getLotStatus(lot.expiryDate, today)))
}

export function countLotsByStatus(lots: Lot[], today = new Date()) {
  return lots.reduce(
    (acc, lot) => {
      const status = getLotStatus(lot.expiryDate, today)
      if (status === "danger") acc.danger += 1
      if (status === "warn") acc.warn += 1
      if (status === "ok") acc.ok += 1
      return acc
    },
    { danger: 0, warn: 0, ok: 0 }
  )
}

export function getProductById(products: Producto[], productId: string) {
  return products.find((product) => product.id === productId) || null
}

