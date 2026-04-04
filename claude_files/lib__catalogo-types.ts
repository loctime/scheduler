export type CatalogoProducto = {
  id: string
  ownerId: string
  nombre: string
  unidad: string
  categoria?: string
  pedidoId: string
  stockMinimo: number
  orden: number
  activo: boolean
  createdAt?: unknown
  updatedAt?: unknown
  createdBy: string
}
