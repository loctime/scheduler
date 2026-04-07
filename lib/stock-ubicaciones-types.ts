export type StockUbicacion = {
  id: string
  ownerId: string
  catalogoId: string
  locationId: string
  nombre: string
  unidad: string
  pedidoId: string
  stockActual: number
  stockMinimo: number
  orden: number
  grupoCatalogoId?: string
  createdAt?: unknown
  updatedAt?: unknown
  updatedBy: string
}
