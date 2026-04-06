export interface GrupoCatalogo {
  id: string
  nombre: string
  ownerId: string
  createdBy: string
  createdAt?: unknown
  despachadores: Array<{ locationId: string; locationName: string }>
  diasEnvio?: number[]
}

export type GrupoCatalogoUI = GrupoCatalogo & {
  productosIds: string[]
}

export type UbicacionCatalogo = {
  locationId: string
  locationName: string
}

export type CatalogoProducto = {
  id: string
  ownerId: string
  nombre: string
  unidad: string
  unidadAlternativa?: string
  factorConversion?: number
  proveedor?: string
  categoria?: string
  pedidoId: string
  /** Grupo del catálogo (Firestore `grupos_catalogo`); sustituye al selector basado en pedidos. */
  grupoCatalogoId?: string
  stockMinimo: number
  orden: number
  activo: boolean
  createdAt?: unknown
  updatedAt?: unknown
  createdBy: string
}
