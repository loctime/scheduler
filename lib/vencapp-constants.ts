export const VENCAPP_STATUS_COLORS = {
  danger: "#E24B4A",
  warn: "#BA7517",
  ok: "#3B6D11",
  empty: "#888780",
} as const

export const VENCAPP_CATEGORIES = ["Bebidas", "Insumos", "Limpieza", "Otro"] as const
export type VencAppCategory = (typeof VENCAPP_CATEGORIES)[number]

export const VENCAPP_ZONE_TYPES = ["estante", "heladera", "freezer", "sector"] as const
export type VencAppZoneType = (typeof VENCAPP_ZONE_TYPES)[number]

export const VENCAPP_DEFAULT_ZONE_SIZE = {
  width: 180,
  height: 120,
} as const

