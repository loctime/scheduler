export type GrupoCatalogo = {
  id: string
  nombre: string
  destinoLocationId: string
  destinoNombre: string
  ownerId: string
  createdBy: string
  createdAt?: unknown
}

export type CatalogoProducto = {
  id: string
  ownerId: string
  nombre: string
  unidad: string
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
