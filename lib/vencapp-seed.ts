import { collection, getDocs, limit, query, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { createLot, createVencAppProduct, createZone } from "@/lib/vencapp-firestore"
import type { Producto } from "@/lib/types"
import type { VencAppCategory, VencAppZoneType } from "@/lib/vencapp-constants"

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const DEFAULT_PRODUCTS: Array<{ nombre: string; category: VencAppCategory }> = [
  { nombre: "Agua Mineral 500ml", category: "Bebidas" },
  { nombre: "Jugo Naranja 1L", category: "Bebidas" },
  { nombre: "Detergente Limón", category: "Limpieza" },
  { nombre: "Lavandina", category: "Limpieza" },
  { nombre: "Servilletas", category: "Insumos" },
  { nombre: "Bolsa Residuo", category: "Insumos" },
]

const DEFAULT_ZONES: Array<{
  name: string
  type: VencAppZoneType
  x: number
  y: number
  width: number
  height: number
  parentId?: string | null
  key: string
}> = [
  { key: "heladera-1", name: "Heladera 1", type: "heladera", x: 40, y: 40, width: 200, height: 140 },
  { key: "freezer-1", name: "Freezer 1", type: "freezer", x: 270, y: 40, width: 200, height: 140 },
  { key: "estante-a", name: "Estante A", type: "estante", x: 40, y: 220, width: 220, height: 140 },
  { key: "deposito", name: "Depósito", type: "sector", x: 270, y: 220, width: 240, height: 180 },
]

const DEFAULT_SUBZONES: Array<{
  name: string
  type: VencAppZoneType
  x: number
  y: number
  width: number
  height: number
  parentKey: string
}> = [
  { parentKey: "heladera-1", name: "Estante superior", type: "estante", x: 30, y: 30, width: 180, height: 60 },
  { parentKey: "heladera-1", name: "Estante inferior", type: "estante", x: 30, y: 110, width: 180, height: 60 },
]

export async function seedVencAppIfEmpty(params: {
  ownerId: string
  userId: string
  productos: Producto[]
}) {
  if (!db) return

  const zonesQuery = query(
    collection(db, COLLECTIONS.WAREHOUSE_ZONES),
    where("ownerId", "==", params.ownerId),
    limit(1)
  )
  const lotsQuery = query(
    collection(db, COLLECTIONS.LOTS),
    where("ownerId", "==", params.ownerId),
    limit(1)
  )

  const [zonesSnap, lotsSnap] = await Promise.all([getDocs(zonesQuery), getDocs(lotsQuery)])
  if (!zonesSnap.empty || !lotsSnap.empty) return

  const products = [...params.productos]

  if (products.length < 6) {
    const missing = DEFAULT_PRODUCTS.slice(0, Math.max(0, 6 - products.length))
    for (const item of missing) {
      const created = await createVencAppProduct({
        nombre: item.nombre,
        category: item.category,
        ownerId: params.ownerId,
        userId: params.userId,
      })
      products.push({
        id: created.id,
        pedidoId: "vencapp",
        nombre: item.nombre,
        category: item.category,
        ownerId: params.ownerId,
        userId: params.userId,
      })
    }
  }

  const zoneIdByKey: Record<string, string> = {}

  for (const zone of DEFAULT_ZONES) {
    const created = await createZone({
      name: zone.name,
      type: zone.type,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      parentId: null,
      ownerId: params.ownerId,
      userId: params.userId,
    })
    zoneIdByKey[zone.key] = created.id
  }

  for (const subzone of DEFAULT_SUBZONES) {
    const parentId = zoneIdByKey[subzone.parentKey]
    if (!parentId) continue
    await createZone({
      name: subzone.name,
      type: subzone.type,
      x: subzone.x,
      y: subzone.y,
      width: subzone.width,
      height: subzone.height,
      parentId,
      ownerId: params.ownerId,
      userId: params.userId,
    })
  }

  const today = new Date()
  const expiryOffsets = [-2, 3, 10, 20, 45, 90]
  const zonesForLots = Object.values(zoneIdByKey)

  for (let index = 0; index < Math.min(products.length, 6); index += 1) {
    const product = products[index]
    const lotsForProduct = [expiryOffsets[index % expiryOffsets.length], expiryOffsets[(index + 2) % expiryOffsets.length]]
    for (let lotIndex = 0; lotIndex < lotsForProduct.length; lotIndex += 1) {
      const offset = lotsForProduct[lotIndex]
      await createLot({
        productId: product.id,
        quantity: 5 + lotIndex * 3,
        expiryDate: toISODate(addDays(today, offset)),
        locationId: zonesForLots[(index + lotIndex) % zonesForLots.length] ?? null,
        note: offset < 0 ? "Vencido" : undefined,
        ownerId: params.ownerId,
        userId: params.userId,
      })
    }
  }
}

